import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// §12.1 — coquille web progressive. Le précache couvre le code, les styles et les
// paquets de données obligatoires : sans eux, un démarrage hors réseau donne une
// application vide.
export default defineConfig({
  server: { port: 5173 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}', 'data/**/*.{bin,json}'],
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
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
