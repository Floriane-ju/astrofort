---
{
  "id": "T-0022",
  "titre": "Trier l’étoile avant de calculer son arc",
  "epic": "T-0021",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "performance",
    "rendu",
    "file"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-17",
  "plan": "2026-08-15-tickets-cout-du-file-incruste-dans-le-cadre.md"
}
---

## Contexte

Dans `dessineCouche` (`src/ui/dessine-champ.ts:162`), l'ordre des opérations fait
payer le calcul le plus cher à des étoiles qui seront ensuite jetées :

1. ligne 165 — `arcEtoile` construit la polyligne complète, jusqu'à 481
   projections ;
2. lignes 171-180 — `magnitudeLimitePrevisu` recalcule la profondeur avec la pose
   par pixel réelle ;
3. ligne 182 — `if (opacite < OPACITE_MIN) return`.

Toute étoile trop faible pour laisser une trace a donc payé son arc entier avant
d'être écartée. Or `OPACITE_MIN` existe précisément parce que ces étoiles sont
nombreuses : le commentaire de la constante (`dessine-champ.ts:45`) parle de
« milliers de traces sous-liminaires ». En filé long, c'est le gros du semis.

Le tri ne dépend pas de l'arc : `poseParPixelS` a besoin de la déclinaison, tirée
de `z`, disponible dès l'entrée du visiteur de `selectionne`.

C'est le plus petit diff de l'epic pour un des plus gros gains : à faire en
premier avec T-0025.

## Critères d'acceptation

- [x] `profondeurTrace` et `opaciteEtoile` sont calculés **avant** l'appel à
      `arcEtoile` ; aucune étoile sous `OPACITE_MIN` ne déclenche de construction
      d'arc
- [x] L'image produite est identique à celle d'avant le changement — comparaison
      pixel pour pixel sur au moins un cas de filé long et un cas d'aperçu de
      champ
- [x] Les compteurs remontés au panneau (`etoilesReelles`, `etoilesGenerees`,
      `arcsTronques`) sont inchangés à réglages égaux
- [x] Le nombre d'appels à `arcEtoile` évités est chiffré sur le cas de mesure de
      T-0021

## Réalisation

Trois lignes déplacées dans `dessineCouche` : la profondeur de trace et l'opacité
passent avant `arcEtoile`, qui ne reste plus que pour les étoiles retenues. Le
tri ne dépend que de `z`, disponible dès l'entrée du visiteur — aucun calcul
n'a été dupliqué pour l'obtenir.

Identité de l'image **mesurée**, pas déduite : `scripts/bench-incrustation.ts
--empreinte` condense tous les ordres de peinture (positions au millième de
pixel, couleurs, opacités, largeurs de trait) en une empreinte FNV. Les trois cas
de mesure rendent la même empreinte avant et après — `19c61c6b`, `6b835733`,
`7f741289`. Les compteurs du panneau sont identiques par construction : le tri
qu'ils suivaient existait déjà, il a seulement changé de place.

Gain chiffré (T-0021) : 752 → 609 ms sur le pire cas à 10 mm f/2,8, 6 313 arcs
évités sur 26 057 étoiles lues. À 50 mm f/1,4 le gain est nul — la profondeur
atteinte y rend presque toutes les étoiles traçables, et le tri n'écarte plus
rien. C'est le résultat attendu : ce ticket ne coupe que ce qui était sous le
seuil.
