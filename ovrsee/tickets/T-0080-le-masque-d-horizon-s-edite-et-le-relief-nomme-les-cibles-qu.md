---
{
  "id": "T-0080",
  "titre": "Le masque d'horizon s'édite, et le relief nomme les cibles qu'il bloque",
  "colonne": "pret",
  "priorite": "haute",
  "epic": "T-0079",
  "tags": [
    "prd",
    "lieu",
    "planification"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": null
}
---

## Contexte

§4.1 et §8.1 spécifient un masque d'horizon par site : un tableau azimut → altitude
d'obstruction, éditable par-dessus une source de relief. Le code n'a que `masquePlat()`
(`src/core/site.ts:63`) : 360 zéros marqués `[HYP]`. Le constructeur de masque réel et sa
validation existent juste à côté (`src/core/site.ts:85`) — **sans aucun appelant**.

Conséquence : `obstructionDeg()` rend toujours 0, la cause d'exclusion `RELIEF` de §8.2 est
inatteignable, et le créneau de chaque cible est calculé contre un horizon dégagé que
personne n'a. Le journal des décisions de périmètre l'annonçait (Annexe C, décision 6) :
« masque d'horizon promu au MVP : sans lui, les recommandations sont fausses la moitié du
temps sur ce type de site ». Le site de référence est au pied des Alpes.

Le modèle numérique de terrain n'est pas le sujet de ce ticket : il demande le réseau et un
cache par site. La saisie manuelle, elle, est hors ligne, suffit à rendre les créneaux
justes, et c'est le chemin que §4.1 décrit comme « édition manuelle par-dessus ».

## Critères d'acceptation

- [ ] Le panneau Séance permet de saisir des couples azimut → altitude d'obstruction, et de
      les effacer.
- [ ] Le masque saisi est interpolé sur les 360 azimuts, et refuse une altitude hors du
      domaine `masque_horizon_deg` du registre en nommant le champ.
- [ ] Une cible dont la culmination passe sous l'obstruction de son azimut est écartée avec
      la cause `RELIEF`, et l'explication nomme l'azimut et l'altitude d'obstruction (§10.2).
- [ ] Un site sans masque saisi conserve le masque plat marqué `[HYP]`, affiché comme tel.
- [ ] Le masque saisi part dans l'export de §12.3 et revient à l'import.
- [ ] Un test couvre le cas de §8.1 : relief à 22° dans l'azimut 165, cible culminant à 19°
      → non observable, cause `RELIEF`, pas `HAUTEUR`.
