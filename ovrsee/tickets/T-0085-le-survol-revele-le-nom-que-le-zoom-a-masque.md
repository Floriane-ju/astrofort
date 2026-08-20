---
{
  "id": "T-0085",
  "titre": "Le survol révèle le nom que le zoom a masqué",
  "colonne": "pret",
  "priorite": "moyenne",
  "epic": "T-0083",
  "tags": [
    "prd",
    "planetarium",
    "labels"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": null
}
---

## Contexte

§3.4 impose une hiérarchie de labels par zoom — au-delà de 40° de champ, seuls les noms de
constellations ; sous 10°, les noms propres et les objets du ciel profond — et un plafond de
25 labels avec anti-chevauchement. La règle est nécessaire : sans elle, un champ dense est
illisible. Sa conséquence est qu'un élément parfaitement identifié par le catalogue n'a
aucun nom à l'écran, et rien ne permet de le lui demander.

`decritCible()` (`src/ui/planetarium-selection.ts`) sait déjà nommer tout ce que la scène
porte — objet, corps, étoile nommée, étoile sans désignation — mais seulement au clic, ce
qui ouvre l'onglet Cible et change l'état de l'application.

Ce ticket remplace la mise en évidence de constellation au survol qu'appelait §3.4 : elle
contredisait §11.2, qui interdit qu'une information critique dépende du survol. Révéler un
label déjà calculé mais masqué par le seuil de zoom n'est pas une information critique — c'est
une aide à la lecture, et le clic reste le chemin complet.

## Critères d'acceptation

- [ ] Survoler un élément de la scène dont le label n'est pas affiché au champ courant révèle
      son nom, sans changer l'onglet ni l'état de la scène.
- [ ] Le label révélé emprunte le même libellé que le clic : aucune désignation n'est
      inventée, une donnée absente se dit absente.
- [ ] Le label révélé respecte l'anti-chevauchement de §3.4 et n'entre pas dans le plafond
      de 25 : c'est un label transitoire, pas un label de plus.
- [ ] Aucune information n'est accessible AU SEUL survol : tout ce que le survol montre reste
      atteignable au clic (§11.2).
- [ ] Un élément dont le label est déjà affiché ne produit pas de doublon au survol.
