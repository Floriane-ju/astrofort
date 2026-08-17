---
{
  "status": "open",
  "title": "Retirer les curseurs azimut / hauteur du panneau Filé",
  "opened": "2026-08-15",
  "closed": null,
  "commits": []
}
---

# Retirer les curseurs azimut / hauteur du panneau Filé

## Contexte

Depuis le lot 6, le pointage est partagé : `src/ui/scene-etat.ts` détient `VueScene`
(`azimutDeg`, `hauteurDeg`, `rotationDeg`, `fovDeg`, `mode`) et le planétarium le pilote
directement au glisser-déposer (`Planetarium.tsx:470-493`, `majVue`). Le panneau Filé duplique
ce réglage avec deux curseurs (`PanneauFile.tsx:230-251`) — commande redondante avec la vue,
qui reste la manière naturelle de cadrer. On les supprime.

## Changement

Fichier unique : `src/ui/PanneauFile.tsx`

- Supprimer les deux `<label>` « Azimut de visée » (l. 230-240) et « Hauteur de visée »
  (l. 241-251) dans le bloc `.champs` de la section §9.
- Ne rien toucher d'autre :
  - `const { azimutDeg, hauteurDeg, rotationDeg } = vue` (l. 99) reste — les deux valeurs
    alimentent toujours `projecteur()` (l. 112-123) et donc la visée AD/δ, la carte de pose et
    le diagnostic de filé.
  - `actions` reste utilisé par le bouton « Voir comme l'objectif » (l. 285).
  - Le curseur « Rotation du boîtier » reste : c'est un réglage matériel, pas une commande de
    la vue.
- La ligne d'état l. 204 (`visée … ° AD / … ° δ`) continue de refléter le pointage courant :
  aucune information n'est perdue, elle devient seulement en lecture seule côté Filé.

## Vérification

- `pnpm test` — aucun test ne pilote ces curseurs (grep « Azimut de visée » / « Hauteur de
  visée » ne renvoie que les deux lignes supprimées ; `tests/coque.test.tsx`,
  `tests/previsu-champ.test.tsx` ne construisent que des objets `Vue`). Suite attendue verte
  sans modification de test.
- `pnpm build` (typecheck) — vérifie qu'aucune variable ne devient inutilisée.
- `pnpm dev` : dans l'onglet Filé, plus de curseurs azimut/hauteur ; faire glisser la scène du
  planétarium doit toujours changer la ligne « visée … AD / … δ », la carte de pose §9.1 et le
  diagnostic de pôle §9.3.
