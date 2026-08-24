---
{
  "id": "T-0119",
  "titre": "Le filé plafonne la surface peinte, pas le nombre d'étoiles",
  "colonne": "pret",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0114",
  "tags": [
    "performance",
    "file",
    "planetarium",
    "lisibilite"
  ],
  "cree": "2026-08-24",
  "maj": "2026-08-24",
  "plan": "2026-08-24-le-file-plafonne-la-surface-peinte-pas-le-nombre-d-etoiles.md"
}
---

## Contexte

En filé « durée totale », la scène est une nappe blanche : la longueur des traces ne se lit plus,
le fond de ciel et la bande galactique disparaissent dessous, et l'interface saccade. Mesuré par
instrumentation de `dessineChamp` (surface peinte = somme des portions visibles × largeur de
trait, rapportée au canevas 1920×1080) :

| champ / durée | traces peintes | surface peinte |
|---|---|---|
| 180° / 480 min | 10 640 | **535 %** |
| 180° / 120 min | 10 324 | **180 %** |
| 120° / 120 min | 5 219 | **140 %** |
| 60° / 120 min | 1 597 | 69 % |

Au-delà de 100 %, chaque pixel est repeint plusieurs fois : la trace n'a plus de longueur lisible.

**T-0118 plafonne la mauvaise grandeur.** Il borne le nombre d'étoiles *lues*
(`BUDGET_ETOILES_FILE` = 1 500), et seulement la couche du semis. Or la surface peinte vaut
`nombre × longueur × largeur` : elle croît avec la durée et avec le champ. À 480 min, 1 500 traces
couvrent déjà 5× le canevas.

**Et sa prémisse est fausse.** T-0118 écrit « le catalogue réel n'est pas plafonné… environ
15 000 étoiles sur toute la sphère ». `public/data/hyg-1.bin` en contient **25 791** à
mag ≤ 7,5 — ~12 900 dans le champ en plein ciel. C'est cette couche, celle qui n'est pas
plafonnée, qui fait toute la nappe.

**L'opacité n'est pas un levier.** `OPACITE_MIN = 0,2` (`src/ui/dessine-champ.ts:52`) ne coupe
jamais rien sur le catalogue réel : à 10 mm f/2,8 une étoile de mag 7,5 sort à 0,49–0,71, et à
50 mm f/1,4 **toutes** les étoiles mag ≤ 7,5 sortent à 1,00. Physiquement juste — un filé f/1,4
sature vraiment — donc rien de « quasi transparent » à supprimer. Le levier est le nombre de
traces.

## Ce qui doit devenir vrai

La grandeur plafonnée est la **surface peinte**, pas le nombre d'étoiles : c'est le seul invariant
qui borne d'un coup le coût de peinture et la lisibilité, et il ne dépend ni de la durée ni du
champ.

- Une constante de registre porte la fraction de canevas que les traces peuvent peindre
  (`COUVERTURE_TRACES_MAX`, cible 0,4, réglée par la mesure). `OPACITE_MIN` rejoint le registre.
- Le budget de traces s'estime **avant** la sélection, dans `src/core/` : longueur d'arc de §9.3 à
  la déclinaison du centre du champ, échelle **moyenne** sur le champ — `sqrt(aire / Ω)`, celle du
  centre sous-estime d'un facteur 3 en stéréographique plein ciel — bornée par la corde moyenne du
  canevas, au-delà de laquelle `arcsVisibles` découpe déjà.
