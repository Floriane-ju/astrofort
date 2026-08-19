---
{
  "id": "T-0076",
  "titre": "L'application est réellement installable",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "audit",
    "pwa",
    "design",
    "mode-nuit"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "epic": "T-0074",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **B2** de l'audit du 19 août 2026.

`vite.config.ts:20-28` déclare `name`, `short_name`, `description`, `theme_color`,
`background_color`, `display: 'standalone'`, `start_url` — **et aucun `icons`**. `public/` ne
contient que `data/`. `index.html` n'a ni `<link rel="icon">` ni `apple-touch-icon`.

Sans icône de 192 et de 512 pixels, Chrome ne propose pas l'installation. §12.1 pose
l'installabilité comme « deux fois utile », dont le second usage est décisif : « l'installation
est un critère d'octroi du stockage persistant (§12.3) ». Le critère d'acceptation §12.1 sur
l'usage en fenêtre dédiée ne peut donc pas être tenu aujourd'hui, et le levier de §12.3 est perdu
avec lui.

Une contrainte tient tout le ticket, et elle vient de §11.1 : une icône claire dans un lanceur ou
un dock ruine l'adaptation à l'obscurité aussi sûrement qu'une modale blanche. « Aucune surface
blanche, aucun flash de transition » ne s'arrête pas à la fenêtre de l'application. Les icônes se
composent en rouge sur noir, comme le reste.

## Critères d'acceptation

- [x] Des icônes 192×192 et 512×512 existent, plus une variante `maskable`, plus un favicon et une
      `apple-touch-icon`
- [x] Elles sont composées en rouge sur noir : aucune surface blanche, aucune composante verte ou
      bleue — la même règle §11.1 que l'interface
- [x] Elles sont déclarées dans `manifest.icons` (`vite.config.ts`) et référencées depuis
      `index.html`
- [x] Elles sont couvertes par le précache du service worker, donc présentes hors réseau
- [x] Les fichiers sont versionnés dans `public/` : un clone démarre et s'installe sans réseau
      (§12.2)
- [ ] Chrome propose l'installation, et l'application s'ouvre en fenêtre dédiée sans barre
      d'adresse

## Réalisation

`scripts/build-icones.ts` (`pnpm icones:build`) dessine le viseur en rouge sur noir et encode les
PNG sans dépendance (zlib de Node) : une image importée d'ailleurs pourrait porter du blanc ou du
bleu sans que rien ne le signale, un tracé le garantit par construction. Sorties versionnées dans
`public/icones/` — 32 (favicon), 180 (apple-touch), 192, 512, 512 maskable.

`vite.config.ts` déclare les trois entrées `manifest.icons` (`any` ×2, `maskable`) et étend le
précache aux `png` ; `index.html` référence favicon, apple-touch-icon et `theme-color: #000000`.

Vérifié : `pnpm build` → manifeste avec les icônes, précache à 18 entrées incluant les 5 PNG ;
`pnpm preview` → 200 sur le manifeste et chaque icône ; `tests/icones.test.ts` (4 cas) contrôle
les tailles exigées, l'absence de composante verte ou bleue, la zone sûre du maskable et la
correspondance entre fichiers versionnés et tracé. `pnpm typecheck` propre, 489 tests passent.

Reste manuel : confirmer l'invite d'installation de Chrome et l'ouverture en fenêtre dédiée.
