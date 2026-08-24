---
{
  "status": "open",
  "title": "Le filé plafonne la surface peinte, pas le nombre d'étoiles",
  "opened": "2026-08-24",
  "closed": null,
  "commits": []
}
---

# Le filé plafonne la surface peinte, pas le nombre d'étoiles

## Contexte

En mode filé « durée totale », l'écran est une nappe blanche : on ne distingue plus la longueur
des traces, et l'interface saccade. Mesuré au banc (`pnpm bench:file --planetarium`) et par
instrumentation de `dessineChamp` :

| champ / durée | traces peintes | surface peinte / canevas |
|---|---|---|
| 180° / 480 min | 10 640 | **535 %** |
| 180° / 120 min | 10 324 | **180 %** |
| 120° / 120 min | 5 219 | **140 %** |
| 60° / 120 min | 1 597 | 69 % |
| 60° / 60 min | 1 593 | 40 % |

Au-delà de 100 % de couverture, chaque pixel du ciel est repeint plusieurs fois : la trace n'a
plus de longueur lisible, et le fond de ciel du planétarium disparaît sous les traces. C'est
exactement l'image de la capture.

**Trois causes, une seule racine.**

1. **T-0118 plafonne la mauvaise grandeur.** Il borne le nombre d'étoiles *lues*
   (`BUDGET_ETOILES_FILE` = 1 500), et seulement sur la couche du semis. Or la surface peinte
   vaut `nombre × longueur × largeur` : elle croît avec la durée et avec le champ. À 480 min,
   1 500 traces couvrent déjà 5× le canevas. Un budget d'étoiles ne borne donc pas la lisibilité.

2. **La prémisse de T-0118 est fausse.** Le ticket écrit « le catalogue réel n'est pas plafonné…
   environ 15 000 étoiles sur toute la sphère ». Le paquet `public/data/hyg-1.bin` en contient
   **25 791** à mag ≤ 7,5. En plein ciel, ~12 900 sont dans le champ, et c'est cette couche —
   celle qui n'est pas plafonnée — qui fait toute la nappe.

3. **Il n'y a rien de « quasi transparent » à supprimer.** `OPACITE_MIN = 0.2`
   (`src/ui/dessine-champ.ts:52`) ne coupe jamais rien sur le catalogue réel : à 10 mm f/2,8 une
   étoile de mag 7,5 sort à opacité 0,49–0,71, et à 50 mm f/1,4 **toutes** les étoiles mag ≤ 7,5
   sortent à opacité 1,00. Physiquement c'est juste — un filé f/1,4 sature vraiment — mais cela
   veut dire que l'opacité n'est pas un levier : le levier est le nombre de traces.

**Résultat visé** — plafonner la **surface peinte** plutôt que le nombre d'étoiles. C'est le seul
invariant qui borne d'un coup le coût de peinture et la lisibilité, et il est invariant en durée
et en champ. Simulation bouclée, cible 40 % :

| champ / durée | avant | après | plafond mag dérivé |
|---|---|---|---|
| 180° / 480 min | 10 640 tr — 535 % | **454 tr — 33 %** | 4,7 |
| 180° / 120 min | 10 324 tr — 180 % | **1 550 tr — 31 %** | 5,8 |
| 120° / 120 min | 5 219 tr — 140 % | **957 tr — 28 %** | 6,0 |
| 60° / 120 min | 1 597 tr — 69 % | **551 tr — 25 %** | 6,5 |
| 60° / 60 min | 1 593 tr — 40 % | **1 145 tr — 29 %** | 7,2 |
| 20° / 120 min et 20° / 480 min | 685 tr — 17 % | inchangé | *aucun plafond* |
| aperçu de champ (pose 25 s) | 1 541 tr — 0 % | inchangé | *aucun plafond* |

La couverture obtenue est de 25–33 % partout : c'est la propriété qui manquait. Et le plafond se
**désactive tout seul** quand il n'y a rien à borner — champ étroit, durée courte, aperçu de pose,
suivi actif. C'est ce qui permet de supprimer le commutateur sur le mode
(`file.apercu === 'FILE'`) au lieu d'en ajouter un.

Gain de peinture et de calcul : ×23 au pire cas, ×6,6 en plein ciel à 120 min, ×3 à 60°/120 min.

