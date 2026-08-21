---
{
  "id": "T-0077",
  "titre": "Une intégration continue garde typecheck, tests et audit",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "outillage",
    "securite"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "epic": "T-0074",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **C2** de l'audit du 19 août 2026.

Aucun `.github/workflows` dans le dépôt. `pnpm typecheck`, `pnpm test` (472 tests, 40 fichiers) et
`pnpm audit` ne s'exécutent que quand quelqu'un y pense — ce qui a bien tenu jusqu'ici, et ne
prouve rien sur la suite.

C'est aussi la pièce qui manque à deux tickets déjà ouverts : T-0060 ajoute un linter, T-0061 une
mesure de couverture. Sans exécution automatique, ils ajoutent deux commandes que personne ne
lance et deux garanties que personne ne constate.

Rien à négocier côté secrets : l'application n'a pas de backend, donc le workflow n'a besoin
d'aucun identifiant.

## Critères d'acceptation

- [ ] Un workflow s'exécute à chaque poussée et sur chaque demande de fusion
- [ ] Il installe avec `pnpm install --frozen-lockfile`, puis passe `pnpm typecheck`, `pnpm test`,
      `pnpm build` et `pnpm audit`
- [ ] Un échec de l'une de ces étapes bloque : le rouge est un arrêt, pas un avertissement
- [ ] La version de pnpm utilisée est celle de `packageManager` dans `package.json`, pas une autre
- [ ] Les étapes `pnpm lint` (T-0060) et couverture (T-0061) sont prévues dans le fichier, en
      commentaire ou désactivées, avec le ticket qui les activera
- [ ] Le workflow ne requiert aucun secret
