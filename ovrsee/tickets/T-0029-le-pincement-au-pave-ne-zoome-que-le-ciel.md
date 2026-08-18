---
{
  "id": "T-0029",
  "titre": "Le pincement au pavé ne zoome que le ciel",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0032",
  "tags": [
    "ui",
    "planetarium"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-tickets-le-pincement-au-pave-tactile-ne-doit-zoomer-que-le-c.md"
}
---

## Contexte

Sur macOS, un pincement à deux doigts au-dessus du planétarium zoome **toute
l'interface** — le zoom de page du navigateur — au lieu de ne changer que le
champ de la scène. La molette de souris, elle, se comporte correctement.

Le zoom est branché par `onWheel={surMolette}` (`src/ui/Planetarium.tsx`).
React attache `wheel` sur le conteneur racine en écouteur **passif** :
`preventDefault()` y est sans effet. Or Chrome et Firefox traduisent le
pincement du pavé en `wheel` avec `ctrlKey: true` ; sans `preventDefault()`,
le navigateur applique son zoom de page par-dessus le nôtre.

`.planetarium` a déjà `touch-action: none` (`src/ui/styles.css`) : ça couvre
le tactile, pas le pavé, qui passe par `wheel`.

Piste : poser l'écouteur à la main sur la ref `canevas` dans un `useEffect` —
`addEventListener('wheel', handler, { passive: false })` — et appeler
`preventDefault()`.

## Critères d'acceptation

- [ ] Le pincement à deux doigts au-dessus du planétarium change `fovDeg` et
      rien d'autre : le reste de l'interface garde sa taille.
- [ ] Le zoom de page du navigateur ne se déclenche jamais depuis la scène,
      vérifié sur Chrome macOS.
- [ ] La molette de souris zoome comme avant, sans faire défiler la page.
- [ ] Hors du canevas, pincement et molette gardent leur comportement natif.
