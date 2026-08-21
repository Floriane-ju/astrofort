---
{
  "id": "T-0070",
  "titre": "Le focus se voit, et il ne fuit pas en bleu",
  "colonne": "fait",
  "priorite": "haute",
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

Constat **A3** de l'audit du 19 août 2026.

`src/ui/styles.css` ne contient ni `:focus`, ni `:focus-visible`, ni `outline` — 698 lignes, zéro
occurrence. Rien n'est *retiré*, donc l'anneau par défaut subsiste : c'est le navigateur qui le
dessine, et il le dessine en bleu.

C'est là que le défaut d'accessibilité et le défaut de mode nuit se rejoignent. §11.1 exige
qu'« aucun pixel ne présente de composante verte ou bleue non nulle », et l'en-tête de la feuille
explique pourquoi la palette passe entièrement par des variables : « une seule couleur écrite en
dur ailleurs dans la feuille survivrait au basculement ». Le raisonnement est juste, mais il ne
couvre que ce qui est *écrit* dans la feuille. Ce qui n'y est pas écrit vient du navigateur :

- l'anneau de focus, bleu ;
- `::selection`, bleu ;
- le caret, la couleur d'accent des cases à cocher ;
- les ascenseurs, que `color-scheme: dark` (`styles.css:12`) fait dessiner en gris bleuté.

`accent-color: var(--alerte)` (`styles.css:348`) traite déjà ce problème — mais pour les seuls
`input[type='range']`. Le reste de la liste est resté dehors.

`tests/mode-nuit.test.tsx` ne peut pas voir cette fuite : il lit la feuille de style et ces
couleurs n'y sont pas. Le test est bon, son angle mort est structurel — il se referme en
**écrivant** les déclarations, ce qui les rend inspectables.

## Critères d'acceptation

- [x] Une règle `:focus-visible` explicite existe, d'un contraste ≥ 3:1 avec ce qui l'entoure
      (WCAG 2.4.11 et 2.4.13), et n'utilise que les jetons de la palette
- [x] `::selection`, `caret-color`, `accent-color` et la couleur des ascenseurs sont posés depuis
      ces mêmes jetons : en mode nuit ils sont rouges, sans exception
- [x] L'indicateur de focus reste perceptible au plancher de luminance de 2 % — s'il faut pour
      cela qu'il porte aussi une forme, ce choix est écrit
- [x] `tests/mode-nuit.test.tsx` couvre ces nouvelles déclarations et échoue si l'une d'elles
      réintroduit une composante verte ou bleue
- [x] Le parcours au clavier de toute l'application montre en permanence où se trouve le focus,
      y compris sur le canevas (T-0069) et sur les `summary` des tiroirs
