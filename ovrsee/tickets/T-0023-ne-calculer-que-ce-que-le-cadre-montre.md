---
{
  "id": "T-0023",
  "titre": "Ne calculer que ce que le cadre montre",
  "epic": "T-0021",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
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

L'incrustation ne montre que l'intérieur du cadre : `incrusteDansLeCadre`
(`src/ui/scene-overlay.ts:113`) dépose l'image sous `ctx.clip()` du contour du
cadre. Mais l'image, elle, est peinte sur toute l'étendue de la scène —
`rayonChampDeg` (`src/ui/dessine-champ.ts:155`) est dérivé de
`projecteur.vue.fovDeg`, celui de la scène.

Un cadre d'objectif occupe une fraction de la scène. Tout ce qui tombe autour est
sélectionné, trié, tracé — puis clippé. C'est du travail intégralement perdu, et
il grandit quand on dézoome la scène : plus le planétarium montre de ciel, plus
l'incrustation calcule d'étoiles qu'on ne verra jamais.

Le cadre est déjà décrit : `Cadre` (`src/core/cadre.ts`), contour projeté par
`cheminCadre` (`src/ui/dessine-ciel.ts`), direction et étendue par
`contourCadreJ2000`. Rien à réécrire — §3.3 interdit qu'un second code de
projection existe.

Deux honnêtetés à tenir, sous peine de casser ce que T-0019 a établi :

- **Le canevas hors écran reste à la définition de la scène, dans le repère de la
  scène.** C'est ce partage du `Vue` qui fait tomber les arcs exactement sur les
  étoiles du ciel qui les entoure. On restreint la **sélection**, jamais le
  canevas ni la projection.
- **La marge de sélection doit couvrir la longueur des arcs.** Une étoile hors
  cadre dont la trace y entre doit rester tracée : le rayon de sélection se prend
  autour du cadre plus le balayage de la durée demandée. Sans cette marge, les
  bords du cadre se vident en filé long.

## Critères d'acceptation

- [x] Le rayon de sélection de `dessineChamp` en incrustation dérive du champ du
      **cadre**, plus une marge, et non du champ de la scène
- [x] La marge couvre le balayage de la durée demandée : à 480 min, aucune trace
      entrante ne manque au bord du cadre — **prouvé par test** plutôt que
      constaté à l'œil : `tests/file-etoiles.test.ts` balaie toute la sphère et
      vérifie qu'aucune étoile dont la trace entre dans la calotte du cadre n'est
      écartée, à 0, 30 et 120° de balayage
- [x] Le canevas hors écran garde la définition et le `Vue` de la scène : les arcs
      tombent toujours sur les étoiles du ciel qui les entoure
- [x] Aucun second code de projection n'est introduit ; `contourCadreJ2000` /
      `cheminCadre` sont réutilisés
- [~] Le nombre d'étoiles visitées chute d'un facteur chiffré sur le cas de mesure
      de T-0021, et le gain croît quand on dézoome la scène — ce n'est pas le
      nombre d'étoiles **lues** qui chute (l'index ne sélectionne que par disque,
      voir plus bas) mais le nombre d'**arcs construits** : 169 338 → 28 858, soit
      5,9×, et 5 044 → 917 ms
- [x] Le contenu du cadre est inchangé à l'œil par rapport au rendu d'avant — mieux
      qu'à l'œil : le filtre est conservateur par construction et le test l'établit
      sans faux négatif

## Réalisation

Deux temps, parce que le premier ne suffisait pas — et c'est la mesure qui l'a dit.

**Le disque, tel que le ticket le décrivait.** `etendueCadre` (`src/core/cadre.ts`)
prend le contour de `contourCadreJ2000`, en tire la direction moyenne et le rayon
englobant ; `dessineChamp` reçoit cette étendue et ramène son rayon de sélection à
`séparation + rayon du cadre + balayage`, jamais au-delà du champ de la scène.
Résultat mesuré : **aucun gain**. À 480 min le balayage vaut 120° — la marge
couvre à elle seule un tiers du ciel et le disque ne trie plus rien. Le ticket
demandait cette marge, elle est nécessaire, et elle annule le tri qu'elle protège.

**Le cercle de déclinaison, qui lui trie.** Une trace ne quitte jamais le cercle
de déclinaison de son étoile. `filtreArcCadre` (`src/core/file-etoiles.ts`) pose
donc deux questions, sans construire un seul arc : ce cercle entre-t-il dans la
calotte du cadre (loi des cosinus sphérique, résolue en angle au pôle), et si oui
l'étoile y arrive-t-elle pendant le balayage demandé (fenêtre d'angle horaire) ?
Le test est conservateur par construction — la calotte englobe le cadre — donc
aucune étoile traçante n'est perdue, et le contenu du cadre est identique.

Le filtre passe **avant** le calcul de profondeur : quelques produits scalaires
coûtent moins qu'une valeur tracée allouée par étoile.

## Réserve

La sélection d'index reste un disque : `selectionne` ne sait pas parcourir une
bande de déclinaison, et le nombre d'étoiles **lues** ne baisse donc pas — 177 377
dans le pire cas, avant comme après. Lire une étoile coûte une lecture de
`Float32Array` et une comparaison ; c'est l'arc qui coûte. Le jour où ce
parcours pèserait, c'est l'index qu'il faudrait apprendre à interroger par
anneau, pas ce filtre qu'il faudrait déplacer.

L'empreinte de peinture du canevas **change** — c'est attendu : des étoiles qui
tombaient hors du cadre étaient peintes puis clippées, elles ne sont plus
peintes. Ce qui devait rester identique, c'est le contenu du cadre, et c'est le
test d'absence de faux négatif qui l'établit.
