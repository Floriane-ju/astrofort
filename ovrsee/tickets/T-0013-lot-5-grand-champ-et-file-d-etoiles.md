---
{
  "id": "T-0013",
  "titre": "Lot 5 — Grand champ et filé d'étoiles",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "lot-5",
    "rendu"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-15",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§9.1 pose max par déclinaison · §9.2 prévisualisation de champ · §9.3 prévisualisation du
filé · §9.4 logistique de séquence. Dépend du Lot 4 : réutilise intégralement son moteur
de projection et son catalogue. Le développer avant imposerait de coder deux fois la
projection, ce que §3.3 interdit explicitement.

## Critères d'acceptation

- [x] La pose max NPF dépend de la déclinaison de la cible, pas d'une règle uniforme
- [x] La prévisualisation de filé trace des arcs sur les positions réelles du catalogue,
      pôle exact compris
- [x] La logistique de séquence chiffre nombre de poses, volume de stockage et batteries,
      facteur de froid appliqué

## Ce qui a été livré

- §9.1 `src/core/grand-champ.ts` — carte de pose maximale par cellule du cadre, zone
  limitante nommée, règle des 500 affichée en repère non retenu, bascule sur le plafond de
  monture quand le suivi est actif.
- §9.2 `src/core/galactique.ts` + `src/data/semis.ts` + `src/ui/dessine-champ.ts` — trois
  couches : catalogue réel sous magnitude 7,5, semis génératif à graine fixe modulé par la
  latitude galactique, masque procédural de la Voie lactée dont le contraste suit le fond de
  ciel. Profondeur atteinte dérivée du point zéro système : le PRD la laissait `[À CALCULER]`.
- §9.3 `src/core/file-etoiles.ts` — arcs projetés par le moteur de §3.3, autour du pôle DE
  L'ÉPOQUE, jamais recentré dans l'image ; longueur variable avec la déclinaison, troncature
  aux bords signalée, brillance calculée sur la pose vue par un pixel du capteur.
- §9.4 `src/core/sequence-file.ts` — poses, volume, batteries avec facteur de froid, refus
  chiffré de l'intervalle au-delà de C-09, interruption de séquence quand la carte est pleine.
- Vue `src/ui/GrandChamp.tsx`, un seul pointage pour les quatre features.

## Points à trancher plus tard

- Autonomie CIPA absente de la base matériel : aucun nombre de batteries n'est produit tant
  qu'elle n'est pas saisie. Le remplissage de la base reste `[À VÉRIFIER]`.
- Semis plafonné à 300 000 étoiles sur la sphère : la modulation de densité est fidèle, le
  comptage absolu ne l'est pas, et l'écran le déclare.
- Voie lactée : masque procédural du MVP. Les tuiles HiPS de §9.2 restent post-MVP.
