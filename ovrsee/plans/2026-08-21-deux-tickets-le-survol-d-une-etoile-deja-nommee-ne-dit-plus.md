---
{
  "status": "open",
  "title": "Deux tickets — le survol d'une étoile déjà nommée ne dit plus qu'elle est sans désignation",
  "opened": "2026-08-21",
  "closed": null,
  "commits": [
    {
      "sha": "0f42361",
      "date": "2026-08-22",
      "files": [
        "src/ui/dessine-ciel.ts",
        "tests/dessine-ciel.test.ts"
      ]
    }
  ]
}
---

# Deux tickets — le survol d'une étoile déjà nommée ne dit plus qu'elle est sans désignation

## Contexte

Au survol de certaines étoiles du planétarium, une seconde ligne apparaît sous le nom déjà
affiché : « Étoile sans désignation dans le paquet chargé » — Cebalrai en porte la capture.
C'est contradictoire : l'étoile est nommée à l'écran, et le survol affirme le contraire.
L'attente est simple — une étoile dont le label est déjà peint ne doit rien changer au survol.

L'investigation ferme le diagnostic. La correction et son verrou de non-régression sont
découpés en deux tickets, `T-0107` et `T-0108`, tous deux en colonne `pret`.

## Ce que l'investigation a établi

**Chaque étoile brillante est poussée deux fois dans `cibles`.**

- `src/ui/dessine-ciel.ts:612-615` — passe des étoiles du catalogue : tout astre de
  `magV ≤ K('MAG_LABEL_BAYER_MAX')` devient une cible `ETOILE` portant `etoile`, sans
  désignation.
- `src/ui/dessine-ciel.ts:630-636` — passe des étoiles nommées : la même étoile redevient une
  cible `ETOILE`, portant cette fois `etoileNommee`.

**Le doublon anonyme gagne une fois sur deux.** Les deux entrées ne tombent pas exactement au
même sous-pixel : `constellations-1.bin` conserve la position en double précision, `hyg-1.bin`
l'encode en `Float32`. Mesuré sur β Oph — `265.868145°` contre `265.8681335°`, soit **0,041″**,
de l'ordre de 1e-4 pixel à tout champ réaliste. `cibleSousLeCurseur`
(`src/ui/dessine-ciel.ts:811-817`) retient la plus proche du curseur : selon le côté où le
pointeur se trouve, c'est l'anonyme ou la nommée. D'où « sur certaines étoiles ».

**Le garde-fou existant ne rattrape pas ce cas.** `labelSurvol` (`src/core/labels.ts:101`) tait
le survol quand son titre commence par un label déjà retenu. Résolu sur la nommée, le titre
aurait été « Cebalrai — β Oph » et rien n'aurait été peint. Résolu sur l'anonyme, le titre est
« Étoile sans désignation dans le paquet chargé », qui ne commence par aucun label : il est
peint sous le nom.

**La branche de repli reste nécessaire.** Comptage des paquets versionnés : 291 étoiles
`magV ≤ 3,5` dans `hyg-1.bin`, 284 entrées correspondantes dans `constellations-1.bin`.
**286 des 291 cibles anonymes sont des doublons** ; 5 étoiles seulement — toutes australes,
magnitudes 3,16 à 3,43 — n'ont ni Bayer, ni Flamsteed, ni nom propre et méritent vraiment le
message de repli. Supprimer la branche les rendrait injoignables : il faut dédoublonner, pas
amputer.

## T-0107 — Une étoile nommée n'apparaît qu'une fois parmi les cibles

Colonne `pret`, priorité `haute`, charge `s`, tags `["planetarium", "rendu", "interaction"]`.

**Correction.** Dans `src/ui/dessine-ciel.ts`, ne pas émettre de cible anonyme pour une étoile
qu'une cible nommée occupe déjà au même pixel.

- Les cibles nommées se construisent sans rien peindre (les disques sortent du `fill` des
  `Path2D` en `dessine-ciel.ts:618-621`, les labels au `composeLabels` de la ligne 770) : la
  boucle des étoiles nommées peut donc précéder l'appel à `selectionne`, ou bien les entrées
  anonymes s'accumuler dans un tableau intermédiaire filtré après elle. Le second découpage
  donne le plus petit diff.
