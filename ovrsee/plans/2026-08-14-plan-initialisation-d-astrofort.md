---
{
  "status": "open",
  "title": "Plan — Initialisation d'Astrofort",
  "opened": "2026-08-14",
  "closed": null,
  "commits": [
    {
      "sha": "0e366aa",
      "date": "2026-08-14",
      "files": [
        ".gitignore",
        "index.html",
        "package.json",
        "pnpm-lock.yaml",
        "prd.md",
        "public/data/hyg-1.bin",
        "public/data/manifest.json",
        "public/data/openngc-1.bin",
        "public/data/openngc-noms-1.bin",
        "scripts/build-catalogs.ts",
        "src/App.tsx",
        "src/core/ephem.ts",
        "src/core/night.ts",
        "src/core/site.ts",
        "src/core/sky-background.ts",
        "src/core/traced.ts",
        "src/data/bootstrap.ts",
        "src/data/catalog.ts",
        "src/data/db.ts",
        "src/data/deepsky.ts",
        "src/data/degradation.ts",
        "src/data/equipment.ts",
        "src/data/persistence.ts",
        "src/main.tsx",
        "src/registry/bortle.ts",
        "src/registry/constants.ts",
        "src/registry/formulas.ts",
        "src/ui/TracedValue.tsx",
        "src/ui/styles.css",
        "tests/bortle.test.ts",
        "tests/catalog.test.ts",
        "tests/night.test.ts",
        "tests/offline.test.ts",
        "tests/persistence.test.ts",
        "tests/registry.test.ts",
        "tsconfig.json",
        "vite.config.ts"
      ]
    }
  ]
}
---

# Plan — Initialisation d'Astrofort

## Context

Le dépôt ne contient aujourd'hui que `prd.md` (3534 lignes, PRD v1.0 clos) et un dossier `ovrsee/`
dont la config annonce déjà `pnpm dev` sur le port 5173 — donc Vite. Aucun code applicatif.

Le PRD décrit une application web **intégralement cliente** : pas de serveur applicatif, pas de
compte, pas de télémétrie comportementale (§1.4, §2.5, §13.1). Elle prend un **lieu**, une **date**
et un **matériel**, et produit un **plan de session exécutable** — cibles, ordre, horaires, pose
unitaire, nombre d'images, aide au pointage sans GoTo.

Objectif de ce plan : poser le squelette du projet et livrer le **Lot 0 — Socle technique** (§14),
qui ne dépend de rien et bloque tout le reste. Les lots 1 à 5 sont cadrés ici mais non exécutés.

Trois contraintes du PRD gouvernent l'architecture et ne sont pas négociables :

1. **Aucune constante numérique hors du registre §2.1.** Un critère d'acceptation le vérifie par
   recherche dans le code source.
2. **Tout nombre affiché est dépliable jusqu'à sa formule et sa constante source** (§1.5, §10.2).
3. **Le thread principal ne fait que du rendu** (§12.1). Tout calcul non lié à l'image courante
   part en Web Worker.

## Décisions arrêtées avec l'utilisateur

| Sujet | Choix |
|---|---|
| Socle | Vite + React + TypeScript, gestionnaire **pnpm** exclusivement |
| Rendu ciel (Lot 4) | WebGL 2 brut — un tampon de sommets, une passe de dessin (§12.2) |
| Éphémérides | `astronomy-engine` (MIT, VSOP87/ELP tronqués en JS, zéro fichier de données) — c'est l'option C de §12.4 |
| Coquille PWA | `vite-plugin-pwa` (Workbox) |
| Stockage | `idb` sur IndexedDB |
| Tests | `vitest` |
| Périmètre de la session | Plan complet + implémentation du **Lot 0 seul** |

---

## Architecture cible

