---
{
  "status": "closed",
  "title": "Masquer le ciel sous l'horizon — couche « Sol »",
  "opened": "2026-08-21",
  "closed": "2026-08-21",
  "commits": [
    {
      "sha": "521ff95",
      "date": "2026-08-21",
      "files": [
        "src/core/projection.ts",
        "src/registry/constants.ts",
        "tests/projection.test.ts"
      ]
    },
    {
      "sha": "b9a9957",
      "date": "2026-08-21",
      "files": [
        "src/ui/dessine-champ.ts"
      ]
    },
    {
      "sha": "98196d9",
      "date": "2026-08-21",
      "files": [
        "scripts/bench-ciel.ts",
        "src/App.tsx",
        "src/core/sol.ts",
        "src/ui/PanneauExplorer.tsx",
        "src/ui/Planetarium.tsx",
        "src/ui/RegionSeance.tsx",
        "src/ui/couleurs.ts",
        "src/ui/dessine-ciel.ts",
        "src/ui/dessine-sol.ts",
        "src/ui/planetarium-boucle.ts",
        "src/ui/scene-etat.ts",
        "tests/dessine-ciel.test.ts",
        "tests/scene-etat.test.ts",
        "tests/sol.test.ts"
      ]
    },
    {
      "sha": "c1335df",
      "date": "2026-08-21",
      "files": []
    },
    {
      "sha": "a11933c",
      "date": "2026-08-21",
      "files": []
    }
  ]
}
---

# Masquer le ciel sous l'horizon — couche « Sol »

## Contexte

Le planétarium dessine la sphère entière : étoiles, figures, frontières, bande de la Voie
lactée et corps mobiles sont tracés même quand ils sont **sous l'horizon**, où rien n'est
observable. Le seul repère du sol est aujourd'hui le cercle d'horizon (`traceHorizon`,
`src/ui/dessine-ciel.ts:246`) — une ligne, pas un masque. Résultat : la scène ne ressemble pas
à ce qu'on voit dehors, et un clic sur la moitié basse sélectionne des objets invisibles depuis
le site.

Objectif : une couche « Sol » qui masque tout ce qui est sous l'horizon, cochable dans le
panneau Couches (onglet Explorer), **activée par défaut**. Le site dispose déjà d'un masque de
relief relevé à la main (`MasqueHorizon`, `src/core/site.ts:49`) : le sol suit ce relief quand
il existe, l'horizon plat à 0° servant de repli déclaré `[HYP]` (§4.1).

## Approche : filtrer la projection, pas peindre un polygone

Le fond de ciel est déjà noir (`PALETTE_JOUR.fond = '#05070d'`, `couleurs.ts:103`). Un « masque
noir » n'a donc pas besoin d'être peint : il suffit que **rien ne soit projeté sous l'horizon**.

Tous les tracés de la scène — polylignes, segments, boucle chaude des étoiles, marqueurs,
labels, contour du cadre — passent par `Projecteur.projetteEn` / `projette`
(`src/core/projection.ts:116`), qui répond déjà `false` pour une direction non projetable, et
que chaque appelant sait traiter (`cheminLignes` rompt la polyligne, les boucles font
`continue`). On décore donc le projecteur : sous le sol, la direction devient non projetable.
Un seul point d'insertion, zéro modification des passes de rendu, et les cibles de clic
disparaissent avec les objets puisqu'elles sont poussées après la projection.

## Fichiers

### 1. `src/core/sol.ts` — nouveau (~40 lignes)

```ts
/** Direction J2000 sous le sol du site : relief relevé compris (§4.1). */
export function sousLeSol(masque: MasqueHorizon, matriceCiel: Mat3): (x, y, z) => boolean
/** Le même projecteur, aveugle à ce qui est sous le sol (§3.3 — un seul code de projection). */
export function projecteurSansSol(base: Projecteur, masque: MasqueHorizon, matriceCiel: Mat3): Projecteur
```

