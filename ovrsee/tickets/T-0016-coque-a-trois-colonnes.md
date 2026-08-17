---
{
  "id": "T-0016",
  "titre": "Coque à trois colonnes",
  "epic": "T-0014",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "lot-6",
    "ui"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md"
}
---

## Contexte

`src/ui/styles.css:54` pose un `main` à `max-width: 70rem` centré : une colonne de lecture,
donc un défilement infini. La coque la remplace par une grille de trois colonnes sur la
hauteur du viewport — barre du haut, matériel, scène, séance.

Le piège connu est `min-height: 0` sur les pistes de grille : sans lui, le canevas pousse la
grille au-delà du viewport et le défilement de page revient par la fenêtre.

## Critères d'acceptation

- [x] `src/ui/Coque.tsx` monte `topbar` + `aside` matériel + scène + `aside` séance en
      `grid-template-columns: 20rem minmax(0, 1fr) 24rem` sur `height: 100dvh`
- [x] Les deux panneaux défilent indépendamment, la scène jamais — canevas en
      `position: sticky` tant que le planétarium porte encore ses réglages (voir Réserve)
- [~] À 1440×900, aucune barre de défilement de page — la grille est bornée
      (`minmax(0, 1fr)` + `min-height: 0`), mais **non vérifié dans un navigateur**
- [x] Sous 1100 px : une colonne, panneaux en `<details>` repliables sous la scène, `summary`
      à `min-height: var(--cible-clic)`
- [x] Mode nuit : aucune couleur en dur dans la coque, tout passe par les variables — le test
      `mode-nuit.test.tsx` qui interdit `#`, `rgb(`, `hsl(` hors palette passe toujours
- [x] À l'impression : coque en flux, barre haute / scène / panneau matériel masqués, et du
      panneau droit ne survit que `.plan-session`

## Réalisation

`Coque.tsx` ne connaît aucun contenu : quatre régions en `ReactNode`. Les panneaux sont des
`<details open>` — au-dessus de 1100 px leur `summary` est masqué et ils restent dépliés ;
en dessous ils redeviennent des accordéons. Aucune media query en JavaScript.

`App.tsx` distribue l'existant sans extraire de composant : matériel à gauche (Lieu, Optique,
Suivi, lectures), planétarium au centre, tout le reste à droite. L'extraction en
`PanneauMateriel.tsx` / `PanneauSeance.tsx` reste à T-0017 et T-0018.

`main { max-width: 70rem }` supprimé. Le plan de session est enveloppé dans un
`div.plan-session` : c'est l'ancre de la règle d'impression.

## Réserve

Le planétarium porte encore ses propres réglages sous le canevas. Ils défilent dans la colonne
centrale pendant que le canevas reste collé en haut (`position: sticky`, `max-height: 60vh`) —
la scène ne bouge donc pas, mais la colonne défile. Quand T-0018 aura déplacé ces réglages
dans l'onglet Explorer, le bloc `.coque-scene > section` se réduit à `overflow: hidden` et le
`sticky` disparaît. Repère laissé en commentaire `ponytail:` dans `styles.css`.

Aucune vérification visuelle : pas d'outil de navigateur dans cette session. `pnpm typecheck`,
`pnpm build` et `pnpm test` (373 tests) passent.
