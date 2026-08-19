---
{
  "id": "T-0054",
  "titre": "Auditer le code : sécurité, pratiques, code mort, optimisation",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "audit",
    "securite",
    "qualite",
    "performance"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-ticket-d-audit-du-code-securite-pratiques-code-mort-optimisa.md"
}
---

## Contexte

Cinquante-trois tickets de fonctionnalités et de performance ciblée plus tard
(epic T-0021 et ses enfants), aucune passe transversale n'a jamais été faite sur
la santé du code. Rien ne la signale non plus : `package.json` n'expose que
`dev`, `build`, `preview`, `test`, `typecheck`, `data:build`, `bench:file` — ni
linter, ni détecteur de code mort. Un import mort, une dépendance inutilisée ou
un `innerHTML` glissé dans le rendu passeraient sans bruit.

Ce ticket **pose l'audit**, il ne le fait pas et ne corrige rien. Son résultat
attendu est une liste de constats écrite ; chaque constat qui mérite correction
devient son propre ticket.

Périmètre : `src/`, `scripts/`, `tests/`, `public/data/`, la configuration Vite
et PWA. **Le design — visuel, ergonomie, typographie — est hors périmètre.**

### Les quatre axes

1. **Sécurité** — la surface réelle d'une PWA sans backend : chaîne
   d'approvisionnement (`pnpm audit`, scripts de cycle de vie des dépendances),
   stratégie de cache du service worker (`vite-plugin-pwa`), données persistées
   dans IndexedDB (`idb`), toute injection HTML/DOM non échappée, absence de
   secret en dur.
2. **Bonnes pratiques de dev** — les règles du projet tenues ou non : fichiers
   sous 800 lignes, fonctions sous 50 lignes, pas de mutation, validation aux
   frontières (décodage des catalogues binaires, saisies des panneaux de
   réglages), `any` et `as` de complaisance, couverture des tests.
3. **Code mort** — exports non consommés, fichiers orphelins, dépendances
   inutilisées, branches mortes des composants et des scripts, tests désactivés.
   Outillage en `pnpm dlx` (knip, ts-prune, depcheck) : passe unique, rien à
   installer.
4. **Optimisation** — ce que T-0021 n'a pas couvert : allocations par image,
   recalculs React évitables, taille des artefacts de `public/data/`, poids du
   bundle après `pnpm build`.

## Critères d'acceptation

- [x] Chacun des quatre axes a produit une liste de constats écrite, chaque
      constat localisé en `fichier:ligne`, avec une gravité et l'action proposée
- [x] Les constats sans action — faux positifs, choix assumés — sont écrits comme
      tels avec leur raison : un axe ne se referme pas sur un silence
- [x] `pnpm audit` est passé et son résultat reporté ; toute vulnérabilité haute
      ou critique donne lieu à un ticket
- [x] Chaque constat retenu est soit corrigé dans le tour, soit devient un ticket
      citant ce T-0054 — aucun constat n'est laissé sans suite
- [x] Aucune modification de code n'est faite au titre de l'audit lui-même :
      l'audit constate, les tickets qui en sortent corrigent
- [x] Le design reste hors périmètre du début à la fin

---

# Constats — 18 août 2026

Outils passés : `pnpm audit`, `pnpm build`, `pnpm test`, `pnpm dlx knip`
(entrées `src/main.tsx`, `scripts/*.ts`, `tests/**`). Aucun fichier de `src/`,
`scripts/` ou `tests/` n'a été modifié.

État de départ : `pnpm test` → 472 tests, 40 fichiers, tous verts.
`pnpm build` → succès, un fragment de 542,21 Ko (179,89 Ko gzip).

## Axe 1 — Sécurité

### S1 · Le service worker s'enregistre, mais rien ne propose sa mise à jour — **moyenne**

`vite.config.ts:12` déclare `registerType: 'prompt'`. Aucun `virtual:pwa-register`
n'est importé dans `src/` : `dist/registerSW.js` enregistre bien `/sw.js`, mais
aucune interface ne propose l'activation. Un nouveau service worker reste donc
indéfiniment en attente tant qu'un onglet est ouvert — un correctif, y compris
de sécurité, n'atteint pas l'utilisateur.
→ **T-0058**

### S2 · Un manifeste malformé bloque l'application sur « Vérification en cours… » — **haute**

