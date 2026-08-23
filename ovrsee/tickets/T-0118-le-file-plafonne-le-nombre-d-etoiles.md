---
{
  "id": "T-0118",
  "titre": "Le filé plafonne le nombre d'étoiles",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0114",
  "tags": [
    "performance",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

**La condition est levée : ce ticket se fait.** La mesure de T-0117 (`pnpm bench:file
--planetarium`, plein ciel, cercle exact de T-0115 compris) rate le budget dès le cas usuel avec
un objectif rapide — 141 ms pour 60°, 120 min, 50 mm f/1,4, contre ~33 ms d'intervalle de boucle.
Seul le cas usuel à 10 mm f/2,8 tient (13 ms). Le pire cas est à 287 ms.

Le levier est la profondeur atteinte en plein ciel. À 50 mm f/1,4 la magnitude limite descend à
15,1 et le semis génératif entre en jeu — 177 377 étoiles lues au pire cas. En filé, cette
profondeur ne produit pas de trace lisible : elle produit du temps de calcul.

**Le plafond est global, pas gestuel.** Une première rédaction n'allégeait la passe que pendant le
mouvement, et rendait la passe complète au repos. Ce n'est plus ce qui est demandé. Dès que le mode
filé est actif — immobile comme en panoramique — le nombre d'étoiles est plafonné. Une passe qui
change de profondeur sous la main donne deux images pour une même scène, une mention qui clignote
au rythme du geste, et une règle sur les compteurs qui ne vaut qu'en mouvement. Un plafond
permanent donne une image, un coût, une phrase.

Le déclencheur est le mode, lu à `src/ui/planetarium-incrustation.ts:70` :
`file.apercu === 'FILE'`. L'aperçu de champ (`'CHAMP'`, pose unitaire) n'est **pas** concerné :
les arcs y sont courts, la passe ne coûte rien, et c'est précisément là que la profondeur atteinte
par le capteur est le propos de l'écran.

Reste à savoir **combien**. Le ticket porte un levier réglable et un protocole de banc, pas un
nombre décidé d'avance : c'est la mesure qui fixe la valeur.

## Ce qui doit devenir vrai

### Le levier : un budget d'étoiles, pas un plafond de magnitude

Une constante de `src/registry/constants.ts` (`C-33`, aux côtés de `SEMIS_ETOILES_TOTAL`) porte le
**budget d'étoiles lues** en filé. Même grandeur que `etoilesVisitees`
(`src/ui/dessine-champ.ts:88-93`) — le compteur qui dit ce que la passe a coûté, et que le banc
rapporte déjà. Tolérance `ordreDeGrandeur: true` : la modulation de densité par la latitude
galactique fait varier le comptage réel autour de la cible, et c'est voulu.

Un plafond de **magnitude** fixe ne convient pas : à magnitude égale, le nombre d'étoiles suit
l'angle solide du champ. Ce qui tient à 60° coûte environ 9× plus à 180°. Le pire cas retomberait
hors budget, ou le cas usuel deviendrait inutilement pauvre.

La passe convertit donc le budget en magnitude plafond pour la couche du semis, via la loi de
comptage `N(<m) ∝ 10^(PENTE × m)` et la fraction de sphère couverte par le champ,
`fractionCiel = (1 − cos r) / 2` avec `r` = `rayonChampDeg`, déjà calculé à
`src/ui/dessine-champ.ts:118-121` :

```
magPlafond = SEUIL + log10( 1 + (N / (SEMIS_ETOILES_TOTAL × fractionCiel))
                                × (10^(PENTE × (SEMIS_MAG_MAX − SEUIL)) − 1) ) / PENTE
```

Aucun des symboles n'est un nombre écrit : `SEUIL` = `SEUIL_MAG_ETOILES_REELLES`, `PENTE` =
`PENTE_COMPTAGE_ETOILES`, `SEMIS_MAG_MAX` et `SEMIS_ETOILES_TOTAL` existent déjà, `N` est la
constante nouvelle.

La conversion est un calcul pur : elle va dans `src/core/`, dans `galactique.ts` qui tient déjà
`magnitudeLimitePrevisu` et la physique de profondeur. **`src/data/semis.ts:60` tire ses
magnitudes avec exactement cette loi** — les deux la partagent, elles ne la récrivent pas chacune.

### Portée du plafond

- La borne effective de la couche du semis devient `min(magLimite, magPlafond)`.
- La couche du semis est **coupée** si `magPlafond` retombe sous `SEUIL_MAG_ETOILES_REELLES` :
  c'est la garde déjà en place à `src/ui/dessine-champ.ts:208`, elle suffit.
- **Le catalogue réel n'est pas plafonné.** Il vaut environ 15 000 étoiles sur toute la sphère,
  c'est le ciel reconnaissable, et ce n'est pas lui qui coûte. Écrit ici pour qu'on ne « complète »
  pas le plafond dessus plus tard.

### Ce que l'écran dit

- Les compteurs du panneau Filé disent **ce qui est peint**. Pas de seconde passe de comptage à
  pleine profondeur : c'est précisément le coût qu'on supprime.
- Une mention, **permanente tant que le filé est actif**, dit que l'aperçu est plafonné à N étoiles
  et que le capteur en enregistrerait davantage. Un plafond muet se lit comme un ciel pauvre, donc
  comme un bug de rendu.
- La mention rejoint les lectures du panneau Filé (`src/ui/panneau-file-lectures.ts`) ; son texte
  vit au registre, comme `MENTION_VIGNETTAGE_INCRUSTATION` avant elle.

## Critères d'acceptation

- [x] Le budget de T-0114 est tenu **au pire cas** (180°, 480 min, 50 mm f/1,4), mesuré au banc,
      filé actif — 27 ms contre ~32,9 ms
- [x] Le coût mesuré ne varie pas d'un ordre de grandeur entre 60° et 180° à durée égale — 17 ms
      à 180° contre 16 ms à 60°, à 120 min dans les deux cas (rapport 1,1 ; sans plafond :
      183 ms contre 140 ms, mais 177 377 étoiles lues contre 56 086)
- [x] La valeur de N est **choisie par la mesure** : tableau ci-dessous
- [x] L'aperçu de champ (`apercu === 'CHAMP'`) est inchangé — `pnpm bench:file --empreinte
      --budget=0` rend les condensés d'avant T-0118, bit pour bit
- [x] Aucun plafond, seuil ni facteur écrit hors de `src/registry/` — `tests/registry.test.ts`
      passe, la base de la loi de comptage est `BASE_MAGNITUDE`
- [x] La mention « aperçu plafonné » est présente tant que le filé est actif, absente sinon (test)
- [x] `pnpm typecheck && pnpm test` verts — 53 fichiers, 742 tests

## Mesure

`pnpm bench:file --planetarium --budget=N`, médiane de 5 passes, 1920 × 1080. Un cas a été
ajouté au banc — **180°, 120 min** — parce que le critère d'invariance se lit à durée ÉGALE,
et que les deux cas existants n'avaient ni le même champ ni la même durée.

Budget de référence : 33,3 ms d'intervalle de boucle moins 0,41 ms de passe du ciel
(`pnpm bench:ciel`), soit **~32,9 ms**.

| N (étoiles lues) | usuel 60° f/2,8 | usuel 60° f/1,4 | 180° 120 min f/1,4 | pire 180° f/2,8 | pire 180° f/1,4 | verdict |
|---|---|---|---|---|---|---|
| _sans plafond_ | 13 ms | 140 ms | 183 ms | 35 ms | 284 ms | ne tient pas |
| 12 000 | 12 ms | 63 ms | 28 ms | 34 ms | 42 ms | ne tient pas |
| 6 000 | 13 ms | 38 ms | 22 ms | 32 ms | 34 ms | limite, dépasse |
| 3 000 | 13 ms | 23 ms | 19 ms | 29 ms | 29 ms | tient |
| **1 500** | **13 ms** | **16 ms** | **17 ms** | **28 ms** | **27 ms** | **tient, retenu** |

**Valeur retenue : 1 500.** Le banc tenait déjà à 3 000 (29 ms contre ~32,9), mais l'aperçu
lagait encore à l'usage : la valeur a été divisée par deux sur ce constat. Le gain mesuré est de
2 ms — 27 ms contre 29 — et il ne peut pas être plus grand, parce que **le plancher n'est plus le
semis mais le catalogue réel**, qui n'est pas plafonné par décision : environ 12 900 étoiles lues
au plein ciel, soit l'essentiel des 27 ms restants.

C'est donc la borne de ce levier. Si le lag persiste, il ne se réduira plus ici : le prochain
levier est le catalogue réel — ou le nombre d'arcs tracés, pas le nombre d'étoiles lues.

Deux vérifications de forme, lues sur les compteurs plutôt que sur les durées :

- **Le plafond borne un NOMBRE, pas une magnitude.** À 3 000, les deux cas 180° lisent exactement
  15 743 étoiles, que la pupille soit f/1,4 ou f/2,8 : la profondeur atteinte ne change plus rien
  au coût. À 60°, le cas f/2,8 lit désormais lui aussi le plafond (6 327 étoiles) : à 1 500, la
  magnitude plafond du champ de 34° tombe sous les 10,1 de la pose.
- **La passe non plafonnée est intacte.** `--empreinte --budget=0` rend `51895831`, `53814e53`,
  `20f4fe4b`, `a1de5779` — les condensés de `HEAD` avant ce ticket.

## Ce qui a été écrit

- `src/registry/constants.ts` — `BUDGET_ETOILES_FILE` (C-33), 1 500 étoiles, `ordreDeGrandeur`.
- `src/core/galactique.ts` — `magnitudeSemis(u)`, la loi de comptage, et
  `magnitudePlafondSemis(budget, rayonChampDeg)`, sa conversion en magnitude plafond.
  `src/data/semis.ts` importe la première au lieu de la récrire.
- `src/ui/dessine-champ.ts` — `budgetEtoiles: number | null` sur `ParametresFile` ; le rayon du
  champ, jusque-là calculé dans la couche, est extrait pour que le plafond et la sélection
  lisent le même. Seule la borne du semis est abaissée.
- `src/ui/planetarium-incrustation.ts` — le budget suit le MODE : `apercu === 'FILE'` ⇒ plafond,
  `'CHAMP'` ⇒ `null`.
- `src/ui/scene-overlay.ts` — `MENTION_PLAFOND_FILE`, à côté de `MENTION_VIGNETTAGE_FILE` ;
  affichée par `PanneauFile-sections.tsx` tant que l'aperçu est en filé.
- `scripts/bench-incrustation.ts` — `--budget=N` (0 = sans plafond) et le cas d'invariance.
