---
{
  "id": "T-0048",
  "titre": "La cible vient du catalogue, ou elle est personnalisée",
  "type": "epic",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
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

Depuis T-0045, l'onglet Cible propose la liste des visibles, groupée par verdict
(`src/ui/FicheCible.tsx:281-303`). Deux choses lui manquent encore, et une
troisième la contredit.

Ce qui manque : le **type d'objet** n'apparaît nulle part dans la liste. Une
option dit « NGC0224 — Andromeda · mag 3,4 · 47° de hauteur » — brillante et
haute, mais galaxie ou amas ? Il faut choisir pour le savoir. Et rien ne permet
de restreindre la liste à ce qu'on est venu chercher ce soir.

Ce qui contredit : après un choix dans la liste, les six champs de la fiche
restent des `<input>` libres (`FicheCible.tsx:334-360`). L'utilisateur peut donc
modifier la magnitude d'un objet du catalogue OpenNGC, ou son grand axe, et la
fiche continue d'afficher sa désignation. Le verdict calculé ne décrit alors plus
aucun objet réel, et rien ne le signale.

Cet epic tranche : une cible du catalogue est une donnée, pas une saisie. Qui veut
des valeurs à soi choisit explicitement « Personnalisé ».

## Critères d'acceptation

- [x] Chaque entrée de la liste des visibles annonce son type d'objet en clair.
- [x] La liste peut être restreinte à un type d'objet, sans l'être par défaut.
- [x] Une cible venue du catalogue a ses champs en lecture seule.
- [x] « Personnalisé » est un choix explicite de la liste, et rouvre la saisie.
- [x] Les trois tickets enfants sont soldés.