## Décisions prises

- **Cible de couverture : 40 %** (donne 25–33 % réels).
- **T-0118 est remplacé, pas empilé** : `BUDGET_ETOILES_FILE` et le commutateur sur le mode
  disparaissent ; le budget d'étoiles devient dérivé de la couverture.
- **Pas de refonte de l'opacité.** `opaciteEtoile` est la physique de §9.2, testée : elle reste
  telle quelle. La hiérarchie visuelle revient d'elle-même par la largeur de trait
  (`rayonEtoilePx` : 1,40 px à mag 7,5, 4,01 px à mag 2) une fois les traces assez rares pour
  qu'on les distingue.
- **Pas de regroupement des ordres de tracé** (un `beginPath`/`stroke` par étoile reste). Avec
  ×23 moins de traces, ce n'est pas le goulot. À rouvrir seulement si le banc le redemande.

## Ce qui change dans le code

### 1. `src/core/index-ciel.ts` — inverser le comptage du catalogue

La loi de comptage du registre (`SEMIS_ETOILES_TOTAL` = 300 000 à mag 12, pente 0,6) donne
N(<7,5) ≈ 600 là où le catalogue réel en compte 25 791 : **cette loi n'est pas extensible vers le
bas**, elle décrit le semis, pas le catalogue. Le comptage exact doit donc venir du catalogue
lui-même.

- `construitIndex` accumule un **histogramme cumulé de magnitudes** par pas de 0,1 mag, une seule
  fois à la construction. Empreinte : `Float32Array` de ~90 entrées pour le catalogue réel
  (mag −1,5 → 7,5), ~135 pour le semis — quelques centaines d'octets, négligeable.
- Nouveau champ `readonly cumulMag: Float32Array` sur `IndexCiel`, plus l'origine et le pas
  nécessaires pour l'indexer (ou une convention documentée : indice = `round(mag / pas)`).
- Nouvelle fonction pure `magnitudePourEffectif(index, n)` : magnitude la plus faible telle que
  l'index contienne au plus `n` étoiles sur toute la sphère. Interpolation linéaire dans le
  cumul ; `+Infinity` quand `n` dépasse l'effectif total (= pas de plafond).

### 2. `src/core/file-etoiles.ts` — estimer la surface peinte avant de la peindre

Nouvelle fonction pure, à côté de `longueurArcDeg` et `poseParPixelS` :

```
budgetTracesCouverture({ vue, dureeMin, decCentreDeg, couvertureMax, largeurTraceRefPx }) → number
```

- **Longueur estimée d'une trace, en pixels.** L'échelle au centre du champ sous-estime d'un
  facteur 3 en stéréographique plein ciel (le facteur radial diverge vers le bord). L'échelle
  **moyenne** sur le champ tombe juste à 15 % près : `sqrt(largeurPx × hauteurPx / Ω)` avec
  `Ω = 2π(1 − cos rayonChampDeg)`, en px/rad. Longueur = `longueurArcDeg(dureeMin, decCentreDeg)`
  × cette échelle.
- **Bornée par la corde moyenne du canevas**, `π × aire / (2 × (largeur + hauteur))` ≈ 1 086 px
  en 1920×1080 : au-delà, la trace sort de l'écran et `arcsVisibles` la découpe déjà. Sans cette
  borne, un champ de 20° à 480 min serait plafonné alors qu'il ne couvre que 17 %.
- **Budget** = `couvertureMax × aire / (longueurEstimée × largeurTraceRefPx)`, en traces
  présentes dans le champ.
- Vérifié numériquement contre la mesure : estimation / mesure = 0,84 à 1,03 sur les champs où le
  plafond mord (60°–180°), et la borne de corde neutralise les champs étroits.

### 3. `src/ui/dessine-champ.ts` — dépenser le budget, catalogue réel d'abord

Dans `dessineChamp`, avant les deux appels à `dessineCouche` :

