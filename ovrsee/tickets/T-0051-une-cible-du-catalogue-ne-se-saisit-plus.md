---
{
  "id": "T-0051",
  "titre": "Une cible du catalogue ne se saisit plus",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0048",
  "tags": [
    "ui",
    "cible"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

`appliqueObjet` (`src/ui/FicheCible.tsx:169-176`) recopie l'objet du catalogue dans
six `useState` de chaînes, et les six champs restent des `<input>` libres
(`FicheCible.tsx:334-360`). Rien n'empêche donc de choisir NGC0224 puis d'en
changer la magnitude : la fiche affiche alors une désignation réelle et un verdict
qui ne décrit plus aucun objet du ciel. Le catalogue OpenNGC est une donnée
mesurée, pas une valeur par défaut à retoucher.

Trois chemins garnissent la fiche, et les trois viennent du catalogue : la liste
des visibles (`choisitParmiLesVisibles`), le clic sur la scène
(`objetSelectionne`, câblé par `ouvreCible`, `src/ui/seance-etat.ts:107`), et le
`<select>` du tiroir de réglages (T-0047). Tous les trois verrouillent.

**Le verrou est un état, pas une déduction.** `choisie`
(`FicheCible.tsx:210`) est aujourd'hui retrouvé en cherchant la désignation dans
`visibles` : s'en servir comme verrou rouvrirait la saisie dès qu'un objet sort de
la liste — un objet cliqué depuis le tiroir alors qu'il est sous l'horizon, ou une
cible que la minute suivante fait passer sous l'horizon. Il faut un
`ObjetCielProfond | null` retenu tel quel, `null` valant « personnalisé ». Le
bouton « Voir » de T-0046, lui, garde sa logique actuelle : il ne peut centrer que
ce qui est au-dessus de l'horizon.

`CIBLE_REFERENCE` (`FicheCible.tsx:62-69`) n'est pas un objet du catalogue — c'est
la chaîne de référence §6.3, saisie à la main. L'application s'ouvre donc en
personnalisé, champs saisissables, comme aujourd'hui.

Passer à « Personnalisé » **conserve les valeurs affichées** et les rend
modifiables : partir des chiffres d'un objet réel pour les ajuster est le geste
attendu, et une remise à zéro serait une perte de travail.

## Critères d'acceptation

- [x] Après un choix dans la liste des visibles, les six champs de la fiche
      (désignation, type, magnitude, grand axe, petit axe, angle de position) sont
      en lecture seule et se voient comme tels.
- [x] Il en va de même après un clic sur un objet de la scène, et après un choix
      dans le `<select>` du tiroir de réglages.
- [x] La liste des visibles porte une entrée « Personnalisé » ; la choisir rouvre
      les six champs.
- [x] Passer en personnalisé garde les valeurs affichées comme point de départ.
- [x] À l'ouverture de l'application, la fiche est en personnalisé et se saisit.
- [x] Une cible du catalogue qui passe sous l'horizon reste verrouillée.
- [~] `tests/cible.test.tsx` constate le verrouillage après un choix, et la
      réouverture après « Personnalisé ».

> Réserve de revue : l'environnement de test est `node` (`vite.config.ts`), sans DOM —
> aucun clic n'est simulable. Le filtrage et le déverrouillage sont donc constatés sur
> leurs fonctions pures (`typesPresents`, `parType`, `tests/visibles.test.ts`) et sur le
> rendu statique des deux états, pas sur le geste lui-même. Ajouter `jsdom` +
> `@testing-library/react` fermerait l'écart.
