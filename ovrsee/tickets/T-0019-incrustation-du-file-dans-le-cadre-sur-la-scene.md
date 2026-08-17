---
{
  "id": "T-0019",
  "titre": "Incrustation du filé dans le cadre, sur la scène",
  "epic": "T-0014",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "lot-6",
    "rendu"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md"
}
---

## Contexte

Le cœur du lot : le résultat se voit sur le planétarium, pas dans un second canevas ailleurs.
Le filé se dessine **à l'intérieur du cadre matériel**, sur le canevas de la scène, avec le
projecteur de la scène — donc les arcs tombent exactement sur les étoiles du ciel qui les
entoure.

C'est peu de code parce que `dessineChamp` (`src/ui/dessine-champ.ts:228`) prend son étendue
de `projecteur.vue.largeurPx/hauteurPx` et jamais de `ctx.canvas` : elle accepte déjà le
projecteur de la scène sans être touchée. Le contour du cadre vient de `contourCadreJ2000` ;
s'il est tracé en local dans `dessine-ciel.ts`, l'exporter plutôt que le réécrire — §3.3
interdit deux codes de projection.

Deux honnêtetés à tenir. Le vignettage se centre sur le canevas et non sur le cadre : il est
désactivé en incrustation, son chiffre en diaphragmes reste au panneau, et l'écran le dit. Et
si la projection de la scène n'est pas celle de l'objectif, le contenu du cadre n'est pas ce
que le capteur enregistrerait : la mention s'affiche, avec le bouton qui recadre.

## Critères d'acceptation

- [x] Le filé est rendu hors écran en 1920×1080 avec le `Vue` de la scène, puis dessiné dans
      la boucle sous `ctx.clip()` du contour du cadre, liseré du cadre retracé par dessus
- [x] Le rendu hors écran est statique : recalculé sur changement de pointage, champ, mode,
      instant, matériel, pose, durée, Voie lactée ou mode nuit — jamais à 60 Hz
- [x] Activer l'incrustation fige le temps : la vue animée reste le §3, un filé est une
      composition fixe
- [~] Pose unitaire portée au-delà de la pose max du cadre : les étoiles s'ovalisent dans le
      cadre, sur la scène, et la traînée en pixels s'affiche au panneau — chaîne en place,
      ovalisation couverte par `previsu-champ.test.tsx`, mais **non constatée à l'écran**
- [~] Durée totale portée de 5 à 480 min : les arcs s'allongent autour du pôle de l'époque,
      jamais recentré dans l'image, troncature aux bords signalée — moteurs inchangés, arcs
      tronqués remontés au panneau par le rendu hors écran, **non constaté à l'écran**
- [~] Le compteur d'images du ciel ne chute pas quand l'incrustation est active — par
      construction, la boucle ne fait qu'un `drawImage` sous clip, mais **non mesuré**
- [x] Projection de scène ≠ projection de l'objectif : mention affichée et bouton « voir comme
      l'objectif » qui pose le mode et le champ du cadre

## Réalisation

`src/ui/scene-overlay.ts` fait deux choses et rien d'autre : `rendIncrustation` peint
`dessineChamp` dans un `OffscreenCanvas` à la définition de la scène avec **le `Vue` de la
scène**, et `incrusteDansLeCadre` dépose l'image sous `ctx.clip()` du contour du cadre, puis
retrace le liseré par-dessus.

Rien n'a été réécrit. `dessineChamp` prend son étendue de `projecteur.vue` et jamais de
`ctx.canvas` : elle accepte le projecteur de la scène telle quelle. Le contour vient de
`dessine-ciel.ts`, où le tracé local a été scindé en `cheminLignes` (compose) et `traceLignes`
(compose puis peint), le premier exporté sous `cheminCadre` — §3.3 interdit qu'un second code
de projection existe, et un clip a besoin du chemin sans le trait.

Le rendu hors écran est produit par un effet, gardé dans une `ref`, et la boucle
`requestAnimationFrame` ne fait que le redéposer. Le semis génératif n'est construit qu'à la
première incrustation. Piège évité en chemin : l'incrustation republie ses compteurs dans le
magasin de séance, ce qui rend l'application — l'objet de matériel passé à la scène est donc
mémoïsé, sans quoi chaque publication relancerait un rendu, qui republierait, sans fin.

`activeIncrustation(true)` pose `modeTemps = 'FIGE'`. L'inverse n'est pas vrai : éteindre
l'incrustation ne rend pas le temps à l'horloge système, parce que c'est un geste et non un
effet de bord — un test le fixe.

Trois honnêtetés tenues. Le vignettage n'est jamais incrusté (il se centre sur le canevas, pas
sur le cadre) et l'écran le dit, son chiffre en diaphragmes restant au panneau. Quand la
projection de la scène n'est pas celle de l'objectif, la mention s'affiche avec le bouton
« Voir comme l'objectif », qui pose le mode et le champ du cadre. Et si l'incrustation est
demandée alors que la couche « Cadre matériel » est éteinte, l'écran le dit plutôt que de
laisser une case cochée sans effet.

## Réserve

Aucune image n'a été regardée : pas de pilote de navigateur ici. Ce qui est vérifié sans DOM,
c'est l'ordre des opérations de dépose — `save → clip → drawImage → restore → liseré` — et la
mention de projection, dans `tests/coque.test.tsx`. L'ovalisation, l'allongement des arcs et le
compteur d'images restent à constater à l'écran.
