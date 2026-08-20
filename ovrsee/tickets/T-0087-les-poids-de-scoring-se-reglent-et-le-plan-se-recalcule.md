---
{
  "id": "T-0087",
  "titre": "Les poids de scoring se règlent, et le plan se recalcule",
  "colonne": "fait",
  "priorite": "basse",
  "epic": "T-0083",
  "tags": [
    "prd",
    "planification"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

§8.3 et §2.4 sont explicites : les poids C-15 sont « figés, exposés, réglables par
l'utilisateur, sans apprentissage ». Exposés, ils le sont — `session-score.ts` trace les cinq
termes et la fiche du plan les affiche. Réglables, non : ils viennent du registre
(`src/core/session-types.ts:54`) et rien ne les touche.

L'écart compte parce que les cinq critères n'ont pas le même sens pour tout le monde : un
amateur de Voie lactée pondère la fenêtre et la Lune, un chasseur de galaxies la hauteur et
le signal. Le PRD a déjà tranché que ce réglage remplace tout apprentissage — c'est la
contrepartie assumée de l'absence de télémétrie.

## Critères d'acceptation

- [x] Les cinq poids se règlent depuis l'interface, la somme restant normalisée à 1.
- [x] Le plan de séance se recalcule au changement, et la décomposition du score affichée
      reflète les poids courants.
- [x] Un geste unique revient aux valeurs C-15 du registre, qui restent la référence.
- [x] Les poids réglés partent dans l'export de §12.3.
- [x] Aucun ajustement automatique, aucune mémoire de choix passés : le réglage est explicite
      ou il n'existe pas (§2.1).
