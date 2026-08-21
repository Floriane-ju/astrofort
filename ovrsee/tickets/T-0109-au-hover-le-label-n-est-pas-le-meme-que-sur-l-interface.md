---
{
  "id": "T-0109",
  "titre": "Un élément porte le même libellé, au même endroit, qu'il soit peint ou révélé",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "planetarium",
    "rendu",
    "interaction"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-22",
  "plan": null
}
---

## Contexte

Signalé ainsi : « au hover, le label n'est pas le même que sur l'interface quand on zoome sur
l'étoile. À grand angle, Dabih est notée *Dabih — β Cap* ; quand je zoome, c'est simplement
marqué *Dabih*. » Deux demandes : pas de doublon de donnée, et des libellés cohérents qui
« tapent au même endroit ».

L'investigation confirme les deux, et un troisième écart avec le PRD.

### 1. Deux vocabulaires pour un même astre

La scène compose le texte des labels ; le survol emprunte celui du clic. Ce sont deux règles
de nommage écrites à deux endroits :

- `src/ui/dessine-ciel.ts:655` — label peint d'une étoile nommée :
  `nomPropre === '' ? designation : nomPropre` → « Dabih ».
- `src/ui/planetarium-selection.ts:38-41` — titre du clic, que
  `src/ui/planetarium-gestes.ts:186-190` recopie tel quel dans `survol.texte` :
  `nomPropre === '' ? designation : `${nomPropre} — ${designation}`` → « Dabih — β Cap ».

Même dédoublement sur les objets du ciel profond : label peint `objet.designation` (« M31 »),
titre du survol `designation — premier nom commun` (« M31 — Galaxie d'Andromède »,
`planetarium-selection.ts:16`). Les corps mobiles échappent au problème — les deux passes
lisent le même `cible.nom`.

Le commentaire de `SurvolEcran` (`dessine-ciel.ts:83-85`) revendique l'inverse de ce qui se
passe : « la scène ne compose pas un second vocabulaire, elle emprunte celui du clic ». Le
vocabulaire du clic *est* le second — celui de la fiche, pas celui du label.

### 2. Le nom ne tape pas au même endroit

Chaque famille de labels a son ancre, et le survol en a une quatrième, la même pour toutes :

| Élément | Label peint | Ancre |
|---|---|---|
| Étoile nommée | `dessine-ciel.ts:663-664` | `x + 9`, `y − 9` |
| Objet | `dessine-ciel.ts:688-689` | `x + 13`, `y` |
| Corps mobile | `dessine-ciel.ts:715-716` | `x + 14`, `y` |
| **Survol, tous types** | `dessine-ciel.ts:807-808` | `x + 19`, `y` |

Un nom révélé au survol saute donc de 10 px à droite et 9 px vers le bas dès qu'un cran de
zoom le fait passer en label peint. Le texte change *et* se déplace au même instant.

### 3. La hiérarchie de §3.4 est inversée

Le PRD §3.4 ordonne les libellés par champ :

```
fov > 40°   noms de constellations uniquement
10° à 40°   + désignations Bayer des étoiles de mag ≤ 3,5
fov < 10°   + noms propres et désignations des objets du ciel profond
```

Plus on zoome, plus on nomme. `categoriesActives` (`src/core/labels.ts:35-40`) applique bien
ces deux seuils aux *catégories*, mais aucun code n'applique la gradation au *texte* : dès que
la catégorie `ETOILE` est active, le label peint est le nom propre, jamais la désignation
Bayer que §3.4 réclame entre 10° et 40°.

L'utilisateur voit donc la gradation à l'envers : à grand champ le survol donne la forme
longue (« Dabih — β Cap »), et en zoomant le label peint donne la forme courte (« Dabih »).
C'est cette inversion qui se lit comme une incohérence, plus encore que l'écart de position.

## La correction

**Un module unique possède le nommage et la mise en place.** À créer,
`src/ui/libelles-cibles.ts` :

- `libelleCible(cible: CibleEcran, fovDeg: number): string | null` — le texte à peindre pour
  cet élément à ce champ. `null` quand l'élément ne porte aucun nom (étoile brillante sans
  désignation) : il n'a pas de label, il n'a que sa fiche.
  - Étoile nommée : `nomPropre`, à tout champ — ou `designation` à défaut de nom propre. Un
    astre porte UN nom sur la scène, celui sous lequel on le cherche : « Dabih », pas
    « β Cap ». La désignation Bayer lève une ambiguïté, ce qu'un label n'a pas à faire ; elle
    reste à la fiche. §3.4 nomme « les étoiles de mag ≤ 3,5 portant une désignation Bayer »
    comme celles qui SONT éligibles au label (`etoileLabellisable`), pas comme le texte à
    peindre : le libellé ne dépend donc pas du champ, et `libelleCible` ne prend pas de
    `fovDeg`.
  - Objet : `designation`. Corps mobile : `cible.nom`.
- `titreCible(cible: CibleEcran): string` — la forme longue de la fiche, indépendante du
  champ. `decritCible` l'appelle au lieu de recomposer les siennes, et ne garde que `lignes`.
