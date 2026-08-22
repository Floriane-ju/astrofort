---
{
  "id": "T-0110",
  "titre": "Relire tout src/ : coût par image, lignes en trop, défauts",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "audit",
    "performance",
    "qualite",
    "refactor"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-ticket-t-0110-relecture-d-optimisation-de-src.md"
}
---

## Contexte

Le 22 août 2026, une session partie d'une plainte d'affichage — « les étoiles disparaissent au
dézoom » — a trouvé tout autre chose en cherchant la cause de la saccade : la bande de la Voie
lactée émettait **1 662 `stroke()` par image**, un par segment, chacun étalant un trait large et
translucide sur le canevas. La moitié des segments ne changeait aucun pixel, et la moitié du
reste tombait derrière l'observateur. Trois corrections mécaniques — regrouper par teinte,
écarter ce qui ne se peint pas, écarter ce qui n'est pas dans le champ — ont ramené le rendu de
2,9 à 1,6 ms par image à 180° de champ, sans changer un pixel (`9615d12`).

Ce défaut vivait dans le code depuis T-0103. **L'audit transversal T-0054 ne l'a pas vu** : son
axe « Optimisation » comptait les allocations par image et le poids du bundle, jamais le nombre
d'appels de tracé. Le gisement est donc plus profond que ce qu'une passe a exploré, et rien ne
dit qu'il se limite au planétarium.

Ce ticket demande la seconde passe, et il diffère de T-0054 sur un point : **il corrige**.
T-0054 constatait et déléguait tout à des tickets fils, ce qui était juste pour un audit de
sécurité et de pratiques ; ici, une correction sûre — celle qui ne change ni le rendu ni un
contrat — s'applique dans le tour.

Périmètre : **tout `src/`** — `registry/`, `core/`, `data/`, `ui/`.

## Les trois axes

### 1. Coût par image

Le chemin chaud : `src/ui/dessine-ciel.ts`, `dessine-champ.ts`, `dessine-sol.ts`,
`dessine-fond-ciel.ts`, `planetarium-boucle.ts`, `scene-overlay.ts`, et côté calcul
`src/core/projection.ts`, `index-ciel.ts`, `sol.ts`, `file-etoiles.ts`, `cadre.ts`.

Ce qui se compte, et que T-0054 n'a pas compté :

- **appels de tracé par image** — `stroke()`, `fill()`, changements de `strokeStyle` /
  `fillStyle` / `globalAlpha`. Un appel par élément est le défaut qui vient d'être payé ;
- **points projetés par image**, et parmi eux ceux qui sont rejetés après projection alors
  qu'un test d'appartenance au champ les aurait écartés avant ;
- **travail répété d'une image à l'autre alors que son entrée n'a pas bougé** — la teinte d'un
  segment de bande ne dépend ni du zoom ni du défilement, elle se mémorise.

Le patron de mesure existe : contexte 2D espion qui compte les appels
(`contexteEspion`, `tests/dessine-ciel.test.ts`) et `scripts/bench-incrustation.ts` pour le filé.
Le patron de correction existe aussi : `champVisible` / `horsDuChamp`
(`src/ui/dessine-ciel.ts`) écartent une géométrie fixe par un produit scalaire avant de la
projeter, comme `selectionne` le fait des cellules d'étoiles (§3.3). Toute couche qui projette
une géométrie fixe doit être passée à cette question.

### 2. Lignes en trop

Logique dupliquée entre modules, indirections à un seul appelant, fonctions et composants qui ne
se lisent plus d'un bloc. Cibles déjà nommées par T-0054 et jamais retaillées : `src/App.tsx`,
`src/ui/Planetarium.tsx`, `src/ui/PanneauFile.tsx`, `src/ui/FicheCible.tsx`,
`src/core/session.ts`.

Les tables déclaratives du registre — `constants.ts`, `glossaire.ts` — restent longues : T-0054 a
tranché que les découper déplace le problème sans rien résoudre. Ce n'est pas rouvert ici.

### 3. Défauts

