---
{
  "status": "open",
  "title": "Ticket d'audit du code — sécurité, pratiques, code mort, optimisation",
  "opened": "2026-08-18",
  "closed": null,
  "commits": []
}
---

# Ticket d'audit du code — sécurité, pratiques, code mort, optimisation

## Contexte

Astrofort a accumulé 53 tickets de fonctionnalités et de performance ciblée
(epic T-0021 et ses enfants), mais aucune passe transversale sur la santé du
code. Le projet n'a ni linter ni détecteur de code mort configuré
(`package.json` n'expose que `dev`, `build`, `preview`, `test`, `typecheck`,
`data:build`, `bench:file`), donc rien ne signale aujourd'hui un import mort,
une dépendance non utilisée ou un `innerHTML` glissé dans le rendu.

L'objet du ticket est de **poser l'audit**, pas de le faire ni de corriger : un
seul ticket, quatre axes, dont le résultat attendu est une liste de constats
écrite — chaque constat qui mérite correction devient ensuite son propre ticket.
Le design est explicitement hors périmètre.

## Fichier à créer

`ovrsee/tickets/T-0054-auditer-le-code-securite-pratiques-code-mort-optimisa.md`

- `T-0054` = max existant (`T-0053`) + 1.
- Slug : titre en minuscules sans accents, non-`[a-z0-9]` → tiret, coupé à 60 car.
- Colonne `backlog` (première de `ovrsee/board.json`) — l'audit n'est pas lancé.
- `priorite: "moyenne"`, `plan: null`, `cree`/`maj` = `2026-08-18`.
- Tags : `audit`, `securite`, `qualite`, `performance`.
- Un seul ticket, **pas d'epic** : les épics naissent des constats, pas avant.

## Contenu du ticket

Frontmatter JSON puis `## Contexte` / `## Critères d'acceptation`, format du
skill `ovrsee-tickets`.

Corps — quatre axes, périmètre `src/`, `scripts/`, `tests/` :

1. **Sécurité** — surface réelle d'une PWA sans backend : chaîne
   d'approvisionnement (`pnpm audit`, scripts de cycle de vie), stratégie de
   cache du service worker (`vite-plugin-pwa`), données persistées (`idb`),
   toute injection HTML/DOM non échappée, absence de secret en dur.
2. **Bonnes pratiques de dev** — respect des règles du projet : fichiers <800
   lignes, fonctions <50 lignes, pas de mutation, validation aux frontières
   (décodage des catalogues binaires, entrées utilisateur des panneaux),
   `any`/`as` de complaisance, couverture des tests.
3. **Code mort** — exports non consommés, fichiers orphelins, dépendances
   inutilisées, branches mortes des composants et des scripts, tests désactivés.
   Outils en `pnpm dlx` (knip / ts-prune / depcheck), sans les installer.
4. **Optimisation** — hors du périmètre déjà couvert par T-0021 : allocations
   par image, recalculs React évitables, taille des artefacts de
   `public/data/`, poids du bundle après `pnpm build`.

Critères d'acceptation — chacun exige un livrable constatable, pas une
impression :

- [ ] Chacun des quatre axes a produit une liste de constats écrite, chaque
      constat localisé en `fichier:ligne`, avec une gravité et l'action proposée.
- [ ] Les constats sans action (faux positifs, choix assumés) sont écrits comme
      tels, avec la raison — un axe ne se referme pas sur un silence.
- [ ] `pnpm audit` est passé et son résultat reporté ; toute vulnérabilité
      haute/critique donne lieu à un ticket.
- [ ] Chaque constat retenu est soit corrigé dans le tour, soit devient un
      ticket citant ce T-0054 — aucun constat n'est laissé sans suite.
- [ ] Aucune modification de code n'est faite dans le cadre de l'audit lui-même
      (l'audit constate ; les tickets enfants corrigent).
- [ ] Le design (visuel, ergonomie, typographie) est hors périmètre et le reste.

## Vérification

- `ls ovrsee/tickets/T-0054-*` → le fichier existe.
- `node -e` sur le frontmatter extrait → JSON valide, `colonne` présente dans
  `ovrsee/board.json`, `id` unique dans le dossier.
- Le ticket apparaît en Backlog dans l'interface ovrsee.

## Écarté

- Un epic + 4 tickets enfants : l'utilisateur en a demandé **un**. Si la
  granularité manque au moment de lancer l'audit, T-0054 se convertit en epic
  (`"type": "epic"`) et les axes se détachent en enfants — geste d'une ligne
  par fichier.
- Installer eslint / knip en `devDependencies` : `pnpm dlx` suffit pour une
  passe unique, et une install se demande d'abord.
