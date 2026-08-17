---
{
  "id": "T-0021",
  "titre": "Coût du filé incrusté : une image, pas une seconde",
  "type": "epic",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "performance",
    "rendu",
    "file"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-17",
  "plan": "2026-08-15-tickets-cout-du-file-incruste-dans-le-cadre.md"
}
---

## Contexte

En mode filé avec l'incrustation dans le cadre, l'application rame — au point que
le panoramique devient inutilisable. T-0019 avait laissé le compteur d'images
« non mesuré » : c'est ce trou qui se paie ici.

Le rendu hors écran (`rendIncrustation`, `src/ui/scene-overlay.ts:84`) appelle
`dessineChamp` (`src/ui/dessine-champ.ts:227`) avec le **`Vue` de la scène**,
donc sur le canevas entier, alors que `incrusteDansLeCadre`
(`scene-overlay.ts:113`) n'en garde que la portion sous `ctx.clip()` du contour
du cadre. Quatre coûts s'additionnent, chacun traité par un enfant de cet epic :

- l'arc d'une étoile est calculé **avant** le tri par opacité qui la rejette
  (T-0022) ;
- la sélection porte sur le champ de la scène, pas sur celui du cadre (T-0023) ;
- le pas d'échantillonnage d'un arc est fixe en angle horaire : jusqu'à 481
  projections par étoile à 480 min, même près du pôle (T-0024) ;
- le rendu complet se refait à chaque `pointermove` du panoramique et à chaque
  cran du curseur de durée (T-0025).

Ordre de grandeur : catalogue réel (~15 000 étoiles) plus semis génératif
plafonné à 300 000 sur la sphère (`SEMIS_ETOILES_TOTAL`), sélectionnés sur le
champ de la **scène**, chacun multiplié par jusqu'à 481 pas. On compte en
millions de projections par image — et par mouvement de souris.

Cet epic porte la **mesure**. Sans chiffre avant et après, aucun des cinq
enfants ne peut se dire fini : « ça semble plus fluide » n'est pas un critère.

**Ordre recommandé** — T-0025 et T-0022 d'abord : plus gros gain, plus petit
diff, aucun risque sur l'image produite. Puis T-0023, puis T-0024. T-0026 n'est à
trancher qu'après la mesure finale ; si les quatre premiers suffisent, il meurt
sans être fait.

## Critères d'acceptation

- [x] Le coût d'une passe `rendIncrustation` est chiffré **avant travaux**, au
      pire cas documenté : `apercu = 'FILE'`, durée totale 480 min, semis actif,
      champ de scène large, Voie lactée allumée — durée en ms et nombre d'étoiles
      visitées
- [x] La même mesure est reprise après chaque enfant livré, dans les mêmes
      conditions, et le facteur de gain est écrit noir sur blanc
- [~] Le compteur d'images du ciel ne chute pas quand l'incrustation est active
      (critère resté « non mesuré » en T-0019) — toujours **non mesuré** : aucun
      pilote de navigateur ici. Ce qui a changé, c'est qu'une passe ne tombe plus
      dans la boucle : T-0025 la sort du geste, la boucle ne fait qu'un
      `drawImage` sous clip. Protocole pour le constater : ouvrir l'app, cocher
      l'incrustation, lire la ligne « images/s » de la scène
- [~] Un panoramique complet à la souris reste fluide, incrustation active, en
      mode filé à 480 min — le rendu par `pointermove` est supprimé (T-0025,
      compté par `tests/rendu-differe.test.ts`), la passe finale du pire cas
      tient en 0,77 s au lieu de 5,04 s. **Non constaté à l'écran**
- [~] Le curseur de durée se glisse de 5 à 480 min sans blocage perceptible du
      fil principal — même mécanique, un seul rendu pour les 96 crans. **Non
      constaté à l'écran**
- [x] Aucun de ces gains ne change l'image produite : le contenu du cadre reste
      celui d'avant, hors écart explicitement accepté dans T-0024 — T-0022 rend
      une empreinte de peinture identique au bit près, T-0023 est prouvé sans
      faux négatif par test sur toute la sphère, T-0024 tient l'écart sous le
      pixel par test

## Mesure

Instrument : `scripts/bench-incrustation.ts`. Il rejoue `dessineChamp` hors
navigateur — même projecteur, même catalogue réel (25 791 étoiles sous le seuil),
même semis (300 000) — sur un contexte 2D muet. Ce qui est mesuré est donc le
**calcul**, jamais la peinture : c'est le calcul qui bloque le fil principal.
Médiane de 5 passes, scène 1920×1080, Voie lactée allumée, sans suivi.

`--empreinte` remplace la durée par un condensé des ordres de peinture : c'est
lui qui dit qu'une optimisation n'a pas changé l'image. `--champ-scene` rejoue la
sélection d'avant T-0023.

### Avant / après

| cas | avant | après | gain | projections |
|---|---|---|---|---|
| scène 180°, 480 min, 50 mm f/1,4 (pire cas) | **5 040 ms** | **768 ms** | **6,6×** | 85,7 M → 11,5 M |
| scène 180°, 480 min, 10 mm f/2,8 | 747 ms | 309 ms | 2,4× | 12,6 M → 4,9 M |
| scène 60°, 120 min, 50 mm f/1,4 | 583 ms | 260 ms | 2,2× | 6,8 M → 3,0 M |
| scène 60°, 120 min, 10 mm f/2,8 | 74 ms | 54 ms | 1,4× | 883 k → 630 k |

Le pire cas demande une pupille qui atteigne le semis : à 10 mm f/2,8 la
profondeur s'arrête à la magnitude 10,1 et la passe ne voit presque que le
catalogue réel. À 50 mm f/1,4 elle descend à 15,1 et le semis entre en jeu — 177 377
étoiles lues, 169 338 arcs construits avant travaux, 28 858 après.

### Attribution, dans l'ordre livré

| étape | pire cas 50 mm | 180° 10 mm | ce qui l'explique |
|---|---|---|---|
| départ | 5 143 ms | 752 ms | — |
| T-0022 tri avant l'arc | 5 044 ms | 609 ms | 6 313 arcs évités à 10 mm ; à 50 mm le tri par opacité n'écarte presque rien, la profondeur étant atteinte |
| T-0023 ne calculer que le cadre | 917 ms | 447 ms | **le gros du gain** : 169 338 → 28 858 arcs construits |
| T-0024 pas adaptatif | 753 ms | 309 ms | 13,9 M → 11,5 M projections |
| T-0025 rendu hors geste | — | — | n'apparaît pas au banc : il supprime des **passes entières**, une par geste au lieu d'une par `pointermove` |

Lu autrement : avant, un panoramique d'une seconde en filé long lançait ~60
passes de 5 s chacune sur le fil principal. Après, il en lance une, de 0,77 s.

## Réserve

Le banc est hors navigateur : il mesure le calcul, pas la peinture ni le compteur
d'images. Les trois critères qui demandent un écran restent à constater à la
main. `T-0026` n'est pas fermé : 0,77 s de calcul au relâchement du geste reste
perceptible dans le pire cas, donc le plafond garde une raison d'être — sa valeur,
elle, est maintenant chiffrable.