- `sousLeSol` inline les trois produits scalaires de `matriceCiel` (J2000 → repère horizontal)
  puis `hauteur = asin(z)`, `azimut = atan2(y, x)` — soit ce que
  `versSpherique(applique(matriceCiel, v))` calcule, **sans allouer** (T-0065 : la boucle par
  étoile l'appelle des milliers de fois par image). Comparaison à
  `obstructionDeg(masque, azimut)` (`src/core/site.ts:143`), réutilisé tel quel.
  Vérifier à l'implémentation la convention de `versVecteur`/`versSpherique` (`src/core/mat3.ts`)
  pour l'ordre des lignes : un test compare la valeur inline à `versSpherique(applique(...))`.
- `projecteurSansSol` retourne `{ ...base, projetteEn, projette }` : `false` / `null` sous le
  sol, délégation sinon. `inverse`, `vue`, `echelle`, `matrice` inchangés.
- Strictement inférieur : un objet exactement à la hauteur du sol reste visible, le cercle
  d'horizon d'un masque plat n'est donc pas effacé par lui-même.

### 2. `src/ui/dessine-ciel.ts`

- `CouchesActives` (ligne 46) : `readonly sol: boolean`.
- `EntreeDessin` (ligne 82) : `readonly masque: MasqueHorizon`.
- `dessineCiel` (ligne 392) : renommer le paramètre en `entreeBrute`, puis
  ```ts
  const brut = entreeBrute.projecteur
  const entree = entreeBrute.couches.sol
    ? { ...entreeBrute, projecteur: projecteurSansSol(brut, entreeBrute.masque, entreeBrute.matriceCiel) }
    : entreeBrute
  ```
  Tout le corps existant hérite du filtre sans autre retouche.
- `traceHorizon` (ligne 246) : prend le projecteur **brut** en paramètre — c'est un repère de
  lecture, il ne se masque pas lui-même. Il gagne un second tracé quand
  `!masque.estHypothese` : la silhouette du relief, mêmes azimuts (`PAS_AZIMUT_DEG = 3`),
  hauteur `obstructionDeg(masque, az)`. Sans elle, avec un relief relevé, le bord du sol est
  implicite et le cercle à 0° passe sous le sol sans l'expliquer.
- L'aperçu incrusté du filé (`surLeFond`, ligne 403) n'est pas filtré : il est peint à même le
  contexte, hors projecteur. Il reste découpé sur le cadre matériel ; viser sous l'horizon avec
  un filé incrusté laisse donc l'aperçu visible. Commentaire `ponytail:` sur place, à traiter si
  ça se voit à l'usage.

### 3. Câblage du masque du site jusqu'à la scène (4 lignes, une par fichier)

- `src/ui/planetarium-boucle.ts` : `EtatBoucle.masque: MasqueHorizon` (ligne 49) + `masque:
  courant.masque` dans l'appel à `dessineCiel` (ligne 151).
- `src/ui/Planetarium.tsx` : `PlanetariumProps.masque` (ligne 61) + report dans `etatBoucle.current`
  (ligne 167).
- `src/App.tsx` : `masque={chaine.masque}` sur `<Planetarium>` (ligne 160) — `chaine.masque`
  existe déjà (`src/ui/app-calcul.ts:251`), c'est celui que la persistance enregistre.

### 4. Réglage

- `src/ui/scene-etat.ts` : `sol: true` dans `ETAT_INITIAL.rendu.couches` (ligne 177).
- `src/ui/PanneauExplorer.tsx` : entrée `['sol', 'Sol opaque — masque sous l\'horizon']` dans
  `COUCHES` (ligne 44). La case et sa persistance d'état viennent gratuitement de la boucle
  `COUCHES.map` existante (ligne 129).
- Même fichier, discipline §4.1 : quand `couches.sol` est actif et que le masque est le repli
  plat, une note `<p className="etat">` annonce l'hypothèse (« horizon plat supposé, relief non
  relevé — à compléter au panneau Lieu »), sur le modèle de `RAPPEL_ASTERISME` (ligne 144).
  Demande un booléen `masqueEstHypothese` passé par `src/ui/RegionSeance.tsx:41` depuis `App.tsx`.

## Tests

- `tests/sol.test.ts` (nouveau) : `sousLeSol` — étoile au zénith visible, étoile au nadir
  masquée ; avec un masque relevé, une direction à 5° de hauteur dans un azimut obstrué à 10°
  est masquée, la même dans un azimut plat ne l'est pas ; enroulement de l'azimut (359,7° →
  index 0) ; accord avec `versSpherique(applique(matriceCiel, v))`. `projecteurSansSol` —
  `projetteEn` répond `false` sous le sol et délègue à l'identique au-dessus.
  Aucune coordonnée écrite en dur : les directions se construisent avec `versVecteur` dans le
  repère horizontal puis se transposent en J2000.
- `tests/dessine-ciel.test.ts` : ajouter `sol: false` à la constante `COUCHES` (ligne 122) et
  `masque: masquePlat()` à l'entrée de test ; un cas `sol: true` vérifie qu'une étoile placée
  sous l'horizon n'apparaît ni dans `cibles` ni dans les arcs du `Path2DEspion`, et qu'elle y
  est avec `sol: false`.
- Vérifier les autres constructions d'`EntreeDessin` que le typecheck signalera (`masque`
  obligatoire) — `tests/cadre.test.ts`, `tests/zoom-planetarium.test.ts` notamment.

## Vérification

1. `pnpm typecheck && pnpm test` — rapporter la sortie réelle.
2. `pnpm dev`, onglet Explorer : « Sol opaque » coché par défaut ; la moitié basse de la scène
   est vide, le cercle d'horizon et les points cardinaux restent visibles, décocher rétablit le
   ciel complet.
3. Viser le zénith puis le nadir (glisser vertical) : aucun artefact au passage, le filtre ne
   dépend d'aucun point singulier de la projection.
4. Cliquer dans la zone masquée : aucune sélection (les cibles ont disparu avec les tracés).
5. Relever deux ou trois points de masque au panneau Lieu : la silhouette du relief apparaît et
   les étoiles s'arrêtent dessus ; la note `[HYP]` disparaît.
6. Compteur d'images du menu d'information : le surcoût est d'un produit scalaire et d'un
   `atan2` par point candidat, il doit rester invisible sous le plafond de 30 im/s.
