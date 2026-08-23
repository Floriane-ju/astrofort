---
{
  "id": "T-0115",
  "titre": "Un arc de filé est un cercle exact en projection stéréographique",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0114",
  "tags": [
    "performance",
    "file",
    "projection"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

`arcEtoile` (`src/core/file-etoiles.ts:179`) construit chaque trace en tournant l'étoile de proche
en proche autour du pôle et en projetant chaque position : jusqu'à 481 pas par étoile à 480 min,
ramenés par T-0024 au pas qui tient la conique sous le pixel. Après T-0111, `projetteEn` et
`arcEtoile` pèsent encore les deux tiers de la passe. C'est le poste à supprimer, pas à réduire.

§9.3 interdit la primitive de cercle, et pour une bonne raison : **en projection rectilinéaire, un
cercle de déclinaison devient une conique** — ellipse, parabole ou hyperbole selon l'angle au pôle.
Tracer des cercles concentriques est le raccourci classique, et il est faux à 130° de champ.

Mais la scène du planétarium n'est pas en projection rectilinéaire. `MODE_PLANETARIUM` projette par
le facteur `2 / (1 + z)` (`src/core/projection.ts:183`), soit `R = 2·tan(θ/2)` : c'est la
**projection stéréographique depuis l'antipode de la visée**. Elle est conforme, et elle conserve
les cercles : un cercle de la sphère s'y projette en cercle **exact** du plan. Pour ce mode-là, la
primitive de cercle n'est pas un raccourci, c'est une identité — et la mise en garde de §9.3 ne
s'applique pas, puisqu'elle porte sur la rectilinéaire.

`MODE_CADRE` (gnomonique, `1/z`) et `MODE_FISHEYE` (équidistante, `atan2(s,z)/s`) ne conservent pas
les cercles. Ils gardent la polyligne, intacte.

## Ce qui doit devenir vrai

En `MODE_PLANETARIUM`, la trace d'une étoile se construit en une poignée de projections au lieu de
plusieurs centaines :

- cinq positions projetées suffisent — début, quarts, milieu, fin du balayage ;
- le cercle s'ajuste sur trois d'entre elles (centre et rayon en pixels) ;
- le balayage écran s'obtient en déroulant les angles des cinq autour de ce centre : c'est ce
  déroulement qui donne le sens et l'étendue, un balayage pouvant dépasser le demi-tour ;
- le tracé passe par `ctx.arc` (`src/ui/dessine-champ.ts:305-324`) ;
- `longueurPx` devient `rayon × balayage` — c'est elle qui décide disque contre trait, et elle qui
  alimente `arcsTronques`.

## Garde-fous — ils sont la moitié du travail

- **Dégénérescence à l'antipode.** Un cercle de déclinaison qui passe près de l'antipode de la
  visée se projette en droite : le rayon diverge. Repli sur la polyligne dès que le rayon ajusté
  dépasse `porteeUtilePx` (`src/core/projection.ts`) — le seuil existe déjà, pour ce motif exact.
  Aucune constante nouvelle.
- **Portions non projetables.** Elles doivent rester coupées comme aujourd'hui. Sans la coupure, la
  corde entre deux positions de part et d'autre de la singularité traverse l'image — la droite
  fantôme que `porteeUtilePx` existe pour empêcher.
- **Les deux autres modes ne changent pas.** La polyligne reste le chemin de `MODE_CADRE` et de
  `MODE_FISHEYE`, sans écart d'un pixel.
- Le pôle reste exact et reste hors cadre quand il l'est (§9.3 point 1) : le centre du cercle
  ajusté n'est pas le pôle projeté, et rien ne doit le ramener dedans.

## Critères d'acceptation

- [x] La primitive de cercle ne s'applique qu'en `MODE_PLANETARIUM` — un test le vérifie mode par
      mode
- [x] Écart géométrique maximal entre le cercle et la polyligne de référence **sous le pixel**, sur
      un échantillon de déclinaisons de −90° à +90° et d'écarts au pôle jusqu'à 180°, durées de 5 à
      480 min. Valeurs **calculées** par le test, aucune recopiée
- [x] Cas dégénéré couvert : une étoile dont le cercle passe près de l'antipode de la visée tombe
      sur la polyligne, et la trace ne traverse pas l'image
- [x] `longueurPx` reste cohérente : une trace plus courte que le rayon de l'étoile reste un
      disque, comme aujourd'hui
- [x] `pnpm bench:file` mesuré avant / après, par mode, et le gain écrit. **L'empreinte de peinture
      change** — la primitive n'est plus la même — et c'est le test d'écart géométrique qui tient le
      rôle de non-régression, pas `--empreinte`
- [x] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée

## Ce qui a été fait

`arcEtoile` (`src/core/file-etoiles.ts`) essaie d'abord `arcStereographique` quand la vue est en
`MODE_PLANETARIUM`, et retombe sur la polyligne inchangée sinon ou en cas de repli. Cinq
projections par étoile — début, quarts, milieu, fin ; cercle circonscrit au départ, au milieu et à
la fin ; balayage obtenu en déroulant les cinq angles. `src/ui/dessine-champ.ts` trace l'arc par
`ctx.arc` quand `ArcFile.cercle` est renseigné.

**Le déroulement des angles a demandé plus que la somme des écarts.** Un balayage écran peut
dépasser le demi-tour, et un écart de plus de 180° entre deux des cinq positions se replie alors du
mauvais côté : sur 75 928 cas balayés, le pire écart de balayage valait **6,283 rad — un tour
entier retiré**. Le sens vient donc d'un vote des quatre écarts : le balayage total restant sous le
tour complet, un seul écart peut dépasser 180°, et les trois autres tranchent. Après vote, l'écart
au balayage de référence retombe à **3,5 × 10⁻¹⁴ rad** sur les mêmes 75 928 cas.

L'identité elle-même est vérifiée : mesuré contre la trajectoire reprojetée point par point,
l'écart au cercle vaut **1,2 × 10⁻⁹ px** en stéréographique, contre **1,2 × 10³ px** en
gnomonique et **4,0 × 10³ px** en équidistante. Ces deux-là gardent la polyligne, et le test
`ne sort une primitive de cercle qu’en MODE_PLANETARIUM` le fige.

`tronque` ne se lit plus sur des sommets échantillonnés mais sur la **boîte englobante exacte** de
l'arc : ses deux extrémités, plus ceux des quatre extrêmes du cercle que le balayage traverse
réellement.

Le message de `diagnosticFile` a gagné sa branche `MODE_PLANETARIUM` : il annonçait « projection
rectilinéaire […] les tracer en cercles concentriques serait faux » sous une projection qui, elle,
les conserve.

## Mesure

`scripts/bench-incrustation.ts` gagne l'axe `--planetarium` (l'epic T-0114 le demandait ; il est
requis ici pour mesurer quoi que ce soit). Médiane de 5 passes, 1920 × 1080 :

```
MODE_PLANETARIUM                        avant     après     projections avant → après
pire cas — 180°, 480 min, 50 mm f/1,4   312 ms    103 ms    11 538 209 → 2 152 148
pire cas — 180°, 480 min, 10 mm f/2,8   152 ms     30 ms     4 965 706 →   392 639
usuel — 60°, 120 min, 50 mm f/1,4       101 ms     77 ms     3 033 642 → 1 972 177
usuel — 60°, 120 min, 10 mm f/2,8        24 ms     13 ms       633 469 →   235 318

MODE_CADRE                              avant     après
pire cas — 180°, 480 min, 50 mm f/1,4   209 ms    214 ms
pire cas — 180°, 480 min, 10 mm f/2,8    90 ms     91 ms
usuel — 60°, 120 min, 50 mm f/1,4        97 ms     98 ms
usuel — 60°, 120 min, 10 mm f/2,8        24 ms     24 ms
```

Le pire cas stéréographique passe de 312 à 103 ms, soit **×3,0**, et de 11,5 à 2,2 millions de
projections, soit **×5,4**. `MODE_CADRE` ne bouge pas — l'écart de 1 à 5 ms est du bruit de
mesure, la polyligne y est le même code qu'avant.

Ce qui reste en projections vient des replis. Sur le catalogue réel entier (83 479 étoiles, donc
bien au-delà des étoiles réellement tracées), le cercle dégénère et rend la main à la polyligne
dans **5,1 %** des cas à 180° / 480 min, **19,9 %** à 60° / 120 min — un cercle de déclinaison
dont le rayon projeté dépasse `porteeUtilePx` frôle l'antipode de la visée, et c'est exactement le
repli que le ticket demandait.

L'empreinte de peinture n'a pas été comparée : la primitive change, donc le condensé change. Le
rôle de non-régression est tenu par le test d'écart géométrique, comme le ticket le prévoyait.

## Vérification

```
$ pnpm typecheck
$ tsc --noEmit
        (aucune sortie)

$ pnpm test
 Test Files  54 passed (54)
      Tests  738 passed (738)
   Duration  7.73s
```

Cinq tests ajoutés à `tests/file-etoiles.test.ts`. Aucune valeur recopiée : chacun rejoue la
trajectoire par `rotationAutourDe` + `projette` et compare. Les tests s'assurent aussi d'avoir
exercé ce qu'ils prétendent couvrir — plus de 1 000 cercles jugés, au moins un balayage de plus
d'un demi-tour, au moins un cas dégénéré.

## Ce qui n'a pas été fait, et pourquoi

Le repli à `porteeUtilePx` est **conservateur au-delà du nécessaire**. Le motif d'origine du seuil
est la corde fantôme d'une polyligne, qui n'existe pas avec une primitive d'arc : un cercle de
grand rayon reste géométriquement juste, il n'y a que la précision flottante du canevas à
craindre. Baisser ce repli récupérerait une partie des 5 à 20 % de replis, mais demande de savoir
à partir de quel rayon `ctx.arc` cesse d'être fidèle — mesure d'écran, pas de banc. Laissé tel
quel : le ticket demandait ce seuil, et il n'invente aucune constante.
