---
{
  "id": "T-0060",
  "titre": "Un linter garde les règles que le projet s'est données",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["audit", "qualite", "outillage"],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **P3** de l'audit T-0054.

`package.json:6-14` n'expose ni ESLint ni Biome. Le projet tient beaucoup de
règles — fichiers courts, fonctions courtes, immutabilité, pas de `any` — et
aucune n'est gardée par autre chose que l'attention.

La preuve que ça coûte est dans le code : `src/App.tsx:348` porte
`// eslint-disable-next-line react-hooks/exhaustive-deps`. La directive vise un
outil qui n'existe pas dans le projet : elle ne désactive rien, et elle **masque
un vrai défaut**. Le `useMemo` du plan lit `zeroSysteme.valeur`,
`zeroSysteme.estime` et `iso.readNoiseE` sans qu'ils figurent dans son tableau
de dépendances (`App.tsx:346-349`). Le calcul est juste aujourd'hui parce que
`BOITIER_REFERENCE` est constant — une raison qui n'est écrite nulle part et que
le premier boîtier configurable fera tomber.

À l'inverse, `tsconfig.json` tient déjà `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals` et `noUnusedParameters` : le
typage est gardé, c'est le reste qui ne l'est pas. Le linter doit compléter, pas
redoubler.

Installation à demander avant de faire — c'est une dépendance de plus.

## Critères d'acceptation

- [ ] Un linter est installé et exposé par un script `pnpm lint`
- [ ] `eslint-plugin-react-hooks`, ou son équivalent, est actif : la directive de
      `src/App.tsx:348` est soit honorée par un outil réel, soit retirée après
      correction des dépendances manquantes
- [ ] La raison pour laquelle une dépendance est volontairement omise, s'il en
      reste une, est écrite à côté — pas seulement désactivée
- [ ] `pnpm lint` passe sur `src/`, `scripts/` et `tests/` sans avertissement
- [ ] La configuration ne redouble pas ce que `tsconfig.json` garde déjà
