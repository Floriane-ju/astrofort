---
{
  "id": "T-0049",
  "titre": "Le type de l’objet se lit dans la liste",
  "colonne": "revue",
  "priorite": "haute",
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

`libelleCible` (`src/ui/FicheCible.tsx:98-102`) compose désignation, nom commun,
magnitude et hauteur. Le type de l'objet, pourtant porté par le catalogue
(`objet.type`, `src/data/deepsky.ts:40-53`), n'y figure pas — alors que c'est la
première chose qu'on cherche : ce soir, une galaxie ou un amas ?

Deux obstacles, un seul travail :

1. `TYPES_OBJET` est une liste de constantes machine — `AMAS_OUVERT`,
   `NEB_PLANETAIRE`, `RESTE_SUPERNOVA`. Elles sont déjà affichées telles quelles
   dans le `<select>` « Type d'objet » (`FicheCible.tsx:337-341`), et elles y
   sont illisibles. Il faut une table de libellés français, exhaustive sur les dix
   types, sur le patron de `LIBELLE_VERDICT` (`FicheCible.tsx:90-95`) :
   `Readonly<Record<TypeObjet, string>>`, donc le compilateur refuse un type
   oublié.
2. `libelleCible` reprend ce libellé.

La table sert aussi T-0050 et le `<select>` « Type d'objet » existant : un seul
endroit où traduire un type, jamais deux.

## Critères d'acceptation

- [x] Chaque option de la liste des visibles porte le type de l'objet en français
      (« galaxie », « amas ouvert », « nébuleuse planétaire »…).
- [x] Le `<select>` « Type d'objet » de la fiche affiche les mêmes libellés, plus
      jamais `AMAS_GLOB`.
- [x] Les dix valeurs de `TYPES_OBJET` ont un libellé ; en ajouter une sans la
      traduire ne compile pas.
- [x] `tests/cible.test.tsx` constate qu'une option de la liste porte le type de
      son objet.
