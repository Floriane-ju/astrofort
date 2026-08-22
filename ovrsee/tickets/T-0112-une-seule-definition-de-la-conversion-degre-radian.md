---
{
  "id": "T-0112",
  "titre": "Une seule définition de la conversion degré/radian",
  "colonne": "fait",
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

- [x] Une seule définition de la conversion dans tout `src/`
- [x] `grep -rn "Math.PI / 180\|180 / Math.PI" src/` ne renvoie que cette définition
- [x] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée

## Réalisé — 22 août 2026

`DEG` reste dans `src/core/mat3.ts`, avec un commentaire qui dit pourquoi : une identité
mathématique n'a ni source ni tolérance, elle n'a rien à faire dans `src/registry/`, et sept
moteurs l'importaient déjà de là.

Quatorze définitions locales supprimées, sur seize emplacements — le ticket en listait treize,
le balayage en a trouvé deux de plus, écrites sous une forme que son grep ne voyait pas :

```
src/ui/dessine-ciel.ts:264   (bDeg * Math.PI) / 180
src/core/site.ts:173         (hauteurDeg * Math.PI) / 180
```

Conversions inversées : `* DEG_PAR_RADIAN` → `/ DEG`, `/ DEG_PAR_RADIAN` → `* DEG`,
`RADIAN_PAR_DEG` → `DEG`. Les deux `const` reconstruites à chaque appel dans `index-ciel.ts`
(§3.3, chemin chaud) sont parties.

Vérification :

```
$ pnpm typecheck
$ tsc --noEmit
        (aucune sortie)

$ pnpm test
 Test Files  54 passed (54)
      Tests  733 passed (733)
   Duration  4.34s

$ grep -rn "Math.PI / 180\|180 / Math.PI" src/
src/core/mat3.ts:31:export const DEG = Math.PI / 180
```

`src/registry/constants.ts` garde une entrée `DEG_PAR_RADIAN_APPROX` : c'est le facteur 57,296
de l'approximation petits angles, marqué `deprecie`, qu'aucun moteur ne consomme. Ce n'est pas
une seconde définition de la conversion — c'est la trace d'une formule écartée par §5.1.
