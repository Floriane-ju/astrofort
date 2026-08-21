---
{
  "id": "T-0094",
  "titre": "Le ciel sous l'horizon se masque, relief compris",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "ui",
    "rendu",
    "charge:m"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-masquer-le-ciel-sous-l-horizon-couche-sol.md"
}
---

## Contexte

Le planétarium trace la sphère entière : étoiles, figures, frontières, bande de la Voie lactée
et corps mobiles sont dessinés sous l'horizon, où rien n'est observable depuis le site. Le seul
repère du sol est le cercle d'horizon — une ligne, pas un masque. La scène ne ressemble donc pas
à ce qu'on voit dehors, et un clic dans la moitié basse sélectionne un objet invisible d'ici.

Le site porte déjà un masque de relief relevé à la main (`MasqueHorizon`, §4.1) : le sol le suit
quand il existe, et l'horizon plat à 0° reste le repli, annoncé `[HYP]`.

## Critères d'acceptation

- [ ] Une couche « Sol » figure au panneau Couches de l'onglet Explorer et se coche.
- [ ] Elle est active à l'ouverture : rien n'est tracé sous l'horizon du site.
- [ ] Le cercle d'horizon et les points cardinaux restent visibles, masque actif.
- [ ] Un clic dans la zone masquée ne sélectionne rien.
- [ ] Avec un relief relevé au panneau Lieu, les tracés s'arrêtent sur la silhouette du relief,
      et cette silhouette est visible.
- [ ] Sans relevé, le panneau annonce l'hypothèse d'horizon plat.
- [ ] Aucun artefact en visant le zénith puis le nadir ; le plafond de 30 im/s tient.
- [ ] `pnpm typecheck && pnpm test` passent, tests du filtre de sol compris.
