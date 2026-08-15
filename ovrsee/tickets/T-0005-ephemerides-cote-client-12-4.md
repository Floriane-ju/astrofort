---
{
  "id": "T-0005",
  "titre": "Éphémérides côté client §12.4 et fenêtre nocturne §8.1",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": ["lot-0", "moteur"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

Toutes les positions astronomiques se calculent dans le navigateur, sans appel réseau
(option C de §12.4 : séries analytiques portées en JS). `astronomy-engine` fournit
VSOP87/ELP tronqués, la réfraction et les recherches de lever/coucher. La façade expose
exactement ce que le PRD consomme, rien de plus.

La réfraction de Bennett est indispensable près de l'horizon : sans elle, les instants
de lever et de coucher sont faux de plusieurs minutes.

## Critères d'acceptation

- [ ] Aucune requête réseau n'est émise lors d'un calcul de crépuscule
- [ ] L'écart sur un instant de lever reste inférieur à 2 minutes de temps
- [ ] Le décalage du midi solaire vrai vaut +26,8 min au site 46,391° N / 6,697° E
- [ ] Les seuils du site sont annoncés : circumpolaire δ > +43,6°, imagerie impossible δ < −13,6°
- [ ] Hors du domaine de validité des séries, les corps du système solaire sont masqués
      avec la cause nommée, jamais extrapolés en silence