```
astrofort/
├── index.html
├── package.json                  pnpm, scripts dev/build/test/data
├── vite.config.ts                + vite-plugin-pwa
├── tsconfig.json
├── scripts/
│   └── build-catalogs.ts         CSV/sources → binaire 12 o/étoile (§12.2). Exécuté à la main.
├── public/data/                  paquets binaires versionnés + manifeste de sommes de contrôle
├── src/
│   ├── registry/
│   │   ├── constants.ts          §2.1 — SEULE source de nombres. Gelée à l'exécution.
│   │   ├── formulas.ts           Annexe B — une entrée par formule : id, expression, unité
│   │   └── bortle.ts             §2.2 — table Bortle, interpolation bornée
│   ├── core/                     moteurs purs, sans dépendance UI ni DOM
│   │   ├── ephem.ts              §12.4 — façade sur astronomy-engine
│   │   ├── night.ts              §8.1 — crépuscules, culmination, masse d'air, midi solaire vrai
│   │   ├── optics.ts             §5.1 — FOV, échantillonnage, Dawes  (Lot 1)
│   │   ├── tracking.ts           §5.2 — t_max_suivi, NPF             (Lot 1)
│   │   ├── framing.ts            §6.1, §6.2                          (Lot 2)
│   │   ├── detectability.ts      §6.3                                (Lot 2)
│   │   └── exposure.ts           §7.1–7.3                            (Lot 2)
│   ├── data/
│   │   ├── db.ts                 idb — profils, sites, plans, paquets
│   │   ├── catalog.ts            décodage binaire + vérification d'intégrité
│   │   ├── persistence.ts        §12.3 — persist(), persisted(), estimate(), export/import JSON
│   │   └── degradation.ts        §12.5 — matrice de dégradation, état réseau
│   ├── workers/                  §12.1 — tout calcul lourd
│   └── ui/                       composants React
└── tests/                        les Gherkin du PRD, portés en vitest
```

### Trois choix de conception qui évitent une réécriture au Lot 2

