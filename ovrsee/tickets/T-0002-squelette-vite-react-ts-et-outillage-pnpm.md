---
{
  "id": "T-0002",
  "titre": "Squelette Vite + React + TS et outillage pnpm",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": ["lot-0", "outillage"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

Aucun code applicatif n'existe. `ovrsee.config.json` annonce déjà `pnpm dev` sur le
port 5173 : le socle est Vite. Les dépendances arrêtées avec l'utilisateur sont
`astronomy-engine`, `vite-plugin-pwa`, `idb` et `vitest`.

## Critères d'acceptation

- [ ] `pnpm dev` sert l'application sur le port 5173
- [ ] `pnpm test` exécute vitest, `pnpm build` produit un bundle
- [ ] `pnpm-lock.yaml` est committé et aucun `package-lock.json` n'existe
- [ ] `.gitignore` couvre `node_modules`, `dist` et les binaires générés