- **bugs de comportement** : calcul faux, cas limite non traité, état impossible atteignable ;
- **code mort et doublons** : exports sans consommateur, branches inatteignables, deux
  implémentations de la même formule. `pnpm dlx knip` et `ts-prune` comme à T-0054, sans rien
  installer.

À vérifier au passage : les neuf symboles morts du constat M1 de T-0054 ont-ils été traités par
T-0062 et T-0063, ou sont-ils toujours là ?

## Méthode

1. **Un chiffre, pas une intuition.** Toute affirmation de performance porte une mesure avant et
   après, aux mêmes champs et sur le même catalogue.
2. **La correction sûre s'applique dans le tour.** Sûre veut dire : rendu identique, contrat
   identique, test existant vert.
3. **Le changement structurel devient un ticket** citant T-0110. Pas de gros diff opportuniste
   glissé dans une passe d'optimisation.

## Critères d'acceptation

- [ ] Chacun des trois axes a produit une liste de constats écrite, chaque constat localisé en
      `fichier:ligne`, avec sa gravité et l'action retenue
- [ ] Les constats sans action — faux positifs, choix assumés — sont écrits comme tels avec leur
      raison : un axe ne se referme pas sur un silence
- [ ] Le coût par image est mesuré avant et après, aux mêmes champs (15°, 60°, 180°) et sur le
      même catalogue, et les deux chiffres figurent au ticket
- [ ] Aucune correction ne change ce qui s'affiche à l'écran sans que le ticket le dise
      explicitement et dise pourquoi
- [ ] `pnpm typecheck && pnpm test` passent, sortie réelle rapportée — pas de « ça devrait
      marcher »
- [ ] Chaque constat retenu est soit corrigé dans le tour, soit devient un ticket citant ce
      T-0110 — aucun constat n'est laissé sans suite

## Hors périmètre

- **Sécurité** — couverte par T-0054, suite tenue par T-0074.
- **Design** — visuel, ergonomie, typographie.
- **Règles de style du projet** et **écarts au PRD** : écartés du périmètre à la demande. Le PRD
  ne se modifie pas.

---

# Résultats — 22 août 2026

## L'instrument, d'abord

`pnpm bench:ciel` existait mais était figé à 30° de champ et ne comptait que les **allocations** —
exactement l'angle mort qui avait laissé passer les 1 662 `stroke()`. Trois ajouts à
`scripts/bench-ciel.ts` :

- `--fov=`, `--az=`, `--alt=` : la scène se choisit. Un défaut ne se voit pas au même champ pour
  toutes les couches — les étoiles dominent en vue serrée, la bande et les frontières en vue large.
- `--appels` : compte les **ordres de peinture** — `stroke`, `fill`, `fillText`, `fillRect`, les
  affectations de style, et la part de celles qui réécrivent la valeur déjà en place.
- `--effective` : une empreinte qui ne hache que ce qui **touche un pixel**. Elle ignore trois
  choses, et c'est ce qui la rend capable de valider une optimisation : une écriture de style que
  rien n'utilise, un `stroke()` sur un chemin vide, et un segment qui tombe hors du canevas.
  L'empreinte `--empreinte` existante hache le flux d'ordres complet : elle crie à la régression
  dès qu'un ordre inutile disparaît, ce qui est précisément ce qu'on cherche à faire.

C'est `--effective` qui a arbitré tout le reste, et c'est elle qui a **attrapé une vraie
régression** en cours de route (voir C2).

## Axe 1 — coût par image

### Mesures, mêmes catalogues, mêmes visées (1920×1080, azimut 180°, hauteur 40°)

| Champ | ordres de peinture | affectations de style | ordres de chemin | ms/image (médiane de 5) |
|---|---|---|---|---|
| **15°** | 165 → **47** (−72 %) | 320 → **84** (−74 %) | 2 959 → **661** (−78 %) | 0,58 → **0,39** (−33 %) |
| **60°** | 172 → **140** (−19 %) | 326 → **262** (−20 %) | 4 427 → **2 507** (−43 %) | 0,62 → **0,50** (−19 %) |
| **180°** | 191 → **184** (−4 %) | 345 → **331** (−4 %) | 7 181 → **7 174** (−0 %) | 1,02 → **0,99** (−3 %) |

