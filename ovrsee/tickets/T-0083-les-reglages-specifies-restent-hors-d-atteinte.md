---
{
  "id": "T-0083",
  "titre": "Les réglages spécifiés restent hors d'atteinte",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "prd",
    "audit",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
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

- [x] Les cinq tickets enfants sont soldés, ou explicitement retirés du PRD avec leur raison.
- [x] Aucun paramètre de moteur cité par le PRD ne reste sans chemin depuis l'interface.

## Solde — 21 août 2026

Les cinq enfants sont livrés (T-0084 à T-0088). Les deux paramètres que l'épique nommait comme
écrits et sans appelant ont désormais leur chemin depuis l'interface :

- `permissif` (§7.2, C-03 = 3) — `src/ui/fiche-cible-calcul.ts:124` le porte et
  `src/ui/Verdicts.tsx:27` le demande. Il est demandé, jamais déduit du contexte.
- angle de boîtier suggéré (§6.2) — `rotationSuggeree` (`src/core/cadre.ts:248`) est appelée
  par `src/ui/MenuInfos.tsx:91`, et le bouton « Appliquer » l'applique d'un clic.
