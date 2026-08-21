---
{
  "id": "T-0071",
  "titre": "Le texte secondaire garde son contraste en mode nuit",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "accessibilite",
    "mode-nuit",
    "design"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "epic": "T-0067",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **A4** de l'audit du 19 août 2026.

Ratios calculés depuis les jetons de `src/ui/styles.css:11-36`, au facteur de luminance nominal :

| Paire | Mode normal | Mode nuit |
|---|---|---|
| `--texte` sur `--fond` | 15,5:1 | **4,36:1** — AA demande 4,5 |
| `--attenue` sur `--surface` | 6,3:1 | **2,20:1** |

Le mode normal est irréprochable. Le mode nuit fait passer le texte secondaire sous la moitié du
seuil, et ce texte secondaire n'est pas décoratif : c'est `--attenue` qui porte **tous les
libellés de champs** (règle `label`, 0,85 rem ≈ 12,75 px), les `.etat`, les `.niveau` et les
`<th>` des tableaux. Sur le terrain, de nuit, ce sont précisément les mots qui disent de quelle
grandeur on parle.

Deux plafonds encadrent la correction, et il faut les écrire plutôt que les découvrir :

- **Le rouge pur plafonne à 5,25:1 sur du noir.** AA à 4,5:1 est donc atteignable pour le texte
  principal, mais il n'y a presque pas de marge : il faut monter `--texte` vers 237 et poser le
  texte sur du noir plutôt que sur `--surface`.
- **Au plancher de 2 %, tous les ratios s'effondrent vers 1:1.** C'est arithmétique et c'est
  voulu : le plancher existe pour que l'écran cesse d'être une source de lumière. WCAG mesure un
  contraste photopique ; §11.1 optimise une vision scotopique. Les deux ne se réconcilient pas,
  et l'écart s'assume par écrit.

Ce qui ne se fait pas : ajouter du vert ou du bleu pour gagner un ratio. §11.1 est une contrainte
de physiologie, pas une préférence esthétique.

## Critères d'acceptation

- [x] Au facteur nominal, tout texte porteur d'information atteint 4,5:1, ou 3:1 s'il est rendu
      à ≥ 18,66 px ou en gras — le calcul est écrit à côté de la palette, avec sa source
- [x] La hiérarchie entre texte principal et texte secondaire survit à la correction : si la
      luminance ne peut plus la porter, elle passe par la graisse, la taille ou l'espacement
- [x] Le plafond du rouge pur et l'effondrement des ratios au plancher de 2 % sont écrits comme
      écart assumé, avec la raison §11.1, à côté du bloc de palette
- [x] Aucun jeton ne gagne de composante verte ou bleue : `tests/mode-nuit.test.tsx` reste vert
- [x] Un test calcule les ratios depuis la feuille de style et échoue si un jeton régresse sous
      le seuil retenu

## Résolution

Palette de nuit, `src/ui/styles.css` — les glyphes montent, les aplats descendent, parce qu'à
surface d'écran allumée ce sont les fonds qui pèsent, pas les traits des lettres :
`--texte` 230 → 250, `--attenue` 150 → 242, `--surface` 26 → 8, `--surface-haute` 46 → 18,
`--fond-alerte` 40 → 26. `--bordure` et `--alerte` inchangés ; aucun jeton ne gagne de vert
ni de bleu.

Ratios au facteur nominal, pire fond (`--fond-alerte`) : `--texte` 4,85:1, `--attenue` 4,57:1,
`--alerte` 5,03:1 — contre 4,00 / 2,11 / 4,82 avant. Le mode normal était déjà conforme et ne
bouge pas.

Le calcul WCAG 2.2 avec sa source, le plafond du rouge pur (5,25:1 sur noir), l'effondrement
vers 1,01:1 au plancher de 2 % et la non-monochromaticité de la primaire rouge sRGB sont écrits
en tête du bloc de palette, comme écart assumé §11.1.

La hiérarchie ne peut plus tenir sur la luminance — 5,25:1 de plafond ne laisse pas de place.
Elle repose sur la taille (0,85 rem contre 15 px) et la graisse (`.onglet.actif`, `th`), déjà
en place ; le test en verrouille la présence.

`tests/mode-nuit.test.tsx` recalcule les ratios depuis la feuille pour les deux palettes, tout
jeton de texte contre tout jeton de fond, et échoue sous 4,5:1. Vérifié en régressant `--attenue`
à 150 : le test tombe. `pnpm typecheck` propre, 623 tests verts.
