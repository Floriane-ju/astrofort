---
{
  "status": "open",
  "title": "Tickets — coût du filé incrusté dans le cadre",
  "opened": "2026-08-15",
  "closed": null,
  "commits": []
}
---

# Tickets — coût du filé incrusté dans le cadre

## Contexte

En mode filé avec incrustation dans le cadre, l'application rame. La demande :
créer les tickets. Ce plan ne change **aucun** code de rendu — il ne produit que
des fichiers `ovrsee/tickets/*.md`.

La lecture du code confirme l'intuition de départ (trop d'étoiles calculées) et
en désigne la cause exacte. Le rendu hors écran (`rendIncrustation`,
`src/ui/scene-overlay.ts:84`) appelle `dessineChamp`
(`src/ui/dessine-champ.ts:227`) avec le **`Vue` de la scène** — plein canevas —
alors que seule la portion sous le cadre est visible : `incrusteDansLeCadre`
(`scene-overlay.ts:113`) dépose l'image sous `ctx.clip()` du contour du cadre et
jette le reste. Quatre coûts s'additionnent :

1. **L'arc est calculé avant le tri par opacité.** Dans `dessineCouche`
   (`dessine-champ.ts:162`), `arcEtoile` est appelé ligne 165, puis
   `magnitudeLimitePrevisu` / `opaciteEtoile` lignes 171-182 rejettent l'étoile
   sous `OPACITE_MIN`. Les étoiles rejetées ont payé l'arc entier.
2. **Le champ sélectionné est celui de la scène, pas celui du cadre.**
   `rayonChampDeg` (`dessine-champ.ts:155`) vient de `projecteur.vue.fovDeg` — la
   scène. Le cadre couvre typiquement une fraction de cette surface ; tout le
   reste est calculé puis clippé.
3. **Le pas d'arc est fixe en angle horaire.** `arcEtoile`
   (`src/core/file-etoiles.ts:148`) : `pas = ceil(balayageDeg / 0,25°)`. À 480 min
   (maximum du curseur, `PanneauFile.tsx:353`), le balayage vaut 120° → **481
   projections par étoile**, y compris pour une étoile proche du pôle dont l'arc
   fait dix pixels.
4. **Le rendu se refait pendant le geste.** L'effet `Planetarium.tsx:278` a
   `azimutDeg` / `hauteurDeg` / `fovDeg` en dépendances, et le panoramique les
   réécrit à chaque `pointermove` (`Planetarium.tsx:484`). Idem pour le curseur de
   durée, à chaque cran de 5 min. Chaque geste déclenche une passe complète,
   synchrone, sur le fil principal.

Ordre de grandeur : catalogue réel (~15 000 étoiles) plus semis génératif
plafonné à `SEMIS_ETOILES_TOTAL` = 300 000 sur la sphère, sélectionnés sur le
champ de la scène, chacun × jusqu'à 481 pas. Le compte se fait en millions de
projections par image — et par mouvement de souris.

## Ce qui est produit

Un epic et cinq enfants, dans `ovrsee/tickets/`. Prochain `id` libre : **T-0021**
(max existant T-0020). Colonnes lues dans `ovrsee/board.json` : `backlog`,
`a-specifier`, `pret`, `en-cours`, `revue`, `fait`. Frontmatter JSON, `cree` /
`maj` = `2026-08-15`, `plan` = `null` (ces tickets ne naissent pas d'un plan
ovrsee capturé).

| id | titre | colonne | prio | charge |
|---|---|---|---|---|
| T-0021 | Coût du filé incrusté : une image, pas une seconde (epic) | `pret` | haute | — |
| T-0022 | Trier l'étoile avant de calculer son arc | `pret` | haute | s |
| T-0023 | Ne calculer que ce que le cadre montre | `pret` | haute | m |
| T-0024 | Pas d'échantillonnage d'arc adaptatif, en pixels | `pret` | moyenne | m |
| T-0025 | Ne rien recalculer pendant le geste | `pret` | haute | s |
| T-0026 | Plafond d'étoiles incrustées, déclaré à l'écran | `a-specifier` | basse | s |

Enfants : `"epic": "T-0021"`. T-0026 part en « À spécifier » parce que son seuil
n'est pas connu tant que T-0021 n'a pas chiffré le coût — et un ticket sans
critère constatable n'est pas mûr.

### Contenu des tickets

