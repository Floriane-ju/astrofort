---
{
  "id": "T-0065",
  "titre": "Le rendu du ciel alloue moins par image",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "performance",
    "rendu"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-19",
  "plan": null
}
---

## Contexte

Constat **O2** de l'audit T-0054.

Dans la boucle chaude, deux objets sont alloués **par étoile et par image** :

- `src/ui/dessine-ciel.ts:283` alloue le littéral d'entrée
  `projecteur.projette({ x, y, z })` ;
- `src/core/projection.ts:150` alloue le `PointEcran` retourné.

À 24 im/s (`INTERVALLE_MIN_MS`, `src/ui/Planetarium.tsx:82`) et quelques milliers
d'étoiles retenues par la sélection, l'ordre de grandeur est 10⁵ objets par
seconde à collecter. C'est du travail que le ramasse-miettes rend sous forme de
saccades, pas de ralentissement moyen — donc invisible sur une moyenne de FPS,
visible à l'œil pendant un panoramique.

S'y ajoutent, une fois par image (`src/ui/Planetarium.tsx:466-518`) : `new Date`,
`cielInstantane`, `positionsInterpolees`, `etat.props.profils.map(…)`, le
projecteur et ses deux fermetures, la fermeture `surLeFond`, et le littéral
d'entrée de `dessineCiel`. Puis, dans `dessineCiel` : `palette()`
(`dessine-ciel.ts:224`) et les `TEINTES` `Path2D` (`dessine-ciel.ts:271`).

**Mesurer avant de corriger.** Deux raisons précises :

1. `scripts/bench-incrustation.ts` fournit déjà le harnais — il n'y a pas à
   l'inventer, seulement à le pointer sur la boucle du ciel.
2. Les `Path2D` ne se réutilisent pas : l'API n'offre aucun effacement. Leur
   allocation par image est contrainte, pas négligente. La confondre avec les
   autres ferait perdre du temps sur la seule qui ne se supprime pas.

La cible évidente est le couple entrée/sortie de `projette` : un vecteur et un
point réutilisés, écrits en place, plutôt que réalloués par étoile.

## Critères d'acceptation

- [x] Le nombre d'objets alloués par image est mesuré avant et après, sur une
      scène de référence — le chiffre figure dans le commit
- [x] `projecteur.projette` n'alloue plus par étoile, ni en entrée ni en sortie
- [x] Les allocations par image de `Planetarium.tsx:466-518` qui peuvent être
      hissées hors de la boucle le sont ; celles qui ne le peuvent pas — les
      `Path2D` — portent une ligne qui dit pourquoi
- [x] Le compteur d'images du planétarium ne baisse pas, et l'image rendue est
      identique au pixel près sur la scène de référence
- [x] `pnpm test` reste vert

## Mesure

`pnpm bench:ciel` — scène de référence : 30° de champ (le zoom qui retient le plus
d'étoiles du catalogue HYG), site réel, toutes les couches actives, 200 images.

|                        | avant  | après |
| ---------------------- | -----: | ----: |
| objets alloués / image | 17 096 |     8 |
| GC sur 200 images      |     16 |     6 |
| ms / image             |   0,65 |  0,59 |

`pnpm bench:ciel --empreinte` : `788f180a` avant comme après — l'image est identique
au pixel près. Les quatre empreintes de `pnpm bench:file` sont inchangées elles aussi.

Restent alloués par image : les 8 `Path2D` du regroupement par teinte (l'API n'offre
aucun effacement, un chemin réutilisé accumulerait les disques des images précédentes),
et une poignée d'objets qui dépendent de la vue de l'image — le projecteur, le littéral
d'entrée de `dessineCiel`, la fermeture `surLeFond`, les cadres.

## À suivre

- `projetteEn` calcule `thetaDeg` — `atan2` + `hypot` par étoile — alors qu'aucun
  appelant de production ne le lit ; seuls les tests l'observent. L'en-tête de
  `projection.ts` promet pourtant un coût par étoile « sans une seule fonction
  transcendante » en gnomonique et en stéréographique. Hors du périmètre de ce ticket.
- Une mesure d'octets alloués a été tentée puis abandonnée : la croissance du tas suit
  les heuristiques de dimensionnement de la jeune génération plus que le code mesuré
  (195 ko puis 225 ko par image sur deux passes consécutives). Le compte d'objets et le
  nombre de GC sont, eux, reproductibles.
