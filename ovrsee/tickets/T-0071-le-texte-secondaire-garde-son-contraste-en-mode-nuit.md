---
{
  "id": "T-0071",
  "titre": "Le texte secondaire garde son contraste en mode nuit",
  "colonne": "pret",
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

- [ ] Au facteur nominal, tout texte porteur d'information atteint 4,5:1, ou 3:1 s'il est rendu
      à ≥ 18,66 px ou en gras — le calcul est écrit à côté de la palette, avec sa source
- [ ] La hiérarchie entre texte principal et texte secondaire survit à la correction : si la
      luminance ne peut plus la porter, elle passe par la graisse, la taille ou l'espacement
- [ ] Le plafond du rouge pur et l'effondrement des ratios au plancher de 2 % sont écrits comme
      écart assumé, avec la raison §11.1, à côté du bloc de palette
- [ ] Aucun jeton ne gagne de composante verte ou bleue : `tests/mode-nuit.test.tsx` reste vert
- [ ] Un test calcule les ratios depuis la feuille de style et échoue si un jeton régresse sous
      le seuil retenu
