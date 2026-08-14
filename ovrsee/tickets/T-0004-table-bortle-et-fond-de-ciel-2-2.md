---
{
  "id": "T-0004",
  "titre": "Table Bortle et fond de ciel §2.2",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "s",
  "tags": ["lot-0", "registre"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

Le modèle linéaire du socle initial donnait 23,4 mag/arcsec² à Bortle 1, valeur
physiquement impossible, et une magnitude d'écart à Bortle 8. Il est remplacé par une
table de 9 lignes, interpolable mais jamais extrapolable. Consommée par §6.3, §7.1, §8.4.

## Critères d'acceptation

- [ ] Bortle 4,5 donne SB = 20,95 mag/arcsec² et m_lim_oeil = 6,05
- [ ] Un Bortle hors [1 ; 9] est refusé, sans extrapolation
- [ ] Un SQM mesuré prévaut toujours sur le Bortle, et `source_sb` l'indique
- [ ] Un SQM saisi à 23,0 déclenche une demande de confirmation, pas un rejet muet