Le gain se concentre en vue serrée, et c'est cohérent : à 180° de champ presque tout est
effectivement visible, il n'y a plus rien à écarter. Le banc peint sur un contexte **muet** —
il chiffre le calcul, pas le pilote graphique. Les 118 `stroke()` supprimés à 15° coûtent
davantage sur un vrai canevas que dans cette colonne « ms ».

### C1 — la bande émettait un tracé par teinte, même sans un seul segment à l'écran — **HAUTE — corrigé**

`src/ui/dessine-ciel.ts:529` (avant correction). Le regroupement par teinte de `9615d12` avait
ramené 1 662 `stroke()` à 145, mais les 145 étaient émis **inconditionnellement** : `globalAlpha`,
`strokeStyle`, `beginPath` et `stroke()` partaient pour chaque teinte, y compris pour les teintes
dont tous les segments venaient d'être écartés par `horsDuChamp`. À 15° de champ, où la bande
n'occupe qu'une fraction du ciel, 118 de ces 145 tracés ne posaient pas un pixel.

Correction : le chemin se construit d'abord, la teinte ne se pose qu'à la première géométrie
retenue, et le `stroke()` n'a lieu que si le chemin n'est pas vide. À 15°, `stroke` 145 → 27,
`beginPath` 145 → 27.

### C2 — les frontières, figures et astérismes projetaient la sphère entière à chaque image — **HAUTE — corrigé**

`src/ui/dessine-ciel.ts` — `cheminLignes`, `traceSegments`. Géométrie J2000 **fixe** : elle ne
bouge ni au zoom ni au défilement. Elle était intégralement projetée à chaque image, quel que
soit le champ. Mesuré à 15° de champ, couche par couche, en sommets projetés
(`moveTo` + `lineTo`), chaque couche isolée en éteignant les autres :

| couche | avant | après |
|---|---|---|
| frontières | 1 413 | **41** |
| figures | 500 | **34** |
| astérismes | 348 | **6** |
| bande (déjà écartée par `9615d12`) | 232 | 232 |

La bande sert de témoin : elle portait déjà l'écart, et son chiffre ne bouge pas.

C'est le défaut de la bande, sur la couche d'à côté, et le patron de correction était déjà dans
le fichier. Chaque polyligne et chaque constellation reçoit une **calotte englobante** — direction
moyenne et écart angulaire maximal — calculée une fois et mémorisée sur le tableau lui-même
(`WeakMap`, comme `bandeMemo` mémorise la bande). Un produit scalaire écarte la couche entière
avant toute projection.

**Une régression a été introduite ici, puis attrapée par la mesure.** `champVisible` plafonne son
rayon à `FOV_MAX_DEG / 2`. Ce plafond convient à la sélection d'étoiles — sélectionner trop
d'étoiles n'est pas une faute — mais pas à l'écart : au-delà, la calotte est **plus petite** que
ce que le canevas montre, et l'écart effaçait des frontières visibles. Constaté à 170° de champ
par `--effective`, invisible à 15° et à 60°. D'où `champPourEcart`, qui renvoie `null` au-delà du
plafond : au-dessus, plus rien ne s'écarte. C'est aussi pourquoi la colonne 180° du tableau ne
bouge pas — par construction, et non par échec.

**Preuve que le rendu n'a pas changé** : `--effective` comparée avant/après sur **160
configurations** — 8 azimuts × 5 hauteurs (−20° à 89°) × 4 champs, puis un balayage de champ de
10° à 180° par paliers. **Zéro divergence.**

### C3 — l'aperçu du filé, jusqu'à 786 ms sur le fil principal — **HAUTE — → T-0111**

`pnpm bench:file` : 786 ms et 11,5 M projections au pire cas. **Hors de cet axe** : l'aperçu est
rendu hors écran, mis en cache dans une `ref` et sauté pendant les gestes — il ne coûte rien *par
image*. Mais c'est une tranche de calcul bloquante, et `src/ui/dessine-champ.ts:202-203` projette
la bande galactique sans aucun écart préalable — le défaut de C2, non corrigé. Le tracé par étoile
du filé (`:296-316`) est un cas **différent**, pas une recopie : largeur et opacité sont propres à
chaque trace. Arbitrage nécessaire → **T-0111**.

