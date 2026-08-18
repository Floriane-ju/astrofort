---
{
  "id": "T-0039",
  "titre": "Menu d’information déroulant en haut à droite",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "m",
  "epic": "T-0038",
  "tags": [
    "ui",
    "coque"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Les lectures qui datent l'image vivent sous le canevas, dans
`.scene-lectures` (`src/ui/Planetarium.tsx:728-802`). Il faut un endroit où les
poser qui ne prenne pas de hauteur tant qu'on ne l'ouvre pas.

La barre haute a déjà ce geste : le tiroir « ☾ nuit » est un `<details>` ouvert
en superposition (`src/App.tsx:412`, `.tiroir` dans `styles.css`). Le menu
d'information est le même objet, poussé à droite de la barre — rien de neuf à
inventer, et pas de JavaScript de fermeture au clic extérieur si le `<details>`
natif suffit.

Ce qui doit s'y retrouver, dans cet ordre :

1. la ligne d'état — date, visée AD/δ, azimut, hauteur, champ, magnitude
   limite, époque, mentions du filé incrusté ;
2. les causes et avertissements — `ciel.cause`, avertissement d'époque, refus
   d'incrustation sans cadre, absence de profil, trop de profils ;
3. les lectures du cadre — échantillonnage identique, cible dominante, et la
   suggestion de rotation **avec son bouton « Appliquer »**, qui reste
   actionnable depuis le menu ;
4. la sélection courante — titre et lignes de l'objet cliqué ;
5. le diagnostic de rendu — images/s et compteurs d'étoiles, de cellules et de
   labels.

Le contenu se déplace tel quel : ce ticket ne réécrit aucune lecture, il change
seulement où elles sont posées.

## Critères d'acceptation

- [x] Un bouton d'ouverture est visible en haut à droite de la barre haute,
      aligné à droite quelle que soit la largeur des autres éléments de barre.
- [x] Fermé, le menu ne prend aucune hauteur dans la mise en page.
- [x] Ouvert, il se superpose à la scène — il ne pousse ni la barre, ni le
      canevas, ni les panneaux.
- [x] Les cinq groupes de lectures ci-dessus y figurent, avec les mêmes textes
      qu'aujourd'hui et le bouton « Appliquer N° » toujours fonctionnel.
- [x] Le menu se referme au clic sur son bouton, et à la touche Échap.
- [x] Ouvert, il reste lisible en mode nuit (aucune couleur hors palette
      rouge).
- [x] Sous le repli 1100 px, le menu reste utilisable et son contenu défile
      s'il dépasse la hauteur disponible.
