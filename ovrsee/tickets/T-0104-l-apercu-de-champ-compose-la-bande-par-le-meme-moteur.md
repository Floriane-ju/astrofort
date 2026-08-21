---
{
  "id": "T-0104",
  "titre": "L'aperçu de champ compose la bande par le même moteur",
  "epic": "T-0101",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "planetarium",
    "rendu",
    "registre"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

Il y a **deux rendus de la Voie lactée** dans le projet, et le second est aujourd'hui le moins
mauvais : `dessineVoieLactee` (`src/ui/dessine-champ.ts:118-166`) floute déjà son escalier
(`FLOU_BANDE_PX` = 32), soustrait déjà un plancher à sa coupure, et sa teinte de jour
`rgb(150 160 190)` est bleutée plutôt que magenta. Mais c'est un second modèle, avec ses propres
constantes en dur et sa propre coupure à ±60° — le double de celle du planétarium.

Deux rendus du même objet avec deux paramétrages différents finissent par se contredire à
l'écran : l'aperçu incrusté se superpose au planétarium (§9.5), et deux bandes de teintes
différentes au même endroit se verraient comme un défaut de rendu.

Ce ticket ferme la boucle et **retire les quatre constantes de convention** — une fois le
dernier appelant parti, pas avant.

## Ce qui change

- `dessineVoieLactee` (118-166) passe au modèle additif de T-0102. Disparaissent :
  `BANDE_B_MAX_DEG` = 60 (49), le `plancher` soustrait (130), les deux couleurs en dur
  `rgb(150 160 190)` et `rgb(120 0 0)` (135-137), l'appel à `contrasteVoieLactee` (120).
- Les polygones remplis **restent** : l'aperçu couvre un champ étroit, une bande n'y sort pas du
  cadre par un côté pour y rentrer par un autre, donc le problème qui impose le trait au
  planétarium ne s'y pose pas. `FLOU_BANDE_PX` reste aussi — même rôle qu'avant.
- `src/core/galactique.ts` — `contrasteVoieLactee` (75-79) supprimée. `densiteRelative` **reste** :
  elle sert au comptage d'étoiles de `src/data/semis.ts`, qui est son usage juste — la densité
  stellaire n'est pas la brillance de la bande.
- `src/registry/constants.ts` — retrait de `SB_VOIE_LACTEE_PLEINE_MAG`,
  `SB_VOIE_LACTEE_EFFACEE_MAG`, `LATITUDE_BANDE_GALACTIQUE_MAX_DEG`,
  `OPACITE_BANDE_GALACTIQUE`.
- `tests/previsu-champ.test.tsx:231-232` teste `contrasteVoieLactee` directement : réécrit sur
  le nouveau critère.
- `src/registry/glossaire.ts:972-982` — l'entrée `voie_lactee` dit « bande modulée par le ciel »,
  toujours vrai, mais son `explication` décrit le masque procédural et son alpha. À reformuler
  sur le modèle additif : la glose doit dire pourquoi la bande s'efface, pas comment elle est
  peinte.

## Critères d'acceptation

- [x] Aucune couleur écrite en dur ne subsiste dans le chemin de la bande, dans aucun des deux
      rendus.
- [x] Les deux rendus appellent la **même** fonction de brillance : à latitude galactique et
      fond de ciel égaux, ils composent la même couleur et la même part.
- [x] Un `grep` de `contrasteVoieLactee`, `SB_VOIE_LACTEE_PLEINE_MAG`,
      `SB_VOIE_LACTEE_EFFACEE_MAG`, `LATITUDE_BANDE_GALACTIQUE_MAX_DEG` et
      `OPACITE_BANDE_GALACTIQUE` ne rend rien dans `src/` ni `tests/`.
- [x] L'aperçu incrusté posé sur le planétarium ne montre aucune discontinuité de la bande à sa
      frontière — c'est le test qui justifie l'unification.
- [x] La glose du glossaire décrit le modèle livré, pas l'ancien masque.
- [x] `pnpm typecheck && pnpm test` verts, sortie rapportée.

## Livré

- `src/ui/dessine-champ.ts` — `dessineVoieLactee` passe au modèle additif. Disparus :
  `BANDE_B_MAX_DEG` = 60, le plancher soustrait, les deux couleurs en dur `rgb(150 160 190)` et
  `rgb(120 0 0)`, l'appel à `contrasteVoieLactee`. Les polygones remplis restent — le champ est
  étroit, une bande n'en sort pas par un côté pour y rentrer par un autre. Le flou reste aussi :
  le pas de latitude y est grossier devant la taille de l'aperçu.
- `src/core/galactique.ts` — `contrasteVoieLactee` supprimée. `densiteRelative` **conservée** :
  elle sert au comptage d'étoiles de `src/data/semis.ts`, qui est son usage juste.
- `src/registry/constants.ts` — les quatre constantes de convention retirées :
  `SB_VOIE_LACTEE_PLEINE_MAG`, `SB_VOIE_LACTEE_EFFACEE_MAG`,
  `LATITUDE_BANDE_GALACTIQUE_MAX_DEG`, `OPACITE_BANDE_GALACTIQUE`.
- `scripts/bench-ciel.ts` — citait `SB_VOIE_LACTEE_PLEINE_MAG` pour « le cas le plus lourd ».
  Passe à `SB_PLANCHER_NATUREL`, et le commentaire dit la vérité : le ciel le plus noir donne
  le plus d'étoiles, mais le cas le plus lourd POUR LA BANDE est l'inverse.
- `tests/previsu-champ.test.tsx` — le test « efface la Voie lactée en ville » affirmait qu'aucune
  surface n'était peinte. C'est devenu faux et le test est réécrit sur ce qui est vrai : la part
  s'effondre sous 0,1 en ville et dépasse 0,5 en montagne. La bande est encore composée, elle ne
  déplace plus le fond.
- `src/registry/glossaire.ts` — la glose décrivait un « masque procédural » au contraste
  « piloté ». Elle dit maintenant pourquoi la bande s'efface — sa lumière devient négligeable
  devant celle du ciel — et déclare la limite en longitude (bulbe, Grande Faille) plutôt que de
  la taire.

**Vérification.** `pnpm typecheck && pnpm test` : **691 tests verts, 53 fichiers**. Un `grep` des
cinq symboles retirés ne rend rien dans `src/` ni `tests/`.
