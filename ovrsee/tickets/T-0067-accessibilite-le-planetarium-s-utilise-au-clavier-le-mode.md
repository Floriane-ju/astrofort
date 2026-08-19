---
{
  "id": "T-0067",
  "titre": "Accessibilité : le planétarium s'utilise au clavier, le mode nuit reste lisible",
  "type": "epic",
  "colonne": "a-specifier",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "audit",
    "accessibilite",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

L'audit T-0054 s'est fermé sur une phrase : « Le design — visuel, ergonomie, typographie — est
resté hors périmètre du début à la fin. `src/ui/styles.css` n'a pas été ouvert. » L'accessibilité,
elle, n'a jamais figuré dans aucun périmètre.

Le socle est sain, et c'est ce qui rend le reste corrigeable : tous les contrôles sont de vrais
`<button>`, tous les champs sont enveloppés d'un `<label>`, `--cible-clic: 44px` s'applique
partout y compris sous le repli, `index.html` porte `lang="fr"` et n'interdit pas le zoom.
Ce qui manque est localisé, pas systémique — cinq endroits, cinq enfants.

Deux d'entre eux touchent le mode nuit, et là le PRD et WCAG tirent dans le même sens sans se
recouvrir : §11.1 interdit toute composante verte ou bleue, WCAG demande 4,5:1. Le rouge pur
plafonne à 5,25:1 sur noir. AA est donc atteignable pour le texte principal, et hors d'atteinte
au plancher de luminance de 2 % — cet écart-là s'écrit et se justifie par la physiologie, il ne
se maquille pas.

Référentiel retenu pour les enfants : **WCAG 2.2 AA**.

## Critères d'acceptation

- [ ] Les six tickets enfants sont soldés
- [ ] Un parcours complet au clavier est possible sans souris : chargement, choix d'une cible,
      lecture de sa fiche, export du plan de session
- [ ] En mode nuit, aucun pixel ne présente de composante verte ou bleue non nulle — anneau de
      focus, sélection de texte, caret et ascenseurs compris, c'est-à-dire y compris ce que
      `tests/mode-nuit.test.tsx` ne voit pas aujourd'hui
- [ ] Chaque écart au référentiel qui subsiste est écrit à côté de la règle concernée, avec sa
      raison ; aucun n'est laissé implicite
