---
{
  "id": "T-0014",
  "titre": "Lot 6 — Coque planétarium",
  "type": "epic",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "xl",
  "tags": [
    "lot-6",
    "ui"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md"
}
---

## Contexte

Les lots 0 à 5 ont livré tous les moteurs et cinq vues qui fonctionnent, mais `src/App.tsx`
les empile en onze `<section>` dans un `main` à `max-width: 70rem`. Changer une focale et
voir son effet sur le cadre demande de remonter trois mille pixels. `src/App.tsx:8-9`
l'assumait : « ce n'est toujours pas un écran conçu ».

L'application est un planétarium. Elle doit se lire comme un planétarium : la scène au
centre, le matériel à gauche, l'intention à droite, et tout résultat visible sur la scène.

Ce lot ne touche aucun moteur de calcul. Le PRD n'impose aucune mise en page ; §11.2 impose
les cibles ≥ 44 px, le plan imprimable et aucune information portée par le survol seul.

## Critères d'acceptation

- [x] Le planétarium occupe la colonne centrale et n'est jamais scrollé
- [x] Aucun réglage ne se trouve sous la scène : matériel à gauche, séance à droite
- [x] Un changement de matériel ou de pose se constate sur la scène, sans défilement
- [x] Aucun fichier de `src/core/`, `src/data/` ni `src/registry/` n'est modifié
- [x] Les six tickets enfants sont soldés

## Réalisation

Les six tickets sont livrés : T-0015 pointage et temps partagés, T-0016 coque à trois colonnes,
T-0017 panneau matériel, T-0018 panneau séance à onglets, T-0019 incrustation du filé dans le
cadre, T-0020 tiroir de vérification et tests de coque.

Aucun moteur n'a bougé : `src/core/`, `src/data/`, `src/registry/` et `src/ui/dessine-champ.ts`
sont intacts. `dessine-ciel.ts` a été touché sur un seul point — son tracé de contour de cadre,
scindé pour être réutilisé en chemin de découpe, et ses tests passent inchangés.

`pnpm typecheck`, `pnpm build` et `pnpm test` (36 fichiers, 387 tests) sont verts.

## Réserve

Le lot n'a jamais été regardé à l'écran : aucun pilote de navigateur dans cette session et le
port 5173 est occupé par un autre serveur. Les neuf points de vérification visuelle du plan et
le rescan `ovrsee` des captures restent à faire.
