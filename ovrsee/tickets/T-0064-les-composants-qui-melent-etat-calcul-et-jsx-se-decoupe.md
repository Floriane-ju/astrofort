---
{
  "id": "T-0064",
  "titre": "Les composants qui mêlent état, calcul et JSX se découpent",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "audit",
    "qualite",
    "refactor",
    "ui"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constats **P1** et **P2** de l'audit T-0054.

Les règles du projet posent 800 lignes par fichier et 50 lignes par fonction.
Quatre fichiers dépassent le premier seuil, vingt-trois fonctions le second,
onze de plus du double :

| Fonction | Emplacement | Lignes |
|---|---|---|
| `App` | `src/App.tsx:122` | 540 |
| `Planetarium` | `src/ui/Planetarium.tsx:239` | 428 |
| `PanneauFile` | `src/ui/PanneauFile.tsx:96` | 370 |
| `FicheCible` | `src/ui/FicheCible.tsx:203` | 301 |
| `Verdicts` | `src/ui/FicheCible.tsx:651` | 276 |
| `PanneauExplorer` | `src/ui/PanneauExplorer.tsx:52` | 187 |
| `MenuInfos` | `src/ui/MenuInfos.tsx:51` | 155 |
| `PlanSessionVue` | `src/ui/PlanSession.tsx:38` | 140 |
| `cartePoseMax` | `src/core/grand-champ.ts:83` | 139 |
| `sequenceFile` | `src/core/sequence-file.ts:101` | 126 |

Deux fichiers hors périmètre : `src/registry/constants.ts` (1514) et
`src/registry/glossaire.ts` (1074) sont des **tables déclaratives** du registre
§2.1. Les trancher en morceaux de 400 lignes déplacerait la longueur sans rien
rendre plus lisible — l'audit les a laissés délibérément.

Restent `src/ui/FicheCible.tsx` (926) et `src/core/session.ts` (873), qui portent
de la logique.

Le motif est le même partout : un composant tient son état de saisie, fait
tourner ses calculs et rend son JSX dans une seule fonction. Ce n'est pas une
question d'esthétique — c'est ce qui rend T-0056 difficile à mener, parce qu'on
ne peut pas mémoïser une région qu'on ne peut pas nommer.

`dessineCiel` (`src/ui/dessine-ciel.ts:222`, 225 lignes) est délibérément **hors
périmètre de ce ticket** : c'est une boucle de rendu chaude, son découpage se
décide sous mesure et relève de T-0065.

## Critères d'acceptation

- [ ] `App`, `Planetarium`, `PanneauFile` et `FicheCible` sont chacun ramenés
      sous 150 lignes, l'état et le calcul extraits dans des unités nommées
- [ ] Aucun fichier de `src/ui/` ni de `src/core/` ne dépasse 800 lignes
- [ ] Les régions extraites sont nommées d'après ce qu'elles montrent, pas
      d'après leur position à l'écran
- [ ] Aucun comportement n'est modifié : `pnpm test` reste vert sans qu'un test
      soit réécrit pour s'adapter au découpage
- [ ] Le design — visuel, ergonomie, typographie — n'est pas touché
