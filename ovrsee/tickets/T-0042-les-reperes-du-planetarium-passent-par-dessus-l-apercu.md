---
{
  "id": "T-0042",
  "titre": "Les repères du planétarium passent par-dessus l’aperçu",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "ui",
    "planetarium",
    "file"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-les-reperes-du-planetarium-par-dessus-l-apercu-incruste.md"
}
---

## Contexte

Incrustation activée, le cadre matériel est rempli par l’aperçu des étoiles et
tout ce que le planétarium y dessinait disparaît : figures, frontières,
astérismes, horizon, plan galactique, marqueurs d’objets, corps, noms. Les
constellations s’arrêtent net au liseré orange, et rien ne rattache le contenu
du cadre au ciel qui l’entoure.

Ce n’est pas un défaut de projection — les deux passes partagent le projecteur
de la scène (§3.3), les repères tomberaient au bon endroit. C’est un ordre de
peinture : `dessineCiel` peint le ciel entier (`Planetarium.tsx:495`), puis
`incrusteDansLeCadre` dépose par-dessus une image **opaque**
(`Planetarium.tsx:518`, fond rempli en `dessine-champ.ts:285`).

L’aperçu doit donc se déposer **entre le fond et le reste**, pas après tout.
Un crochet `surLeFond` sur `EntreeDessin`, appelé juste après le `fillRect` du
fond (`dessine-ciel.ts:223`), suffit : `dessine-ciel.ts` ne peut pas importer
`scene-overlay.ts`, qui lui prend déjà `cheminCadre`. Rien n’est retracé deux
fois, le coût par image ne bouge pas.

Conséquence assumée : les étoiles du catalogue se dessinent désormais aussi
par-dessus l’aperçu, en plus des arcs. C’est le comportement demandé — tout le
rendu du planétarium au-dessus de l’image, sans atténuation ni réglage
supplémentaire.

## Critères d’acceptation

- [x] Incrustation activée, les figures, frontières, astérismes, l’horizon et
      le plan galactique traversent le liseré du cadre sans interruption.
- [x] Les noms — constellations, astérismes, étoiles nommées, objets, corps,
      « Voie lactée » — restent lisibles à l’intérieur du cadre.
- [x] Aucune couche nouvelle et aucun réglage nouveau : ce qui est éteint au
      planétarium reste éteint dans le cadre.
- [x] Le liseré du cadre n’est tracé qu’une fois : le retracé devenu redondant
      de `incrusteDansLeCadre` (`scene-overlay.ts:133-137`) est supprimé, pas
      laissé en place.
- [x] Un test de `tests/dessine-ciel.test.ts` constate que `surLeFond` est
      appelé après l’unique `fillRect` du fond et avant le premier tracé.
- [x] Le nombre d’images par seconde du planétarium est inchangé : aucune
      passe de tracé n’est exécutée deux fois.
- [x] Mode nuit : aucune couleur peinte ne porte de composante verte ou bleue.