- `decCentreDeg` se déduit du `centreJ2000` déjà calculé dans `dessineCouche` — le remonter dans
  `dessineChamp` et le passer aux deux couches (il y est calculé deux fois aujourd'hui).
- `nMax = budgetTracesCouverture({ … couvertureMax: K('COUVERTURE_TRACES_MAX'),
  largeurTraceRefPx: 2 × rayonEtoilePx(K('SEUIL_MAG_ETOILES_REELLES')) })`. La largeur de
  référence est celle de l'étoile la plus faible du catalogue : c'est un plancher, l'écart est
  absorbé par la cible de couverture.
- `dureeMin` vaut 0 avec suivi actif, comme dans `dessineCouche` : le budget devient alors infini
  et rien n'est plafonné. Même règle pour l'aperçu de pose (arc de 2 px → budget de 237 000).
- **Couche 1 (catalogue réel)** : borne `min(magLimite, SEUIL_MAG_ETOILES_REELLES,
  magnitudePourEffectif(indexReel, nMax / fractionCiel))`.
- **Couche 2 (semis)** : le budget restant, `max(0, nMax − effectifCouche1)`, converti par
  `magnitudePlafondSemis` — **conservée telle quelle**, elle porte déjà la loi du semis et la
  fraction de ciel. La garde existante `magSemis > seuilReel` coupe la couche quand il ne reste
  rien.
- `OPACITE_MIN` (ligne 52) → `K('OPACITE_TRACE_MIN')`. C'est un seuil écrit en dur dans un module
  de rendu, donc un bug au sens de `CLAUDE.md`.
- `ParametresFile.budgetEtoiles` est **supprimé** : la passe dispose déjà de tout ce qu'il faut
  (`dureeS`, `suiviActif`, le projecteur).

Limite assumée, à écrire en commentaire : la conversion « traces dans le champ → magnitude » passe
par la densité **moyenne** du ciel (`fractionCiel`). Sur un champ étroit posé sur la Voie lactée,
l'écart atteint un facteur 2. Or c'est précisément là que le plafond ne mord pas (17 % de
couverture) : l'erreur est confinée au domaine où elle est sans effet.

### 4. `src/ui/planetarium-incrustation.ts` — supprimer le commutateur

La ligne 74 (`budgetEtoiles: file.apercu === 'FILE' ? K('BUDGET_ETOILES_FILE') : null`) disparaît.
Le plafond suit désormais la géométrie et la durée, pas le mode : il se neutralise de lui-même en
aperçu de pose. L'argument de T-0118 — « une passe qui change de profondeur sous la main donne
deux images pour une même scène » — reste tenu : le plafond ne dépend que du champ et de la durée,
donc il change au zoom mais pas sous un panoramique, exactement comme le champ lui-même.

### 5. `src/registry/constants.ts`

Ajouter deux entrées, en supprimer une.

| Entrée | Valeur | Unité | Source | Tolérance |
|---|---|---|---|---|
| `COUVERTURE_TRACES_MAX` | 0,4 | — | §9.3 — fraction du canevas que les traces peuvent peindre ; au-delà de 1 la trace n'a plus de longueur lisible. Réglée par la mesure (`pnpm bench:file --planetarium`) | convention produit, `ordreDeGrandeur: true` |
| `OPACITE_TRACE_MIN` | 0,2 | — | §9.3 — sous cette opacité l'étoile est trop loin sous le seuil d'enregistrement pour laisser une trace (déplacée depuis `dessine-champ.ts:52`) | ordre de grandeur, `ordreDeGrandeur: true` |
| ~~`BUDGET_ETOILES_FILE`~~ | — | — | supprimée : remplacée par le plafond de couverture | — |

Réf `C-33` pour les deux, sections `['9.3']` (`['9.2','9.3']` pour l'opacité).

### 6. `src/ui/scene-overlay.ts` — la mention perd son nombre

`MENTION_PLAFOND_FILE` interpole `K('BUDGET_ETOILES_FILE')`. Le plafond étant désormais dérivé du
champ et de la durée, la mention énonce la **règle** et laisse les compteurs dire le nombre — ils
le disent déjà. Nouveau texte, sans chiffre : l'aperçu ne peint que les traces qui restent
lisibles ; au-delà, les traces se recouvrent et la longueur du filé cesse d'être visible ; le
capteur en enregistrerait davantage.

### 7. `scripts/bench-incrustation.ts`

- `--budget=N` → `--couverture=F` (fraction ; `--couverture=0` retire le plafond, comme
  `--budget=0` avant).
- Ajouter à la sortie la **surface peinte** en fraction du canevas, sommée sur les portions
  visibles (`arcsVisibles` pour le cercle, les cordes pour la polyligne). C'est la grandeur que le
  ticket borne : sans elle, le réglage de `COUVERTURE_TRACES_MAX` se raconte au lieu de se
  chiffrer. Le contexte muet peut la compter en instrumentant `ctx.arc`/`ctx.lineTo`, ou la passe
  peut la retourner dans `SortieDessinChamp` — préférer le second : le panneau pourra la lire.

## Tests

`tests/previsu-champ.test.tsx` référence `BUDGET_ETOILES_FILE` (l. 329, 343) et
`magnitudePlafondSemis` (l. 20, 333, 344, 348) : les trois assertions sur le budget se
réécrivent, celles sur `magnitudePlafondSemis` restent valables (la fonction survit).

Nouveaux comportements à couvrir, un test par comportement :

- `magnitudePourEffectif` — le cumul redonne l'effectif exact du catalogue au seuil, est monotone,
  et rend `+Infinity` au-delà de l'effectif total.
- `budgetTracesCouverture` — **invariance** : doubler la durée à champ constant divise le budget
  par deux ; le budget est le même à 60° et à 180° pour une même surface peinte cible. C'est le
  test qui distingue ce plafond de celui de T-0118.
- `budgetTracesCouverture` — **neutralité** : suivi actif, aperçu de pose unitaire, et champ
  étroit rendent un budget supérieur à l'effectif du catalogue, donc aucun plafond.
- `dessineChamp` — la couche du semis est coupée quand le catalogue réel épuise le budget.
- Aucune valeur d'éphéméride ni de magnitude recopiée : les cas se construisent depuis
  `astronomy-engine` et le registre, et vérifient des rapports (invariance, monotonie), pas des
  nombres.

## Vérification

1. `pnpm typecheck && pnpm test` — rapporter la sortie réelle.
2. `pnpm bench:file --planetarium` — le pire cas (180° / 480 min / 50 mm f/1,4) doit rester sous
   l'intervalle de boucle (~33 ms) **et** afficher une surface peinte ≤ ~40 % ; comparer aux
   535 % d'avant. Vérifier au passage que `--couverture=0` reproduit les compteurs d'aujourd'hui.
3. `pnpm bench:file --planetarium --empreinte` — le condensé **doit changer** (l'image change,
   c'est le propos) ; `--couverture=0 --empreinte` doit reproduire le condensé actuel avec
   `--budget=0`.
4. `pnpm dev`, mode filé, durée totale, plein ciel : la longueur des traces doit se lire, le fond
   de ciel et la bande galactique doivent redevenir visibles, et le panoramique/zoom doit rester
   fluide. Comparer à la capture du ticket. C'est ce passage qui valide la valeur de
   `COUVERTURE_TRACES_MAX` — le chiffre est un réglage, pas une déduction.
5. Vérifier que l'aperçu de champ (`file.apercu === 'CHAMP'`) est **inchangé** : même profondeur,
   mêmes compteurs qu'avant.

## Suivi `ovrsee/`

Créer un ticket sous l'epic **T-0114**, et corriger dans **T-0118** la prémisse fausse
(« environ 15 000 étoiles » → 25 791 à mag ≤ 7,5) : c'est elle qui a laissé la couche coûteuse
sans plafond.

## Non tranché

- **La valeur de `COUVERTURE_TRACES_MAX` est un réglage à l'œil.** 0,4 produit 25–33 % réels et
  un ciel de magnitude 4,7–7,2 selon le cas. Si le plein ciel à 480 min reste chargé, descendre à
  0,25 ; s'il paraît pauvre, monter à 0,6. Le banc dit le coût, pas la beauté.
- **La hiérarchie visuelle des traces.** `opaciteEtoile` sature à 1,00 pour tout le catalogue dès
  qu'on déclare un objectif rapide : la brillance ne distingue plus rien, seule la largeur de
  trait le fait. C'est physiquement honnête et ce plan n'y touche pas — mais si les traces
  restent plates après le plafond, la question à poser est celle du **point blanc** de l'affichage
  (aujourd'hui `SNR_RENDU_SATURATION` = 100, fixe), pas celle du plafond.
