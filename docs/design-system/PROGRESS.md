# Suivi de migration — design system Astrofort

> Périmètre validé : **lots A → D + F**. Lot E (cascade de `label`) écarté.
> Glyphes validés : `✛` → `my_location`, `★` → `star`, `●` → `circle`.

## Baseline

```
$ pnpm typecheck    → aucune sortie
$ pnpm test         → Test Files 81 passed (81) · Tests 1306 passed (1306)
```

Pas de commande `lint` dans ce dépôt. Vérification = `pnpm typecheck && pnpm test`.

## Tableau de bord

| # | Chantier | État | Commit |
|---|---|---|---|
| A1 | `Interrupteur` — 7 sites | à faire | |
| A2 | `ChampChoix` — 8 sites | à faire | |
| A3 | `Tiroir` — 4 sites | à faire | |
| B1 | `--gouttiere-ecran` — 4 décl. | à faire | |
| B2 | `--filet-accent` — 3 décl. | à faire | |
| B3 | `--decalage-pointille` — 2 décl. | à faire | |
| B4 | 3 suivis hors échelle nommés | à faire | |
| C1 | micro-libellé groupé + test | à faire | |
| D1 | `●` → `circle` | à faire | |
| D2 | `✛` → `my_location` | à faire | |
| D3 | `★` → `star` | à faire | |
| F1 | `.facilite-ligne` morte | à faire | |
| F2 | bloc dupliqué (média 1100px) | à faire | |

## Décisions prises

- **Q1 — pas de couche de primitives sous les couleurs.** Le mode nuit surcharge chaque
  jeton sémantique individuellement, avec une valeur calculée. Une primitive n'aurait aucun
  consommateur : aucun jeton sémantique ne partage sa valeur avec un autre.
- **Q2 — `--texte` (couleur) n'est pas renommé.** Le nom est cité en dur par dix tests et
  par tout le produit ; le renommer ne change aucun pixel et élargit le diff pour rien.
- **Q3 — lot E écarté.** La verrue est documentée et ne grandit pas ; la corriger toucherait
  tous les champs de saisie du produit.
- **Q4 — `✛` → `my_location`** : déjà le glyphe « viser » du produit (`PanneauCibles.tsx:303`),
  donc cohérent avec le vocabulaire en place. `★` → `star`. `●` → `circle`.
- **Q5 — les trois `letter-spacing` hors échelle sont NOMMÉS, pas fusionnés.** Les ramener
  sur `--suivi-micro` changerait la chasse des saisies, des titres d'étape et des horaires
  du plan. La contrainte fondamentale est qu'aucun pixel ne bouge sans validation.
- **Q6 — le micro-libellé devient un sélecteur groupé, plus un test qui interdit d'écrire le
  quadruplet ailleurs.** C'est la mécanique par laquelle la feuille tient déjà ses couleurs
  (`mode-nuit.test.tsx`) et ses écarts (`echelles.test.ts`) : la garantie vit dans un test,
  pas dans une convention.

## Fusions proposées, en attente de validation

_Aucune._ Toutes les substitutions des lots B sont à valeur identique — zéro pixel change
par construction.

## Icônes sans équivalent Material

_Aucune._ Les trois caractères Unicode ont un glyphe retenu (voir Q4). Note : `✛` n'a pas
d'équivalent au dessin identique dans Material ; `my_location` a été retenu sur le sens, pas
sur la forme. Le dessin du schéma §8.4 changera.

## À vérifier visuellement

_Rien pour l'instant._
