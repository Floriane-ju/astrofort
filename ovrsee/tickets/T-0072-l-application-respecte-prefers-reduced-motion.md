---
{
  "id": "T-0072",
  "titre": "L'application respecte prefers-reduced-motion",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "audit",
    "accessibilite",
    "mode-nuit"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "epic": "T-0067",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **A5** de l'audit du 19 août 2026.

Aucune occurrence de `prefers-reduced-motion` dans `src/` ni dans `tests/`. Deux mouvements
s'imposent donc à qui a demandé au système de ne plus en voir : la transition de 600 ms de
`src/ui/styles.css:38-41` au basculement du mode nuit, et le défilement animé du curseur
temporel §3.2.

Il y a une vraie tension à trancher, pas seulement une règle à ajouter. §11.1 dit : « Passage en
mode nuit : transition progressive, jamais un basculement brutal », et « aucun flash de
transition ». Supprimer la transition, c'est le basculement brutal que §11.1 interdit. Le
compromis — durée réduite plutôt que supprimée, ou un fondu de luminance sans déplacement — se
choisit et s'écrit ; il ne se devine pas à la lecture du code.

Pour le curseur temporel, §11.2 tranche déjà dans le même sens : « Aucune animation non
sollicitée en mode nuit. » La préférence système étend cette règle hors du mode nuit.

## Critères d'acceptation

- [x] Sous `prefers-reduced-motion: reduce`, la transition de bascule du mode nuit est réduite
      **sans produire de flash** — le compromis retenu entre §11.1 et WCAG 2.3.3 est écrit à côté
      de la règle
- [x] Sous cette même préférence, le défilement du curseur temporel ne démarre pas de lui-même ;
      il reste déclenchable à la demande
- [x] Aucune autre animation de l'interface ne s'impose sous cette préférence
- [x] Un test vérifie la présence de la règle dans la feuille de style, du même geste que
      `tests/mode-nuit.test.tsx`

## Réalisation

- `src/ui/styles.css` — `@media (prefers-reduced-motion: reduce)` posé juste sous la règle
  qu'il amende. Arbitrage écrit à côté : la transition ne déplace rien, c'est un fondu de
  luminance ; on coupe sa durée (600 ms → 120 ms), pas son existence, sinon le basculement
  brutal que §11.1 interdit revient. Le cas qui justifie la règle est l'auto-activation au
  crépuscule, seul moment où la bascule n'est pas demandée quand elle survient.
- `src/ui/Planetarium.tsx` — le défilement n'a rien demandé de plus : `MAINTENANT` est l'état
  de départ (§3.2), aucun chemin ne bascule en `DEFILEMENT` sans le choix explicite du
  sélecteur, et l'incrustation §9.3 fige au contraire le temps. Le couper d'office sous la
  préférence aurait retiré un mode demandé — la décision est écrite à côté du calcul de `anime`.
- Aucune autre animation à traiter : la feuille ne déclare ni `@keyframes`, ni `animation`,
  ni `scroll-behavior: smooth`, et sa seule `transition` est celle de la bascule.
- `tests/mode-nuit.test.tsx` — trois tests : durée réduite mais non nulle sous la préférence,
  absence de toute autre animation dans la feuille, et mode de temps initial ≠ défilement.

`pnpm typecheck` : sans erreur. `pnpm test` : 492 tests, 41 fichiers, tout au vert.
