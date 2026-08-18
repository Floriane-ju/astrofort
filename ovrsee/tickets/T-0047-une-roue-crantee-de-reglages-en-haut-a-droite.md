---
{
  "id": "T-0047",
  "titre": "Une roue crantée de réglages en haut à droite",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0043",
  "tags": [
    "ui",
    "coque"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-choisir-sa-cible-parmi-ce-que-le-ciel-offre.md"
}
---

## Contexte

Le `<select>` « Choisir dans le catalogue » occupe le chemin principal de l'onglet
Cible (`src/ui/FicheCible.tsx:209-222`) alors qu'il n'est plus la façon normale de
choisir : T-0045 met à sa place la liste des visibles. Il ne disparaît pas pour
autant — parcourir le catalogue brut reste utile — mais il quitte la fiche.

Nouveau `src/ui/MenuReglages.tsx`, sur le patron exact de `src/ui/MenuInfos.tsx` :
`<details className="tiroir tiroir-reglages">`, `<summary>⚙ Réglages</summary>`,
fermeture à Échap. Monté dans `topbar` (`src/App.tsx:398-436`) **avant**
`MenuInfos`, qui reste le dernier élément — donc le plus à droite, comme son
commentaire l'annonce.

Le tiroir reçoit `catalogue` et porte le `<select>` **inchangé** : mêmes 400
entrées, même libellé. Il appelle `ouvreCible(objet)`
(`src/ui/seance-etat.ts:107`) au lieu de l'ancien `choisitDansCatalogue` local :
`ouvreCible` garnit la fiche *et* bascule sur l'onglet Cible, ce qui est
exactement le geste attendu depuis la barre haute. Aucun câblage nouveau — c'est
le chemin que le clic sur la scène emprunte déjà.

## Critères d'acceptation

- [x] Une roue crantée est visible dans la barre haute, à droite, avant le menu
      des lectures.
- [x] Le tiroir fermé ne prend aucune hauteur ; ouvert, il se superpose à la scène.
- [x] Échap le referme.
- [x] Le choix dans le catalogue s'y trouve, à l'identique, et n'est plus dans
      l'onglet Cible.
- [x] Y choisir un objet garnit la fiche et amène l'onglet Cible au premier plan.
- [x] La cible ≥ 44 px de §11.2 est respectée sur le bouton du tiroir.
- [x] `tests/coque.test.tsx` constate la présence du tiroir dans la barre haute et
      l'absence du select catalogue dans l'onglet Cible.
