---
{
  "id": "T-0001",
  "type": "epic",
  "titre": "Lot 0 — Socle technique",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "xl",
  "tags": ["lot-0", "socle"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

Le dépôt ne contient que `prd.md`. Le Lot 0 du PRD (§14) ne dépend de rien et bloque
tous les autres lots : registre de constantes, table Bortle, point zéro système,
coquille web progressive, encodage des données, persistance, éphémérides en JS.

Il porte aussi les trois contraintes d'architecture non négociables du PRD : aucune
constante hors registre (§2.1), tout nombre dépliable jusqu'à sa formule (§1.5), le
thread principal ne fait que du rendu (§12.1).

## Critères d'acceptation

- [ ] L'application démarre hors réseau après une première visite
- [ ] Elle calcule un crépuscule juste à 2 minutes près pour le site de référence (Annexe A)
- [ ] Elle expose son registre de constantes avec source et tolérance par entrée
- [ ] Aucune constante numérique non triviale n'existe hors du registre dans `src/core/`
- [ ] Les données produites par l'utilisateur sont exportables et réimportables en JSON
