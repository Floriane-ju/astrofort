---
{
  "id": "T-0037",
  "titre": "Le canevas garde sa taille quand les lectures s’allongent",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "ui",
    "planetarium"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

En visant vers le bas, le planétarium rétrécit. Ce n’est pas le zoom : c’est la
mise en page.

`.coque-scene > .scene` est une grille `minmax(0, 1fr) auto` — le canevas prend
ce qui reste une fois les lectures posées. Or le bloc `.scene-lectures` change
de hauteur avec ce qu’il dit : dès qu’une cible dominante impose une rotation,
le paragraphe « Rotation de 117° : le grand axe de … » s’ajoute, la ligne d’état
passe à trois lignes, et la rangée `auto` mange la place du canevas. Le canevas
étant en `object-fit: contain` sur un 1920 × 1080, l’image affichée rétrécit
d’autant, en largeur comme en hauteur.

Conséquence : la scène tressaute pendant qu’on promène la visée, et l’échelle
apparente du ciel change sans que le champ ait bougé.

## Critères d’acceptation

- [x] En promenant la visée d’un bord à l’autre du ciel, le canevas garde des
      dimensions à l’écran constantes, quel que soit le nombre de lignes
      affichées dessous.
- [x] Quand les lectures dépassent la place qui leur est réservée, elles
      défilent dans leur propre zone ; elles ne repoussent jamais le canevas.
- [x] Quand les lectures sont courtes, le canevas ne grandit pas non plus : sa
      taille ne dépend pas du texte.
- [x] Sous le repli 1100 px, la scène reste en flux vertical comme aujourd’hui
      (canevas en `aspect-ratio: 16 / 9`, lectures à la suite).
