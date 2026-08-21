import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

// §13.1, §13.3 — l'application n'a pas de serveur applicatif et ne transmet ni profil, ni site,
// ni plan de séance. `connect-src 'self'` fait tenir cette promesse par le navigateur à
// l'exécution : une dépendance qui appellerait un tiers demain est refusée sans qu'une revue de
// code ait à la rattraper.
//
// La politique voyage dans `<meta>` plutôt que dans un en-tête parce que le dépôt ne fixe aucune
// cible d'hébergement (§13.1 : pas de serveur) : un `<meta>` part avec l'artefact et vaut sur
// n'importe quel hébergeur statique. Contrepartie assumée : `frame-ancestors` et `report-uri`
// sont ignorés en `<meta>` — le jour où un hébergeur est choisi, la même liste passe en en-tête
// et gagne l'anti-encadrement.
const CSP_COMMUNE = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  // React pose des styles en attribut (`style={{…}}`) et Vite injecte la feuille par script :
  // les deux exigent l'inline. Sans effet sur §13.3, qui se joue sur `connect-src`.
  "style-src 'self' 'unsafe-inline'",
]

export const CSP_PRODUCTION = [...CSP_COMMUNE, "script-src 'self'", "connect-src 'self'"].join('; ')

// Assouplissements réservés au serveur de développement, jamais construits : Vite injecte le
// préambule de rafraîchissement React en script inline, et le rechargement à chaud ouvre une
// WebSocket vers l'hôte de développement.
export const CSP_DEVELOPPEMENT = [
  ...CSP_COMMUNE,
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
].join('; ')

export function politiqueDeSecurite(): Plugin {
  return {
    name: 'astrofort-csp',
    transformIndexHtml: {
      order: 'pre',
      handler: (_html, ctx) => [
        {
          tag: 'meta',
          // En tête du `<head>` : une politique en `<meta>` ne couvre que ce qui la suit.
          injectTo: 'head-prepend',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: ctx.server === undefined ? CSP_PRODUCTION : CSP_DEVELOPPEMENT,
          },
        },
      ],
    },
  }
}


// §12.1 — coquille web progressive. Le précache couvre le code, les styles et les
// paquets de données obligatoires : sans eux, un démarrage hors réseau donne une
// application vide.
export default defineConfig({
  server: { port: 5173 },
  plugins: [
    politiqueDeSecurite(),
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png}', 'data/**/*.{bin,json}'],
        // Les paquets binaires dépassent la limite par défaut de 2 Mo (§12.2 : HYG ≈ 1,7 Mo,
        // OpenNGC ≈ 1,2 Mo, paquet Gaia différé ≈ 12 Mo).
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
      manifest: {
        name: 'Astrofort — planétarium et plan de session',
        short_name: 'Astrofort',
        description:
          "Planétarium orienté observation et capture : lieu, date et matériel produisent un plan de session exécutable.",
        theme_color: '#000000',
        background_color: '#000000',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        // §12.1 — sans 192 et 512, le navigateur ne propose pas l'installation ; la
        // variante `maskable` évite que le lanceur rogne le viseur (§11.1, `pnpm icones:build`).
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icones/icone-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
