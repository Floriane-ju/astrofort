---
{
  "id": "T-0050",
  "titre": "Filtrer la liste des visibles par type d’objet",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0048",
  "tags": [
    "ui",
    "cible"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

La liste des visibles peut compter plusieurs milliers d'entrées — le compte réel
est déjà annoncé sous elle, plafond compris (`src/ui/FicheCible.tsx:308-317`).
Sortir voir des amas globulaires oblige aujourd'hui à les repérer un par un dans
une liste triée par magnitude et groupée par verdict.

Un `<select>` de type d'objet à côté de la liste, valeur par défaut « Tous types »,
restreint `visibles` avant le plafond de `CIBLES_LISTEES_MAX`. Le filtrage tombe
donc **avant** le `slice`, sinon filtrer sur les 200 plus brillantes ne dirait rien
du ciel.

Il se pose sur les types réellement présents dans `visibles`, pas sur les dix de
`TYPES_OBJET` : proposer « nébuleuse obscure » quand aucune n'est levée est une
impasse offerte à l'utilisateur. Libellés : la table de T-0049.

Le compte annoncé suit le filtre — filtrer sans que le nombre bouge laisserait
croire que rien n'a été retenu.

Le filtre ne touche ni le calcul de `ciblesVisibles`, ni son `useMemo` quantifié à
la minute (T-0045) : c'est un `filter` en aval, sur un tableau déjà en mémoire.

## Critères d'acceptation

- [x] Un `<select>` au-dessus de la liste restreint les cibles à un type d'objet.
- [x] Sa valeur par défaut ne filtre rien.
- [x] Il ne propose que les types présents dans le ciel à l'instant affiché.
- [x] Le compte annoncé sous la liste reflète le filtre appliqué.
- [x] Un objet du type retenu qui n'est pas dans les 200 plus brillantes du ciel
      entier apparaît quand même une fois le filtre posé.
- [x] La cible déjà choisie reste choisie si le filtre l'exclut de la liste.
- [~] `tests/cible.test.tsx` couvre le filtrage et le compte.

> Réserve de revue : l'environnement de test est `node` (`vite.config.ts`), sans DOM —
> aucun clic n'est simulable. Le filtrage et le déverrouillage sont donc constatés sur
> leurs fonctions pures (`typesPresents`, `parType`, `tests/visibles.test.ts`) et sur le
> rendu statique des deux états, pas sur le geste lui-même. Ajouter `jsdom` +
> `@testing-library/react` fermerait l'écart.
