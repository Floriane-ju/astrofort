---
{
  "id": "T-0091",
  "titre": "La bande de la Voie lactée et le centre galactique se voient sur la scène",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "prd",
    "planetarium",
    "voie-lactee"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

Extension de §3.7 au PRD 1.2.

La scène ne porte aujourd'hui que la LIGNE du plan galactique `b = 0` et son label
(`src/ui/dessine-ciel.ts:96`). Le persona « amateur de Voie lactée et de filé » a besoin de
deux choses de plus, et les deux sont déjà calculées ailleurs :

1. **La bande, modulée par le fond de ciel du site.** `contrasteVoieLactee(sb_ciel)`
   (`src/core/galactique.ts:75`) et la densité par latitude galactique
   (`densiteRelative()`) servent déjà l'aperçu de §9.2. Une ligne dit où passe le plan ; une
   bande dit ce que l'utilisateur verra depuis SON ciel — à Bortle 4 elle est visible mais
   atténuée, à Bortle 8 elle disparaît. C'est l'information qui décide d'un déplacement.

2. **Le centre galactique.** C'est la cible la plus demandée du grand champ d'été, et depuis
   le site de référence (46,391° N) elle culmine à 14,6° — inaccessible. Le PRD le calcule en
   §8.2 dans un tableau, l'application ne le montre nulle part. Un repère sur la scène rend
   la contrainte immédiatement lisible, là où un tableau demande d'y croire.

La bande reste un repère de lecture, pas une promesse photométrique : elle ne remplace pas la
couche 3 de §9.2, qui module un contraste dans une image de capture.

## Critères d'acceptation

- [x] La bande de la Voie lactée est rendue sur la scène, son contraste modulé par le fond de
      ciel du site, et s'effaçant à Bortle élevé.
- [x] La bande reste sous les repères, les étoiles et les labels, comme l'aperçu incrusté
      de §9.5 — elle n'est jamais peinte par-dessus le repérage.
- [x] Le centre galactique est repéré et nommé sur la scène, avec sa hauteur courante.
- [x] Quand le centre galactique n'atteint jamais le seuil d'imagerie depuis le site, le
      repère le dit, avec la latitude en dessous de laquelle il deviendrait accessible (§8.2).
- [x] La bande et le repère suivent la couche Voie lactée existante : une seule bascule, pas
      trois.
- [x] Le budget de labels de §3.4 est respecté : le repère du centre galactique s'arbitre
      comme les autres, sans passe-droit.
- [x] Le mode nuit compose la bande en rouge monochrome, sans dépasser la luminance plafond
      (§11.1).

## Réalisé

**La bande** — treize tranches de latitude galactique de −30° à +30°, tracées au trait épais
de la largeur de la tranche (`src/ui/dessine-ciel.ts`, `TRANCHES_BANDE`). Le trait et non le
polygone rempli : une polyligne partiellement hors champ se rompt en segments, et un polygone
rompu se referme n'importe où — le trait ne peint que ce qui reste. Opacité par tranche
= `contrasteVoieLactee(sb_ciel)` × `densiteRelative(b)` × `OPACITE_BANDE_GALACTIQUE`. Contraste
nul à Bortle 8 : la fonction ne peint rien, et la ligne du plan reste tracée.

Peinte juste après le fond, AVANT le crochet `surLeFond` : la bande passe donc sous l'aperçu
incrusté de §9.5 comme sous les repères. Peinte plus tard, elle laverait la prévisualisation
qu'elle recouvre.

**Le centre galactique** — `depuisGalactique(0, 0)`, jamais une coordonnée recopiée. Le repère
porte sa hauteur COURANTE (elle dit où le chercher maintenant) et, sous le seuil d'imagerie,
sa culmination et la latitude qui le rendrait atteignable — 14,6° et 31,1° N depuis le site de
référence, les chiffres du tableau de §8.2, recalculés et non repris. Le tout dans UN label,
pour que le budget de §3.4 l'arbitre d'un bloc : il passe devant le nom « Voie lactée » au
tri stable à priorité égale, parce que les deux s'ancrent au même point quand la visée est sur
le centre et que c'est le repère qui porte la conséquence.

`latitudeAccessibleDeg` est extraite dans `src/core/site.ts` et consommée par `creneaux.ts`
comme par la scène : la formule δ + (90° − seuil) n'existe qu'une fois.

Une seule bascule : la couche `voieLactee` éteint ligne, bande et repère ensemble.

Banc `pnpm bench:ciel` : 0,73 ms/image, 10 118 projections — la bande en ajoute ~1 570, sans
allocation par étoile. Suite complète verte (514 tests), `pnpm typecheck` propre.

Non vérifié : le rendu à l'écran. L'extension navigateur n'était pas connectée pendant la
session.
