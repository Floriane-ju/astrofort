---
{
  "id": "T-0020",
  "titre": "Tiroir vérification et tests de coque",
  "epic": "T-0014",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "lot-6",
    "ui",
    "tests"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md"
}
---

## Contexte

Les écrans de §14 — état du socle, export/import, matrice de dégradation, registre de
constantes (`App.tsx:653-753`) — vérifient le socle, ils ne préparent pas une nuit. Leur place
est un tiroir fermé par défaut, pas trois pleines hauteurs d'écran sous le planétarium. Le mode
nuit, lui, remonte dans la barre du haut : c'est un geste de terrain, il doit être à portée.

Restent les tests de vue, qui interrogent l'ancienne mise en page. Ceux des moteurs ne doivent
pas bouger — s'ils bougent, c'est qu'un moteur a bougé, ce que ce lot interdit.

## Critères d'acceptation

- [x] `src/ui/Verification.tsx` porte les quatre blocs de §14, fermé par défaut, ouvrable
      depuis la barre du haut
- [x] Mode nuit dans la barre du haut : interrupteur plus curseur de luminance, auto-activation
      au crépuscule inchangée (§11.1)
- [x] `tests/coque.test.tsx` couvre : les trois régions présentes, la bascule d'onglets, un clic
      objet qui ouvre l'onglet Cible, l'incrustation qui fige le temps
- [x] `tests/contrat-entree.test.tsx`, `previsu-champ.test.tsx`, `mode-nuit.test.tsx` et
      `cible.test.tsx` remis à jour sur la nouvelle mise en page
- [x] Aucun test de moteur modifié — `grand-champ`, `file-etoiles`, `projection`, `exposure`
      et les autres passent inchangés
- [x] `pnpm typecheck && pnpm test` vert — 36 fichiers, 387 tests

## Réalisation

`src/ui/Verification.tsx` est un `<details>` fermé, posé dans la barre du haut : état du socle,
export/import des données utilisateur, matrice de dégradation, registre de constantes. Le mode
nuit a son propre tiroir juste à côté, interrupteur et curseur de luminance compris.
L'auto-activation au crépuscule n'a pas bougé — elle vit toujours dans `App.tsx`, sur la
fenêtre nocturne calculée. Aucun état React n'est apparu pour ces tiroirs : l'élément natif
porte déjà l'ouverture, le clavier et l'annonce.

`tests/coque.test.tsx` (12 tests) couvre la structure, pas l'apparence : les trois régions, le
groupe Séance visible sous chacun des quatre onglets, un seul contenu monté à la fois, l'onglet
actif marqué autrement que par la couleur, la bascule vers Cible quand un objet est ouvert,
l'incrustation qui fige le temps et ne le redémarre pas seule, le plan rendu hors de l'onglet
Nuit, et l'ordre de dépose de l'incrustation.

Tests de vue mis à jour : `cible.test.tsx` ouvre l'onglet Cible avant de rendre — la fiche ne
vit plus dans une pile mais sous un onglet ; `scene-etat.test.ts` interroge `PanneauExplorer`
pour le choix de projection, qui a quitté la scène ; `previsu-champ.test.tsx` et `cadre.test.ts`
suivent les signatures de `PanneauFile` et de `Planetarium`. `contrat-entree.test.tsx` et
`mode-nuit.test.tsx` passent **sans modification** : la coque n'a pas changé ce que
l'application affiche, seulement où.

Aucun test de moteur touché. `dessine-ciel.test.ts` passe inchangé malgré le découpage de son
tracé de contour — c'est la preuve que le découpage n'a rien changé au rendu.

## Réserve

Rien à l'écran, comme pour T-0018 et T-0019 : pas de navigateur pilotable, port 5173 occupé.
Le rescan `ovrsee` des captures reste à faire — elles datent du lot 4.
