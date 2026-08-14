---
{
  "id": "T-0013",
  "titre": "Lot 5 — Grand champ et filé d'étoiles",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "l",
  "tags": ["lot-5", "rendu"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§9.1 pose max par déclinaison · §9.2 prévisualisation de champ · §9.3 prévisualisation du
filé · §9.4 logistique de séquence. Dépend du Lot 4 : réutilise intégralement son moteur
de projection et son catalogue. Le développer avant imposerait de coder deux fois la
projection, ce que §3.3 interdit explicitement.

## Critères d'acceptation

- [ ] La pose max NPF dépend de la déclinaison de la cible, pas d'une règle uniforme
- [ ] La prévisualisation de filé trace des arcs sur les positions réelles du catalogue,
      pôle exact compris
- [ ] La logistique de séquence chiffre nombre de poses, volume de stockage et batteries,
      facteur de froid appliqué
