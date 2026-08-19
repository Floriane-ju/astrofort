# Astrofort — règles permanentes

Valables à chaque session, sans exception. Le détail est dans `CLAUDE.md` ; ici, les
non-négociables.

## Interdits

- Écrire un nombre en dur dans un moteur (`src/core/`) ou dans l'UI. Toute constante, plage,
  seuil ou tolérance vient de `src/registry/`.
- Écrire une éphéméride, une coordonnée ou une magnitude en dur, y compris dans un test.
  Les tests d'acceptation vérifient une formule, pas une valeur recopiée.
- Installer une dépendance sans accord. `pnpm` uniquement (`pnpm add`, `pnpm dlx`).
- Modifier `prd.md` ou éditer `public/data/*.bin` à la main.
- Ajouter de la télémétrie ou un ajustement automatique du registre.

## Avant de coder

1. Lire la section du PRD citée par le fichier concerné (`§x.y` en en-tête).
2. Vérifier si la valeur existe déjà dans `src/registry/` (`constants.ts`, `domains.ts`,
   `formulas.ts`, `verdicts.ts`).
3. Pour toute règle astro — visibilité, nuit, lune, pose, cadrage, filé, échantillonnage —
   invoquer le skill `astro-feature-review` avant de trancher.

## Organisation

- Calcul pur dans `src/core/`, données et persistance dans `src/data/`, React dans `src/ui/`.
  Un composant ne calcule pas : il appelle un moteur.
- Fichiers courts. Un composant qui mêle état, calcul et JSX se découpe (`*-calcul.ts`,
  `*-saisie.ts`, sous-composants).
- Un test par comportement dans `tests/`, nommé d'après le module (`visibles.test.ts`).

## Style

- Métier en français (`creneaux`, `cadre`, `pose`), technique en anglais (`mat3`, `projection`).
- `readonly` + `Object.freeze` sur toute structure partagée. Pas de mutation en place.
- Commentaire = pourquoi la décision, jamais quoi fait le code.

## Vérification

Avant d'annoncer qu'un travail est terminé : `pnpm typecheck && pnpm test`, et rapporter la
sortie réelle. Pas de « ça devrait marcher ».
