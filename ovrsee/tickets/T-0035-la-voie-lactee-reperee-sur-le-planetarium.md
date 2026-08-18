---
{
  "id": "T-0035",
  "titre": "La Voie lactée repérée sur le planétarium",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
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

Le planétarium ne montre nulle part où passe la Voie lactée, alors que c'est
le premier repère pour situer les régions riches (Cygne, Sagittaire) et pour
comprendre où le fond de ciel du grand champ s'éclaircit.

Cet epic regroupe les deux moitiés du même geste : le tracé rose du plan
galactique, et le nom posé dessus — une ligne sans label ne se distingue pas
d'un méridien.

La conversion de coordonnées existe déjà (`depuisGalactique`,
`src/core/galactique.ts`) : rien à calculer de neuf, seulement à tracer.

## Critères d'acceptation

- [ ] Une couche « Voie lactée » se coche et se décoche au panneau Explorer.
- [ ] Couche active : une ligne rose nommée « Voie lactée » traverse le ciel
      au bon endroit, suit rotation et zoom, et passe au rouge pur en mode
      nuit.
- [ ] Couche décochée : ni ligne ni label, et le coût de l'image revient à son
      niveau d'avant.
