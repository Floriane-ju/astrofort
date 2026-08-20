---
{
  "id": "T-0088",
  "titre": "Le mode permissif C = 3 s'active",
  "colonne": "fait",
  "priorite": "basse",
  "epic": "T-0083",
  "tags": [
    "prd",
    "pose"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

C-03 pose deux valeurs du facteur de pose : 10 par défaut, 3 en mode permissif, ce dernier
destiné au « ciel pollué, suivi imprécis, vent » (§7.2). Le paramètre existe
(`src/core/exposure.ts:93`, `permissif`), la constante existe
(`FACTEUR_POSE_C_PERMISSIF`), et **aucun appelant ne le passe** : le mode est du code mort.

Ce qu'il change est chiffré au PRD : la perte de SNR passe de 4,7 % à 13,4 %, contre une pose
unitaire divisée par plus de trois. C'est l'arbitrage à offrir un soir de vent, quand une
pose sur deux part à la poubelle — mais il doit être choisi, jamais appliqué en silence.

## Critères d'acceptation

- [x] Le mode permissif s'active depuis la fiche cible, désactivé par défaut.
- [x] Activé, il affiche la pose obtenue, la perte de SNR correspondante et la raison
      d'usage — jamais comme un réglage neutre.
- [x] La chaîne d'explication de §10.2 cite la constante réellement employée, C-03 par défaut
      ou sa variante permissive.
- [x] Désactivé, aucune sortie ne change par rapport à aujourd'hui.

## Réalisé

Case à cocher dans la section Pose de la fiche (`src/ui/Verdicts.tsx`), état porté par
`FicheCible.tsx` et passé à `evalue(…, permissif)` — jamais déduit du contexte.

`poseUnitaire` rend `notePermissif` : la pose obtenue face à celle du mode par défaut, les
deux pertes de SNR chiffrées depuis les constantes, et la raison d'usage de §7.2. Le message
de régime nominal est reformulé sous permissif — « poser plus longtemps n'apporterait quasi
rien » est faux quand C vaut 3.

Les conséquences aval ne sont pas réécrites : `planIntegration` et `planCalibration` prennent
déjà la pose retenue, donc nombre d'images, intégration requise, volume et darks suivent
d'eux-mêmes. Un test le vérifie plutôt qu'un commentaire l'affirme.

Sur le setup de référence : 4 s au lieu de 13 s, perte 13,4 % contre 4,7 % — les valeurs de la
table §2.3.
