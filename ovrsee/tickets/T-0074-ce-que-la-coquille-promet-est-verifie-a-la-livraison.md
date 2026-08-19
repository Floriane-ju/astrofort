---
{
  "id": "T-0074",
  "titre": "Ce que la coquille promet est vérifié à la livraison",
  "type": "epic",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "securite",
    "pwa",
    "outillage"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Trois promesses du PRD ne sont tenues aujourd'hui par rien d'exécutable. Elles sont vraies, et
c'est justement le problème : elles sont vraies parce que personne ne s'est encore trompé.

- §13.3 demande qu'« aucune donnée de profil, de site ou de plan de session » ne soit transmise.
  Rien ne l'empêche techniquement — la garantie tient à une revue de code, à refaire entièrement
  à chaque dépendance ajoutée.
- §12.1 pose l'application comme installable, et §12.3 s'appuie sur l'installation pour obtenir
  le stockage persistant. Le manifeste ne déclare aucune icône : la promesse est simplement
  fausse.
- 472 tests, `pnpm typecheck` et `pnpm audit` ne s'exécutent que quand on y pense. T-0060 et
  T-0061 ajoutent un linter et une mesure de couverture, c'est-à-dire deux outils de plus que
  rien ne lancera automatiquement.

Ce n'est pas un epic de sécurité au sens des vulnérabilités : l'audit T-0054 avait déjà conclu
qu'il n'y a ni injection, ni secret, ni dépendance vulnérable, et cet audit-ci le confirme. C'est
un epic de **livraison** : transformer trois intentions en trois mécanismes.

## Critères d'acceptation

- [ ] Les trois tickets enfants sont soldés
- [ ] Chacune des trois promesses est gardée par un mécanisme qui échoue tout seul quand elle est
      violée, et non par l'attention de qui relit
