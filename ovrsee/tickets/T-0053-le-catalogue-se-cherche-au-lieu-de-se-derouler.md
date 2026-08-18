---
{
  "id": "T-0053",
  "titre": "Le catalogue se cherche au lieu de se dérouler",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "ui",
    "cible",
    "catalogue"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Le `<select>` du tiroir de réglages (`src/ui/MenuReglages.tsx:51-59`) déroule
400 entrées sur 14 000, toutes des IC (voir T-0052). Il est remplacé par un
champ de saisie cherchable, alimenté par la fonction de T-0052.

**`<input list>` + `<datalist>`, natifs.** C'est la sortie déjà nommée dans le
`ponytail:` de `FicheCible.tsx:75` : le navigateur porte la liste déroulante, la
navigation clavier, le filtrage à la frappe et l'annonce aux lecteurs d'écran.
Aucune bibliothèque de combobox, aucun `aria-activedescendant` à tenir à la
main, aucun gestionnaire de focus.

**La valeur insérée est la désignation.** `<datalist>` insère l'attribut `value`
de l'option dans le champ ; le texte de l'option n'est qu'une aide à la lecture.
`value="M45"`, contenu textuel = le reste de `libelleObjet` — sinon la saisie
retenue serait « M45 — Pléiades · amas ouvert · mag 1.6 », qu'aucune recherche
ultérieure ne retrouve. Le rendu du contenu textuel varie d'un navigateur à
l'autre : c'est une aide, jamais le porteur de l'information.

**Le `<datalist>` ne porte que les résultats de la frappe en cours**, une
poignée d'options, pas 14 000 nœuds. Le plafond `ENTREES_CATALOGUE_MAX`
disparaît : ce n'est plus une fenêtre sur le catalogue, c'est un rendu de
résultats. Ce qui est cherchable n'est plus plafonné.

**Résolution avant `ouvreCible`.** Un champ libre accepte n'importe quoi. Une
saisie qui ne correspond à aucune désignation du catalogue n'ouvre rien et le
dit — c'est la validation d'entrée à la frontière, pas un détail d'ergonomie. La
résolution reste celle d'aujourd'hui (`choisitDansCatalogue`,
`MenuReglages.tsx:29`) : `find` sur la désignation exacte, puis `ouvreCible`,
qui garnit la fiche, verrouille les six champs (T-0051) et amène l'onglet Cible
au premier plan.

**Ce qui ne change pas.** Le catalogue non vérifié affiche toujours son message
d'attente d'intégrité. La cible de clic de §11.2 tient sur le champ comme elle
tenait sur le select. La liste des visibles de l'onglet Cible n'est pas touchée
— ce ticket ne concerne que le chemin secondaire.

## Critères d'acceptation

- [x] Le tiroir de réglages porte un champ de saisie, plus un `<select>`
      déroulant le début du catalogue.
- [x] Taper « pléiades » ou « M45 » propose M45 ; le choisir ouvre sa fiche,
      verrouillée, onglet Cible au premier plan.
- [x] Un objet de n'importe quelle partie du catalogue est atteignable : les NGC
      et les Messier ne sont plus hors de portée.
- [x] `ENTREES_CATALOGUE_MAX` n'existe plus ; le nombre d'options rendues suit
      la frappe.
- [x] Une saisie qui ne désigne aucun objet du catalogue n'ouvre aucune fiche et
      se signale à l'utilisateur.
- [x] Chaque option affiche le même libellé que la liste des visibles, hauteur
      exceptée (`libelleObjet`), et insère la seule désignation dans le champ.
- [x] Le champ respecte la cible de clic de §11.2 et reste utilisable au clavier
      seul.
- [x] Catalogue non vérifié : le message d'attente d'intégrité tient.
