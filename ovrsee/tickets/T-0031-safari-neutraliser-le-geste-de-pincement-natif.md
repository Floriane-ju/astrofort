---
{
  "id": "T-0031",
  "titre": "Safari : neutraliser le geste de pincement natif",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "xs",
  "epic": "T-0032",
  "tags": [
    "ui",
    "planetarium",
    "safari"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-tickets-le-pincement-au-pave-tactile-ne-doit-zoomer-que-le-c.md"
}
---

## Contexte

Safari macOS n'émet pas seulement un `wheel` avec `ctrlKey` pour le pincement :
il émet aussi les événements non standard `gesturestart`, `gesturechange` et
`gestureend`, qui zooment la page de leur côté. T-0029 ne les couvre pas — le
pincement resterait cassé sur Safari alors qu'il serait réparé ailleurs.

Ces événements n'existent pas dans les types du DOM : les typer localement,
pas de `any` implicite.

## Critères d'acceptation

- [ ] `gesturestart`, `gesturechange` et `gestureend` sont interceptés sur le
      canevas et ne provoquent aucun zoom de page dans Safari macOS.
- [ ] Le zoom du planétarium au pincement fonctionne dans Safari comme dans
      Chrome.
- [ ] `pnpm build` passe sans avertissement TypeScript.
