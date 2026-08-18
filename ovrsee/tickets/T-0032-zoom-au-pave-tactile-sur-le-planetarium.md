---
{
  "id": "T-0032",
  "type": "epic",
  "titre": "Zoom au pavé tactile sur le planétarium",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
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

Le pincement à deux doigts au-dessus du planétarium zoome toute l'interface au
lieu du seul champ de la scène. Trois causes distinctes se cumulent : un
écouteur `wheel` passif posé par React, un facteur de zoom pensé pour un cran
de molette et non pour un geste continu, et les événements `gesture*` propres à
Safari. Cet epic les regroupe : le geste n'est correct que lorsque les trois
sont traités.

## Critères d'acceptation

- [ ] Sur Chrome et Safari macOS, un pincement au-dessus du planétarium ne
      change que `fovDeg` — jamais la taille de l'interface.
- [ ] Le pincement est continu, la molette garde son cran.
- [ ] La molette de souris ne régresse pas.
