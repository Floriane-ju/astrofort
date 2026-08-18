---
{
  "id": "T-0034",
  "titre": "Poser le label « Voie lactée » sur la bande",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "s",
  "epic": "T-0035",
  "tags": [
    "ui",
    "planetarium",
    "labels"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Une ligne rose sans nom ne se lit pas : rien ne distingue le plan galactique
d'un méridien ou d'un cercle d'horizon. Le tracé de T-0033 a besoin d'un
label posé sur la bande, à l'endroit où elle est visible à l'écran.

Les labels ne se peignent pas au fil du tracé : ils passent par `composeLabels`
(`src/core/labels.ts`), qui filtre par catégorie selon le champ, trie par
priorité et refuse les chevauchements, avec un plafond de `LABELS_MAX`. Le
label de la Voie lactée doit entrer dans ce circuit, sinon il se superposera
aux noms de constellations.

Deux points à trancher à l'implémentation :

- **Catégorie.** Réutiliser `CONSTELLATION` (visible à tout champ) ou ajouter
  une catégorie dédiée avec son propre seuil de champ. Réutiliser est le geste
  le plus court ; une catégorie dédiée ne se justifie que si le label doit
  disparaître au zoom serré.
- **Ancrage.** Le label suit la ligne : à choisir le point de la polyligne
  visible le plus proche du centre du canevas, pour qu'il ne colle pas au bord.

## Critères d'acceptation

- [ ] Couche « Voie lactée » active (T-0033), le texte « Voie lactée » apparaît
      une fois, posé sur la ligne, dans la même teinte rose qu'elle.
- [ ] Le label est absent quand la couche est décochée, et absent quand la
      ligne ne traverse pas le champ affiché.
- [ ] Le label ne chevauche aucun autre label : il passe par `composeLabels`
      comme les autres et se voit écarté quand la place manque.
- [ ] Il suit la rotation et le zoom : il reste sur la ligne, jamais figé à un
      coin du canevas.
- [ ] En mode nuit, le texte est rouge pur comme les autres textes du canevas.
