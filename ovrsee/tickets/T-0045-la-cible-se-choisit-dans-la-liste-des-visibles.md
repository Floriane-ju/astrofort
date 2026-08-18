---
{
  "id": "T-0045",
  "titre": "La cible se choisit dans la liste des visibles",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0043",
  "tags": [
    "ui",
    "cible"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-choisir-sa-cible-parmi-ce-que-le-ciel-offre.md"
}
---

## Contexte

Le `<select>` de l'onglet Cible liste les 400 premières entrées du binaire
(`src/ui/FicheCible.tsx:209-222`) : un ordre de fichier, pas un ordre de ciel. À sa
place, la fiche doit proposer ce que T-0044 calcule — les objets au-dessus de
l'horizon à l'instant affiché, retenus sur le verdict de détectabilité du setup.

La fiche lit `msAffiche` du magasin de scène (`useScene()`,
`src/ui/scene-etat.ts:240`) et reçoit une nouvelle prop `site`. Le `useMemo` sur
`ciblesVisibles(…)` est **clé quantifiée à la minute** (`Math.floor(msAffiche / 60000)`) :
`msAffiche` est publié deux fois par seconde (`scene-etat.ts:222`) et le catalogue
compte ~14 000 entrées — recalculer à chaque publication mettrait 28 000 appels à
`detectabilite` par seconde dans le fil de rendu. Une minute de granularité ne
change pas quel objet est au-dessus de l'horizon.

Le `<select>` est groupé par `<optgroup>` sur le verdict — Œil nu, Jumelles,
Télescope, Photo seule : le groupe dit ce que le setup en fera, sans texte
supplémentaire. Chaque option porte la désignation, le premier nom commun, la
magnitude et la hauteur.

La liste est plafonnée par une constante nommée du module (`CIBLES_LISTEES_MAX`),
et le compte réel est annoncé à côté — un plafond muet mentirait sur le ciel. Le
plafond porte un commentaire `ponytail:` nommant sa sortie : `<input list>` +
`<datalist>` si la liste doit devenir cherchable.

Le choix appelle `appliqueObjet` (`FicheCible.tsx:122`), déjà écrit.

## Critères d'acceptation

- [x] L'onglet Cible porte un `<select>` de cibles visibles, groupé par verdict.
- [x] Choisir une entrée remplit les six champs de la fiche, comme un clic sur la
      scène.
- [x] Le compte réel de cibles au-dessus de l'horizon est affiché, plafond compris.
- [x] La liste ne se recalcule pas plus d'une fois par minute d'horloge affichée.
- [x] `tests/cible.test.tsx` constate qu'un objet du catalogue sous l'horizon
      n'apparaît pas dans le `<select>`, et qu'un objet au-dessus y apparaît.