**T-0021 — epic.** Porte la mesure : sans chiffre avant/après, aucun des cinq
autres ne peut se dire fini. Critères : coût d'une passe `rendIncrustation`
chiffré au pire cas (480 min, semis actif, champ large) avant travaux ; même
mesure après ; le compteur d'images du ciel ne chute pas quand l'incrustation est
active ; panoramique et curseur de durée restent fluides. Cite l'ordre
recommandé : T-0025 (le geste) et T-0022 (le tri) d'abord — plus gros gain, plus
petit diff —, puis T-0023, puis T-0024.

**T-0022.** Déplacer le calcul de `profondeurTrace` / `opaciteEtoile` **avant**
`arcEtoile` dans `dessineCouche`. Le seul point délicat : `poseParPixelS` prend
la déclinaison, obtenue de `z` — disponible sans l'arc. Critère : aucune étoile
sous `OPACITE_MIN` ne provoque d'appel à `arcEtoile`, et l'image produite est
identique pixel pour pixel à celle d'avant.

**T-0023.** Restreindre la sélection au champ du **cadre**, pas à celui de la
scène. Le cadre est déjà décrit par `Cadre` (`src/core/cadre.ts`) et son contour
par `cheminCadre` (`dessine-ciel.ts`) ; `contourCadreJ2000` donne la direction et
l'étendue sans réécrire de projection (§3.3 interdit un second code de
projection). Deux honnêtetés à tenir : l'image hors écran reste à la définition
de la scène et dans le repère de la scène — c'est ce partage qui fait tomber les
arcs sur les bonnes étoiles (cf. T-0019) — donc on restreint la **sélection**, pas
le canevas ; et la marge de sélection doit couvrir la longueur d'arc, sinon une
étoile hors cadre dont la trace y entre disparaît. Critère : le contenu du cadre
est inchangé à l'œil, la marge est explicite, le nombre d'étoiles visitées chute
d'un facteur constatable.

**T-0024.** Remplacer le pas fixe en angle horaire par un pas dérivé de la
longueur d'arc projetée, en pixels, borné par `PAS_ANGLE_HORAIRE_FILE_DEG` (§9.3
plafonne le pas, il n'en impose pas un plancher). Précédent dans le dépôt :
`file-etoiles.ts:79` module déjà une fraction par la distance au centre. Critère :
une étoile près du pôle ne coûte plus 481 pas ; la conique reste suivie — l'écart
entre polyligne et arc exact reste sous le pixel, y compris pour l'arc le plus
long du cadre.

**T-0025.** Ne pas relancer `rendIncrustation` pendant un geste continu.
Rendu différé jusqu'à la fin du panoramique / du glissement de curseur ; le cadre
peut montrer l'image précédente entre-temps. Critère : un panoramique complet ne
déclenche qu'un seul rendu hors écran, le curseur de durée aussi ; l'image
affichée n'est jamais périmée une fois le geste terminé.

**T-0026.** Un plafond d'étoiles incrustées, **déclaré à l'écran** comme
`MENTION_SEMIS` le fait déjà pour `SEMIS_ETOILES_TOTAL` (`src/data/semis.ts`) —
jamais un plafond silencieux. Reste à spécifier : la valeur, et le critère de
tri (les plus brillantes ? une décimation qui préserve la densité ?). Question
ouverte notée dans le ticket. À ne trancher qu'après la mesure de T-0021 : si
T-0022 à T-0025 suffisent, ce ticket meurt sans être fait.

## Vérification

Aucun code applicatif n'étant touché, la vérification porte sur les tickets :

1. `ls ovrsee/tickets/` — six nouveaux fichiers, `T-0021` à `T-0026`, aucun `id`
   repris, nom de fichier = `T-00NN-<slug du titre>.md`.
2. Frontmatter JSON valide sur chacun :
   `for f in ovrsee/tickets/T-002*.md; do sed -n '2,/^---$/p' "$f" | sed '$d' | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))' || echo "KO $f"; done`
3. Chaque `colonne` existe dans `ovrsee/board.json` ; les cinq enfants portent
   `"epic": "T-0021"`.
4. Chaque ticket a un `## Contexte` et des `## Critères d'acceptation` cochables —
   pas un titre déguisé en tâche.
5. `git status` : uniquement des ajouts sous `ovrsee/tickets/`, aucun fichier de
   `src/` modifié.