- `ancreLabel(cible: CibleEcran): { xPx: number; yPx: number }` — l'ancre du label de cet
  élément. Les décalages par type et les constantes de mise en page qu'ils utilisent
  (`HAUTEUR_LABEL_PX`, `MARQUEUR_OBJET_PX`, `RAYON_CORPS_PX`) déménagent ici ; `dessine-ciel.ts`
  les importe pour les labels qui restent chez lui (constellations, astérismes, Voie lactée).

**Les trois appelants passent par ce module.** Les boucles de `dessineCiel` construisent leurs
`CandidatLabel` avec `libelleCible` et `ancreLabel` ; la passe de survol appelle exactement les
mêmes deux fonctions au lieu de recopier `entree.survol.texte` et d'ajouter `RAYON_CLIC_PX`.

**`SurvolEcran` porte la cible, pas un texte déjà composé** — `{ readonly cible: CibleEcran }`.
`planetarium-gestes.ts` range le retour de `cibleSousLeCurseur` et cesse d'appeler `decritCible`
pour le survol ; la scène résout le texte au moment où elle peint, avec le champ courant. La
fraîcheur ne change pas : la cible vient déjà de l'image précédente, comme ses coordonnées
aujourd'hui, et le glisser remet `survol` à `null`.

Conséquence heureuse sur `labelSurvol` (`src/core/labels.ts:101`) : la détection du doublon
par préfixe devient une égalité exacte. La garder telle quelle — elle reste juste, et le
préfixe couvre encore le cas d'un libellé enrichi.

**Ce qui ne bouge pas.** `cible.nom` reste le nom brut de l'élément et cesse de servir au
dessin. La fiche garde sa forme longue, à tout champ : c'est un panneau, pas un label. La
branche de repli de `planetarium-selection.ts:52-63` et son message restent — une étoile sans
désignation n'a pas de label peint, donc rien à contredire, et le survol continue de la
nommer par son titre de fiche (`libelleCible` rend `null`, la passe retombe sur `titreCible`).
Le budget `LABELS_MAX`, l'anti-chevauchement et la priorité par magnitude sont intacts.

## Critères d'acceptation

- [ ] Pour tout label d'étoile, d'objet ou de corps retenu par `composeLabels`, il existe une
      cible dont `libelleCible(cible, fov)` rend exactement le texte du label et dont
      `ancreLabel` rend exactement sa position : la scène n'a plus qu'une source de texte et
      qu'une source d'ancre.
- [ ] Survoler un élément dont le label a été écarté (seuil de zoom, budget ou chevauchement)
      peint le même texte, au même point, que celui qu'il aurait porté peint — texte et
      coordonnées comparés caractère par caractère et pixel par pixel.
- [ ] Une étoile nommée porte son nom propre, le même à tout champ : « Dabih » au grand
      angle comme au zoom, jamais « β Cap » ni « Dabih — β Cap ». Sa fiche, elle, garde la
      forme longue. Aucun seuil de champ n'entre dans le texte d'un label.
- [ ] Une étoile nommée sans nom propre porte sa désignation — sans tiret orphelin, ni au
      label ni à la fiche.
- [ ] Le survol d'un élément dont le label est peint ne peint toujours rien (invariant T-0108).
- [ ] Une étoile brillante réellement sans désignation révèle encore son titre de repli au
      survol et ouvre encore sa fiche au clic (invariant T-0107).
- [ ] La règle de nommage n'est écrite qu'une fois : `grep -rn "nomPropre" src/ui/` ne la
      trouve que dans `libelles-cibles.ts`.
- [ ] Le nombre de labels retenus et la liste des cibles sont inchangés à champ égal — hors le
      texte des étoiles entre 10° et 40°, qui devient la désignation.
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée. Les cas de
      `tests/dessine-ciel.test.ts` (lignes 544-580 et 612-705) suivent la nouvelle forme de
      `SurvolEcran` sans perdre ce qu'ils verrouillent.

## Fichiers touchés

- `src/ui/libelles-cibles.ts` — à créer : nommage par champ, titre de fiche, ancres.
- `src/ui/dessine-ciel.ts` — labels et passe de survol alimentés par le module ; `SurvolEcran`.
- `src/ui/planetarium-selection.ts` — `decritCible` emprunte `titreCible`.
- `src/ui/planetarium-gestes.ts` — le survol range la cible, plus un texte.
- `src/ui/planetarium-boucle.ts`, `src/ui/Planetarium.tsx` — type de la référence de survol.
- `tests/dessine-ciel.test.ts` — cas d'acceptation, nouvelle forme du survol.

Inchangés : `src/core/labels.ts`, `src/registry/`, `public/data/`, `prd.md`.

## Écarté

- **Peindre la forme longue partout** (« Dabih — β Cap » comme label à tout champ). Cohérent,
  mais la largeur d'un label double et l'anti-chevauchement en écarte d'autant plus : §3.4
  gradue précisément pour éviter ça.
- **Graduer le texte par palier de zoom** (désignation Bayer entre 10° et 40°, forme longue
  en dessous). Essayé, puis retiré : le nom d'un astre changeait encore de forme au cran de
  zoom, ce qui est précisément ce que le signalement reproche. §3.4 gradue les CATÉGORIES
  admises, pas le vocabulaire d'un même élément.
- **Une catégorie de label par palier** (`ETOILE_BAYER`, `ETOILE_NOM`). Le palier est une
  question de texte, pas d'éligibilité : `categoriesActives` reste tel quel.
