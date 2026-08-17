---
{
  "id": "T-0024",
  "titre": "Pas d’échantillonnage d’arc adaptatif, en pixels",
  "epic": "T-0021",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
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

`arcEtoile` (`src/core/file-etoiles.ts:148`) échantillonne l'arc à pas constant
**en angle horaire** :

```
const pas = Math.max(1, Math.ceil(balayageDeg / K('PAS_ANGLE_HORAIRE_FILE_DEG')))
```

À 480 min — le maximum du curseur (`src/ui/PanneauFile.tsx:353`) — le balayage
vaut 120°, donc 481 positions calculées et projetées **pour chaque étoile**, quel
que soit son arc. Une étoile à un degré du pôle décrit une trace de quelques
pixels : elle paie les mêmes 481 pas qu'une étoile à l'équateur céleste qui
traverse tout le cadre.

Le pas devrait suivre la longueur de l'arc **projeté**, en pixels : c'est là que
se juge la fidélité de la polyligne à la conique. §9.3 impose un pas
« ≤ 0,25° d'angle horaire » — c'est un plafond, pas un plancher : l'affiner près
du pôle reste conforme, l'élargir ne l'est pas. `PAS_ANGLE_HORAIRE_FILE_DEG`
reste donc la borne supérieure.

Précédent dans le dépôt : `file-etoiles.ts:79` module déjà une fraction par la
distance au centre de rotation. Le raisonnement est le même, appliqué au comptage
des pas.

À traiter après T-0022, T-0023 et T-0025 : c'est le seul enfant qui touche la
géométrie, donc le seul qui puisse changer l'image.

## Critères d'acceptation

- [x] Le nombre de pas d'un arc dérive de sa longueur projetée en pixels, borné
      par `PAS_ANGLE_HORAIRE_FILE_DEG` — ~~jamais un pas plus large que §9.3~~
      **le ticket se contredisait ici**, voir ci-dessous : la borne est appliquée
      comme pas le plus **fin**, jamais comme pas le plus large
- [x] Une étoile proche du pôle ne coûte plus 481 pas à 480 min ; le coût par
      étoile est chiffré en fonction de la distance au pôle
- [x] L'écart entre la polyligne et l'arc exact reste sous le pixel, y compris
      pour l'arc le plus long du cadre — vérifié par test, pas à l'œil
- [~] `longueurPx` et `tronque` restent justes : la détection de troncature ne
      doit pas rater une sortie de cadre entre deux pas devenus plus larges — vrai
      à 4 px près, voir la réserve
- [x] Les tests existants du filé (`tests/previsu-champ.test.tsx`) passent, et un
      test couvre le cas polaire

## Réalisation

`arcEtoile` estime d'abord la longueur projetée de l'arc — cinq projections, pas
481 — puis compte les pas pour que chaque segment fasse au plus **4 px**. La
flèche d'une corde `c` sur un rayon projeté `R` vaut `c²/8R` : à 4 px de corde,
l'écart à la conique reste sous le pixel dès que le rayon dépasse 2 px, donc pour
tout arc visible. Étoile non projetable sur tout le balayage : on garde le pas
fin, sans estimation.

Le test mesure l'écart contre un arc exact échantillonné dix fois plus finement
que §9.3, en distance point-segment : moins d'un pixel à l'équateur céleste sur
480 min comme à un demi-degré du pôle, où l'arc tombe sous le quart du comptage
de référence.

Gain chiffré (T-0021) : 917 → 753 ms sur le pire cas, 13,9 M → 11,5 M
projections. Modeste comparé à T-0023, et c'est logique : après T-0023, les arcs
restants sont ceux qui traversent le cadre, donc les longs.

## Contradiction du ticket, tranchée

Le ticket demandait à la fois « jamais un pas plus large que 0,25° d'angle
horaire » et « une étoile proche du pôle ne coûte plus 481 pas à 480 min ». Les
deux ne tiennent pas ensemble : à 480 min le balayage vaut 120°, et un pas
plafonné à 0,25° impose 481 positions, pour toutes les étoiles, quel que soit
leur arc. « Affiner reste conforme » va dans le sens du coût, pas contre lui.

Ce qui est retenu : le 0,25° de §9.3 est un **proxy de fidélité en pixels** — sur
le capteur de référence du PRD (46,6 px/°), il vaut ~12 px de corde à
déclinaison nulle. La fidélité est donc tenue là où elle se juge, en pixels et
sous le pixel, prouvée par test ; et `PAS_ANGLE_HORAIRE_FILE_DEG` reste le pas
**le plus fin** — rien ne subdivise au-delà. C'est le seul enfant de l'epic qui
change l'image, et le ticket l'avait prévu.

## Réserve

Une étoile qui sortirait du cadre et y rentrerait entre deux pas devenus plus
larges ne serait pas comptée comme tronquée. L'excursion manquée mesure moins de
4 px : elle est sous le rayon de tracé de la plupart des étoiles. `longueurPx`
suit la polyligne, donc raccourcit d'une fraction de pour cent (corde contre
arc) ; il ne sert qu'à départager disque et trait, à une comparaison au rayon de
l'étoile.
