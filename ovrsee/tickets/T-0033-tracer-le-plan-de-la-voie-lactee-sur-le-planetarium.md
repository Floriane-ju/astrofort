---
{
  "id": "T-0033",
  "titre": "Tracer le plan de la Voie lactée sur le planétarium",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0035",
  "tags": [
    "ui",
    "planetarium",
    "rendu"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Le planétarium sait tracer les frontières IAU, les figures, les astérismes,
le cadre matériel et l'horizon (`CouchesActives`, `src/ui/dessine-ciel.ts`).
Rien n'y montre où passe la Voie lactée : sur une carte de repérage, c'est
pourtant le premier point de repère pour situer les régions riches (Cygne,
Sagittaire) et pour comprendre pourquoi le fond de ciel du grand champ
s'éclaircit à cet endroit.

La conversion existe déjà et n'est pas à réécrire : `depuisGalactique(l, b)`
(`src/core/galactique.ts`) rend la direction J2000 d'une position galactique.
Une polyligne `b = 0`, échantillonnée en longitude, se trace exactement comme
l'horizon le fait déjà par `traceLignes` — voir `traceHorizon`.

Portée : **une seule ligne**, le plan galactique `b = 0`. Les contours de
bande (`b = ±10°`) et un dégradé de densité ne sont pas demandés.

Couleur : rose, teinte propre dans `palette()` (`src/ui/couleurs.ts`) — donc
deux valeurs, la rose du mode normal et sa contrepartie mode nuit, qui doit
rester strictement rouge (§11.1 : canaux vert et bleu nuls).

## Critères d'acceptation

- [ ] Une couche « Voie lactée » figure dans `CouchesActives` et dans la liste
      `COUCHES` du panneau Explorer, avec sa case à cocher.
- [ ] Couche active : une ligne rose continue traverse le ciel là où passe le
      plan galactique — elle croise le Cygne et le Sagittaire, pas le pôle
      céleste.
- [ ] La ligne suit la rotation du ciel et le zoom comme les autres couches,
      sans décalage à fort champ.
- [ ] En mode nuit, la ligne est rouge pure (vert et bleu à zéro), comme les
      autres couches.
- [ ] Couche décochée : plus rien n'est tracé, et le coût de l'image revient à
      son niveau d'avant.