**Le registre est une donnée, pas des `const` éparpillées.** `constants.ts` exporte un objet
unique dont chaque entrée porte `{ valeur, unite, source, tolerance, sections }`, conforme au
tableau §2.1. Une constante marquée `"ordre de grandeur"` fait afficher une **plage** en sortie,
jamais une valeur exacte (critère d'acceptation §2.1). Cette métadonnée doit exister dès
maintenant, sinon le critère est inapplicable après coup.

**Chaque formule est déclarée une fois dans `formulas.ts`**, avec son expression littérale telle
qu'écrite en Annexe B. Les moteurs référencent l'identifiant de la formule dans leur résultat.
Conséquence : §10.2 « explication de verdict » (Lot 2) devient presque gratuite, alors que
l'ajouter après coup obligerait à retoucher chaque moteur.

**Les moteurs retournent un résultat tracé**, pas un nombre nu :

```ts
type Traced<T> = {
  value: T
  formula: FormulaId          // → registry/formulas.ts
  inputs: Record<string, number>
  constants: ConstantRef[]    // → registry/constants.ts
  range?: [number, number]    // rempli quand une constante source est un ordre de grandeur
  flags?: ('ESTIME' | 'HYP' | 'DONNEE_MANQUANTE')[]
}
```

C'est le seul mécanisme qui satisfait le critère de réussite n° 2 du MVP (§1.5) sans dupliquer la
logique de calcul dans une couche d'explication.

---

## Lot 0 — Contenu à implémenter maintenant

Ordre d'exécution : les étapes 1 et 2 conditionnent tout le reste.

### 1. Squelette et outillage

`pnpm create vite` (React + TS), puis ajout de `astronomy-engine`, `vite-plugin-pwa`, `idb`,
`vitest`. Lockfile `pnpm-lock.yaml` committé, aucun `package-lock.json`. `.gitignore` complété
(`node_modules`, `dist`, `public/data/*.bin`).

### 2. Registre §2.1 — `src/registry/constants.ts`

Port intégral des deux tableaux du PRD : constantes astronomiques exactes (rotation 15,041 °/h,
jour sidéral 86 164,09 s, jour solaire 86 400 s, mois synodique 29,5306 j, année tropique
365,2422 j, précession 50,29 "/an, 206 265, Dawes 116/D, réfraction 34', époque B1875) et
constantes conventionnelles C-01 à C-16 avec source et tolérance.

Le facteur 57,296 est **présent mais marqué comme remplacé par l'arctangente** — il ne doit être
consommé par aucun moteur (§5.1, Annexe C ligne 4).

Objet gelé (`Object.freeze`) : le registre est en lecture seule à l'exécution, aucun mécanisme
d'ajustement (§2.1).

### 3. Table Bortle §2.2 — `src/registry/bortle.ts`

Table des 9 lignes (SB fond de ciel + magnitude limite œil nu). Interpolation linéaire autorisée
entre deux lignes, **extrapolation refusée** hors [1 ; 9]. Le SQM mesuré prévaut toujours sur le
Bortle estimé ; un SQM saisi au-dessus du plancher naturel (≈ 22,0) déclenche une demande de
confirmation, pas un rejet. Sortie `source_sb ∈ {TABLE_BORTLE, SQM_MESURE, VIIRS}`, affichée.

### 4. Point zéro système §2.3

Champ `zp_sys` dans le schéma de la base matériel, avec la générique C-14 = 20,20 et le drapeau
`[ESTIMÉ]` quand le boîtier est absent de la base. La base matériel elle-même est remplie au Lot 1 ;
le Lot 0 pose le schéma et la valeur de repli. **Aucun écran de calibration nulle part** (§2.3).

### 5. Éphémérides §12.4 — `src/core/ephem.ts` et `src/core/night.ts`

Façade mince sur `astronomy-engine`, exposant exactement ce dont le PRD a besoin : temps sidéral
local, précession (J2000 → époque, et B1875 → époque pour §3.4), positions Soleil/Lune/planètes,
crépuscules et lever/coucher **avec réfraction de Bennett**, culmination, angle horaire, masse
d'air, transformations az/alt ↔ AD/δ.

Deux règles à câbler dès maintenant, parce que ce sont des cas limites du PRD :

- Hors du domaine de validité des séries → les corps du système solaire sont **masqués avec la
  cause nommée**, jamais extrapolés en silence (§3.1, §12.4).
- Le décalage du midi solaire vrai (`offset_midi_min`) est calculé et exposé : les créneaux de
  §8.1 se centrent sur le milieu de nuit vrai, jamais sur minuit légal (§4.1).

Satellites, ISS et comètes : hors MVP, en ligne seulement (§12.4). Rien à écrire.

### 6. Encodage et paquet de données §12.2 — `scripts/build-catalogs.ts` + `src/data/catalog.ts`

Encodeur hors ligne : 12 octets par étoile (AD float32, δ float32, mag V int16 ×100, B−V int16
×1000) + table de noms creuse. Cible ≈ 1,7 Mo pour HYG v3 jusqu'à magnitude 9, et OpenNGC ≈ 1,2 Mo.
Décodeur côté client + vérification de somme de contrôle au démarrage.

Le script télécharge les sources publiques (HYG v3, OpenNGC) — **il est lancé explicitement, pas
au `postinstall`**, cohérent avec la politique pnpm de blocage des scripts de cycle de vie. Les
binaires produits sont versionnés dans `public/data/`.

Le paquet Gaia différé (12 Mo) relève du Lot 4 : seul le mécanisme de paquet optionnel est posé ici.

### 7. Coquille PWA §12.1 et persistance §12.3

`vite-plugin-pwa` pour le Service Worker et le manifeste, précache du code et des paquets
obligatoires. Détection WebGL 2 au démarrage : absent → §3 et §9 désactivés avec la cause nommée,
les moteurs §6, §7, §8 restent pleinement utilisables.

Persistance en trois étages, exactement comme §12.3 :

1. `persist()` demandé **après la première action utile**, jamais au chargement.
2. `persisted()` vérifié à chaque démarrage ; si faux, avertissement explicite et proposition
   d'installer l'application.
3. Intégrité des catalogues vérifiée au démarrage. Absents ou corrompus **et** hors réseau →
   mode dégradé documenté, jamais un écran blanc ni une erreur technique brute.

**Export/import JSON manuel obligatoire au MVP** : une éviction du stockage ne doit jamais détruire
une donnée produite par l'utilisateur (profils, sites, masques d'horizon édités, plans de session).

### 8. Matrice de dégradation §12.5 — `src/data/degradation.ts`

Le tableau du PRD porté en données, affiché dans l'interface. `mode_reseau ∈ {EN_LIGNE,
HORS_LIGNE, DEGRADE}`. C'est un contrat visible, pas une note interne.

### 9. Écran de vérification du Lot 0

Un écran minimal — pas de design, c'est le livrable vérifiable de §14 : saisie lieu + date,
affichage des crépuscules, du midi solaire vrai, du fond de ciel Bortle, de l'état de persistance
et de l'intégrité des catalogues. Chaque nombre affiché est déjà dépliable vers sa formule.

---

## Lots suivants — cadrage, non exécutés dans cette session

| Lot | Contenu | Dépend de |
|---|---|---|
| **1 — Contrat d'entrée** | §4 profil Lieu + masque d'horizon · §5.1 profil optique · §5.2 profil suivi · §10.1 glossaire | Lot 0 |
| **2 — Cœur métier ciel profond** | §6.1–6.3 verdicts · §7.1–7.4 pose, intégration, calibration · §10.2 explication | Lots 0–1 |
| **3 — Planification nocturne** | §8.1–8.4 fenêtre, créneaux, plan ordonné, cheminement · §7.5, §10.3 · §11 mode nuit | Lots 0–2 |
| **4 — Rendu du ciel** | §3.1–3.5 pipeline deux horloges, curseur, moteur unifié, constellations, cadre matériel · paquet Gaia | Lots 0–2 |
| **5 — Grand champ et filé** | §9.1–9.4 | Lot 4 |

Le Lot 2 porte la valeur de l'application et se livre **avant** le planétarium. Le Lot 5 se livre
après le Lot 4 : §3.3 interdit explicitement de coder deux fois la projection.

---

## Vérification du Lot 0

Les critères d'acceptation Gherkin du PRD sont portés en tests `vitest`. Le setup de référence de
l'Annexe A fournit les valeurs attendues.

**Tests unitaires**

| Vérification | Attendu | Source |
|---|---|---|
| Décalage du midi solaire à 46,391° N / 6,697° E | +26,8 min | Annexe A |
| Instant de lever comparé à une éphéméride de référence | écart < 2 min | §12.4 |
| Bortle 4,5 | SB = 20,95 mag/as² et m_lim = 6,05 | §2.2 |
| Bortle < 1 ou > 9 | saisie refusée, aucune extrapolation | §2.2 |
| SQM 21,1 contre Bortle déclaré | le SQM prévaut, `source_sb = SQM_MESURE` | §2.2, §4.1 |
| SQM saisi à 23,0 | demande de confirmation, pas un rejet muet | §2.2 |
| Seuils du site de référence | circumpolaire δ > +43,6° ; imagerie impossible δ < −13,6° | Annexe A |
| 100 positions décodées du binaire vs source | écart max < 1" | §12.2 |
| Date hors domaine des séries | corps masqués avec cause nommée | §3.1, §12.4 |

**Test de garde du registre** — un test parcourt `src/core/` et échoue sur toute constante
numérique non triviale écrite en dur. C'est le premier critère d'acceptation de §2.1, et il n'a de
valeur que s'il est automatisé dès maintenant.

**Vérification manuelle de bout en bout**

1. `pnpm build && pnpm preview`, puis passage de l'onglet en mode hors ligne dans les outils de
   développement : l'application démarre, les crépuscules sont calculés, aucune requête réseau.
2. Vider le stockage du site, recharger hors réseau : l'absence de catalogues est annoncée
   clairement, avec proposition de rechargement au retour du réseau — ni écran blanc, ni erreur brute.
3. Export JSON, vidage du stockage, réimport : les données utilisateur sont restaurées sans perte.

---

## Points ouverts, à trancher au moment où ils se posent

- Les entrées marquées `[À VÉRIFIER]` du PRD (comptage exact Gaia DR3, colonne magnitude limite de
  l'échelle de Bortle contre la publication *Sky & Telescope* 2001, taille du bundle après build)
  sont vérifiées à l'implémentation de leur lot, pas maintenant.
- Le domaine de validité exact des séries d'`astronomy-engine` est à lire dans sa documentation au
  moment de câbler le masquage hors domaine (étape 5).
