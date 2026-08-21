---
{
  "id": "T-0078",
  "titre": "Le point d'explication de la fiche cible porte son type",
  "colonne": "en-cours",
  "priorite": "basse",
  "charge": "s",
  "tags": [
    "audit",
    "qualite"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **D1** de l'audit du 19 août 2026.

`src/ui/fiche-cible-calcul.ts:202-208` construit le point d'explication §10.2 avec exactement cinq
clés connues : `sb_obj`, `sb_ciel`, `t_pose_s`, `read_noise_e`, `snr_cible`. Dix lignes plus bas,
la fonction `sortie` reçoit ce même point retypé en `Readonly<Record<string, number>>` — un type
qui a oublié les cinq clés. Il faut donc six `!` (`fiche-cible-calcul.ts:212-219`) pour ressortir
ce qu'on vient d'y mettre.

Le calcul est juste, et le restera : les clés sont écrites juste au-dessus. Ce qui est en jeu est
plus modeste et plus durable — le type efface un contrat connu, et l'assertion le remet à la main.
`noUncheckedIndexedAccess` avait fait son travail en signalant l'indexation ; on l'a fait taire au
lieu de nommer la forme.

Six des vingt `!` de tout `src/` sont ici. C'est le seul endroit où ils viennent d'un type trop
large plutôt que d'un invariant local.

## Critères d'acceptation

- [x] Une interface nommée décrit le point d'explication, avec ses cinq champs et leurs unités en
      commentaire
- [x] Les six `!` de `src/ui/fiche-cible-calcul.ts:212-219` disparaissent, et ne sont pas remplacés
      par un `as`
- [x] Le moteur d'explication §10.2 reçoit toujours de quoi perturber un champ à la fois : la
      capacité qui justifiait le `Record` est conservée, ou son remplacement est écrit
- [x] `pnpm typecheck` et `pnpm test` restent verts, `tests/explication.test.ts` compris
- [x] La sortie affichée de l'explication est inchangée
