---
{
  "id": "T-0010",
  "titre": "Lot 2 — Cœur métier ciel profond : verdicts et moteur Pose",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "xl",
  "tags": [
    "lot-2"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-15",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§6.1 verdict de domaine · §6.2 cadrage par cible · §6.3 détectabilité · §7.1 à §7.4 flux,
pose unitaire, nombre de poses, calibration · §10.2 explication de verdict. Dépend des
Lots 0 et 1.

C'est le lot qui porte la valeur de l'application, et le PRD demande explicitement de le
livrer **avant** le planétarium.

## Critères d'acceptation

- [x] Pour une cible et un setup, l'app produit un verdict dépliable jusqu'à sa formule
- [x] La pose est affichée avec sa plage utile [t/2 ; t×2], présentée comme équivalente
- [x] M33 à SB_ciel 20,95 donne SB = 23,02, ΔSB = −2,07, verdict PHOTO_SEULE assorti
      d'une durée d'intégration — jamais un refus
- [x] Une cible de 44 px de diamètre voit son verdict « faisable » refusé, avec la focale
      nécessaire indiquée et aucune proposition de recadrage logiciel
- [x] Aucune cible n'est écartée sans que la cause soit nommée
- [x] Aucun écran de calibration n'existe nulle part

## Écart relevé à l'implémentation

Le PRD annonce SB = 23,02 pour M33 : c'est 23,0164, obtenu avec le facteur arrondi 8,63.
Le moteur calcule π/4 × 3600 au lieu de le recopier et donne 23,0148, soit 23,01 à
l'affichage. L'écart est de 0,002 mag, très en deçà du ±0,2 mag que le PRD revendique.

Même nature pour la focale nécessaire de M84 : la formule écrite au §6.1 vise 42 % de
remplissage mais l'exemple annonce 4 200 mm, qui correspond au tiers du champ. La valeur
retenue vise 42 % (5 309 mm) et la plage affichée couvre toute la fenêtre C-05,
4 213 à 6 320 mm — sa borne basse est le 4 200 mm du PRD.
