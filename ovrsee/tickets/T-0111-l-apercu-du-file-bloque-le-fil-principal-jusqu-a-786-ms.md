---
{
  "id": "T-0111",
  "titre": "L'aperçu du filé bloque le fil principal jusqu'à 786 ms",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "performance",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-23",
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

- [x] `pnpm bench:file` mesuré avant et après, sur les quatre cas du banc
- [x] Le rendu de l'aperçu est identique, ou l'écart est décrit et justifié
- [x] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée

## Réalisé — 23 août 2026

Le banc a d'abord servi à localiser la dépense, avant toute correction. `node --cpu-prof` sur
la passe entière :

```
29,1 %  projetteEn      src/core/projection.ts
25,9 %  applique        src/core/mat3.ts
19,8 %  arcEtoile       src/core/file-etoiles.ts
 3,2 %  ramasse-miettes
```

Trois défauts, tous dans l'arc, aucun dans la bande.

**1. `applique` allouait un vecteur par pas d'arc.** `arcEtoile` faisait tourner l'étoile de
proche en proche par `applique(rotation, position)` : à 481 pas par étoile et 29 000 étoiles,
c'est onze millions et demi de vecteurs morts. La matrice est désormais déstructurée avant la
boucle et le produit écrit à la main sur trois scalaires, dans l'ordre exact de `applique` —
la trajectoire reste bit à bit la même. La position projetée passe par `projetteEn` et un point
de travail unique ; seules les positions RETENUES deviennent un objet.

**2. Un point projeté portait une distance angulaire que personne ne lisait.** `PointEcran`
exposait `thetaDeg`, calculé par `Math.atan2(Math.hypot(x, y), z)` à CHAQUE projection. Un seul
lecteur dans tout `src/` : `longitudeGalactiqueVisee`, une fois par image, pour classer soixante
candidats. Le champ est supprimé, et ce classement se fait maintenant sur la séparation entre
directions (`separationDeg`) — la même grandeur, mesurée là où elle sert.

Première tentative écartée : classer sur le rayon en pixels depuis le centre du canevas. C'est
monotone en θ dans les trois modes de §3.3, donc juste sur le papier, et c'est faux en pratique
— à 180° de champ en MODE_CADRE, l'échelle vaut 5,9 · 10⁻¹⁴ px/rad et `xPx - centreX` s'annule
au dernier bit de 960. L'empreinte des deux cas à 180° a changé, ce qui a révélé la faute ; la
séparation entre directions les a ramenés à l'identique.

**3. `Math.hypot` sur des différences de pixels.** Trois appels par pas d'arc — longueur du
segment, pré-échantillonnage, distance au centre. `hypot` met ses arguments à l'échelle pour
survivre à un dépassement qu'une différence de deux abscisses de canevas ne peut pas produire.
Remplacé par `sqrt(dx² + dy²)`.

### Mesures

```
$ pnpm bench:file
                                        AVANT     APRÈS
pire cas — 180°, 480 min, 50 mm f/1,4   770 ms    213 ms    (3,6 ×)
pire cas — 180°, 480 min, 10 mm f/2,8   320 ms     91 ms    (3,5 ×)
usuel — 60°, 120 min, 50 mm f/1,4       260 ms     96 ms    (2,7 ×)
usuel — 60°, 120 min, 10 mm f/2,8        56 ms     24 ms    (2,3 ×)
```

Le nombre de projections est inchangé — 11 543 612 dans le pire cas : rien n'a été retiré du
calcul, c'est le coût unitaire d'une projection qui a baissé. Le cas usuel passe sous les 100 ms,
sous le seuil où une interface se sent figée.

### Rendu identique

```
$ pnpm bench:file --empreinte
pire cas — 180°, 480 min, 50 mm f/1,4  empreinte 474befef
pire cas — 180°, 480 min, 10 mm f/2,8  empreinte 50ceaf8b
usuel — 60°, 120 min, 50 mm f/1,4      empreinte 863c1cd6
usuel — 60°, 120 min, 10 mm f/2,8      empreinte 52939a1a
```

Les quatre condensés sont ceux d'avant la correction : même suite d'ordres de peinture, mêmes
coordonnées au millième de pixel. Aucun écart à justifier.

### Vérification

```
$ pnpm typecheck
$ tsc --noEmit
        (aucune sortie)

$ pnpm test
 Test Files  54 passed (54)
      Tests  733 passed (733)
   Duration  3.39s
```

`tests/projection.test.ts` perdait trois assertions avec `thetaDeg`. Celle qui portait une vraie
propriété de §3.3 — le projecteur restitue l'angle qu'on lui donne — est réécrite sur ce que la
projection produit réellement : l'angle se relit dans le rayon projeté par `angleProjete`, la
réciproque déjà exportée.

### Ce qui n'a pas été fait, et pourquoi

**L'écart avant projection de la bande galactique** (`dessine-champ.ts:202-203`), que ce ticket
donnait comme mécanique et sûr. Il ne rapporte rien : la bande, c'est 90 tranches × 61 longitudes
× 2 sommets, soit 11 000 projections sur les 11 543 612 de la passe — un millième. Après
correction, `dessineVoieLactee` ne figure plus dans le millième supérieur du profil. Et l'écart
n'est pas gratuit : le polygone d'une tranche se coupe là où `projette` répond `null`, donc tout
critère de rejet qui n'est pas exactement celui de `projette` déplace les coupures et change
l'image. Payer un risque de rendu pour un millième de gain, non.

**Le `stroke()` par étoile** reste entier, et l'arbitrage que ce ticket n'avait pas reste à
prendre. Il n'est plus le premier poste : `arcEtoile` et `projetteEn` pèsent encore les deux
tiers de la passe, la peinture n'est même pas mesurée par ce banc.