`src/App.tsx:157-166` enchaîne `void demarre().then(...)` sans `.catch()` ni
nettoyage au démontage. `src/data/bootstrap.ts:106` appelle `manifestes.map(...)`
**hors** du `try` de `chargeManifeste` : un `manifest.json` qui n'est pas un
tableau lève, la promesse est rejetée en silence, `etat` reste `null`, et
`src/ui/Verification.tsx:35` affiche « Vérification en cours… » pour toujours.
Cela contredit frontalement l'en-tête de `bootstrap.ts:5` : « Aucune ne doit
produire un écran blanc ni une erreur technique brute : chaque échec a une cause
nommée et une conduite à tenir. »
→ **T-0055**

### S3 · Les catalogues se construisent depuis des références amont mouvantes — **moyenne**

`scripts/build-catalogs.ts:39,41,49,56` téléchargent depuis `main`, `master` et
`CURRENT`, sans somme de contrôle amont. Le `sha256` du manifeste atteste ce qui
a été construit, jamais ce qui a été téléchargé : un changement amont — accident
ou compromission — entre dans les paquets binaires sans que rien ne le signale.
Portée limitée : la construction tourne sur un poste de dev et les `.bin` sont
versionnés dans git.
→ **T-0059**

### S4 · Le réimport ne valide que la forme du dessus — **moyenne**

`src/data/persistence.ts:109-127` vérifie `format`, `version` et que les trois
sections sont des tableaux. Aucun élément n'est validé avant `put`
(`persistence.ts:135-137`). Un export retouché à la main pose `latitudeDeg: "abc"`
dans IndexedDB, d'où des `NaN` dans toute la chaîne de calcul — persistés.
→ **T-0057**

### S5 · L'erreur d'import n'atteint jamais l'utilisateur — **moyenne**

`src/App.tsx:394-397` : `surImport` n'entoure ni `JSON.parse` ni
`importeDonneesUtilisateur` d'un `try`. Le message d'`ExportInvalideError`, pourtant
rédigé avec soin (`persistence.ts:102-107`), part en rejet non géré ; l'écran
n'affiche rien.
→ **T-0057**

### S6 · `litEtatPersiste` fusionne du JSON non validé — **basse**

`src/ui/ModeNuit.tsx:44` : `{ ...ETAT_INITIAL, ...(JSON.parse(brut) as object) }`.
Un `localStorage` retouché pose n'importe quoi dans `luminance`, repoussé ensuite
dans `document.documentElement.style.setProperty` (`ModeNuit.tsx:67`). **Pas
d'injection possible** : le CSSOM rejette une valeur invalide, `setProperty`
n'échappe pas vers une autre déclaration. Le risque se limite à un état
incohérent.
→ **T-0057**

### S7 · `pnpm audit` — *sans action*

`No known vulnerabilities found`. Aucune vulnérabilité, donc aucun ticket au
titre du critère d'acceptation.

### S8 · Aucune injection HTML/DOM — *sans action*

Grep sur `src/`, `scripts/`, `tests/` : zéro `innerHTML`, `outerHTML`,
`dangerouslySetInnerHTML`, `eval(`, `new Function`, `document.write`,
`insertAdjacentHTML`. Zéro `RegExp` construite depuis une saisie. Tout le texte
passe par les nœuds React ou `ctx.fillText`.

### S9 · Aucun secret en dur — *sans action*

Grep `api[_-]?key|secret|password|token|bearer|authorization` sur `src/`,
`scripts/` et `public/data/manifest.json` : aucune occurrence. Cohérent avec une
PWA sans backend — il n'y a pas de secret à porter.

### S10 · Scripts de cycle de vie des dépendances — *sans action*

`packageManager: "pnpm@11.8.0"`, aucun `pnpm-workspace.yaml`, donc aucun
`onlyBuiltDependencies` : `preinstall` / `install` / `postinstall` sont bloqués
par défaut pour les quatre dépendances et les neuf devDependencies. C'est la
posture voulue, elle est déjà tenue.

### S11 · `decodeConstellations` fait un `JSON.parse` non validé — *sans action*

`src/data/constellations.ts:95`. Le paquet n'atteint le décodage qu'après
`verifieIntegrite` (SHA-256, `src/data/catalog.ts:102-109`) et il est servi
depuis la même origine. Le seul scénario restant est un `.bin` corrompu, que le
contrôle d'intégrité couvre déjà.

### S12 · Le manifeste est casté sans validation — *sans action*

`src/data/bootstrap.ts:62` : `(await reponse.json()) as ManifestePaquet[]`. Un
champ manquant échoue **du bon côté** — `buffer.byteLength !== manifeste.octets`
avec `octets` à `undefined` donne `CORROMPU`, et une empreinte absente ne peut
pas correspondre. Le seul cas non sûr, « ce n'est pas un tableau », est traité
en S2.

