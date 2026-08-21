---
{
  "id": "T-0107",
  "titre": "Une étoile nommée n'apparaît qu'une fois parmi les cibles",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "planetarium",
    "rendu",
    "interaction"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-21",
  "plan": "2026-08-21-deux-tickets-le-survol-d-une-etoile-deja-nommee-ne-dit-plus.md"
}
---

## Contexte

Au survol de certaines étoiles du planétarium, une seconde ligne s'inscrit sous le nom déjà
peint : « Étoile sans désignation dans le paquet chargé ». Cebalrai en porte la capture. L'app
se contredit à l'écran — le label nomme l'étoile, le survol affirme qu'elle n'a pas de nom.

**Chaque étoile brillante est poussée deux fois dans `cibles`.**

- `src/ui/dessine-ciel.ts:612-615` — passe des étoiles du catalogue : tout astre de
  `magV ≤ K('MAG_LABEL_BAYER_MAX')` devient une cible `ETOILE` portant `etoile`, sans
  désignation.
- `src/ui/dessine-ciel.ts:630-636` — passe des étoiles nommées : la même étoile redevient une
  cible `ETOILE`, portant cette fois `etoileNommee`.

**Le doublon anonyme gagne une fois sur deux.** Les deux entrées ne tombent pas au même
sous-pixel : `constellations-1.bin` conserve la position en double précision,
`hyg-1.bin` l'encode en `Float32`. Mesuré sur β Oph — `265.868145°` contre `265.8681335°`,
soit 0,041 seconde d'arc, de l'ordre de 1e-4 pixel à tout champ réaliste. `cibleSousLeCurseur`
(`src/ui/dessine-ciel.ts:811-817`) retient la plus proche du curseur : selon le côté d'approche
du pointeur, c'est l'anonyme ou la nommée qui répond. D'où « sur certaines étoiles » — c'est un
pile ou face, pas une propriété de l'étoile.

Le garde-fou existant ne rattrape pas ce cas. `labelSurvol` (`src/core/labels.ts:101`) tait le
survol quand son titre commence par un label déjà retenu. Résolu sur la nommée, le titre aurait
été « Cebalrai — β Oph » et rien n'aurait été peint. Résolu sur l'anonyme, le titre ne commence
par aucun label retenu : il est peint sous le nom.

**La branche de repli reste nécessaire.** Comptage des paquets versionnés : 291 étoiles
`magV ≤ 3,5` dans `hyg-1.bin`, 284 entrées correspondantes dans `constellations-1.bin`.
286 des 291 cibles anonymes sont donc des doublons ; 5 étoiles seulement — toutes australes,
magnitudes 3,16 à 3,43 — n'ont ni Bayer, ni Flamsteed, ni nom propre et méritent vraiment le
message de repli de `src/ui/planetarium-selection.ts:52-63`. Supprimer la branche les rendrait
injoignables : il faut dédoublonner, pas amputer.

## La correction

Ne pas émettre de cible anonyme pour une étoile qu'une cible nommée occupe déjà au même pixel.

Les cibles nommées se construisent sans rien peindre — les disques sortent du `fill` des
`Path2D` en `dessine-ciel.ts:618-621`, les labels du `composeLabels` de la ligne 770. La boucle
des étoiles nommées peut donc précéder l'appel à `selectionne`, ou bien les entrées anonymes
s'accumuler dans un tableau intermédiaire filtré après elle. Le second découpage donne le plus
petit diff.

Clé de comparaison : le pixel entier — `Math.round(xPx)`, `Math.round(yPx)` — dans un `Set`,
interrogé sur le voisinage 3×3 pour qu'un arrondi à cheval sur une frontière ne rate pas le
doublon. Aucune tolérance nouvelle au registre : deux entrées qui tombent sur le même pixel sont
indiscernables au pointeur, et c'est l'identifiée qui doit répondre. Coût par image négligeable —
au plus 291 étoiles concernées dans tout le ciel, neuf lectures de `Set` chacune.

`cibleSousLeCurseur` n'est pas touchée : la règle « la plus proche » redevient juste une fois le
doublon retiré.

## Critères d'acceptation

- [ ] Aucune étoile n'apparaît deux fois dans `cibles` : pour toute cible portant `etoileNommee`,
      aucune cible anonyme ne partage son pixel.
- [ ] Le survol d'une étoile nommée résout toujours `etoileNommee`, quel que soit le côté par
      lequel le curseur approche — vérifié en visant plusieurs points autour du même astre.
- [ ] Les 5 étoiles brillantes réellement sans désignation répondent encore au clic, avec leur
      magnitude et leur indice B−V.
- [ ] Le nombre d'étoiles dessinées et les labels retenus sont inchangés : seule la liste des
      cibles perd ses doublons.
