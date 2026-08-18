---
{
  "id": "T-0030",
  "titre": "Le pincement zoome en continu, la molette par crans",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "xs",
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

`surMolette` (`src/ui/Planetarium.tsx`) ne lit que le **signe** de `deltaY` et
applique un facteur fixe `FACTEUR_ZOOM_MOLETTE`. C'est juste pour un cran de
molette, faux pour un pincement, dont l'amplitude est continue : un geste lent
saute d'un cran entier, un geste ample n'en fait qu'un.

Dépend de T-0029, qui distingue déjà les deux sources (`ctrlKey`).

## Critères d'acceptation

- [ ] Un pincement lent produit une variation de champ progressive,
      proportionnelle à l'amplitude du geste, sans saut visible.
- [ ] La molette — `ctrlKey` faux — garde son cran actuel
      `FACTEUR_ZOOM_MOLETTE`.
- [ ] Le champ reste borné par `bornesZoom(props.gaiaCharge)` dans les deux
      cas.