- Le budget se convertit en plafond de magnitude par le comptage **du catalogue lui-même** : la
  loi du semis (`SEMIS_ETOILES_TOTAL` à `SEMIS_MAG_MAX`, pente 0,6) donne N(<7,5) ≈ 600 contre
  25 791 réels — elle n'est pas extensible vers le bas. Un histogramme cumulé construit une fois
  dans `construitIndex` (quelques centaines d'octets) porte ce comptage.
- Le budget se dépense **catalogue réel d'abord**, le reste au semis via `magnitudePlafondSemis`,
  conservée.
- `BUDGET_ETOILES_FILE` et le commutateur sur le mode
  (`file.apercu === 'FILE'`, `planetarium-incrustation.ts:74`) **disparaissent** : le plafond se
  neutralise de lui-même quand il n'y a rien à borner — champ étroit, durée courte, aperçu de
  pose, suivi actif.
- La mention du panneau perd son nombre : elle énonce la règle, les compteurs disent le nombre.
- Le banc remplace `--budget=N` par `--couverture=F` et rapporte la surface peinte.

## Deux défauts trouvés à la vérification à l'écran

**1. Le plafond s'effondrait en visant le pôle.** Il lisait la longueur d'arc à la déclinaison du
CENTRE du champ. Au pôle, cos δ tend vers zéro : la trace centrale est minuscule, mais le champ
contient tout le reste du ciel. Mesuré à 120° de champ, 120 min : **84 808 traces et 1 241 % de
couverture** en visant le pôle, contre 1 470 traces et 33 % en visant l'est bas — la même scène,
la même durée.

Le plafond ne compte donc plus des étoiles présentes, il compte des **traversées**. Un pixel est
peint autant de fois qu'il voit passer une étoile : `n · w · ωT·cos δ`, moyenné sur le canevas, où
`w` se lit par l'échelle LOCALE. cos δ est ainsi moyenné sur tout le champ, et l'étirement
stéréographique — facteur trois entre le centre et le bord au plein ciel — entre dans le compte.

**2. La moitié des traces manquait.** La sélection portait sur le champ de la scène. Une étoile
hors du champ dont le cercle de déclinaison le traverse laisse pourtant une trace : à magnitude
fixe, **52 à 86 % des arcs manquaient** à 480 min, et un panoramique les faisait apparaître d'un
coup. Le rayon de sélection s'élargit du balayage complet `ω·T`, et un test d'écart de déclinaison
— deux comparaisons, avant l'arc, comme en T-0022 — écarte celles dont le cercle ne touche rien.

**Un second plafond, de coût.** La couverture borne ce que l'image montre, pas ce que la passe lit :
un filé bref, ou un champ étroit, peint peu par trace et en autorise donc des centaines de
milliers — 268 000 étoiles demandées pour un filé de cinq minutes, 98 ms. `EFFECTIF_CIEL_MAX_FILE`
borne l'effectif lui-même, au-dessus du catalogue réel : le ciel reconnaissable n'est jamais
écarté par le coût, seulement par la lisibilité. Ce plafond, lui, ne se neutralise pas seul : le
commutateur sur le mode reste nécessaire, l'aperçu de champ (§9.2) lisant le catalogue à pleine
profondeur par construction.

## L'aperçu de champ (§9.2) est plafonné lui aussi

Le filé tient à présent en 5 ms ; l'aperçu de champ, non — il lisait le catalogue à pleine
profondeur, soit **185 632 étoiles et 181 ms par image** au plein ciel. Le profil dit où passe le
temps : sélection 8 ms, profondeur atteinte par étoile +78 ms, `arcEtoile` +71 ms.

**Sa cause n'est pas la lisibilité.** Ses étoiles sont des points : ils couvrent 8,5 % du canevas,
rien ne se recouvre, aucune longueur ne se lit. Le plafond de couverture ne s'y applique donc pas,
et n'a rien à y faire. Ce qui coûte est de LIRE.

D'où deux bornes distinctes, portées par deux champs de `ParametresFile` :

- `couvertureMax` — **lisibilité**, filé seulement.
- `effectifMax` — **coût**, les deux aperçus. `EFFECTIF_CIEL_MAX_APERCU` = 45 000, au-dessus du
  catalogue réel : le ciel reconnaissable n'est jamais écarté par le coût.

| aperçu de champ, az 0 / haut 46° | avant | après |
|---|---|---|
| 180° | 113 661 tr — 181 ms | **15 979 tr — 25 ms** |
| 120° | 62 857 tr — 121 ms | **8 342 tr — 16 ms** |
| 60° | 18 027 tr — 37 ms | **2 400 tr — 5 ms** |

Le filé n'en bouge pas : son pire cas est borné par la géométrie, pas par cet effectif (31 ms à
45 000 comme à 60 000). Une seconde mention (`MENTION_PLAFOND_CHAMP`) déclare ce plafond avec SA
raison — un écran de profondeur qui rogne la profondeur doit le dire, sinon il annonce un capteur
moins bon qu'il n'est.

## Le vrai coût de l'aperçu de champ n'était pas le calcul

