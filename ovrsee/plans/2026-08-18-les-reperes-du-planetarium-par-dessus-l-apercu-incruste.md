---
{
  "status": "open",
  "title": "Les repères du planétarium par-dessus l'aperçu incrusté",
  "opened": "2026-08-18",
  "closed": null,
  "commits": []
}
---

# Les repères du planétarium par-dessus l'aperçu incrusté

## Contexte

Quand l'incrustation est active, le cadre matériel est rempli par l'aperçu des étoiles
(champ ou filé) et **tout ce que le planétarium dessine y disparaît** : figures, frontières,
astérismes, horizon, plan galactique, marqueurs d'objets, corps, et les noms. Sur la capture,
les constellations s'arrêtent net au liseré orange — impossible de rapporter le contenu du
cadre à ce qui l'entoure.

La cause est un simple ordre de peinture, pas un défaut de projection :

- `src/ui/Planetarium.tsx:495` appelle `dessineCiel(…)` qui peint le ciel **entier** ;
- `src/ui/Planetarium.tsx:518` appelle ensuite `incrusteDansLeCadre(…)`, qui découpe sur
  `cheminCadre` et dépose une image **opaque** (`dessine-champ.ts:285` remplit `teintes.fond`
  sur tout le canevas hors écran).

Tout ce qui a été peint dans le cadre à l'étape 1 est donc recouvert à l'étape 2.

Résultat visé : l'aperçu passe **sous** le rendu du planétarium au lieu de le recouvrir.
Aucun rendu différent, aucune atténuation, aucun nouveau réglage — ce qui est allumé au
planétarium se voit dans le cadre, tel quel.

## Approche

Un seul point d'insertion : l'incrustation se dépose **juste après le fond**, dans la même
passe, avant tout le reste. Rien n'est retracé deux fois, le coût par image ne bouge pas.

`dessine-ciel.ts` ne peut pas importer `scene-overlay.ts` (ce dernier importe déjà
`cheminCadre`) — d'où un rappel plutôt qu'une dépendance.

### 1. `src/ui/dessine-ciel.ts` — un crochet après le fond

Ajouter à `EntreeDessin` (≈ ligne 67) :

```ts
/**
 * Peint entre le fond et tout le reste. C'est là que l'aperçu incrusté se dépose : sous les
 * repères, les étoiles et les noms, jamais par-dessus.
 */
readonly surLeFond?: (ctx: CanvasRenderingContext2D) => void
```

et l'appeler dans `dessineCiel` immédiatement après le `ctx.fillRect` du fond
(`dessine-ciel.ts:223-224`), avant le réglage de la police.

### 2. `src/ui/Planetarium.tsx` — déplacer le dépôt

Dans la boucle `image(ts)`, le bloc `incrusteDansLeCadre` (`Planetarium.tsx:515-526`) sort
d'après `dessineCiel` et devient le `surLeFond` passé à `dessineCiel` (`Planetarium.tsx:495`).
`cadres[0]` est déjà calculé avant l'appel (`Planetarium.tsx:484-493`) — rien d'autre à
réordonner.

### 3. `src/ui/scene-overlay.ts` — le liseré redevient inutile

`incrusteDansLeCadre` retrace le liseré du cadre (`scene-overlay.ts:133-137`) parce que le
bord de l'image se confondait avec le bord du cadre. Déposée sous la couche Cadre matériel
(`dessine-ciel.ts:422-429`), l'image est de toute façon recerclée juste après — et
l'incrustation exige déjà cette couche allumée (refus « couche Cadre matériel éteinte »).
Le retracé et le commentaire qui le justifie sont supprimés ; le `save`/`clip`/`restore` reste.

## Conséquence assumée

Les étoiles du catalogue du planétarium se dessinent désormais **par-dessus** l'aperçu, en
plus des arcs. C'est ce qui a été demandé (« tout, simplement en dessus ») : à grand champ ce
sont des disques de quelques pixels, et le compte d'étoiles filées affiché au panneau ne
change pas — il vient de `SortieDessinChamp`, pas de ce qui est peint à l'écran.

## Fichiers touchés

- `src/ui/dessine-ciel.ts` — champ `surLeFond` + un appel.
- `src/ui/Planetarium.tsx` — le dépôt de l'incrustation devient le rappel.
- `src/ui/scene-overlay.ts` — retrait du liseré redondant.
- `tests/dessine-ciel.test.ts` — un test.
- `ovrsee/tickets/T-0042-…md` — création (colonne `pret`, priorité `haute`, charge `s`,
  tags `ui`, `planetarium`, `file`, `plan` rattaché).

## Vérification

1. `pnpm test` — vert, y compris `tests/cadre.test.ts` et `tests/mode-nuit.test.tsx`.
2. Nouveau test dans `tests/dessine-ciel.test.ts`, avec le `contexteEspion` déjà en place
   (`tests/dessine-ciel.test.ts:53`) : `surLeFond` est appelé **après** l'unique `fillRect`
   et **avant** le premier `stroke` / `fillText`. Sans le crochet au bon endroit, il tombe.
3. `pnpm dev`, puis dans le planétarium : couche Cadre matériel allumée, un seul profil,
   incrustation activée au panneau Filé. Les figures, frontières et noms de constellations
   traversent le liseré orange sans interruption ; le cadre garde son liseré (une seule fois,
   pas deux traits).
4. Mode nuit : aucune couleur nouvelle — la passe de repères est inchangée, seul son ordre
   par rapport à l'image a bougé.
