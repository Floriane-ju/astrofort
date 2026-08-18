---
{
  "id": "T-0046",
  "titre": "Un bouton « Voir » amène la cible au centre",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0043",
  "tags": [
    "ui",
    "cible",
    "planetarium"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-choisir-sa-cible-parmi-ce-que-le-ciel-offre.md"
}
---

## Contexte

Choisir une cible garnit la fiche mais ne montre rien : la trouver sur le
planétarium reste un glissement à la main, à chercher un objet dont on connaît le
nom mais pas la position. La liste de T-0045 porte déjà l'azimut et la hauteur de
chaque entrée — le geste tient en un appel.

Un bouton « Voir » à côté du `<select>` retrouve la `CibleVisible` choisie et
appelle `majVue({ azimutDeg, hauteurDeg })` (`src/ui/scene-etat.ts:202`). C'est le
patron du bouton « Appliquer » de la rotation suggérée
(`src/ui/MenuInfos.tsx:166-174`) : un bouton de panneau qui recadre la scène par le
magasin partagé.

Ni le champ, ni la rotation, ni l'horloge ne sont touchés — l'utilisateur garde son
zoom et son instant.

## Critères d'acceptation

- [ ] Un bouton « Voir » est présent tant qu'une cible visible est choisie, absent
      sinon.
- [ ] Après le clic, `azimutDeg` et `hauteurDeg` de la scène sont ceux de l'objet à
      l'instant affiché, à moins d'un degré.
- [ ] `fovDeg` et `rotationDeg` sont inchangés après le clic.
- [ ] Un test (`tests/cible.test.tsx` ou `tests/scene-etat.test.ts`) le constate sur
      le magasin de scène.
