---
{
  "id": "T-0110",
  "titre": "Relire tout src/ : coût par image, lignes en trop, défauts",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "audit",
    "performance",
    "qualite",
    "refactor"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-22",
  "plan": "2026-08-22-ticket-t-0110-relecture-d-optimisation-de-src.md"
}
---

## Contexte

Le 22 août 2026, une session partie d'une plainte d'affichage — « les étoiles disparaissent au
dézoom » — a trouvé tout autre chose en cherchant la cause de la saccade : la bande de la Voie
lactée émettait **1 662 `stroke()` par image**, un par segment, chacun étalant un trait large et
translucide sur le canevas. La moitié des segments ne changeait aucun pixel, et la moitié du
reste tombait derrière l'observateur. Trois corrections mécaniques — regrouper par teinte,
écarter ce qui ne se peint pas, écarter ce qui n'est pas dans le champ — ont ramené le rendu de
2,9 à 1,6 ms par image à 180° de champ, sans changer un pixel (`9615d12`).

Ce défaut vivait dans le code depuis T-0103. **L'audit transversal T-0054 ne l'a pas vu** : son
axe « Optimisation » comptait les allocations par image et le poids du bundle, jamais le nombre
d'appels de tracé. Le gisement est donc plus profond que ce qu'une passe a exploré, et rien ne
dit qu'il se limite au planétarium.

Ce ticket demande la seconde passe, et il diffère de T-0054 sur un point : **il corrige**.
T-0054 constatait et déléguait tout à des tickets fils, ce qui était juste pour un audit de
sécurité et de pratiques ; ici, une correction sûre — celle qui ne change ni le rendu ni un
contrat — s'applique dans le tour.

Périmètre : **tout `src/`** — `registry/`, `core/`, `data/`, `ui/`.

## Les trois axes

### 1. Coût par image

Le chemin chaud : `src/ui/dessine-ciel.ts`, `dessine-champ.ts`, `dessine-sol.ts`,
`dessine-fond-ciel.ts`, `planetarium-boucle.ts`, `scene-overlay.ts`, et côté calcul
`src/core/projection.ts`, `index-ciel.ts`, `sol.ts`, `file-etoiles.ts`, `cadre.ts`.

Ce qui se compte, et que T-0054 n'a pas compté :

- **appels de tracé par image** — `stroke()`, `fill()`, changements de `strokeStyle` /
  `fillStyle` / `globalAlpha`. Un appel par élément est le défaut qui vient d'être payé ;
- **points projetés par image**, et parmi eux ceux qui sont rejetés après projection alors
  qu'un test d'appartenance au champ les aurait écartés avant ;
- **travail répété d'une image à l'autre alors que son entrée n'a pas bougé** — la teinte d'un
  segment de bande ne dépend ni du zoom ni du défilement, elle se mémorise.

Le patron de mesure existe : contexte 2D espion qui compte les appels
(`contexteEspion`, `tests/dessine-ciel.test.ts`) et `scripts/bench-incrustation.ts` pour le filé.
Le patron de correction existe aussi : `champVisible` / `horsDuChamp`
(`src/ui/dessine-ciel.ts`) écartent une géométrie fixe par un produit scalaire avant de la
projeter, comme `selectionne` le fait des cellules d'étoiles (§3.3). Toute couche qui projette
une géométrie fixe doit être passée à cette question.

### 2. Lignes en trop

Logique dupliquée entre modules, indirections à un seul appelant, fonctions et composants qui ne
se lisent plus d'un bloc. Cibles déjà nommées par T-0054 et jamais retaillées : `src/App.tsx`,
`src/ui/Planetarium.tsx`, `src/ui/PanneauFile.tsx`, `src/ui/FicheCible.tsx`,
`src/core/session.ts`.

Les tables déclaratives du registre — `constants.ts`, `glossaire.ts` — restent longues : T-0054 a
tranché que les découper déplace le problème sans rien résoudre. Ce n'est pas rouvert ici.

### 3. Défauts

- **bugs de comportement** : calcul faux, cas limite non traité, état impossible atteignable ;
- **code mort et doublons** : exports sans consommateur, branches inatteignables, deux
  implémentations de la même formule. `pnpm dlx knip` et `ts-prune` comme à T-0054, sans rien
  installer.

À vérifier au passage : les neuf symboles morts du constat M1 de T-0054 ont-ils été traités par
T-0062 et T-0063, ou sont-ils toujours là ?

## Méthode

1. **Un chiffre, pas une intuition.** Toute affirmation de performance porte une mesure avant et
   après, aux mêmes champs et sur le même catalogue.
2. **La correction sûre s'applique dans le tour.** Sûre veut dire : rendu identique, contrat
   identique, test existant vert.
3. **Le changement structurel devient un ticket** citant T-0110. Pas de gros diff opportuniste
   glissé dans une passe d'optimisation.

## Critères d'acceptation

- [ ] Chacun des trois axes a produit une liste de constats écrite, chaque constat localisé en
      `fichier:ligne`, avec sa gravité et l'action retenue
- [ ] Les constats sans action — faux positifs, choix assumés — sont écrits comme tels avec leur
      raison : un axe ne se referme pas sur un silence
- [ ] Le coût par image est mesuré avant et après, aux mêmes champs (15°, 60°, 180°) et sur le
      même catalogue, et les deux chiffres figurent au ticket
- [ ] Aucune correction ne change ce qui s'affiche à l'écran sans que le ticket le dise
      explicitement et dise pourquoi
- [ ] `pnpm typecheck && pnpm test` passent, sortie réelle rapportée — pas de « ça devrait
      marcher »
- [ ] Chaque constat retenu est soit corrigé dans le tour, soit devient un ticket citant ce
      T-0110 — aucun constat n'est laissé sans suite

## Hors périmètre

- **Sécurité** — couverte par T-0054, suite tenue par T-0074.
- **Design** — visuel, ergonomie, typographie.
- **Règles de style du projet** et **écarts au PRD** : écartés du périmètre à la demande. Le PRD
  ne se modifie pas.
