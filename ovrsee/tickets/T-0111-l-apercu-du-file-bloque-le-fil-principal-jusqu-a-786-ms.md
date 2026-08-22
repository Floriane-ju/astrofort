---
{
  "id": "T-0111",
  "titre": "L'aperçu du filé bloque le fil principal jusqu'à 786 ms",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "performance",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null
}
---

## Contexte

Constat de **T-0110**, axe « coût par image ». La passe par image du planétarium a été traitée
dans ce ticket-là ; l'aperçu du filé, lui, ne coûte rien par image — il est rendu hors écran,
mis en cache dans une `ref`, et sauté pendant les gestes (`src/ui/planetarium-incrustation.ts`).
Il sort donc de l'axe « par image ». Mais chaque rendu est une seule tranche de calcul sur le
fil principal, et `pnpm bench:file` la chiffre :

```
pire cas — 180°, 480 min, 50 mm f/1,4   786 ms   11 543 612 projections
pire cas — 180°, 480 min, 10 mm f/2,8   327 ms    4 927 735 projections
usuel — 60°, 120 min, 50 mm f/1,4       266 ms    3 033 642 projections
usuel — 60°, 120 min, 10 mm f/2,8        57 ms      633 469 projections
```

786 ms sur le fil principal, c'est l'interface figée le temps d'un clignement long. Le cas usuel
à 266 ms se sent déjà.

## Constats localisés

- `src/ui/dessine-champ.ts:202-203` — la bande galactique de l'aperçu appelle
  `projecteur.projette(depuisGalactique(...))` pour chaque longitude de chaque tranche de
  latitude, AVANT tout test d'appartenance au champ. C'est le défaut que T-0110 vient de
  corriger sur les couches de repérage du planétarium, à l'identique : le patron
  `champVisible` / `horsDuChamp` (`src/ui/dessine-ciel.ts`) écarte par produit scalaire avant
  de projeter. `projette` alloue deux objets par appel là où `projetteEn` n'en alloue aucun.
- `src/ui/dessine-champ.ts:296-316` — un `stroke()` par étoile, avec son `globalAlpha`, son
  `strokeStyle` et son `lineWidth` propres. **Ce n'est pas le même défaut que la bande** : la
  largeur d'une trace vient du rayon de l'étoile et son opacité de sa magnitude — deux valeurs
  continues et propres à chaque étoile. Les regrouper par teinte ne donnerait pas des groupes,
  mais autant de groupes que d'étoiles. À examiner autrement (quantifier rayon et opacité pour
  créer de vrais groupes ?), pas par recopie de la correction de la bande.

## Ce qu'il y a à décider

L'écart avant projection de la bande est mécanique et sûr. Le reste demande un arbitrage que ce
ticket n'a pas : rendre l'aperçu par tranches sur plusieurs images, ou le déporter hors du fil
principal, ou quantifier les traces pour les grouper. C'est pour cela qu'il part en
`a-specifier` et non en `pret`.

## Critères d'acceptation

- [ ] `pnpm bench:file` mesuré avant et après, sur les quatre cas du banc
- [ ] Le rendu de l'aperçu est identique, ou l'écart est décrit et justifié
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée
