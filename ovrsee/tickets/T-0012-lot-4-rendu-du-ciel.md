---
{
  "id": "T-0012",
  "titre": "Lot 4 — Rendu du ciel : planétarium animé et cadre matériel",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "xl",
  "tags": ["lot-4", "rendu"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§3.1 pipeline à deux horloges · §3.2 curseur temporel · §3.3 moteur de rendu unifié ·
§3.4 constellations, frontières, astérismes · §3.5 superposition du cadre matériel ·
paquet Gaia différé. Dépend des Lots 0 à 2 pour les fiches ouvertes au clic.

Spectaculaire mais sans décision de capture propre : le placer avant le Lot 3 produirait
une belle application inutile sur le terrain.

## Critères d'acceptation

- [ ] À 120 000 étoiles et un défilement ×60, la fréquence reste au-dessus de 50 Hz, et
      ajouter des étoiles ne la dégrade pas mesurablement
- [ ] Le curseur de vitesse est couplé au zoom : un zoom à 5° ramène le facteur sous ×374
- [ ] Les frontières IAU sont précessées de B1875 vers l'époque affichée
- [ ] Les astérismes forment une couche distincte des figures IAU
- [ ] Un même pointage en MODE_PLANETARIUM et en MODE_CADRE coïncide, sans divergence
      systématique — une seule implémentation de la projection
- [ ] Le cadre matériel superposé est cliquable vers les moteurs du Lot 2
