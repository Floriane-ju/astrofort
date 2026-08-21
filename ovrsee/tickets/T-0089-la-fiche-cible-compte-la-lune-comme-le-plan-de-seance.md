---
{
  "id": "T-0089",
  "titre": "La fiche cible compte la Lune comme le plan de séance",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "defaut",
    "lune",
    "pose"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

Deux écrans donnent deux dosages pour la même cible, la même nuit.

Le plan de séance fait le travail : `cielSousLaLune()`
(`src/core/session-candidates.ts:67`) évalue la Lune au milieu du créneau de la cible —
illumination, hauteur, séparation angulaire, masse d'air, par Krisciunas & Schaefer — et
propage `sbCielEffectif` jusqu'à `E_ciel`.

La fiche cible ne le fait pas : `fiche-cible-calcul.ts:107` appelle `detectabilite()` **sans**
l'argument `lune`, avec `contexte.sbCiel` — le fond de ciel noir du site
(`src/ui/app-calcul.ts:327`). Conséquences :

- pose unitaire, nombre de poses et intégration totale de la fiche sont calculés comme si la
  nuit était sans Lune ;
- les critères d'acceptation lunaires de §6.3 sont inatteignables depuis la fiche — dont
  « pleine Lune sous l'horizon : l'app le dit explicitement plutôt que de pénaliser la cible » ;
- le déclencheur du conseil filtre de §7.5, « SB_ciel dégradé par la Lune », ne peut plus
  tomber que par la voie `bortle ≥ 5`.

C'est le piège classique de la phase lunaire traitée sans la hauteur — sauf qu'ici le moteur
juste existe déjà, à un argument près.

## Critères d'acceptation

- [x] La fiche cible reçoit l'état de la Lune et emploie le même `deltaSbLune` que le plan.
- [x] Pour une cible et un instant donnés, la fiche et le plan annoncent la même pose
      unitaire et la même intégration totale.
- [x] Une Lune sous l'horizon ne dégrade rien, et la fiche le dit explicitement (§6.3).
- [x] Une nébuleuse en émission sous Lune gibbeuse reste faisable, avec le conseil dual-band
      de §7.5 déclenché par la dégradation lunaire et non par le seul Bortle.
- [x] La tolérance lunaire par type d'objet (§6.3) est appliquée : la même Lune ne pénalise
      pas une galaxie et une nébuleuse Hα de la même façon.
- [x] L'instant d'évaluation de la Lune est nommé à l'écran — la fiche n'a pas de créneau,
      donc le choix doit être explicite plutôt qu'implicite.
- [x] Un test compare les deux chemins sur la même entrée et échoue s'ils divergent.
