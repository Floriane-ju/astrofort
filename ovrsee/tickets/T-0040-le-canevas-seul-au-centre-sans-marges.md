---
{
  "id": "T-0040",
  "titre": "Le canevas seul au centre, sans marges",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0038",
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

Une fois les lectures parties dans le menu (T-0039), la colonne centrale n'a
plus qu'un enfant. La grille à deux rangées de `.coque-scene > .scene`
(`styles.css:123`) et sa hauteur réservée `--hauteur-lectures` n'ont plus de
raison d'être, non plus que le `padding: 0.5rem 1rem` qui creuse une marge
entre le canevas et les bordures des panneaux.

Attention à ne pas défaire T-0037 en le nettoyant : la raison pour laquelle la
rangée basse était fixe était que le canevas ne devait pas dépendre de ce qui
s'écrit dessous. En supprimant la rangée, la propriété devient structurelle —
mais `min-height: 0` sur la colonne reste indispensable, sans quoi le canevas
reprend sa hauteur intrinsèque et le défilement de page revient.

Le canevas gardait `object-fit: contain` : le rendu était un 1920 × 1080 qui ne
devait pas être étiré, et des bandes noires subsistaient quand la place
disponible n'était pas en 16/9. À l'usage, la place ne l'est presque jamais et
les bandes mangeaient le haut et le bas de l'écran. La résolution de rendu suit
donc finalement la boîte (`resolutionRendu`), à budget de pixels constant pour
ne pas alourdir le rendu sur dalle Retina : l'image remplit sa boîte sans être
ni étirée ni rognée, et il n'y a plus rien à loger.

## Critères d'acceptation

- [x] Le canevas touche la bordure du panneau gauche, celle du panneau droit et
      le bas du viewport : aucune marge ni remplissage autour.
- [x] Aucune hauteur n'est réservée sous le canevas, quel que soit l'état de la
      visée ou de la sélection.
- [x] La page ne défile jamais verticalement au-dessus de 1100 px.
- [x] L'image n'est pas déformée : les étoiles restent rondes quel que soit le
      rapport de la fenêtre.
- [x] Aucune bande noire au-dessus ni en dessous du canevas : le rendu remplit
      toute la hauteur disponible.
- [x] Sous le repli 1100 px, la scène reste en flux vertical, canevas en
      `aspect-ratio: 16 / 9`.
- [x] `--hauteur-lectures` et les règles `.scene-lectures` devenues mortes sont
      supprimées, pas laissées en place.
