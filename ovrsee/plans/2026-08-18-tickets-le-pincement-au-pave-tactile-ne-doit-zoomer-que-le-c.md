---
{
  "status": "closed",
  "title": "Tickets — le pincement au pavé tactile ne doit zoomer que le ciel",
  "opened": "2026-08-18",
  "closed": "2026-08-18",
  "commits": [
    {
      "sha": "1a619be",
      "date": "2026-08-18",
      "files": [
        ".gitignore",
        "src/App.tsx",
        "src/core/labels.ts",
        "src/ui/MenuInfos.tsx",
        "src/ui/PanneauExplorer.tsx",
        "src/ui/Planetarium.tsx",
        "src/ui/couleurs.ts",
        "src/ui/dessine-ciel.ts",
        "src/ui/scene-etat.ts",
        "src/ui/scene-overlay.ts",
        "src/ui/styles.css",
        "tests/cadre.test.ts",
        "tests/coque.test.tsx",
        "tests/dessine-ciel.test.ts",
        "tests/mode-nuit.test.tsx",
        "tests/zoom-planetarium.test.ts"
      ]
    }
  ]
}
---

# Tickets — le pincement au pavé tactile ne doit zoomer que le ciel

## Contexte

Sur macOS, un pincement à deux doigts au-dessus du planétarium zoome **toute
l'interface** (zoom navigateur) au lieu de ne changer que le champ de la scène.
La molette de souris, elle, fonctionne bien.

Cause tracée dans le code :

- `src/ui/Planetarium.tsx:605` branche le zoom via `onWheel={surMolette}`
  (`surMolette` en `Planetarium.tsx:561`). React attache `wheel` sur le
  conteneur racine en écouteur **passif** : `preventDefault()` y est sans effet.
- Un pincement au pavé est traduit par Chrome/Firefox macOS en `wheel` avec
  `ctrlKey: true`. Sans `preventDefault()`, le navigateur applique son propre
  zoom de page.
- Safari émet en plus les événements non standard `gesturestart` /
  `gesturechange` / `gestureend`, jamais interceptés ici.
- `surMolette` ne lit que le **signe** de `deltaY` et applique un facteur fixe
  (`FACTEUR_ZOOM_MOLETTE`) : correct pour un cran de molette, faux pour un
  pincement dont l'amplitude est continue.

`.planetarium` a déjà `touch-action: none` (`styles.css:594`) — ça couvre le
tactile, pas le pavé, qui passe par `wheel`.

## Tickets à créer

Board lu (`ovrsee/board.json`) : colonnes `backlog`, `a-specifier`, `pret`,
`en-cours`, `revue`, `fait`. Dernier id existant : `T-0028` → on part de
`T-0029`. Colonne d'arrivée : `pret` (le quoi et le comment le constater sont
tous deux connus). `plan: null`, tag `ui`.

### T-0029 — Le pincement au pavé ne zoome que le ciel (haute)

Corps : contexte ci-dessus + critères.

- [ ] Le pincement à deux doigts au-dessus du planétarium change `fovDeg` et
      **rien d'autre** : le reste de l'interface garde sa taille.
- [ ] Le zoom de page du navigateur ne se déclenche jamais depuis la scène
      (vérifié Chrome + Safari macOS).
- [ ] La molette de souris continue de zoomer comme avant, sans faire défiler
      la page.
- [ ] Hors du canevas, pincement et molette gardent leur comportement natif.

Piste d'implémentation à consigner dans le ticket : remplacer `onWheel` par un
`addEventListener('wheel', …, { passive: false })` posé sur la ref `canevas`
dans un `useEffect`, avec `preventDefault()`.

### T-0030 — Le pincement zoome en continu, la molette par crans (moyenne)

- [ ] Un pincement lent produit une variation de champ progressive,
      proportionnelle à l'amplitude du geste (`Math.exp(-deltaY * k)`), pas un
      saut fixe.
- [ ] La molette (`ctrlKey` faux) garde son cran actuel `FACTEUR_ZOOM_MOLETTE`.
- [ ] Le champ reste borné par `bornesZoom(props.gaiaCharge)`.

### T-0031 — Safari : neutraliser le geste de pincement natif (basse)

- [ ] `gesturestart` / `gesturechange` / `gestureend` sont interceptés sur le
      canevas et ne provoquent aucun zoom de page dans Safari macOS.
- [ ] Aucun avertissement TypeScript : les événements non standard sont typés
      localement, pas `any` implicite.

Pas d'epic : trois tickets sur un même geste, la grappe est lisible telle
quelle.

## Fichiers touchés (par les tickets, pas par ce plan)

- `ovrsee/tickets/T-0029-…md`, `T-0030-…md`, `T-0031-…md` — création.
- (à l'implémentation) `src/ui/Planetarium.tsx` uniquement.

## Vérification

- `ls ovrsee/tickets/` montre les trois nouveaux fichiers, ids sans trou ni
  reprise.
- Chaque frontmatter est du JSON valide, `colonne` ∈ ids de `board.json`,
  `cree` = `maj` = `2026-08-18`.
- Le tableau de l'ovrsee affiche les trois cartes en colonne « Prêt ».