## Axe 2 — Bonnes pratiques de dev

### P1 · Quatre fichiers dépassent 800 lignes — **moyenne** (partiel)

`src/registry/constants.ts` 1514, `src/registry/glossaire.ts` 1074,
`src/ui/FicheCible.tsx` 926, `src/core/session.ts` 873.

Les deux premiers sont des **tables déclaratives** du registre §2.1 : *sans
action*, découper une table de constantes en tranches de 400 lignes déplace le
problème sans rien résoudre. Les deux autres portent de la logique.
→ **T-0064**

### P2 · Vingt-trois fonctions dépassent 50 lignes, onze dépassent 100 — **moyenne**

En tête : `App` 540 (`src/App.tsx:122`), `Planetarium` 428
(`src/ui/Planetarium.tsx:239`), `PanneauFile` 370 (`src/ui/PanneauFile.tsx:96`),
`FicheCible` 301 (`src/ui/FicheCible.tsx:203`), `Verdicts` 276
(`src/ui/FicheCible.tsx:651`), `dessineCiel` 225 (`src/ui/dessine-ciel.ts:222`),
`PanneauExplorer` 187, `MenuInfos` 155, `PlanSessionVue` 140,
`cartePoseMax` 139 (`src/core/grand-champ.ts:83`), `sequenceFile` 126
(`src/core/sequence-file.ts:101`).

Les cinq premiers sont des composants qui mêlent état, calcul et JSX.
`dessineCiel` est une boucle de rendu : son découpage ne se décide pas sans
mesure — voir O2.
→ **T-0064**

### P3 · Aucun linter, et une directive de linter absent qui masque un vrai défaut — **moyenne**

`package.json:6-14` n'expose ni ESLint ni Biome. Conséquence constatable :
`src/App.tsx:348` porte `// eslint-disable-next-line react-hooks/exhaustive-deps`,
une directive pour un outil qui n'existe pas dans le projet. Elle ne désactive
rien — et elle masque une liste de dépendances réellement incomplète : le
`useMemo` du plan lit `zeroSysteme.valeur`, `zeroSysteme.estime` et
`iso.readNoiseE` sans qu'ils figurent dans son tableau de dépendances.
→ **T-0060**

### P4 · La couverture n'est pas mesurée — **moyenne**

`vitest` sans `@vitest/coverage-v8`, aucun script `test:coverage`, aucune
configuration `test.coverage` dans `vite.config.ts`. 472 tests passent, mais le
seuil de 80 % que le projet s'est donné n'est ni mesuré ni prouvé. Huit modules
ne sont importés par aucun test : `src/main.tsx`, `src/ui/Terme.tsx`,
`src/ui/Verification.tsx`, `src/ui/Coque.tsx`, `src/ui/PanneauSeance.tsx`,
`src/ui/PlanSession.tsx`, `src/ui/TracedValue.tsx`, `src/registry/filters.ts`.
→ **T-0061**

### P5 · Aucun test désactivé — *sans action*

Zéro `.skip`, `.todo`, `.only`, `xit(`, `xdescribe(` dans `tests/`. Rien n'est
mis de côté en silence.

### P6 · L'immutabilité est tenue — *sans action*

`readonly` systématique sur les interfaces, `Object.freeze` sur toutes les tables
du registre, magasins de module réécrits par étalement
(`src/ui/scene-etat.ts:190-216`, `src/ui/seance-etat.ts`). Les seize `.sort()`
relevés portent tous sur un tableau fraîchement construit — `.filter().sort()`,
`.slice().sort()`, `[...map.entries()].sort()`. La seule exception apparente,
`src/core/index-ciel.ts:122`, trie `panier.indices`, un tableau que
`construitIndex` vient d'allouer trois lignes plus haut.

### P7 · Les `as` sont maîtrisés, aucun `any` — *sans action*

