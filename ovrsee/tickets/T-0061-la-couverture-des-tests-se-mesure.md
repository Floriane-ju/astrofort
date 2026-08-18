---
{
  "id": "T-0061",
  "titre": "La couverture des tests se mesure",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["audit", "qualite", "tests"],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **P4** de l'audit T-0054.

472 tests répartis sur 40 fichiers passent — c'est solide. Mais `vitest` tourne
sans `@vitest/coverage-v8`, il n'y a ni script `test:coverage` ni bloc
`test.coverage` dans `vite.config.ts`. Le seuil de 80 % que le projet s'est donné
n'est donc ni mesuré, ni prouvé, ni gardé : on ne sait pas s'il est tenu.

Ce qui se mesure sans outil, en revanche, dit qu'il ne l'est probablement pas.
Huit modules ne sont importés par aucun test :

- `src/main.tsx` — point d'entrée, discutable à couvrir
- `src/ui/Coque.tsx`, `src/ui/PanneauSeance.tsx` — structure de mise en page
- `src/ui/Terme.tsx`, `src/ui/TracedValue.tsx` — le contrat §10.1/§10.2 : chaque
  nombre dépliable jusqu'à sa formule, chaque terme portant sa définition
- `src/ui/Verification.tsx` — le panneau qui annonce l'état du socle, celui-là
  même que T-0055 corrige
- `src/ui/PlanSession.tsx` — la seule région qui survit à l'impression (§11.2)
- `src/registry/filters.ts` — table du registre

Les trois derniers groupes portent des promesses du PRD. Mesurer d'abord, viser
ensuite : le chiffre décide où aller, pas l'impression.

## Critères d'acceptation

- [ ] `pnpm test:coverage` existe et produit un rapport lisible
- [ ] Le chiffre de départ, global et par dossier (`core/`, `data/`, `registry/`,
      `ui/`), est relevé et écrit
- [ ] Un seuil est configuré et fait échouer la commande en dessous ; s'il n'est
      pas 80 % au départ, la marche à franchir est écrite avec sa date
- [ ] `src/ui/Terme.tsx`, `src/ui/TracedValue.tsx` et `src/ui/Verification.tsx`
      sont couverts : ils portent un contrat du PRD, pas de la mise en page
- [ ] Les fichiers volontairement exclus de la mesure le sont explicitement,
      avec leur raison
