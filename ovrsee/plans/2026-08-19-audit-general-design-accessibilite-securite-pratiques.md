---
{
  "status": "open",
  "title": "Audit général — design, accessibilité, sécurité, pratiques",
  "opened": "2026-08-19",
  "closed": null,
  "commits": [
    {
      "sha": "ee22e86",
      "date": "2026-08-19",
      "files": [
        "index.html",
        "package.json",
        "public/icones/apple-touch-icon.png",
        "public/icones/favicon.png",
        "public/icones/icone-192.png",
        "public/icones/icone-512-maskable.png",
        "public/icones/icone-512.png",
        "scripts/build-icones.ts",
        "tests/icones.test.ts",
        "vite.config.ts"
      ]
    },
    {
      "sha": "5caaa4c",
      "date": "2026-08-19",
      "files": [
        ".gitignore",
        "src/ui/Planetarium.tsx",
        "src/ui/styles.css",
        "tests/mode-nuit.test.tsx"
      ]
    },
    {
      "sha": "b874126",
      "date": "2026-08-21",
      "files": []
    }
  ]
}
---

# Audit général — design, accessibilité, sécurité, pratiques

## Contexte

L'audit T-0054 (18 août 2026) a couvert quatre axes — sécurité, bonnes pratiques, code mort,
optimisation — et **a explicitement exclu le design** : sa dernière section dit
« `src/ui/styles.css` n'a pas été ouvert ». L'accessibilité n'a jamais été regardée du tout.

Cet audit-ci couvre ce qui restait : **design, accessibilité**, et les angles de sécurité et de
livraison que T-0054 n'a pas atteints (CSP, installabilité, intégration continue). Il ne
reprend aucun constat déjà ticketé : T-0055, T-0058, T-0060, T-0061, T-0062 et T-0066 restent
ouverts et gardent leur périmètre.

Résultat attendu : **2 epics et 9 tickets enfants, plus 1 ticket orphelin**, tous posés en
colonne `pret` pour tri. Aucune ligne de `src/` n'est modifiée par ce plan — l'audit constate,
les tickets corrigent.

Deux décisions prises avec l'utilisateur :

- Les critères d'accessibilité **citent WCAG 2.2 AA**, et là où le rouge pur du mode nuit rend
  AA mathématiquement inatteignable, l'écart est écrit et justifié par la physiologie §11.1
  plutôt que masqué.