### C4 — constats sans action, avec leur raison

- `src/ui/dessine-ciel.ts:807-809` — un `beginPath`/`arc`/`fill` par corps mobile. Mesuré :
  **9 `fill` par image**, tous champs confondus. Les corps du système solaire se comptent sur
  les doigts ; grouper coûterait plus de code que d'ordres économisés.
- `src/ui/dessine-ciel.ts:886-887` — un `stroke()` par cadre matériel. **Non mesuré** : la scène
  de référence du banc ne porte aucun cadre (`cadres: []`), et l'activer ne change que la pose
  du style. Lu au code : un tracé par cadre de la liste, et la liste en compte un. Sans objet.
- Affectations de style **redondantes** — réécrire une propriété avec la valeur qu'elle porte
  déjà. Mesurées par propriété : à 15°, `strokeStyle` 3 et `lineWidth` 6 ; à 180°,
  `strokeStyle` 35, `fillStyle` 23 et `lineWidth` 6. Les `strokeStyle` viennent de la bande —
  ses teintes sont groupées par `couleur|opacité`, donc deux groupes de même couleur à deux
  opacités reposent la même couleur. Les regrouper par couleur d'abord et par opacité ensuite
  économiserait 35 affectations sur 331 à 180°, au prix d'un niveau de boucle et d'un ordre de
  peinture différent — le rapport ne le justifie pas. Les `lineWidth` viennent des couches qui
  reposent `lineWidth = 1` après la bande, et les découpler couplerait des couches que §3.3
  veut indépendantes.

## Axe 2 — lignes en trop

### C5 — `heure()` défini deux fois, dont un commenté « comme partout ailleurs » — **MOYENNE — corrigé**

`src/ui/Verdicts.tsx:34` et `src/ui/PlanSession.tsx:34` portaient la même fonction, au caractère
près. Le commentaire de la première promettait un format partagé que deux définitions ne peuvent
pas tenir. Un plan de séance et le verdict qui le justifie citent les mêmes créneaux. Une seule
définition, dans `src/ui/horaire.ts`.

### C6 — treize définitions locales de la conversion degré/radian — **BASSE — → T-0112**

`src/core/mat3.ts:26` exporte `DEG`. Treize autres emplacements le redéfinissent sous trois noms,
dont `RADIAN_PAR_DEG` qui nomme l'inverse de ce qu'il vaut, et deux **dans un corps de fonction**
de `index-ciel.ts`, chemin chaud de §3.3. Le seul cas tombant dans le diff de ce ticket a été
traité (`dessine-ciel.ts` écrivait la conversion à la main et importe désormais `DEG`). Le reste
est un balayage sur douze fichiers : la méthode de ce ticket l'interdit ici → **T-0112**.

### C7 — constats sans action, avec leur raison

- **« Indirections à un seul appelant »** — `evalueMateriel`, `contexteFiche`, `panneauFile`,
  `profilsDeCadre` (`src/ui/app-calcul.ts`), `useResolutionSuitLaBoite`
  (`src/ui/Planetarium.tsx`). **Rejeté.** Replier une fonction nommée dans son unique appelant ne
  supprime pas ses lignes, il les déplace — et gonfle l'appelant. Les quatre premières feraient
  passer un `useMemo` à plus de cent lignes mêlant état et calcul, ce que les règles du projet
  demandent explicitement de découper. Un seul appelant aujourd'hui n'est pas un défaut quand le
  nom porte l'intention.
- **Gros porteurs relevés par T-0054** — `App.tsx` (199 l.), `Planetarium.tsx` (335 l.),
  `PanneauFile-sections.tsx` (395 l.), `Verdicts.tsx` (480 l.), `session.ts` (338 l.).
  **Légitimement longs** : tous sont des assembleurs plats de sous-composants ou de sections
  autonomes et nommées, aucun ne mêle état, calcul et JSX dans une même fonction. Le seuil du
  projet est 800 lignes ; aucun ne l'approche. Rien à couper.

## Axe 3 — défauts

