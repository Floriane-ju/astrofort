---
{
  "id": "T-0112",
  "titre": "Une seule définition de la conversion degré/radian",
  "colonne": "pret",
  "priorite": "basse",
  "charge": "s",
  "tags": ["qualite", "refactor"],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": null
}
---

## Contexte

Constat de **T-0110**, axe « lignes en trop ». `src/core/mat3.ts:26` exporte déjà
`export const DEG = Math.PI / 180`. Treize autres emplacements redéfinissent la même valeur
localement, sous trois noms différents :

```
src/core/mat3.ts:26              export const DEG = Math.PI / 180   ← la définition
src/core/pointage.ts:26          const DEG = Math.PI / 180
src/core/moon.ts:24              const DEG = Math.PI / 180
src/core/fond-ciel-rendu.ts:35   const DEG = Math.PI / 180
src/ui/dessine-fond-ciel.ts:36   const DEG = Math.PI / 180
src/ui/panneau-file-lectures.ts:29  const DEG = Math.PI / 180
src/core/tracking.ts:18          const RADIAN_PAR_DEG = Math.PI / 180
src/core/framing.ts:25           const DEG_PAR_RADIAN = 180 / Math.PI
src/core/cadre.ts:185            const DEG_PAR_RADIAN = 180 / Math.PI
src/core/optics.ts:18            const DEG_PAR_RADIAN = 180 / Math.PI
src/ui/planetarium-gestes.ts:35  const DEG_PAR_RADIAN = 180 / Math.PI
src/core/index-ciel.ts:66        const DEG_PAR_RADIAN = 180 / Math.PI   ← DANS un corps de fonction
src/core/index-ciel.ts:188       const DEG_PAR_RADIAN = 180 / Math.PI   ← DANS un corps de fonction
src/data/semis.ts:69             (… * 180) / Math.PI   écrit à la volée
```

Aucun risque de divergence : `Math.PI` ne bouge pas. Ce qui gêne est ailleurs — trois noms pour
une notion, dont un (`RADIAN_PAR_DEG`) qui nomme l'inverse de ce qu'il vaut, et deux constantes
reconstruites à chaque appel dans `index-ciel.ts`, qui est le chemin chaud de la sélection
d'étoiles (§3.3).

T-0110 a traité le seul cas qui tombait dans son diff (`src/ui/dessine-ciel.ts`, qui écrivait
`(Math.acos(…) * 180) / Math.PI` et importe désormais `DEG`). Le reste est un balayage sur douze
fichiers : la méthode de T-0110 interdit de le glisser dans une passe d'optimisation.

## Ce qu'il y a à faire

Importer `DEG` depuis `src/core/mat3.ts` partout, et supprimer les définitions locales. Une
division par `DEG` remplace une multiplication par `DEG_PAR_RADIAN` — c'est la même valeur, et
les tests d'acceptation vérifient des formules, pas des recopies.

Décider en passant si `mat3.ts` reste le bon domicile : c'est un module de matrices, et la
conversion d'unité n'en est pas une. `src/registry/` est l'autre candidat.

## Critères d'acceptation

- [ ] Une seule définition de la conversion dans tout `src/`
- [ ] `grep -rn "Math.PI / 180\|180 / Math.PI" src/` ne renvoie que cette définition
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée
