---
{
  "status": "closed",
  "title": "Choisir sa cible parmi ce que le ciel offre",
  "opened": "2026-08-18",
  "closed": "2026-08-18",
  "commits": [
    {
      "sha": "6340349",
      "date": "2026-08-18",
      "files": [
        "src/App.tsx",
        "src/core/recherche-catalogue.ts",
        "src/core/visibles.ts",
        "src/ui/FicheCible.tsx",
        "src/ui/MenuReglages.tsx",
        "src/ui/styles.css",
        "tests/cible.test.tsx",
        "tests/coque.test.tsx",
        "tests/recherche-catalogue.test.ts",
        "tests/visibles.test.ts"
      ]
    }
  ]
}
---

# Choisir sa cible parmi ce que le ciel offre

## Contexte

L'onglet Cible se remplit aujourd'hui de trois façons (`src/ui/FicheCible.tsx:109-140`) :
saisie manuelle des six champs, clic sur un objet de la scène (`ouvreCible`,
`src/ui/seance-etat.ts:107`), ou choix dans un `<select>` alimenté par les **400 premières
entrées** du catalogue OpenNGC (`FicheCible.tsx:209-222`) — 400 entrées prises dans l'ordre du
binaire, sans rapport ni avec le lieu, ni avec l'heure, ni avec le matériel déclaré.

Résultat : rien dans l'interface ne répond à la question qu'on se pose réellement devant le
ciel — *avec ce setup, ce soir, qu'est-ce que je peux viser ?* Et une fois la cible choisie,
rien ne l'amène sous les yeux : il faut la retrouver à la main en glissant sur le planétarium.

Ce travail livre trois choses : une liste des cibles réellement au-dessus de l'horizon à
l'instant affiché et pour lesquelles le setup produit un verdict, un bouton qui centre la
cible choisie, et un tiroir de réglages en haut à droite où le choix brut dans le catalogue
est relogé — il ne disparaît pas, il quitte le chemin principal.

Décisions prises avec l'utilisateur :

- Le cadrage n'entre pas dans les critères : `ciblesDansFenetre` (`src/core/framing.ts:65`)
  n'est **pas** réutilisée ici. Un objet trop grand ou trop petit pour le capteur reste listé.
- Le critère est le verdict de détectabilité du setup (`detectabilite`,
  `src/core/detectability.ts:171`), au-dessus de l'horizon à 0°.
- « Voir » centre, et rien d'autre : ni zoom, ni rotation, ni horloge touchés.
- Le `<select>` « Choisir dans le catalogue » est relogé **tel quel** dans les réglages : on ne
  le transforme pas en choix de sous-catalogue (Messier / NGC / …).

## Ce qu'on écrit : un epic et quatre tickets

À créer dans `ovrsee/tickets/`, colonne `pret`, `"plan": null`. Prochain `id` libre : **T-0043**
(le maximum existant est T-0042).

### T-0043 — epic « Choisir sa cible parmi ce que le ciel offre »

`"type": "epic"`, priorité `haute`, tags `["ui", "cible", "planetarium"]`.

Contexte : celui ci-dessus, resserré. Critères d'acceptation :

- [ ] L'onglet Cible propose une liste des objets au-dessus de l'horizon à l'instant affiché,
      retenus sur le verdict de détectabilité du setup, sans filtre de cadrage.
- [ ] Un bouton amène la cible choisie au centre du planétarium sans changer le champ.
- [ ] Une roue crantée en haut à droite ouvre un tiroir de réglages.
- [ ] Le choix brut dans le catalogue vit dans ce tiroir, et nulle part ailleurs.
- [ ] Les quatre tickets enfants sont soldés.

### T-0044 — « Les cibles visibles, calculées pour ce setup »

Priorité `haute`, charge `s`, `"epic": "T-0043"`, tags `["core", "cible"]`.

Nouveau module **`src/core/visibles.ts`** (~70 lignes), pur, sans React :

```ts
export interface CibleVisible {
  readonly objet: ObjetCielProfond
  readonly azimutDeg: number
  readonly hauteurDeg: number
  readonly verdict: VerdictDetectabilite
}

export function ciblesVisibles(entree: {
  readonly catalogue: readonly ObjetCielProfond[]
  /** `cielInstantane(site, date).matrice` — J2000 → horizon. */
  readonly matriceCiel: Mat3
  readonly sbCiel: number
  readonly mLimOeil: number | null
  readonly dMm: number
}): readonly CibleVisible[]
```

Pour chaque objet du catalogue :

1. `versSpherique(applique(matriceCiel, versVecteur(o.adDeg, o.decDeg)))` donne
   `{ longitudeDeg: azimut, latitudeDeg: hauteur }` — même conversion que
   `src/ui/dessine-ciel.ts:355` prise dans l'autre sens, aucun moteur nouveau.
2. Écarté si `hauteurDeg <= 0`.
3. `detectabilite({ mInt: o.vMag, aArcmin: o.majAxArcmin, bArcmin: o.minAxArcmin,
   typeObjet: o.type, sbCiel, mLimOeil, dMm })` — écarté si `verdict === null`, c'est-à-dire
   quand le catalogue ne porte ni magnitude ni dimensions et qu'aucun verdict n'est calculable
   (`detectability.ts:176-192`). C'est le seul motif d'exclusion en dehors de l'horizon :
   `PHOTO_SEULE` est un verdict, pas un refus.
4. Tri par magnitude croissante, les objets sans magnitude ne pouvant pas arriver ici.

Critères d'acceptation :

- [ ] Un objet sous l'horizon à l'instant donné n'est pas dans la liste.
- [ ] Un objet sans magnitude ou sans dimensions n'est pas dans la liste.
- [ ] Un objet dont le verdict est `PHOTO_SEULE` **est** dans la liste.
- [ ] Un objet trop grand ou trop petit pour le capteur déclaré est dans la liste : le cadrage
      n'entre pas dans le filtre.
- [ ] La liste est triée du plus brillant au plus faible.
- [ ] `tests/visibles.test.ts` couvre ces cinq points sur un catalogue forgé de quelques objets.

### T-0045 — « La cible se choisit dans la liste des visibles »

Priorité `haute`, charge `m`, `"epic": "T-0043"`, tags `["ui", "cible"]`.

Dans `src/ui/FicheCible.tsx` :

- Nouvelles props : `site: Site` et `sbCiel` (déjà présent), `mLimOeil` (déjà présent).
  `dMm` vient de `props.optique.dMm.value`.
- Le composant lit `msAffiche` du magasin de scène (`useScene()`, `src/ui/scene-etat.ts:240`).
- `useMemo` sur `ciblesVisibles(…)`, **clé quantifiée à la minute** :
  `Math.floor(msAffiche / 60000)`. `msAffiche` est publié deux fois par seconde
  (`scene-etat.ts:222`) et le catalogue compte ~14 000 entrées : recalculer à chaque
  publication mettrait 28 000 appels à `detectabilite` par seconde dans le fil de rendu. Une
  minute de granularité ne change pas quel objet est au-dessus de l'horizon.
- Un `<select>` « Cibles visibles » sous le champ Désignation, groupé par
  `<optgroup>` sur le verdict (`Œil nu` / `Jumelles` / `Télescope` / `Photo seule`) : le
  groupe dit ce que le setup en fera, sans texte supplémentaire. Chaque option affiche
  désignation, premier nom commun, magnitude et hauteur.
- Plafonné à une constante nommée dans le module (`CIBLES_LISTEES_MAX = 200`), avec une ligne
  `.etat` qui annonce le compte réel : « 1 842 cibles au-dessus de l'horizon, les 200 plus
  brillantes listées ». Un plafond muet mentirait sur le ciel.
  Commentaire `ponytail:` sur le plafond, chemin de sortie nommé : `<input list>` +
  `<datalist>` si la liste doit devenir cherchable.
- Le choix appelle `appliqueObjet` (`FicheCible.tsx:122`), déjà écrit — rien à ajouter.

Critères d'acceptation :

- [ ] L'onglet Cible porte un `<select>` de cibles visibles, groupé par verdict.
- [ ] Choisir une entrée remplit les six champs de la fiche, comme un clic sur la scène.
- [ ] Le compte réel de cibles au-dessus de l'horizon est affiché, plafond compris.
- [ ] La liste ne se recalcule pas plus d'une fois par minute d'horloge affichée.
- [ ] Un test dans `tests/cible.test.tsx` constate qu'un objet du catalogue sous l'horizon
      n'apparaît pas dans le `<select>` et qu'un objet au-dessus y apparaît.

### T-0046 — « Un bouton “Voir” amène la cible au centre »

Priorité `moyenne`, charge `s`, `"epic": "T-0043"`, tags `["ui", "cible", "planetarium"]`.

Bouton à côté du `<select>` de T-0045. Il retrouve la `CibleVisible` choisie dans la liste déjà
calculée — l'azimut et la hauteur y sont — et appelle
`majVue({ azimutDeg, hauteurDeg })` (`src/ui/scene-etat.ts:202`). Même geste que le bouton
« Appliquer » de la rotation suggérée (`src/ui/MenuInfos.tsx:166-174`), qui est déjà le patron
d'un bouton de panneau qui recadre la scène.

Ni `fovDeg`, ni `rotationDeg`, ni l'horloge ne sont touchés.

Critères d'acceptation :

- [ ] Un bouton « Voir » est présent tant qu'une cible visible est choisie, absent sinon.
- [ ] Après le clic, `azimutDeg` et `hauteurDeg` de la scène sont ceux de l'objet à l'instant
      affiché, à moins d'un degré.
- [ ] `fovDeg` et `rotationDeg` sont inchangés après le clic.
- [ ] Un test dans `tests/cible.test.tsx` ou `tests/scene-etat.test.ts` le constate sur le
      magasin de scène.

### T-0047 — « Une roue crantée de réglages en haut à droite »

Priorité `moyenne`, charge `s`, `"epic": "T-0043"`, tags `["ui", "coque"]`.

Nouveau **`src/ui/MenuReglages.tsx`**, sur le patron exact de `src/ui/MenuInfos.tsx` :
`<details className="tiroir tiroir-reglages">`, `<summary>⚙ Réglages</summary>`, fermeture à
Échap. Monté dans `topbar` (`src/App.tsx:398-436`) **avant** `MenuInfos`, qui reste le dernier
élément — donc le plus à droite, comme son commentaire l'annonce.

Le tiroir reçoit `catalogue` et porte le `<select>` « Choisir dans le catalogue » retiré de
`FicheCible.tsx:209-222`, **inchangé** : mêmes 400 entrées, même libellé. Il appelle
`ouvreCible(objet)` (`src/ui/seance-etat.ts:107`) au lieu de l'ancien `choisitDansCatalogue`
local : `ouvreCible` garnit la fiche *et* bascule sur l'onglet Cible, ce qui est exactement le
geste attendu depuis la barre haute. Aucun câblage nouveau — c'est le chemin que le clic sur la
scène emprunte déjà.

`src/ui/styles.css` : une règle `.tiroir-reglages` à côté de `.tiroir-infos` (ligne 190 et
270) si la largeur du tiroir le demande ; sinon rien, `.tiroir` suffit.

Critères d'acceptation :

- [ ] Une roue crantée est visible dans la barre haute, à droite, avant le menu des lectures.
- [ ] Le tiroir fermé ne prend aucune hauteur ; ouvert, il se superpose à la scène.
- [ ] Échap le referme.
- [ ] Le choix dans le catalogue s'y trouve, à l'identique, et n'est plus dans l'onglet Cible.
- [ ] Y choisir un objet garnit la fiche et amène l'onglet Cible au premier plan.
- [ ] La cible ≥ 44 px de §11.2 est respectée sur le bouton du tiroir.
- [ ] `tests/coque.test.tsx` constate la présence du tiroir dans la barre haute et l'absence du
      select catalogue dans l'onglet Cible.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/core/visibles.ts` | nouveau — le seul calcul ajouté |
| `src/ui/FicheCible.tsx` | select des visibles + bouton Voir ; retrait du select catalogue |
| `src/ui/MenuReglages.tsx` | nouveau — tiroir de la barre haute |
| `src/App.tsx` | montage du tiroir dans `topbar`, props `site` à `FicheCible` |
| `src/ui/styles.css` | `.tiroir-reglages`, si besoin |
| `tests/visibles.test.ts` | nouveau |
| `tests/cible.test.tsx`, `tests/coque.test.tsx` | complétés |

Aucun fichier de `src/registry/`, `src/data/`, ni aucun moteur existant de `src/core/` n'est
modifié : `detectabilite`, `cielInstantane`, `majVue` et `ouvreCible` sont appelés tels quels.

## Vérification

1. `pnpm typecheck && pnpm test` — vert, dont les trois fichiers de test touchés.
2. `pnpm build` — vert.
3. À l'écran (`pnpm dev`) : onglet Cible, la liste des visibles est non vide pour le site par
   défaut ; le compte annoncé correspond ; choisir une cible remplit la fiche ; « Voir »
   l'amène au centre du canevas et le champ ne bouge pas.
4. Passer le curseur temporel de douze heures (onglet Explorer, pas astronomique) : la liste
   change de contenu.
5. Roue crantée : elle s'ouvre, se ferme à Échap, le choix dans le catalogue y bascule bien sur
   l'onglet Cible, et l'onglet Cible ne porte plus ce select.