### C8 — code mort : **aucun** — constat clos

`pnpm dlx knip` et `ts-prune` signalent 48 exports et 39 types non consommés hors de leur fichier.
Vérification au grep, un par un, tests et scripts compris : **zéro vrai positif**. Les exports
signalés sont une surface d'API interne vivante dans son propre fichier ; les types sont obtenus
par inférence chez les appelants et ne pèsent rien au bundle.

**Reprise du constat M1 de T-0054** — les neuf symboles morts sont tous traités : sept supprimés
par T-0063 (`angleRotationCiel`, `traceInterpolation`, `traceRayonEtoile`, `perteSnr`,
`plageUtilePose`, `chercheBoitier`, le ré-export Bortle de `sky-background.ts`), deux désormais
affichés à l'écran par T-0062 (`SOURCE_TABLE_BORTLE` dans `PanneauSeance.tsx:124`,
`SOURCE_TABLE_FILTRES` dans `Verdicts.tsx:422`). **T-0062 et T-0063 sont effectivement soldés.**

### C9 — modulo négatif dans `src/core/site.ts:114` — **FAUX POSITIF**

`masqueDepuisPoints` fait `Math.round(azimut) % NB_AZIMUTS` sans le double modulo que
`obstructionDeg:144` applique, ce qui donnerait un index négatif pour un azimut négatif.
**Inatteignable** : la ligne précédente passe par `valide('azimut_masque_deg', …)`, dont le
domaine est `[0, 360]` et qui **lève** hors plage. L'asymétrie entre les deux lignes est réelle,
le bug ne l'est pas — `obstructionDeg` reçoit un azimut de visée quelconque, `masqueDepuisPoints`
une saisie validée. Pas d'action.

### C10 — aucun autre bug de comportement trouvé

Relecture des 29 modules de `src/core/` et `src/data/` sur : division par zéro, `acos` hors
[-1,1], racine d'un négatif, modulo négatif, passage de minuit, latitude polaire, azimut
enjambant 0/360, tableau vide, `NaN` propagé, `<` contre `<=` sur un seuil de verdict,
comparateur de tri instable, `!` masquant un accès hors borne. Les bornes trigonométriques sont
systématiquement clampées, les domaines validés à l'entrée. Rien à signaler.

## Ce qui protège le résultat

`tests/dessine-ciel.test.ts` — 17 tests ajoutés (716 → 733). Seize comparent, pour 4 champs × 4
visées, les segments **réellement peints sur le canevas** à une référence recalculée dans le test
**sans aucun écart** : l'écart ne doit retirer que ce qui ne peint pas. Le dix-septième vérifie
qu'un champ serré cesse de projeter la sphère entière.

Les deux gardes ont été **vérifiés par mutation** — un test qui ne casse rien ne protège rien :

| mutation | résultat |
|---|---|
| rayon du champ divisé par deux (écart trop large) | **10 tests échouent** |
| écart supprimé | **1 test échoue** |
| code restauré | 65 tests passent |

## Vérification

```
$ pnpm typecheck
$ tsc --noEmit

$ pnpm test
 Test Files  54 passed (54)
      Tests  733 passed (733)
```

## Suite

- **T-0111** — l'aperçu du filé bloque le fil principal jusqu'à 786 ms (C3).
- **T-0112** — une seule définition de la conversion degré/radian (C6).

## Critères d'acceptation

- [x] Chacun des trois axes a produit une liste de constats localisée en `fichier:ligne`, avec
      gravité et action retenue — C1 à C10
- [x] Les constats sans action sont écrits comme tels avec leur raison — C4, C7, C8, C9, C10
- [x] Le coût par image est mesuré avant et après, aux mêmes champs (15°, 60°, 180°) et sur le
      même catalogue — tableau ci-dessus
- [x] Aucune correction ne change ce qui s'affiche : empreinte de peinture identique sur 160
      configurations de visée et sur tout le domaine de champ
- [x] `pnpm typecheck && pnpm test` passent, sortie réelle rapportée
- [x] Chaque constat retenu est corrigé (C1, C2, C5) ou devient un ticket citant T-0110
      (C3 → T-0111, C6 → T-0112)
