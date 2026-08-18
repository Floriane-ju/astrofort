---
{
  "id": "T-0065",
  "titre": "Le rendu du ciel alloue moins par image",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "performance",
    "rendu"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
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

- [ ] Le nombre d'objets alloués par image est mesuré avant et après, sur une
      scène de référence — le chiffre figure dans le commit
- [ ] `projecteur.projette` n'alloue plus par étoile, ni en entrée ni en sortie
- [ ] Les allocations par image de `Planetarium.tsx:466-518` qui peuvent être
      hissées hors de la boucle le sont ; celles qui ne le peuvent pas — les
      `Path2D` — portent une ligne qui dit pourquoi
- [ ] Le compteur d'images du planétarium ne baisse pas, et l'image rendue est
      identique au pixel près sur la scène de référence
- [ ] `pnpm test` reste vert