- Clé de comparaison : le **pixel entier** (`Math.round(xPx)`, `Math.round(yPx)`) dans un `Set`,
  interrogé sur le voisinage 3×3 pour qu'un arrondi à cheval sur une frontière ne rate pas le
  doublon. Aucune tolérance nouvelle au registre : deux entrées qui tombent sur le même pixel
  sont indiscernables au pointeur, et c'est l'identifiée qui doit répondre.
- Coût par image négligeable : au plus 291 étoiles concernées dans tout le ciel, neuf lectures
  de `Set` chacune.

**Ne pas** toucher à `cibleSousLeCurseur` : la règle « la plus proche » reste juste une fois le
doublon retiré. **Ne pas** supprimer la branche de repli de `src/ui/planetarium-selection.ts:52-63`.

**Critères d'acceptation.**

- Aucune étoile n'apparaît deux fois dans `cibles` : pour toute cible portant `etoileNommee`,
  aucune cible anonyme ne partage son pixel.
- Le survol d'une étoile nommée résout toujours `etoileNommee`, quel que soit le côté du
  curseur — vérifié en visant plusieurs points autour de la même étoile.
- Le clic sur les 5 étoiles brillantes sans désignation continue d'ouvrir la fiche de repli
  avec magnitude et indice B−V.
- Le nombre d'étoiles dessinées et les labels retenus sont inchangés : seule la liste des cibles
  perd ses doublons.

## T-0108 — Une étoile déjà nommée à l'écran ne se laisse rien peindre au survol

Colonne `pret`, priorité `moyenne`, charge `xs`, tags `["planetarium", "tests", "interaction"]`.

Verrou de non-régression sur l'invariant que T-0085 énonce déjà en commentaire mais que rien ne
vérifie de bout en bout : le survol ne sert qu'à révéler un nom **masqué**. Si le label est
peint, le survol ne produit rien.

`tests/dessine-ciel.test.ts` porte déjà le harnais `rend()` et couvre `cibles` et `survol`
(lignes 528-536 et 544-575) : les cas s'y ajoutent, sans fichier nouveau.

**Critères d'acceptation.**

- Un test rend un champ contenant une étoile nommée labellisée, appelle `cibleSousLeCurseur` sur
  plusieurs points autour de son pixel, et vérifie que `decritCible` ne rend jamais le titre de
  repli — c'est la chaîne complète survol → titre, pas seulement le dédoublonnage.
- Un test vérifie que pour toute étoile dont le label est retenu par `composeLabels`, le survol
  au même point rend `revele === null`.
- Un test garde le contre-exemple vivant : une étoile brillante réellement sans désignation
  révèle bien son titre de repli au survol. Sans lui, T-0107 pourrait être « corrigé » en
  supprimant la branche.
- Les positions et magnitudes des tests viennent des paquets chargés ou du harnais existant,
  jamais d'une éphéméride recopiée.

## Fichiers touchés

- `ovrsee/tickets/T-0107-*.md`, `ovrsee/tickets/T-0108-*.md` — à créer, frontmatter JSON entre
  `---`, sections `## Contexte` puis `## Critères d'acceptation`, comme `T-0106`.
- `src/ui/dessine-ciel.ts` — dédoublonnage (T-0107).
- `tests/dessine-ciel.test.ts` — cas d'acceptation (T-0108).

Inchangés : `src/core/labels.ts`, `src/ui/planetarium-selection.ts`, `src/ui/planetarium-gestes.ts`,
`src/registry/`, `public/data/`.

## Vérification

1. `pnpm typecheck && pnpm test` — rapporter la sortie réelle.
2. `pnpm test dessine-ciel` pour le sous-ensemble pendant l'itération.
3. `pnpm dev`, viser Ophiuchus à un champ où Cebalrai porte son label, promener le curseur
   autour de l'étoile : aucune seconde ligne n'apparaît, quel que soit le côté d'approche.
4. Viser l'une des 5 étoiles sans désignation (Carène / Centaure, ~α 137-158°, δ ≈ −57 à −62°) :
   le survol et le clic donnent toujours le message de repli.

## Écarté

Un troisième ticket sur `MAG_ETOILES_NOMMEES = 3.5` écrit en dur dans
`scripts/build-catalogs.ts:673`, qui double `K('MAG_LABEL_BAYER_MAX')` — c'est ce qui garantit
le recouvrement des deux paquets, et rien ne le lie au registre. À rouvrir si les deux valeurs
divergent un jour.
