---
{
  "id": "T-0038",
  "titre": "Les lectures passent dans un menu, le ciel prend toute la place",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "coque",
    "planetarium"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

La colonne centrale porte aujourd'hui deux choses : le canevas, et sous lui un
bloc `.scene-lectures` qui empile la ligne d'état, les avertissements, les
lectures du cadre, la sélection et le diagnostic de rendu. T-0037 a figé la
hauteur de ce bloc pour que le canevas cesse de tressauter — mais le prix payé
est une bande réservée en permanence, occupée ou non, prise sur le ciel.

Ces lectures sont de la donnée de contrôle : on les consulte, on ne les
surveille pas en continu. Leur place n'est pas sous la scène, elle est dans un
menu qu'on ouvre. La scène, elle, n'a besoin de rien d'autre qu'elle-même.

Cet epic regroupe le déplacement (un menu d'information en haut à droite), la
récupération de la place (le canevas seul entre les deux panneaux, sans marge),
et le garde-fou qui va avec : une alerte rangée dans un tiroir fermé est une
alerte qu'on ne voit pas.

## Critères d'acceptation

- [x] Plus aucune lecture textuelle sous le canevas : la colonne centrale ne
      contient que la scène.
- [x] Toutes les lectures d'aujourd'hui restent accessibles, sans perte, dans
      un menu déroulant en haut à droite.
- [x] Le canevas occupe toute la place entre le panneau gauche et le panneau
      droit, sans marge ni bande réservée.
- [x] Une cause ou un refus se signale sur le bouton du menu même fermé.
