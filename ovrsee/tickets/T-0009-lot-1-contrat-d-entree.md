---
{
  "id": "T-0009",
  "titre": "Lot 1 — Contrat d'entrée : profils Lieu, Optique et Suivi",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "lot-1"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-15",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§4 profil Lieu avec masque d'horizon · §5.1 profil optique et capteur · §5.2 profil suivi
· §10.1 glossaire contextuel. Dépend du Lot 0 (T-0001).

Deux pièges du PRD à ne pas rater : la formule de champ est l'arctangente partout, sans
condition de bascule (l'approximation linéaire donne 205,7° à 10 mm, valeur impossible) ;
et le recadrage APS-C ne grossit rien, il change le champ et jamais l'échantillonnage.

## Critères d'acceptation

- [x] Un lieu et un matériel saisis produisent champ, échantillonnage, pose max NPF et
      seuils de déclinaison du site
- [x] Le profil de référence 120 mm f/2,8 plein format donne 17,0° × 11,4°, 8,80 "/px,
      D = 42,9 mm, Dawes 2,70", diagnostic « grand champ assumé » sans alerte bloquante
- [x] Le basculement en APS-C affiche explicitement que l'échantillonnage est inchangé
- [x] Un site sans donnée de relief reçoit un masque plat marqué [HYP], affiché comme tel
- [x] Chaque terme technique est glosé au contact