Plafonner à 45 000 étoiles ramenait l'aperçu de champ à 25 ms de CALCUL — et il laguait toujours.
Le banc ne mesure pas la peinture ; le compte des ordres donnés au contexte, lui, la mesure :

| | ordres de tracé | écritures d'état |
|---|---|---|
| aperçu de champ, 180°, 15 979 étoiles | **36 181** | **45 225** |

Un `beginPath`/`fill` par étoile, chacun précédé d'écritures de `globalAlpha`, `fillStyle`,
`strokeStyle` et `lineWidth`. `dessineCiel` avait déjà réglé le même problème pour sa couche
d'étoiles ponctuelles — un `Path2D` par teinte, huit ordres par image — mais il manquait ici les
deux axes que cette passe ajoute : l'opacité, et la largeur de trait.

**Les étoiles se peignent désormais par chemin partagé.** Deux familles, parce que le canevas a
deux primitives : un disque porte son rayon dans sa géométrie, sa clé est (teinte, opacité) ; une
trace ne peut partager un chemin qu'à largeur égale, sa clé est (teinte, opacité, rayon). L'opacité
entre dans la COULEUR au lieu de passer par `globalAlpha` — même résultat en composition
source-over, mais un disque dont l'opacité est dans sa couleur peut rejoindre un chemin.

Au passage : plus de la moitié de l'aperçu « à étoiles fixes » passait par la branche TRACE, pas
disque. À 25 s sans suivi, les étoiles ovalisent déjà — c'est la physique de §9.2, pas un défaut,
mais cela voulait dire que grouper les seuls disques n'aurait réglé que la moitié du problème.

**Et la profondeur atteinte par pixel se tabule.** Elle ne dépend que de la déclinaison, par la
pose par pixel : 134 ms pour deux cent mille étoiles recalculée, 2 ms lue en table. La table est
indexée par le SINUS de la déclinaison — la composante polaire que la sélection lit déjà — ce qui
retire aussi un arc sinus par étoile, et permet de mener le test de déclinaison sur `z` brut.

| | ordres | calcul |
|---|---|---|
| aperçu de champ 180° — avant tout plafond | 36 181 | 181 ms |
| — plafond seul | 36 181 | 25 ms |
| — plafond + chemins partagés + table | **60** | **18 ms** |
| filé, cas nominaux | 51 à 92 | 3 à 6 ms |
| filé, pire cas (10° / 480 min) | 40 | 21 ms |

## Critères d'acceptation

- [ ] Plein ciel / 480 min / 50 mm f/1,4 : surface peinte ≤ ~40 % du canevas, contre 535 %
      aujourd'hui, et le calcul reste sous l'intervalle de boucle (~33 ms) au banc.
- [ ] La surface peinte reste dans la même plage de 60° à 180° et de 60 min à 480 min : c'est
      l'invariance que le budget d'étoiles de T-0118 ne tenait pas.
- [ ] À champ et durée constants, l'inclinaison de la visée ne change plus la densité : le pôle au
      centre donne le même ordre de traces qu'une visée rase.
- [ ] Une étoile hors du champ dont le cercle de déclinaison le traverse laisse sa trace : un
      panoramique ne fait plus apparaître de traces qui étaient là depuis le début.
- [ ] Un champ de 20°, un filé court, l'aperçu de pose unitaire et le suivi actif ne sont **pas**
      plafonnés : compteurs inchangés.
- [ ] Le panoramique et le zoom restent fluides en filé plein ciel, à l'écran.
- [ ] L'aperçu de champ au plein ciel tient sous l'intervalle de boucle : 18 ms contre 181.
- [ ] Le nombre d'ordres donnés au contexte ne suit plus le nombre d'étoiles : quelques dizaines
      par image, contre trente-six mille.
- [ ] Les deux plafonds sont déclarés à l'écran, chacun avec sa raison.
- [ ] `pnpm bench:file --planetarium --couverture=0 --effectif=0` reproduit les compteurs et le
      condensé `--empreinte` d'aujourd'hui avec `--budget=0`.
- [ ] Aucun nombre en dur ajouté : la cible de couverture et le plancher d'opacité sont au
      registre, avec source, unité et tolérance.
- [ ] `pnpm typecheck && pnpm test` au vert.