34 occurrences, toutes justifiées : `.map(Object.freeze) as X[]` (contournement
d'une limite de TypeScript, 8×), `e.target.value as X` sur des `<select>` dont
les options sont énumérées dans le JSX juste au-dessus (12×), deux casts
`OffscreenCanvas` (`src/ui/scene-overlay.ts:91,110`). Zéro `any`, zéro
`@ts-ignore`, zéro `@ts-expect-error`. `tsconfig.json` tient `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`,
`noUnusedParameters`, `verbatimModuleSyntax`.

### P8 · Validation des saisies d'interface — *sans action*

`src/registry/domains.ts` déclare une plage nommée par champ du PRD, et
`SaisieRefuseeError` cite le champ fautif. Les frontières qui manquent ne sont
pas celles de la saisie mais celles de la **désérialisation** — S4, S5, S6.

## Axe 3 — Code mort

`pnpm dlx knip` : **aucun fichier orphelin, aucune dépendance inutilisée**. Les
quatre dépendances et les neuf devDependencies sont toutes consommées. 45 exports
et 39 types signalés — chacun vérifié à la main, ce qui les sépare en trois tas.

### M1 · Neuf symboles réellement morts — **basse**, sauf deux — **moyenne**

Déclarés, appelés nulle part : ni dans `src/`, ni dans `scripts/`, ni dans
`tests/`.

| Symbole | Emplacement | Nature |
|---|---|---|
| `angleRotationCiel` | `src/core/ephem.ts:91` | doublon de `src/core/horloges.ts:130`, même formule `ANGLE_ROTATION_CIEL` |
| `traceInterpolation` | `src/core/horloges.ts:273` | écrit pour §10.2, jamais branché |
| `traceRayonEtoile` | `src/core/projection.ts:283` | écrit pour §10.2, jamais branché |
| `perteSnr` | `src/data/equipment.ts:154` | écrit pour §2.3, jamais branché |
| `plageUtilePose` | `src/data/equipment.ts:159` | écrit pour §2.3, jamais branché |
| `chercheBoitier` | `src/data/equipment.ts:190` | un seul boîtier en base, la recherche n'a pas d'appelant |
| ré-export `BORTLE_MIN`, `BORTLE_MAX`, `BortleHorsTableError` | `src/core/sky-background.ts:124` | les consommateurs importent depuis `registry/bortle.ts` |
| `SOURCE_TABLE_BORTLE` | `src/registry/bortle.ts:38` | **promesse de traçabilité non tenue** |
| `SOURCE_TABLE_FILTRES` | `src/registry/filters.ts:79` | **promesse de traçabilité non tenue** |

Les deux dernières lignes ne sont pas du gras mais un **manque fonctionnel** :
`SOURCE_TABLE_CONTRASTE` s'affiche bien à l'écran
(`src/ui/FicheCible.tsx:710`), ses deux jumelles nulle part. La source du Bortle
et celle des filtres sont écrites et invisibles.
→ **T-0062** (les deux sources), **T-0063** (les sept autres)

### M2 · Trente-sept exports superflus — *sans action*

Le symbole est vivant, mais consommé uniquement dans son propre fichier :
`verifieCatalogues` et `detecteWebGL2` (appelés par `demarre`), les cinq `score*`
de `src/core/session.ts:205-224`, `NOM_BASE` / `VERSION_BASE`
(`src/data/db.ts:12-13`), `PAQUET_ETOILES` / `PAQUET_CONSTELLATIONS` /
`PAQUET_GAIA`, `OCTETS_PAR_OBJET`, `SEPARATEUR_NOMS`,
`TAILLE_PONCTUELLE_ARCMIN`, `TABLE_FILTRES`, `useNiveau`, `ecritEtatPersiste`…

Ce n'est pas du code mort : c'est de la surface d'API sans consommateur. Retirer
ces `export` ne supprime pas une ligne de code exécutable, casse la testabilité
de plusieurs d'entre eux, et transformerait chaque futur besoin en re-export.
Choix assumé de les laisser.

### M3 · Trente-neuf types exportés non consommés hors de leur fichier — *sans action*

`Recommandation`, `BudgetNuit`, `CibleEcartee`, `CellulePose`, `Ancrage`, `Saut`…
Ce sont les types des interfaces publiques des moteurs, que les appelants
obtiennent par inférence sans les nommer. TypeScript n'émet rien pour eux : leur
retrait ne gagne pas un octet et coûte en lisibilité.

## Axe 4 — Optimisation

### O1 · L'application entière se rend deux fois par seconde — **haute**

`src/App.tsx:152` — `const { msAffiche } = useScene()` abonne le composant `App`
(540 lignes) au magasin de scène, que la boucle de rendu republie toutes les
500 ms (`PERIODE_DIAGNOSTIC_MS`, `src/ui/Planetarium.tsx:79`, via `afficheInstant`
à `Planetarium.tsx:527`).

Aucun composant du projet n'est mémoïsé : `React.memo` n'apparaît nulle part dans
`src/`, et `useCallback` non plus. Chaque publication reconcilie donc tout
l'arbre — `Planetarium`, `PanneauSeance`, `FicheCible`, `PlanSessionVue`,
`MenuInfos`. Les `useMemo` protègent les calculs, pas la reconciliation.

Le seul usage de `msAffiche` dans `App` est `epoqueAnnee(new Date(msAffiche))`
(`src/App.tsx:501`) — une valeur qui change une fois par an.
`src/ui/FicheCible.tsx:241` porte le même abonnement.
→ **T-0056**

### O2 · Deux objets alloués par étoile et par image — **moyenne**

Dans la boucle chaude : `src/ui/dessine-ciel.ts:283` alloue le littéral d'entrée
`projecteur.projette({ x, y, z })`, et `src/core/projection.ts:150` alloue le
`PointEcran` retourné. À 24 im/s (`INTERVALLE_MIN_MS`, `Planetarium.tsx:82`) et
quelques milliers d'étoiles retenues, l'ordre de grandeur est 10⁵ objets par
seconde à collecter.

S'y ajoutent, une fois par image (`Planetarium.tsx:466-518`) : `new Date`,
`cielInstantane`, `positionsInterpolees`, `etat.props.profils.map(…)`, le
projecteur et ses fermetures, la fermeture `surLeFond`, le littéral d'entrée de
`dessineCiel` — plus `palette()` (`dessine-ciel.ts:224`) et les `TEINTES`
`Path2D` de `dessine-ciel.ts:271`.

**À mesurer avant de corriger** : `scripts/bench-incrustation.ts` fournit déjà le
harnais, et les `Path2D` ne se réutilisent pas (l'API n'a pas d'effacement).
→ **T-0065**

### O3 · Un seul fragment de 542 Ko, au-delà du seuil d'avertissement de Vite — **basse**

`pnpm build` le signale : « Some chunks are larger than 500 kB ». Aucun `import()`
dynamique dans `src/`.

Le registre pèse 144 Ko de source. La part **réellement détachable** est
`src/registry/glossaire.ts`, 53 Ko, importé par les seuls `src/ui/Terme.tsx` et
`src/ui/TracedValue.tsx` — l'explication §10.2. `constants.ts` (47 Ko) est lu par
39 modules et `formulas.ts` (18 Ko) par `core/traced.ts` : ni l'un ni l'autre
n'est détachable.
→ **T-0066**

### O4 · Travail dupliqué et non mémoïsé dans `App` — **basse**

- `calculeFenetreUtile(site, calcul.nuit)` est calculé par le `useMemo`
  `fenetreUtile` (`src/App.tsx:255`) puis **recalculé à l'identique** dans le
  `useMemo` `plan` (`src/App.tsx:342`).
- `pointZeroSysteme(BOITIER_REFERENCE)` (`src/App.tsx:177`) et
  `isoRecommande(BOITIER_REFERENCE)` (`src/App.tsx:260`) sont réévalués à chaque
  rendu alors que leur unique argument est une constante de module.
- `site` est construit deux fois, dans le `useMemo` `calcul` (`src/App.tsx:184`)
  et dans le sien (`src/App.tsx:246`).

Même fichier et même passe que O1.
→ **T-0056**

### O5 · Taille des artefacts de `public/data/` — *sans action*

`hyg-1.bin` 1 001 748 o = 83 479 × 12 o **exactement**. `openngc-1.bin`
350 504 o = 12 518 × 28 o. `openngc-noms-1.bin` 101 090 o.
`constellations-1.bin` 269 604 o. Aucun remplissage, aucun résidu. Le précache
du service worker déclare 10 entrées pour 2 222 Kio, ce qui couvre les quatre
paquets et le code.

### O6 · `constellations-1.bin` est du JSON, pas du binaire — *sans action*

`src/data/constellations.ts:87` encode en JSON UTF-8, à rebours du principe posé
en tête de `src/data/catalog.ts:4` (« Jamais du CSV, jamais du JSON »).
L'exception est **déjà argumentée sur place**, `constellations.ts:13-17` : « Un
codec binaire économiserait une centaine de kilo-octets sur un paquet qui en pèse
deux cents, au prix d'un format de plus à vérifier. » Le gain réel après
compression de transport est plus faible encore. Choix assumé, écrit, laissé tel
quel.

## Ce que l'audit n'a pas regardé

Le design — visuel, ergonomie, typographie — est resté hors périmètre du début à
la fin, conformément au ticket. `src/ui/styles.css` n'a pas été ouvert.
