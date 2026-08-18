---
{
  "id": "T-0044",
  "titre": "Les cibles visibles, calculées pour ce setup",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0043",
  "tags": [
    "core",
    "cible"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-choisir-sa-cible-parmi-ce-que-le-ciel-offre.md"
}
---

## Contexte

Aucune fonction ne répond aujourd'hui à « quels objets du catalogue sont au-dessus
de l'horizon à cet instant, et que ce setup peut atteindre ». Les deux moitiés
existent séparément : la conversion J2000 → horizon est faite à l'envers dans
`src/ui/dessine-ciel.ts:355` pour peindre les corps, et le verdict de portée est
rendu par `detectabilite` (`src/core/detectability.ts:171`). Il manque le module
qui les met bout à bout sur le catalogue entier.

Un nouveau module `src/core/visibles.ts`, pur et sans React, expose
`ciblesVisibles({ catalogue, matriceCiel, sbCiel, mLimOeil, dMm })` et rend une
liste de `{ objet, azimutDeg, hauteurDeg, verdict }` :

1. `versSpherique(applique(matriceCiel, versVecteur(o.adDeg, o.decDeg)))` donne
   l'azimut (`longitudeDeg`) et la hauteur (`latitudeDeg`) — aucun moteur nouveau,
   c'est la conversion de `dessine-ciel.ts:355` prise dans l'autre sens.
2. Écarté si `hauteurDeg <= 0`.
3. Écarté si `detectabilite(…).verdict === null`, c'est-à-dire quand le catalogue
   ne porte ni magnitude ni dimensions et qu'aucun verdict n'est calculable
   (`detectability.ts:176-192`). C'est le seul motif d'exclusion en dehors de
   l'horizon : `PHOTO_SEULE` est un verdict, pas un refus.
4. Trié par magnitude croissante.

## Critères d'acceptation

- [x] Un objet sous l'horizon à l'instant donné n'est pas dans la liste.
- [x] Un objet sans magnitude, ou sans dimensions, n'est pas dans la liste.
- [x] Un objet dont le verdict est `PHOTO_SEULE` **est** dans la liste.
- [x] Un objet trop grand ou trop petit pour le capteur déclaré est dans la liste :
      le cadrage n'entre pas dans le filtre.
- [x] La liste est triée du plus brillant au plus faible.
- [x] `tests/visibles.test.ts` couvre ces cinq points sur un catalogue forgé de
      quelques objets.
- [x] Aucun fichier existant de `src/core/`, `src/data/` ni `src/registry/` n'est
      modifié.
