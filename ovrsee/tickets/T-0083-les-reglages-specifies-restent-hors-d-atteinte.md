---
{
  "id": "T-0083",
  "titre": "Les réglages spécifiés restent hors d'atteinte",
  "type": "epic",
  "colonne": "pret",
  "priorite": "moyenne",
  "tags": [
    "prd",
    "audit",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": null
}
---

## Contexte

Cinq réglages sont spécifiés au PRD, calculés par les moteurs, et inatteignables depuis
l'interface. Deux d'entre eux ont même leur paramètre écrit et sans appelant — `permissif`
dans `src/core/exposure.ts:93`, l'angle de boîtier suggéré dans `src/core/framing.ts:191`.

Un moteur qui calcule une sortie que rien n'affiche est du code mort en sursis (T-0063) ; une
promesse du PRD que l'interface ne tient pas est pire, parce qu'elle passe la relecture.

## Critères d'acceptation

- [ ] Les cinq tickets enfants sont soldés, ou explicitement retirés du PRD avec leur raison.
- [ ] Aucun paramètre de moteur cité par le PRD ne reste sans chemin depuis l'interface.
