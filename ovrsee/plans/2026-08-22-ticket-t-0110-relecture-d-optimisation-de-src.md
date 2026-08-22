---
{
  "status": "open",
  "title": "Ticket T-0110 — relecture d'optimisation de `src/`",
  "opened": "2026-08-22",
  "closed": null,
  "commits": []
}
---

# Ticket T-0110 — relecture d'optimisation de `src/`

## Contexte

L'utilisateur demande un ticket qui commande une **analyse du code pour l'optimiser** :
performance, raccourcissement du code quand c'est possible, et correction des défauts trouvés.

Ce qui le motive maintenant : la session qui vient d'être fusionnée (`9615d12`) a trouvé que la
bande de la Voie lactée émettait **1 662 `stroke()` par image**, dont l'écrasante majorité ne
changeait aucun pixel. Le coût du rendu est tombé de 2,9 → 1,6 ms par image à 180° de champ pour
trois corrections purement mécaniques. L'audit transversal T-0054 (18 août 2026, soldé) avait un
axe « Optimisation », mais il comptait les **allocations** par image, pas les **appels de tracé** :
ce défaut lui a échappé. Une seconde passe, ciblée sur ce que l'audit n'a pas su voir, est donc
justifiée — et cette fois elle corrige, là où T-0054 se limitait à constater.

Périmètre et livrable arbitrés avec l'utilisateur :

- **Périmètre** : tout `src/` (registry, core, data, ui).
- **Livrable** : rapport chiffré + corrections sûres appliquées dans le tour + un ticket dérivé
  par changement structurel.
- **« Erreurs » couvre** : bugs de comportement, code mort et doublons, et l'optimisation
  elle-même (performance et taille du code).
- **Explicitement hors périmètre** : violations des règles de style du projet et écarts au PRD —
  l'utilisateur ne les a pas retenus.

## Ce qu'il y a à faire

Un seul fichier à créer, aucun code touché :

`ovrsee/tickets/T-0110-relire-tout-src-cout-par-image-lignes-en-trop-defauts.md`

- `T-0110` est le prochain identifiant libre (T-0109 est le maximum existant).
- Frontmatter **JSON** entre deux `---`, jamais YAML — règle du skill `ovrsee-tickets`.
- `colonne` doit être un `id` de `ovrsee/board.json` : `backlog`, `a-specifier`, `pret`,
  `en-cours`, `revue`, `fait`. Le ticket part en **`pret`** : ses critères d'acceptation sont
  écrits, donc il n'a rien à spécifier. (Le projet n'a encore jamais utilisé `pret` — 98 `fait`,
  6 `backlog`, 4 `a-specifier` — mais la colonne existe et c'est son sens.)
- `cree` et `maj` : `2026-08-22`.
- Pas d'index ni de `README` de tickets à mettre à jour ; `board.json` ne change pas.

### Contenu du ticket

**Frontmatter** : `id` T-0110, titre `Relire tout src/ : coût par image, lignes en trop,
défauts`, `colonne` `pret`, `priorite` `moyenne`, `charge` `l`,
`tags` `["audit", "performance", "qualite", "refactor"]`, `plan` `null`.

**## Contexte** — reprend le raisonnement ci-dessus : T-0054 a soldé un audit qui constatait sans
corriger, son axe 4 mesurait les allocations et a laissé passer 1 662 `stroke()` par image ;
citer `9615d12` et les mesures avant/après comme preuve que le gisement existe encore.

**## Les trois axes** :

1. **Coût par image** — le chemin chaud du rendu et du calcul : `src/ui/dessine-ciel.ts`,
   `dessine-champ.ts`, `dessine-sol.ts`, `dessine-fond-ciel.ts`, `planetarium-boucle.ts`,
   `src/core/projection.ts`, `index-ciel.ts`, `sol.ts`, `file-etoiles.ts`. Compter les appels de
   tracé et les points projetés par image, pas seulement les allocations. Réutiliser le patron de
   mesure de cette session : contexte 2D espion qui compte les appels (le gabarit existe dans
   `tests/dessine-ciel.test.ts`, `contexteEspion`), et `scripts/bench-incrustation.ts` pour le
   filé. Réutiliser aussi `champVisible` / `horsDuChamp` (`src/ui/dessine-ciel.ts`) : tout ce qui
   projette une géométrie fixe doit s'écarter par produit scalaire avant de projeter.
2. **Lignes en trop** — logique dupliquée entre modules, indirections à un seul appelant,
   fonctions et composants qui ne se lisent plus d'un bloc. Cible déclarée : les gros porteurs
   relevés par T-0054 et jamais retaillés (`src/App.tsx`, `src/ui/Planetarium.tsx`,
   `src/ui/PanneauFile.tsx`, `src/ui/FicheCible.tsx`, `src/core/session.ts`). Les tables
   déclaratives du registre restent longues : ce n'est pas de la dette, T-0054 l'a déjà tranché.
3. **Défauts** — bugs de comportement (calcul faux, cas limite non traité, état impossible
   atteignable), code mort et doublons. Passer `pnpm dlx knip` / `ts-prune` comme T-0054, et
   vérifier ce que T-0054 avait laissé en suspens : les neuf symboles morts de son constat M1
   ont-ils été traités par T-0062 / T-0063 ?

**## Méthode** — trois règles : (a) toute affirmation de performance porte un chiffre avant/après
mesuré, pas une intuition ; (b) une correction sûre — sans changement de rendu ni de contrat —
est appliquée dans le tour ; (c) tout changement structurel devient un ticket citant T-0110,
jamais un gros diff opportuniste.

**## Critères d'acceptation** (cases à cocher, non cochées) :

- Chaque axe a produit une liste de constats écrite, chaque constat localisé en `fichier:ligne`,
  avec sa gravité et l'action retenue.
- Les constats sans action — faux positifs, choix assumés — sont écrits comme tels avec leur
  raison.
- Le coût par image est mesuré avant et après, aux mêmes champs (15°, 60°, 180°) et sur le même
  catalogue, et les deux chiffres figurent au ticket.
- Aucune correction ne change le rendu à l'écran sans que le ticket le dise explicitement.
- `pnpm typecheck && pnpm test` passent, sortie réelle rapportée.
- Chaque constat retenu est soit corrigé dans le tour, soit devient un ticket citant T-0110.

**## Hors périmètre** — sécurité (T-0054 l'a couverte, T-0074 tient la suite), design, règles de
style du projet, écarts au PRD. Le PRD ne se modifie pas.

## Fichiers touchés

- `ovrsee/tickets/T-0110-relire-tout-src-cout-par-image-lignes-en-trop-defauts.md` — à créer.
- Rien d'autre. Aucun code, aucun `board.json`.

## Vérification

1. `head -20` sur le fichier créé : le frontmatter est du JSON valide entre deux `---`, `id`
   `T-0110`, `colonne` lue dans `board.json`, `priorite` parmi `haute|moyenne|basse`, dates au
   format `YYYY-MM-DD`.
2. `node -e` sur le bloc de frontmatter pour confirmer qu'il parse — un JSON malformé rend le
   ticket invisible dans l'interface ovrsee.
3. `ls ovrsee/tickets | tail -3` : T-0110 est bien le dernier, aucun identifiant repris.
4. Commit `chore: ovrsee — T-0110 ouvert` (Conventional Commits en français). Pas de push sauf
   demande.
