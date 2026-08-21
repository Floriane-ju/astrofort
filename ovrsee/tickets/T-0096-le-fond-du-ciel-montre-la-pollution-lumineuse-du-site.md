---
{
  "id": "T-0096",
  "titre": "Le fond du ciel montre la pollution lumineuse du site",
  "type": "epic",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "l",
  "tags": ["planetarium", "rendu", "prd"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-le-fond-du-ciel-montre-la-pollution-lumineuse-5-tickets-ovrs.md"
}
---

## Contexte

La case « Vue réaliste — plafonnée par le fond de ciel » ne fait qu'une chose : plafonner la
magnitude limite du rendu par `mLimOeil` (`src/core/projection.ts:246-267`). Le fond, lui,
reste `#05070d` quel que soit le site (`src/ui/couleurs.ts:105`, `src/ui/dessine-ciel.ts:426`).

Elle paraît donc inerte, et elle l'est souvent pour de bon :

- au défaut (Bortle 4,5 → `mLimOeil` 6,05 contre 6,5 au champ de référence), le plafond retire
  0,45 mag — quelques dizaines de points d'un pixel ;
- au-delà du champ de bascule `60 × 10^((6,5 − mLimOeil)/5)` — 74° à B4,5, 150° à B8 — le `min`
  renvoie la valeur du zoom : la case ne change **rien**, par construction ;
- le ciel d'un centre-ville et celui d'un col de montagne se rendent avec le même fond, ce qui
  tient à moitié la promesse de §3.3 : « le rendu montre le ciel tel qu'il serait vu, non le
  catalogue complet ».

Cet epic fait porter la vue réaliste sur le fond lui-même : plus le site est pollué, plus le
fond est clair.

**Règle de composition, unique** — celle que le projet applique déjà pour la Lune
(`src/registry/formulas.ts:391-394`) : les brillances s'additionnent en nanolamberts, jamais en
magnitudes.

```
B_total(direction) = B_site × vanRhijn(h)      halo du site      T-0098
                   + B_crepuscule(h_soleil)                      T-0099
                   + B_lune(rho, h_lune, alpha)  déjà implémenté  T-0100
sb_effectif        = sb^-1(B_total)
```

**Rendu écran** — luminance d'écran proportionnelle à la brillance physique, avec une seule
constante libre (l'exposition), calée pour que le ciel le plus noir de la table Bortle soit
juste au-dessus du noir. Le rapport B9/B1 de 36× n'est pas choisi : il est physique.

Le PRD ne spécifie pas la couleur du fond — §3.3 ne donne à `sb_ciel` que « plafonne
`mag_limite` en vue réaliste ». C'est une extension de rendu, documentée comme telle dans le
registre, sur le précédent de `FOV_MAX_GNOMONIQUE_DEG` (convention produit assumée, T-0095).
`prd.md` n'est pas modifié.

**Décisions arbitrées, valables pour les quatre enfants**

1. Mode nuit : le fond reste noir. Le mode nuit protège l'adaptation à l'obscurité ; éclaircir
   le canevas le rendrait inutile. En mode nuit, la vue réaliste ne change que la magnitude
   limite.
2. Le Bortle est toujours renseigné (défaut 4,5, `src/ui/app-saisie.ts:22`) : pas de branche
   « fond de ciel inconnu ».
3. Hors table Bortle, la magnitude limite plafonne au bord de table et le déclare — elle n'est
   pas extrapolée, et elle ne cesse pas de plafonner. Précédent : `src/registry/contrast.ts:47`.
4. Le contraste des repères est compensé, pas re-arbitré : chaque teinte garde le rapport WCAG
   qu'elle a aujourd'hui sur `#05070d`.
5. Le sol ne s'éclaircit pas. Hors périmètre.
6. Pas d'asymétrie en azimut : le dôme lumineux d'une ville est plus clair de son côté, mais
   l'atlas VIIRS qui le donnerait est écarté par §4.1 (réseau exigé).

## Critères d'acceptation

- [ ] T-0097 à T-0100 sont livrés ; chacun se vérifie seul.
- [ ] Un seul moteur calcule `sb_effectif` : tous les contributeurs passent par lui, aucun
      n'écrit de couleur.
- [ ] Le fond de ciel effectif est une valeur tracée : sa décomposition — site, halo
      d'horizon, crépuscule, Lune — se lit comme `magnitude_limite_rendue` se lit aujourd'hui.
- [ ] Les limites sont dites dans l'app, pas seulement ici : le sol ne s'éclaircit pas, le halo
      du site reste symétrique en azimut, la teinte du crépuscule ne vire pas vers l'azimut du
      Soleil.
- [ ] Mode nuit : le fond reste `#000000` dans les quatre enfants.
