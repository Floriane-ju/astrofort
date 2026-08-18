---
{
  "id": "T-0063",
  "titre": "Les symboles morts quittent le code",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "s",
  "tags": [
    "audit",
    "code-mort",
    "menage"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **M1** de l'audit T-0054, moitié ménage. `pnpm dlx knip` n'a trouvé ni
fichier orphelin ni dépendance inutilisée ; sur les 45 exports signalés, sept
sont réellement morts — déclarés, appelés nulle part, ni dans `src/`, ni dans
`scripts/`, ni dans `tests/`.

| Symbole | Emplacement | Pourquoi il est mort |
|---|---|---|
| `angleRotationCiel` | `src/core/ephem.ts:91` | doublon — `src/core/horloges.ts:130` produit la même formule `ANGLE_ROTATION_CIEL`, et c'est celle-là qui sert |
| `traceInterpolation` | `src/core/horloges.ts:273` | trace §10.2 jamais branchée |
| `traceRayonEtoile` | `src/core/projection.ts:283` | trace §10.2 jamais branchée |
| `perteSnr` | `src/data/equipment.ts:154` | écrit pour montrer que l'optimum de pose est plat (§2.3), jamais affiché |
| `plageUtilePose` | `src/data/equipment.ts:159` | même origine §2.3, même sort |
| `chercheBoitier` | `src/data/equipment.ts:190` | `BASE_BOITIERS` ne contient qu'un boîtier ; la recherche n'a pas d'appelant |
| ré-export `BORTLE_MIN`, `BORTLE_MAX`, `BortleHorsTableError` | `src/core/sky-background.ts:124` | les consommateurs importent depuis `src/registry/bortle.ts` |

Deux d'entre eux méritent une décision plutôt qu'une suppression sèche. Les
trois `trace*` sont l'amorce d'une explication §10.2 qui n'a jamais été branchée ;
`perteSnr` et `plageUtilePose` portent un argument pédagogique de §2.3 — « la
pose optimale est plate, donc aucune calibration n'est nécessaire ». Supprimer
efface l'intention ; la garder morte la laisse pourrir. Trancher, et écrire ce
qui a été tranché.

`angleRotationCiel` est le cas net : deux implémentations de la même formule,
une seule utilisée.

Les 37 autres exports signalés par knip sont vivants dans leur propre fichier —
surface d'API sans consommateur, pas du code mort. L'audit a décidé de les
laisser (constat M2) : ils ne sont pas dans le périmètre de ce ticket.

## Critères d'acceptation

- [x] `angleRotationCiel` et le ré-export de `sky-background.ts:124` ont disparu
- [x] Pour chacun des cinq autres, la décision est prise et visible : soit le
      symbole est branché à l'endroit prévu, soit il est supprimé — aucun ne
      reste mort
- [x] Ce qui est supprimé et portait une intention du PRD laisse une trace : une
      ligne dans le fichier ou un ticket, pas un vide silencieux
- [x] `pnpm dlx knip` ne signale plus aucun de ces sept symboles
- [x] `pnpm test` et `pnpm build` restent verts

## Décisions

- `angleRotationCiel` (`ephem.ts`) — supprimé, doublon de `horloges.ts`.
- Ré-export de `sky-background.ts` — supprimé, ainsi que les imports qui ne servaient qu'à lui.
- `traceInterpolation`, `traceRayonEtoile` — supprimés, pas branchés : ni le facteur
  d'interpolation ni le rayon d'une étoile dessinée au canevas n'ont d'endroit où se déplier.
  Les formules `INTERPOLATION_CORPS` et `RAYON_ETOILE` restent au formulaire de l'Annexe B,
  et une ligne dans chaque fichier dit pourquoi et quand les rebrancher.
- `perteSnr`, `plageUtilePose` — supprimés. La plage utile existe déjà dans `exposure.ts`
  (`PLAGE_UTILE_POSE`) et s'affiche sur la fiche cible ; la perte de SNR garde sa formule
  `PERTE_SNR` au formulaire, et l'en-tête de `equipment.ts` porte l'argument §2.3.
- `chercheBoitier` — supprimé, `BASE_BOITIERS` n'a qu'une entrée.

`pnpm dlx knip` passe de 45 à 38 exports signalés ; aucun des sept n'y figure plus.
`pnpm test` (472 tests) et `pnpm build` verts.
