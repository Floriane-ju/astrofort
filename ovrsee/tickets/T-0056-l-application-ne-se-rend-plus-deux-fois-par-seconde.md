---
{
  "id": "T-0056",
  "titre": "L'application ne se rend plus deux fois par seconde",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "audit",
    "performance",
    "react"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constats **O1** et **O4** de l'audit T-0054.

`src/App.tsx:152` — `const { msAffiche } = useScene()` abonne le composant `App`
(540 lignes) à la totalité du magasin de scène. La boucle de rendu le republie
toutes les 500 ms (`PERIODE_DIAGNOSTIC_MS`, `src/ui/Planetarium.tsx:79`, appel à
`afficheInstant` en `Planetarium.tsx:527`).

Aucun composant du projet n'est mémoïsé — `React.memo` et `useCallback`
n'apparaissent nulle part dans `src/`. Chaque publication reconcilie donc tout
l'arbre : `Planetarium`, `PanneauSeance`, `FicheCible`, `PlanSessionVue`,
`MenuInfos`. Les `useMemo` protègent les calculs, jamais la reconciliation.

Le seul usage de `msAffiche` dans `App` est `epoqueAnnee(new Date(msAffiche))`
(`src/App.tsx:501`) — une valeur qui change **une fois par an**.
`src/ui/FicheCible.tsx:241` porte le même abonnement.

Trois duplications s'ajoutent dans le même fichier (constat O4) :

- `calculeFenetreUtile(site, calcul.nuit)` est calculé par le `useMemo`
  `fenetreUtile` (`src/App.tsx:255`) puis recalculé à l'identique dans le
  `useMemo` `plan` (`src/App.tsx:342`) ;
- `pointZeroSysteme(BOITIER_REFERENCE)` (`App.tsx:177`) et
  `isoRecommande(BOITIER_REFERENCE)` (`App.tsx:260`) sont réévalués à chaque
  rendu alors que leur unique argument est une constante de module ;
- `site` est construit deux fois, `App.tsx:184` et `App.tsx:246`.

## Critères d'acceptation

- [x] Un abonnement au magasin de scène ne réveille plus que ce qui dépend
      vraiment de la tranche publiée : `App` ne se rend plus à la cadence du
      diagnostic
- [x] Le compte de rendus de `App` sur dix secondes de temps qui défile est
      mesuré avant / après, et le chiffre figure dans le commit
- [x] `fenetreUtile` n'est calculé qu'une fois par jeu d'entrées
- [x] `zeroSysteme` et `iso` ne sont plus réévalués à chaque rendu
- [x] `site` n'est construit qu'à un seul endroit
- [x] `pnpm test` reste vert ; le compteur d'images du planétarium ne baisse pas

## Décisions

- `useTrancheScene(selecteur)` s'ajoute au magasin (`src/ui/scene-etat.ts`) : un
  `useSyncExternalStore` dont l'instantané est la valeur dérivée, pas l'état entier.
  React compare par `Object.is` et ne rend que si la tranche a bougé. Aucun
  `React.memo` n'a été nécessaire : `App` ne se rendant plus, ses enfants ne
  reconcilient plus non plus, et ceux qui ont besoin de l'instant — `Planetarium`,
  `MenuInfos` — s'abonnent déjà eux-mêmes.
- `App` s'abonne à `epoqueAffichee` : l'époque de précession prise **au jour près**.
  C'est la seule dépendance de `App` au magasin de scène (`ecartFrontieresDeg` pour
  l'onglet Explorer), et elle dérive de 0,014° par an — la journée est très en deçà
  de ce qui s'affiche.
- `FicheCible` s'abonne à `minuteAffichee`, la granularité que son `useMemo`
  utilisait déjà : la fiche ne se rend plus qu'à chaque minute de ciel franchie.
- `site` est construit une fois, remonté avant `calcul` qui le prend en dépendance ;
  `fenetreUtile` est passé au plan au lieu d'y être recalculé ; `ZERO_SYSTEME` et
  `ISO_RETENU` deviennent des constantes de module. Le `plan` n'a plus de
  dépendances manquantes : la ligne `eslint-disable react-hooks/exhaustive-deps`
  disparaît.

### Mesure

Dix secondes de temps qui défile au facteur par défaut (×60), soit vingt
publications de la boucle (`PERIODE_DIAGNOSTIC_MS` = 500 ms), mesurées par
`tests/scene-etat.test.ts` :

| Abonnement | Réveils sur 10 s |
|---|---|
| état entier (avant) | **20** |
| tranche `epoqueAffichee` (après) | **0** |

`FicheCible` passe de 20 à 10 réveils sur la même fenêtre (une minute de ciel
toutes les 500 ms de montre).

Le compteur d'images n'est pas touché : la boucle de rendu, sa cadence de
publication et le chemin canevas sont inchangés — seul le nombre d'abonnés
réveillés par publication baisse.

`pnpm test` (476 tests) et `pnpm build` verts.
