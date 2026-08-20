---
{
  "id": "T-0092",
  "titre": "L'atlas de pollution lumineuse quitte le code avec la feature",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "prd",
    "code-mort",
    "lieu"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

Le PRD 1.2 supprime l'atlas de pollution lumineuse aux coordonnées de §4.1 (Annexe C,
décision 18) : il exige le réseau et un cache par site pour remplacer une saisie exacte et
hors ligne. Restent dans le code trois traces d'une feature qui n'existe plus :

- `SourceSb` porte la valeur `'VIIRS'` et `EntreeFondDeCiel` le champ `bortleViirs`, branche
  jamais empruntée (`src/core/sky-background.ts`) ;
- le message de `FondDeCielIndeterminableError` invite à renseigner « un Bortle estimé par
  VIIRS », c'est-à-dire une saisie qui n'existe pas ;
- la matrice de dégradation hors-ligne AFFICHE la ligne « Bortle par atlas VIIRS — complet
  si en cache » (`src/data/degradation.ts:66`). C'est du texte visible par l'utilisateur, et
  il est faux : §12.5 est un contrat, il ne peut pas promettre une fonction absente.

Le troisième point est le seul visible ; c'est aussi celui qui compte. Les deux premiers sont
du code mort au sens de T-0063.

## Critères d'acceptation

- [ ] `SourceSb` ne porte plus que `TABLE_BORTLE` et `SQM_MESURE`, comme le tableau
      Entrées / Sorties de §2.2 et §4.1.
- [ ] `bortleViirs` et sa branche de priorité disparaissent de `fondDeCiel`.
- [ ] Le message d'indéterminabilité ne cite que les deux sources réellement saisissables.
- [ ] La matrice de dégradation §12.5 ne porte plus la ligne de l'atlas.
- [ ] Le test « classe VIIRS avant le Bortle saisi à la main » est retiré, et la priorité
      SQM > Bortle déclaré reste couverte.
- [ ] `pnpm typecheck && pnpm test` verts.