- Le manquement au §12.1 (« le thread principal ne fait QUE du rendu » — aucun Web Worker
  n'existe, `src/ui/app-calcul.ts:195` le documente en `ponytail:`) est **hors périmètre** :
  constat écrit ci-dessous, aucun ticket.

---

## Constats

### Axe A — Accessibilité

| # | Constat | Gravité | Ticket |
|---|---|---|---|
| A1 | Le canevas n'a ni nom ni rôle accessibles ; `<div className="schema" aria-label=…>` porte un `aria-label` sans rôle, donc ignoré | haute | T-0068 |
| A2 | Le planétarium ne s'utilise qu'au pointeur — zéro `onKeyDown`, zéro `tabIndex` | haute | T-0069 |
| A3 | Aucun style de focus dans la feuille ; l'anneau par défaut du navigateur est bleu | haute | T-0070 |
| A4 | Contraste du texte secondaire en mode nuit : 2,20:1 | moyenne | T-0071 |
| A5 | Aucun `prefers-reduced-motion` | moyenne | T-0072 |
| A6 | Pas de lien d'évitement, régions non nommées, onglets sans navigation aux flèches | moyenne | T-0073 |
| A7 | Cibles de clic, labels, `<button>` réels, `aria-live` — *sans action* | — | — |

**A1** — `src/ui/Planetarium.tsx:171` : `<canvas className="planetarium">` sans `role`, sans
`aria-label`, sans `aria-describedby`. Pour une technologie d'assistance, la vue centrale de
l'application n'existe pas. `src/ui/PlanSession.tsx:276` fait la faute symétrique : un
`aria-label` sur une `<div>` générique n'est pas exposé — il faut un `role="img"`.

**A2** — `src/ui/Planetarium.tsx:176-178` ne câble que `onPointerDown/Move/Up`. Ni visée, ni
zoom, ni sélection de cible n'est atteignable au clavier. WCAG 2.1.1 (Clavier, niveau A) n'est
pas tenu, et §11.2 (« aucune information critique dépendant du survol ») non plus dès qu'on ne
peut pas atteindre l'objet.

**A3** — Grep sur `src/ui/styles.css` : zéro `:focus`, zéro `:focus-visible`, zéro `outline`.
Rien n'est *retiré* — l'anneau par défaut subsiste — mais il est fourni par le navigateur, en
bleu, et `accent-color: var(--alerte)` (`styles.css:348`) ne couvre que les `input[type=range]`.
Avec `color-scheme: dark` (`styles.css:12`), ascenseurs, caret et `::selection` viennent aussi
du navigateur. Ce sont **des pixels à composante bleue non nulle en mode nuit** : la seule
fuite que `tests/mode-nuit.test.tsx` ne peut pas voir, puisqu'il inspecte la feuille de style
et que ces couleurs n'y sont pas.

**A4** — Ratios calculés depuis les jetons de `styles.css:11-36`, au facteur nominal :

| Paire | Mode normal | Mode nuit |
|---|---|---|
| `--texte` sur `--fond` | 15,5:1 ✓ | **4,36:1** ✗ (AA demande 4,5) |
| `--attenue` sur `--surface` | 6,3:1 ✓ | **2,20:1** ✗ |
| `--alerte` sur `--fond-alerte` | 6,5:1 ✓ | à recalculer après correction |

Le texte secondaire — libellés de champs à 0,85 rem ≈ 12,75 px (`styles.css`, règle `label`),
`.etat`, `.niveau`, les `<th>` — passe donc en mode nuit sous la moitié du seuil AA. Plafond
théorique du rouge pur sur noir : **5,25:1** ; AA est atteignable, mais seulement en montant
`--texte` vers 237+ et en posant le texte secondaire sur du noir plutôt que sur `--surface`.

**A5** — Aucune occurrence de `prefers-reduced-motion` dans `src/` ni `tests/`. La transition de
600 ms de `styles.css:38-41` et l'animation du curseur temporel §3.2 s'imposent. §11.1 exige une
transition progressive : la règle doit être « progressive *sauf si* l'utilisateur a demandé
moins de mouvement », pas l'une contre l'autre.

**A6** — `src/ui/Coque.tsx` place correctement `<header>` et `<main>`, mais le panneau Matériel
(≈ 20 contrôles) précède `<main>` dans le DOM : au clavier, atteindre le ciel demande de
traverser tout le matériel. Les deux `<details>` de coque n'ont pas de nom de région. Les
onglets de `src/ui/PanneauSeance.tsx:130-149` portent un `role="tablist"` exemplaire mais pas la
navigation aux flèches que ce rôle promet (WCAG 2.2, motif ARIA APG *Tabs*).

**A7 — sans action.** Tous les contrôles sont de vrais `<button>` (22 fichiers `.tsx` vérifiés,
aucun `onClick` sur `div`/`span`). Tous les champs sont enveloppés d'un `<label>`
(`PanneauSeance.tsx:54-85`, `PanneauMateriel.tsx:79-115`, `ChampsCible.tsx:117-238`).
`--cible-clic: 44px` est appliqué aux boutons, champs, onglets et `summary`, y compris sous le
repli. `MenuInfos.tsx:124` porte un `aria-live="polite"`. `index.html` a `lang="fr"`, un
`<title>`, et un viewport qui **n'interdit pas** le zoom. C'est un socle sain — ce qui manque
est localisé, pas systémique.

### Axe B — Design

| # | Constat | Gravité | Ticket |
|---|---|---|---|
| B1 | Palette, jetons, cibles de clic, repli, impression — *sans action* | — | — |
| B2 | Aucune icône : `public/` ne contient que `data/`, le manifeste ne déclare pas `icons` | haute | T-0076 |

**B1 — sans action.** `src/ui/styles.css` (698 lignes, feuille unique) tient sa règle d'en-tête :
toute couleur passe par une variable, aucun littéral hexadécimal ou `rgb()` hors du bloc de
jetons. Les seuls nombres en dur sont structurels (`1px` de bordure, `4px`/`6px` de rayon,
`20rem`/`24rem` de colonnes). Deux media queries seulement, et chacune fait un vrai travail :
repli à 1100 px en une colonne avec accordéons, et `@media print` pour le plan de session §11.2.
`--cible-clic: 44px` documente sa raison (usage ganté). Le mode nuit est bien une palette
conçue, pas un filtre de teinte. Rien à redresser ici — la dette de design est ailleurs (A3,
A4, B2).

**B2** — `vite.config.ts:20-28` déclare `name`, `short_name`, `description`, `theme_color`,
`background_color`, `display`, `start_url` — **et aucun `icons`**. `public/` ne contient que
`data/`. `index.html` n'a ni `<link rel="icon">` ni `apple-touch-icon`. Conséquence : Chrome
n'offre pas l'installation, et §12.1 pose l'installabilité comme « deux fois utile », dont
« critère d'octroi du stockage persistant (§12.3) ». Le critère d'acceptation §12.1 sur
l'installation ne peut donc pas être tenu aujourd'hui.

### Axe C — Sécurité et livraison

| # | Constat | Gravité | Ticket |
|---|---|---|---|
| C1 | Aucune CSP, aucun en-tête de sécurité | moyenne | T-0075 |
| C2 | Aucune intégration continue | moyenne | T-0077 |
| C3 | Injection, secrets, sources épinglées, validation d'import — *sans action* | — | — |

**C1** — Ni `<meta http-equiv="Content-Security-Policy">` dans `index.html`, ni fichier
d'en-têtes (`vercel.json`, `netlify.toml`, `_headers` : aucun). Ce n'est pas un trou
d'exploitation — il n'y a pas de backend, pas d'`innerHTML`, pas de secret. L'intérêt est
ailleurs et il est spécifique à ce projet : §13.1 exclut tout serveur applicatif et §13.3
demande qu'« aucune donnée de profil, de site ou de plan de session » ne soit transmise. Une
CSP `connect-src 'self'` **transforme cette promesse en contrainte vérifiable par le
navigateur** au lieu d'une revue de code à refaire à chaque ajout de dépendance.

**C2** — Pas de `.github/workflows`. `pnpm typecheck`, `pnpm test` (472 tests) et `pnpm audit`
ne tournent que quand on y pense. T-0060 (linter) et T-0061 (couverture) ajoutent des outils
que rien n'exécutera automatiquement — la CI est la pièce qui leur donne un effet.

**C3 — sans action.** Vérifié de première main, cohérent avec T-0054 : zéro `innerHTML`,
`dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write`. Aucun `.env`, aucun
`import.meta.env`, aucun secret. Les deux seuls `fetch` (`src/data/bootstrap.ts:60,82`) sont de
même origine. `scripts/build-catalogs.ts` télécharge depuis des SHA de commit épinglés
(T-0059 est passé). `src/data/persistence.ts:202-243` valide champ par champ avant écriture, et
`src/ui/ModeNuit.tsx:55-77` valide son état persisté champ par champ. `pnpm-lock.yaml` seul,
pas de `package-lock.json`. Les scripts de cycle de vie restent bloqués par défaut.

### Axe D — Pratiques

| # | Constat | Gravité | Ticket |
|---|---|---|---|
| D1 | Six `!` sur un `Record<string, number>` qui efface un contrat pourtant connu | basse | T-0078 |
| D2 | Le thread principal fait du calcul (§12.1) — **hors périmètre, décidé** | — | — |
| D3 | `tsconfig`, immutabilité, taille des fichiers — *sans action* | — | — |

**D1** — `src/ui/fiche-cible-calcul.ts:212-219` : le point d'explication est construit dix
lignes plus haut avec exactement cinq clés connues (`fiche-cible-calcul.ts:202-208`), puis
retypé en `Readonly<Record<string, number>>`, ce qui oblige à six `!` pour ressortir ces mêmes
clés. Le type efface le contrat, l'assertion le remet à la main.

**D2 — hors périmètre.** §12.1 dit « tout calcul non lié à l'image courante part en Worker,
sans exception » et exige 50 Hz soutenus pendant une planification concurrente. Aucun
`new Worker` n'existe dans `src/`, et `src/ui/app-calcul.ts:195` porte le `ponytail:` qui le
dit. C'est la seule règle du PRD marquée « sans exception » ouvertement non tenue. Décision
prise : pas de ticket dans cet audit, le `ponytail:` reste la trace.

**D3 — sans action.** `tsconfig.json` tient `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
Zéro `any`, zéro `@ts-ignore`, zéro `@ts-expect-error` dans tout `src/`. Le découpage T-0064 a
porté : hors les deux tables déclaratives du registre (`constants.ts` 1514, `glossaire.ts`
1074, tables assumées par T-0054), le plus gros fichier de `src/` fait 558 lignes.

---

## Tickets à créer

Tous en `"colonne": "pret"`, `"cree"` et `"maj"` à `2026-08-19`, `"plan": null`. Nom de
fichier `T-00XX-<slug>.md` dans `ovrsee/tickets/`.

### T-0067 — epic — Accessibilité : le planétarium s'utilise au clavier, le mode nuit reste lisible

`{"id":"T-0067","titre":"Accessibilité : le planétarium s'utilise au clavier, le mode nuit reste lisible","type":"epic","colonne":"pret","priorite":"haute","charge":"l","tags":["audit","accessibilite","ui"]}`

Contexte : l'audit T-0054 a exclu le design, et personne n'a jamais regardé l'accessibilité.
Le socle est sain (A7) ; ce qui manque est localisé — la vue centrale, le focus, le contraste
du mode nuit, le mouvement, l'ordre de parcours. Cite WCAG 2.2 AA comme référentiel, et écrit
l'écart là où la physiologie §11.1 l'impose.
Critères : les six enfants sont soldés ; un parcours clavier complet, du chargement au choix
d'une cible et à l'export du plan, est possible sans souris ; aucun pixel à composante verte ou
bleue n'apparaît en mode nuit, anneau de focus, ascenseurs et sélection de texte compris.

### T-0068 — Le canevas du planétarium se nomme et s'annonce (`epic: T-0067`, haute, `s`)

Constat **A1**. `src/ui/Planetarium.tsx:171` et `src/ui/PlanSession.tsx:276`.
Critères : le canevas porte un `role="img"` — ou `role="application"` si T-0069 le rend
interactif — et un nom accessible ; une description associée dit ce que la vue montre (visée,
champ, instant) ; le schéma de cadre de `PlanSession.tsx:276` porte un rôle qui rend son
`aria-label` effectif ; un test de `tests/` vérifie la présence du nom accessible sur le rendu
statique, comme `tests/coque.test.tsx` le fait déjà pour la structure.

### T-0069 — Le planétarium se pilote au clavier (`epic: T-0067`, haute, `l`)

Constat **A2**. `src/ui/Planetarium.tsx:176-178`, `src/ui/planetarium-gestes.ts`,
`src/ui/planetarium-selection.ts`.
Critères : le canevas est focusable ; flèches = visée, `+`/`-` = zoom (mêmes bornes que la
molette, T-0030), `Tab`/`Entrée` ou une liste parallèle permet de choisir une cible sans
pointeur ; tout pas de déplacement et toute borne viennent de `src/registry/` — aucun nombre en
dur ; les raccourcis sont énoncés à l'écran, pas seulement dans le code ; WCAG 2.1.1 (A) est
tenu et un test le couvre.

### T-0070 — Le focus se voit, et il ne fuit pas en bleu (`epic: T-0067`, haute, `m`)

Constat **A3**. `src/ui/styles.css:12,348`.
Critères : une règle `:focus-visible` explicite, d'un contraste ≥ 3:1 avec son voisinage (WCAG
2.4.11/2.4.13), et qui n'utilise que les jetons de la palette ; `::selection`, `caret-color`,
`accent-color` et la couleur des ascenseurs sont posés depuis les mêmes jetons, donc rouges en
mode nuit ; `tests/mode-nuit.test.tsx` est étendu pour couvrir ces déclarations — aujourd'hui
il ne peut pas les voir puisqu'elles n'existent pas ; l'indicateur reste visible au plancher de
luminance de 2 %.

### T-0071 — Le texte secondaire garde son contraste en mode nuit (`epic: T-0067`, moyenne, `m`)

Constat **A4**. Jetons de `src/ui/styles.css:11-36`.
Critères : au facteur nominal, tout texte porteur d'information atteint 4,5:1 (AA), ou 3:1 s'il
est à ≥ 18,66 px ou en gras — le calcul est écrit à côté de la palette ; le plafond du rouge pur
(5,25:1 sur noir) et l'effondrement des ratios au plancher de 2 % sont écrits comme **écart
assumé**, justifié par §11.1 (les bâtonnets, pas l'esthétique), pas contournés en ajoutant du
vert ou du bleu ; la hiérarchie entre texte principal et secondaire survit à la correction —
par la graisse, la taille ou l'espacement si la luminance ne peut plus la porter ; un test
calcule les ratios depuis la feuille et échoue si un jeton régresse.

### T-0072 — L'application respecte `prefers-reduced-motion` (`epic: T-0067`, moyenne, `s`)

Constat **A5**. `src/ui/styles.css:38-41`, curseur temporel §3.2.
Critères : sous `prefers-reduced-motion: reduce`, la transition de bascule du mode nuit est
supprimée ou ramenée à l'imperceptible **sans produire de flash** (§11.1 l'interdit — c'est la
tension à résoudre, et la résolution retenue est écrite) ; le défilement automatique du curseur
temporel ne démarre pas de lui-même ; WCAG 2.3.3 est tenu ; un test vérifie la présence de la
règle.

### T-0073 — L'ordre de parcours au clavier suit les motifs attendus (`epic: T-0067`, moyenne, `m`)

Constat **A6**. `src/ui/Coque.tsx`, `src/ui/PanneauSeance.tsx:130-149`.
Critères : un lien d'évitement mène directement à la scène (visible au focus, invisible sinon) ;
les deux régions de coque portent un nom accessible ; les onglets de séance se parcourent aux
flèches conformément au motif ARIA APG *Tabs*, avec un seul onglet dans l'ordre de tabulation ;
`tests/coque.test.tsx` couvre le lien d'évitement et les noms de région.

### T-0074 — epic — Ce que la coquille promet est vérifié à la livraison

`{"id":"T-0074","titre":"Ce que la coquille promet est vérifié à la livraison","type":"epic","colonne":"pret","priorite":"moyenne","charge":"m","tags":["audit","securite","pwa","outillage"]}`

Contexte : trois promesses du PRD ne sont tenues par rien d'exécutable — §13.3 « aucune donnée
transmise » repose sur une revue de code, §12.1 « application installable » est fausse faute
d'icônes, et les 472 tests ne tournent que quand on y pense.
Critères : les trois enfants sont soldés ; chaque promesse est gardée par un mécanisme, pas par
l'attention.

### T-0075 — Une CSP interdit toute requête hors origine (`epic: T-0074`, moyenne, `m`)

Constat **C1**. `index.html`, `vite.config.ts`.
Critères : une CSP est servie — en-tête si la cible d'hébergement le permet, `<meta>` sinon — et
la raison du choix est écrite ; `connect-src 'self'` rend le critère §13.3 vérifiable par le
navigateur ; `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` ; l'application
démarre, le service worker s'enregistre et les quatre paquets binaires se chargent sans
violation en console, en développement comme après `pnpm build && pnpm preview` ; toute
directive assouplie pour Vite est écrite avec sa raison et ne s'applique pas à la production.

### T-0076 — L'application est réellement installable (`epic: T-0074`, haute, `m`)

Constat **B2**. `vite.config.ts:20-28`, `public/`, `index.html`.
Critères : des icônes 192×192 et 512×512 existent, plus une variante `maskable`, plus un favicon
et une `apple-touch-icon` ; elles sont déclarées dans `manifest.icons` et référencées depuis
`index.html` ; **elles sont composées en rouge sur noir, aucune surface blanche** — une icône
claire dans un lanceur ruine l'adaptation à l'obscurité aussi sûrement qu'une modale (§11.1) ;
elles sont précachées par le service worker, donc présentes hors réseau ; Chrome propose
l'installation, ce qui rétablit le critère §12.1 et le levier d'octroi de stockage persistant
§12.3 ; les fichiers sont versionnés dans `public/`.

### T-0077 — Une intégration continue garde typecheck, tests et audit (`epic: T-0074`, moyenne, `m`)

Constat **C2**. Aucun `.github/workflows`.
Critères : un workflow tourne à chaque poussée et sur chaque PR ; il installe avec
`pnpm install --frozen-lockfile`, puis passe `pnpm typecheck`, `pnpm test`, `pnpm build` et
`pnpm audit` ; l'échec bloque ; les étapes `pnpm lint` (T-0060) et couverture (T-0061) sont
prévues et documentées, ajoutées dès que ces tickets sont soldés ; aucun secret n'est nécessaire
au workflow — cohérent avec une application sans backend.

### T-0078 — Le point d'explication de la fiche cible porte son type (basse, `s`, sans epic)

Constat **D1**. `src/ui/fiche-cible-calcul.ts:202-219`.
Critères : le point d'explication est décrit par une interface nommée aux cinq champs connus,
avec leurs unités en commentaire ; les six `!` de `fiche-cible-calcul.ts:212-219` disparaissent
sans être remplacés par un cast ; `pnpm typecheck` et `pnpm test` restent verts ; le moteur
d'explication §10.2 continue de produire la même sortie — le test d'explication existant
(`tests/explication.test.ts`) en atteste.

---

## Vérification

L'audit ne touche pas le code : la vérification porte sur les fichiers de tickets.

1. `cat ovrsee/board.json` — confirmer que `pret` est toujours un `id` de colonne valide.
2. Onze fichiers créés dans `ovrsee/tickets/`, de `T-0067` à `T-0078` (aucun `id` réutilisé :
   le maximum existant est `T-0066`).
3. Frontmatter JSON valide sur chacun :
   `for f in ovrsee/tickets/T-00[67]*.md; do sed -n '2,/^---$/p' "$f" | sed '$d' | python3 -m json.tool >/dev/null || echo "KO $f"; done`
4. Chaque enfant cite `"epic": "T-0067"` ou `"epic": "T-0074"` ; les deux epics portent
   `"type": "epic"`.
5. Chaque ticket a une section `## Contexte` qui dit pourquoi il existe et une section
   `## Critères d'acceptation` dont chaque case est constatable — le test de maturité du skill
   `ovrsee-tickets`.
6. `git status` — seuls des fichiers de `ovrsee/tickets/` sont ajoutés, aucun fichier de `src/`,
   `tests/`, `scripts/` ou `prd.md` modifié.
7. Rouvrir l'ovrsee : les deux epics apparaissent en tête de la colonne « Prêt », leurs enfants
   dessous, T-0078 en orphelin.
