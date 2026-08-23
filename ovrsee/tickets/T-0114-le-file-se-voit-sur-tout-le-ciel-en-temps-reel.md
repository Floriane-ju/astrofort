---
{
  "id": "T-0114",
  "titre": "Le filé se voit sur tout le ciel, en temps réel",
  "type": "epic",
  "colonne": "pret",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "performance",
    "rendu",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

L'aperçu du filé (§9.3) est aujourd'hui **statique** et **clippé**. Statique : `rendu-differe.ts`
reporte le recalcul à 120 ms après la fin du geste (T-0025), donc pendant un panoramique le cadre
montre l'image d'avant. Clippé : `incrusteDansLeCadre` (`src/ui/scene-overlay.ts:124`) dépose
l'image sous `ctx.clip()` du contour du cadre, et `cadreSelection` (T-0023) resserre la sélection
d'étoiles sur l'étendue de ce cadre — hors du cadre, aucune trace n'existe.

Ce que cet epic veut rendre vrai : les traces se recalculent **pendant** le geste, et couvrent
**tout le planétarium**. Le plein ciel **remplace** l'incrustation clippée : un seul chemin de
rendu, pas deux.

Ce n'est pas un travail de rendu, c'est un travail de budget. Les chiffres d'aujourd'hui
(`pnpm bench:file`, après T-0111) :

```
pire cas — 180°, 480 min, 50 mm f/1,4   213 ms   11 543 612 projections
pire cas — 180°, 480 min, 10 mm f/2,8    91 ms    4 927 735 projections
usuel — 60°, 120 min, 50 mm f/1,4        96 ms    3 033 642 projections
usuel — 60°, 120 min, 10 mm f/2,8        24 ms      633 469 projections
```

Ces mesures sont prises **avec** la sélection resserrée sur le cadre. La retirer ramène le
comptage d'arcs de 28 858 à 169 338 (chiffres de T-0021), soit environ 6×. Et le temps réel
demande de tenir dans **une image de la boucle** : `FPS_MAX = 30` dans
`src/ui/planetarium-boucle.ts`, donc 33 ms, partagés avec `dessineCiel`. Il manque un facteur de
l'ordre de 40 sur le pire cas.

D'où l'ordre des enfants : on gagne le facteur avant d'allumer le temps réel, on ne l'allume pas
en espérant que ça passe.

## Le budget

Une passe de filé doit tenir dans l'intervalle de la boucle (`INTERVALLE_MIN_MS`,
`planetarium-boucle.ts`), **partagée avec `dessineCiel`** : c'est la même image. Le budget de la
passe de filé est donc cet intervalle moins le coût de la passe du ciel, mesuré par
`pnpm bench:ciel`. Ce n'est pas une constante à écrire dans le code : c'est le critère que les
enfants doivent atteindre, et le chiffre se relit au banc.

Mesure reprise après T-0115, T-0116 et T-0117 — plein ciel, mêmes conditions
(`pnpm bench:file [--planetarium]`), budget = 33,3 ms d'intervalle moins 0,41 ms de passe du ciel
(`pnpm bench:ciel`) :

```
                                        MODE_CADRE   MODE_PLANETARIUM   verdict plein ciel
pire cas — 180°, 480 min, 50 mm f/1,4      1177 ms         287 ms       ne tient pas
pire cas — 180°, 480 min, 10 mm f/2,8       131 ms          36 ms       ne tient pas (de peu)
usuel  —  60°, 120 min, 50 mm f/1,4         249 ms         141 ms       ne tient pas
usuel  —  60°, 120 min, 10 mm f/2,8          23 ms          13 ms       tient
```

Le cercle exact de T-0115 vaut un facteur 4,1 sur le pire cas et 1,8 sur le cas usuel rapide
(MODE_CADRE → MODE_PLANETARIUM). Il ne suffit pas : T-0118 est donc requis, et non plus
conditionnel.

Cas de référence du budget : le cas **usuel** (60°, 120 min). Le pire cas (180°, 480 min, f/1,4)
est le cas dégradé — s'il ne tient pas, c'est T-0118 qui prend la suite : un plafond global
d'étoiles en filé, déclaré à l'écran, jamais posé en silence.

## Instrument

`scripts/bench-incrustation.ts`, déjà en place. À compléter :

- un cas **plein ciel** — même scène, sans `cadreSelection`, c'est la sélection que T-0116
  installe ;
- un axe **mode de projection** — `MODE_PLANETARIUM` et `MODE_CADRE` mesurés séparément : le
  premier bénéficie de la primitive de cercle de T-0115, le second non (conique, polyligne
  obligatoire).

`--empreinte` reste le juge de « l'image n'a pas changé », partout où l'image ne doit pas changer.
T-0115 en est explicitement exempté : la primitive de peinture change, donc l'empreinte change, et
c'est un test d'écart géométrique qui prend le relais.

## Critères d'acceptation

- [ ] Le banc mesure les quatre cas existants **plus** les cas plein ciel, par mode de projection,
      avant tout travail
- [ ] La même mesure est reprise après chaque enfant livré, dans les mêmes conditions, et le
      facteur de gain est écrit noir sur blanc
- [ ] Le budget est chiffré : coût de la passe de filé, coût de la passe du ciel, intervalle de la
      boucle — et le verdict « tient / ne tient pas » par cas
- [ ] Ce que le banc ne mesure pas est écrit en réserve : la peinture et le compteur d'images
      demandent un écran, aucun pilote de navigateur ici

## Ordre recommandé

T-0115 (cercle exact) → T-0116 (plein ciel) → T-0117 (temps réel) → T-0118 (plafond d'étoiles).

T-0118 était conditionnel ; la mesure l'a rendu **requis** (tableau ci-dessus). Il ferme la marche
parce que sa valeur de plafond se règle sur ce que les trois premiers ont déjà gagné : la fixer
avant, ce serait plafonner à l'aveugle un coût qu'on n'a pas encore réduit.
