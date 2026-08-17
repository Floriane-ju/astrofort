---
{
  "id": "T-0015",
  "titre": "Pointage et temps partagés entre les deux vues",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": [
    "lot-6",
    "refactor"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md",
  "epic": "T-0014"
}
---

## Contexte

`Planetarium.tsx:183-197` et `GrandChamp.tsx:105-110` tiennent **chacun** leur azimut,
hauteur, rotation et champ. Deux vues qui fusionnent en une seule scène ne peuvent pas
garder deux pointages : l'utilisateur cadrerait deux fois la même photographie.

Ce ticket est un refactor pur. À sa fin l'écran est encore l'empilement actuel — c'est
justement ce qui rend les cinq tickets suivants sûrs : ils bougent la mise en page sur un
état déjà unifié.

## Critères d'acceptation

- [x] Un hook `useScene()` dans `src/ui/scene-etat.ts` porte le pointage (azimut, hauteur,
      rotation, champ, mode de projection) et le temps (mode, facteur, pas, instant)
- [x] Déplacer la visée dans le planétarium déplace le cadre du grand champ
- [x] `pnpm test` passe **sans qu'un seul fichier de test soit modifié** (373 tests, 35 fichiers)
- [x] Aucun changement visible à l'écran par rapport à aujourd'hui

## Réalisation

Magasin de module + `useSyncExternalStore` plutôt qu'un contexte React : les deux vues n'ont
pas d'ancêtre commun autre que `App`, et les tests rendent `GrandChamp` seul en rendu serveur.
L'instant (`instant.ms`) reste hors de l'état réactif — la boucle RAF l'écrit à 60 Hz.

Le grand champ garde son propre champ (`fovLDeg` du cadre) et sa projection (type d'objectif) :
les partager changerait le rendu, ce que ce ticket interdit. T-0017 les fait remonter.

Nouveau `tests/scene-etat.test.ts` (fichier neuf, aucun test existant modifié).
