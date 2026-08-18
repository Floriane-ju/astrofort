---
{
  "id": "T-0036",
  "titre": "Le défilement à deux doigts promène la visée",
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

T-0029 et T-0030 traitent le pavé comme une molette : tout `wheel` zoome. C'est
le geste attendu d'une souris, pas d'un pavé tactile, où les deux doigts qui
défilent servent à se déplacer dans la scène — c'est la convention de tout
canevas cartographique.

Le navigateur ne dit pas d'où vient un `wheel`. Trois signaux le déduisent, du
plus sûr au moins sûr : `ctrlKey` pour le pincement, `deltaMode` en lignes pour
la molette de Firefox, `wheelDeltaY` multiple de 120 pour le cran de molette de
WebKit et Blink. Reste un cas sans signal — Firefox en pixels — où seule
l'allure du delta tranche : gros, entier, strictement vertical.

## Critères d'acceptation

- [ ] Au pavé, un défilement à deux doigts déplace azimut et hauteur ; le ciel
      suit les doigts, comme au glisser.
- [ ] Au pavé, un pincement change `fovDeg` et rien d'autre.
- [ ] À la souris, la molette zoome comme avant.
- [ ] La hauteur reste bornée à ±90°, l'azimut reste ramené dans [0, 360[.
