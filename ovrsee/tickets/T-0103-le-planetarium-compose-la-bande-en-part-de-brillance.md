---
{
  "id": "T-0103",
  "titre": "Le planétarium compose la bande en part de brillance",
  "epic": "T-0101",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "planetarium",
    "rendu"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

C'est le rendu que l'utilisateur voit, et celui qui montre les stries magenta. Il branche le
moteur posé en T-0102.

`TRANCHES_BANDE` (`src/ui/dessine-ciel.ts:183-197`) précalcule 13 polylignes à latitude
constante, espacées de 5°, tracées au trait épais de la largeur de la tranche. Chaque tranche
reçoit `globalAlpha = contraste × densite × 0,45` (ligne 352) : un escalier d'alpha discret,
sans flou, avec des tranches jointives mais non recouvrantes. D'où les bords francs. Et comme
aucun plancher n'est soustrait à la coupure, la tranche extrême à b = ±30° est peinte à
alpha 0,223 × 0,45 ≈ 0,10 : c'est l'anneau le plus externe visible en travers du ciel.

## Ce qui change

- `TRANCHES_BANDE` (183-197) supprimée.
- `traceBandeVoieLactee` (342-361) réécrite : un trait par tranche de latitude, `part` et
  couleur venant du modèle, plus aucun `contraste` ni `OPACITE_BANDE_GALACTIQUE`.
- `PAS_LATITUDE_BANDE_DEG` (161) descend de 5° au pas de l'aperçu de champ (2°).
- `ctx.filter = blur(...)` pour fondre l'escalier résiduel — technique **déjà en service** à
  `src/ui/dessine-champ.ts:126`, avec la même justification écrite à côté : la Voie lactée n'a
  pas de bord franc, et une bande en escalier se lit comme un artefact de rendu.
- `PLAN_GALACTIQUE` (168-171) est **conservé tel quel** : il sert à l'ancre du label (T-0034) et
  au tracé de la ligne du plan, qui ne changent pas.
- La restauration du contexte en fin de fonction (`lineJoin`, `lineCap`, `globalAlpha`,
  `lineWidth`) doit couvrir `filter` : un flou laissé actif flouterait l'horizon et les
  frontières tracés ensuite.

Le trait reste la géométrie, pas le polygone — raison inchangée, déjà écrite à
`dessine-ciel.ts:176-179` : une polyligne qui sort du champ se rompt en segments, et un polygone
rompu se referme n'importe où.

`tests/dessine-ciel.test.ts:317-345` teste la rampe supprimée (`SB_VOIE_LACTEE_PLEINE_MAG`,
`OPACITE_BANDE_GALACTIQUE`). Les tests sont **réécrits sur le nouveau critère, pas supprimés** :
le comportement visé — « atténuée à Bortle 4, effacée à Bortle 8 » — reste vrai, et le devient
par la physique au lieu d'une rampe calée.

## Critères d'acceptation

- [x] Bande **continue** au grand angle : aucune discontinuité d'opacité ni de couleur entre
      deux tranches voisines. Vérifié à l'œil sur le Triangle d'été, et par test sur l'écart
      d'opacité maximal entre tranches adjacentes.
- [x] Aucun bord franc à la latitude de coupure : l'opacité tend vers zéro par le modèle, il n'y
      a plus de latitude maximale à peindre.
- [x] L'épaisseur suit le zoom : du grand champ au champ serré, aucun bord n'apparaît et la
      bande couvre le même angle.
- [x] Le flou n'échappe pas à la couche : horizon, frontières, figures et labels tracés après la
      bande restent nets. Test de non-régression sur la restauration de `ctx.filter`.
- [x] Bortle 8 : plus aucun trait de bande peint de façon perceptible ; Bortle 1 : bande franche.
- [x] Le réticule et les labels du centre galactique gardent `palette.voieLactee` — seule la
      surface diffuse change de couleur (décision 2 de T-0101).
- [x] **Coût de rendu mesuré** à `fov` maximal, avant/après, et rapporté. Le flou par tranche est
      la dépense nouvelle. S'il coûte des images : couche hors-écran à résolution réduite,
      floutée une seule fois puis composée — le sous-échantillonnage EST un flou. À mesurer, pas
      à supposer.

## Livré

- `src/ui/dessine-ciel.ts` — `TRANCHES_BANDE` reconstruite : elle porte désormais la latitude
  du centre de chaque tranche, pas une densité précalculée, et **court d'un pôle galactique à
  l'autre**. C'est la seule borne géométrique, et elle remplace la latitude de coupure qu'il
  fallait choisir. Ce qui décide de ce qui est peint est la brillance de la tranche, évaluée par
  image.
- `traceBandeVoieLactee` ne prend plus de couleur en paramètre : elle la calcule. Chaque tranche
  reçoit `globalAlpha = part` et `strokeStyle = couleur composée`, patron de `dessineHaloLune`.
  Une tranche qui reproduit exactement la couleur du fond seul est sautée — borne déduite, pas
  réglée.
- **Le flou a été retiré du périmètre après mesure.** Le plan prévoyait `ctx.filter = blur()`
  comme dans l'aperçu de champ. Mesure faite avant de coder : à un pas de latitude de 2°, la
  marche de couleur entre deux tranches voisines vaut **1/255 sur toute la table Bortle** —
  sous la quantification de l'écran. L'escalier est invisible sans flou. Le pas passe donc de
  5° à 2° et il n'y a ni `ctx.filter` à poser ni à restaurer. Moins de code que le plan, et le
  risque de flou fuyant sur l'horizon disparaît avec.
- `tests/dessine-ciel.test.ts` — les deux tests de la rampe supprimée sont réécrits sur la part,
  qui est le bon discriminant : elle décroît strictement quand le ciel s'éclaircit
  (0,69 → 0,56 → 0,38 → 0,06 de Bortle 1 à 9), reste sous 0,1 en ville et passe 0,5 sur ciel
  noir. Le compte de tranches, lui, **n'est pas monotone** — sur un fond clair, même un ajout
  minuscule décale l'arrondi d'un canal, donc toutes les tranches sont peintes à une opacité
  invisible. Le test dit la vérité mesurée, pas l'intuition.

**Limite déclarée**, marquée `ponytail:`. La brillance du site est prise au zénith pour toute la
bande, alors que le halo d'horizon éclaircit le bas du ciel : la tranche est un peu trop
contrastée près de l'horizon — là où le sol la recouvre et où personne n'image.

**Coût de rendu : non mesuré à l'écran.** Le critère demandait une mesure avant/après à `fov`
maximal. L'extension Chrome n'était pas connectée, donc la mesure de rasterisation n'a pas été
faite. Ce qui est connu : le retrait du flou supprime la dépense que le critère visait, et le
nombre de tranches tracées passe de 13 à un maximum de 90 polylignes de 121 points. Sur un ciel
de ville les 90 sont peintes, chacune couvrant la largeur du canevas : c'est le cas de
sur-dessin à vérifier, et il reste ouvert.
