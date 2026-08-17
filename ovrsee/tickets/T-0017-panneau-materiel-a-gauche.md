---
{
  "id": "T-0017",
  "titre": "Panneau matériel à gauche",
  "epic": "T-0014",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
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

Le matériel est ce qu'on a, pas ce qu'on décide : il tient la colonne de gauche, avec sous
lui la lecture directe de ce qu'il donne. La saisie vient de `App.tsx:392-466`, les lectures
de `App.tsx:472-510`.

Un réglage est aujourd'hui mal placé : le type d'objectif vit dans `GrandChamp.tsx:313-322`
alors que rectilinéaire ou fisheye est une propriété du matériel, et que c'est elle qui
choisit la projection — §5.1 le dit, elle n'ajuste pas un rendu.

## Critères d'acceptation

- [x] `src/ui/PanneauMateriel.tsx` porte boîtier, focale, ouverture, mode capteur,
      superposition des deux cadres, type d'objectif, suivi, mise en station, monture
- [x] Sous la saisie : champ L et H, échantillonnage et son diagnostic, pupille, pouvoir
      séparateur, NPF, pose max suivi — tous en `TracedValue`, chaque nombre dépliable
      jusqu'à sa formule (§1.5.2)
- [~] Changer la focale redessine le cadre sur la scène et met à jour les lectures de gauche,
      sans rien déplacer à droite — la focale n'alimente plus que `profilsCadre`, le panneau
      matériel et les vues, mais **non vérifié dans un navigateur**
- [x] Le type d'objectif pilote le mode de projection disponible pour la scène

## Réalisation

`PanneauMateriel.tsx` ne porte que des propriétés d'équipement : Optique (boîtier en lecture,
focale, ouverture, recadrage, type d'objectif, superposition des deux cadres) puis Suivi, puis
les lectures en `TracedValue`. Il ne connaît pas le lieu ; ses entrées sont des valeurs et des
rappels, aucun état ne lui appartient — il reste montable seul.

Le boîtier est une ligne d'état, pas un `select` : `BASE_BOITIERS` n'a qu'une entrée, et un
menu à un choix ment sur ce qui est possible. Repère `ponytail:` à l'endroit du futur menu.

Le type d'objectif quitte `GrandChamp.tsx`. Il vit dans `App.tsx` avec le reste du matériel et
descend en `modeObjectif(typeObjectif)` vers `Planetarium` et `GrandChamp`. Conséquence :
le sélecteur de projection du planétarium n'offre plus trois modes mais deux — « Planétarium »
et « Comme l'objectif », dont la valeur est gnomonique ou équidistante selon l'objectif
déclaré. Changer d'objectif pendant que la scène regarde comme lui la fait suivre ;
en vue planétarium, elle ne bouge pas.

Le groupe Lieu et les trois seuils de déclinaison passent en tête du panneau droit : ils
décrivent la séance et la latitude, pas le matériel. C'est la place que T-0018 leur donne.

`pnpm typecheck`, `pnpm build` et `pnpm test` (375 tests) passent. Deux tests ajoutés dans
`scene-etat.test.ts` : la table objectif → projection, et le fait qu'un objectif fisheye ne
propose pas la projection gnomonique à la scène. Trois fichiers de test ont reçu la nouvelle
prop `modeObjectif` (`cadre`, `scene-etat`, `previsu-champ`) ; aucun moteur n'a bougé.

## Réserve

Aucune vérification visuelle : pas d'outil de navigateur dans cette session.
