---
{
  "id": "T-0008",
  "titre": "Matrice de dégradation §12.5 et écran de vérification du Lot 0",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["lot-0", "offline", "ui"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

§12.5 est un contrat visible dans l'interface, pas une note interne : chaque fonction
indisponible hors réseau est listée avec sa dégradation exacte. L'écran de vérification
est le livrable constatable du Lot 0 — sans design, il sert à prouver que le socle tient.

## Critères d'acceptation

- [ ] La matrice de dégradation est consultable et distingue le noyau intégralement
      hors-ligne de ce qui tombe
- [ ] `mode_reseau` reflète l'état réel et bascule à la perte de réseau
- [ ] Un écran saisit lieu et date, et affiche crépuscules, midi solaire vrai, fond de ciel,
      état de persistance et intégrité des catalogues
- [ ] Chaque nombre affiché s'y déplie vers sa formule et ses constantes sources
