---
{
  "status": "open",
  "title": "Lot 6 — Coque planétarium : la scène au centre, les réglages sur les côtés",
  "opened": "2026-08-15",
  "closed": null,
  "commits": []
}
---

# Lot 6 — Coque planétarium : la scène au centre, les réglages sur les côtés

## Contexte

Les lots 0 à 5 ont livré tous les moteurs du PRD (§2 à §12) et cinq vues qui fonctionnent.
Mais `src/App.tsx` les empile en `<section>` dans un `<main>` à `max-width: 70rem`
(`src/ui/styles.css:54`) : titre, Lieu, Optique, Suivi, lectures optiques, fenêtre nocturne,
fond de ciel, planétarium, grand champ, fiche cible, plan de session, mode nuit, état du
socle, matrice de dégradation, registre. Onze sections à parcourir au doigt pour voir
l'effet d'un changement de focale sur un cadre qui se trouve à 3 000 px plus haut.

C'était assumé : `src/App.tsx:8-9` écrit noir sur blanc « ce n'est pas un écran conçu ».
Le PRD ne prescrit aucune mise en page — le §11.2 impose seulement cibles ≥ 44 px, plan
imprimable, aucune info portée par le survol seul.

L'application est un planétarium. Elle doit se **lire** comme un planétarium : la scène
occupe l'écran, le matériel est à gauche, l'intention à droite, et **tout résultat se voit
sur la scène** — le cadre qui se resserre quand la focale monte, les arcs du filé qui
s'allongent quand la pose grandit.

Ce lot ne touche **aucun moteur de calcul**. C'est une redistribution de l'existant plus un
seul ajout de rendu : l'incrustation du filé dans le cadre matériel.

## Cible

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Astrofort   ·  120 mm f/2.8 · plein format   ·  niveau ▾  ·  ☾ nuit  ·  ⓘ    │
├──────────────────┬──────────────────────────────────┬────────────────────────┤
│ MATÉRIEL   §5    │        SCÈNE  §3                 │ [Explorer][Cible]      │
│                  │                                  │ [Nuit][Filé]           │
│ Boîtier    ▾     │   ciel animé, constellations,    │ ─────────────────────  │
│ Focale   120 mm  │   corps du système solaire       │ ▸ Séance               │
│ Ouverture f/2.8  │                                  │   lieu 46.39 / 6.70    │
│ Capteur    ▾     │      ┌──────────────┐            │   date 2026-08-15      │
│ ☐ comparer cadre │      │ /// filé /// │ ← cadre     │   Bortle 4.5 · SQM —  │
│ Objectif   ▾     │      │ ///  arcs // │   matériel │   nuit 22:41 → 04:12   │
│ ☑ suivi          │      └──────────────┘            │ ─────────────────────  │
│   mise en station│                                  │  Pose unit.   8 s ▬▬○  │
│   monture   ▾    │                                  │  Durée  14 min   ▬▬○   │
│ ──────────────── │                                  │  Intervalle  2 s       │
│ champ 17.0 × 11.4│                                  │  poses 105 · 4.1 Go    │
│ éch.  6.36 "/px  │                                  │  ⚠ pose > max cadre    │
│ pupille  42.9 mm │                                  │     (6.2 s) [corriger] │
│ NPF       6.2 s  │  visée 182° AD / +38° δ · ×60 ·  │ ─────────────────────  │
│ pose max  120 s  │  8.9 mag · 14 min accumulés      │  ▸ tiroir Vérification │
└──────────────────┴──────────────────────────────────┴────────────────────────┘
   panneau scrollable        stage, jamais scrollé        panneau scrollable
```

Trois décisions actées avec l'utilisateur :

1. **Le filé se dessine dans le cadre matériel**, sur le canevas du planétarium, avec le
   projecteur du planétarium — pas dans un second canevas ailleurs.
2. **Lieu, date, Bortle/SQM, fenêtre nocturne** = groupe « Séance » en tête du panneau droit.
3. **Panneau droit à onglets d'intention** : Explorer · Cible · Nuit · Filé. Les écrans §14
   (état du socle, matrice de dégradation, registre) passent dans un tiroir « Vérification ».

## Ce qui est réutilisé tel quel

Aucun moteur ne bouge. Sont réutilisés sans modification :

- `src/core/*` en entier — y compris `projecteur()` (`src/core/projection.ts:114`),
  `contourCadreJ2000` (`src/core/cadre.ts`), `cartePoseMax`, `diagnosticFile`,
  `sequenceFile`, `planSession`.
- Les passes de rendu `dessineCiel` (`src/ui/dessine-ciel.ts:149`) et `dessineChamp`
  (`src/ui/dessine-champ.ts:228`). Point clé : `dessineChamp` prend son extent de
  `projecteur.vue.largeurPx/hauteurPx`, jamais de `ctx.canvas` — elle est donc déjà
  utilisable avec le projecteur de la scène, sans la toucher.
- `TracedValue`, `Etiquette`, `Terme`, `ModeNuit`, `FicheCible`, `PlanSessionVue` — montés
  dans les nouveaux panneaux, pas réécrits.
- Les variables CSS de `src/ui/styles.css:11-36` : la coque n'écrit **aucune couleur en dur**,
  sinon le mode nuit fuit.

## Découpage

Tickets à créer dans `ovrsee/tickets/` (format des fichiers existants : frontmatter JSON,
`plan` pointant vers le nouveau plan ovrsee), plus le plan `ovrsee/plans/2026-08-15-plan-coque-planetarium.md`.

### T-0014 — epic « Lot 6 — Coque planétarium » (`pret`)

Parent des six suivants. Aucun code.

### T-0015 — Pointage et temps partagés

Aujourd'hui `Planetarium.tsx:183-197` et `GrandChamp.tsx:105-110` tiennent **chacun** leur
azimut, hauteur, rotation, fov. Deux vues qui fusionnent en une scène ne peuvent pas garder
deux pointages.

- Nouveau `src/ui/scene-etat.ts` : hook `useScene()` retournant `{ vue, temps, actions }`
  (azimut, hauteur, rotation, fovDeg, mode projection · modeTemps, facteur, pas, dateMs).
- `Planetarium.tsx` et `GrandChamp.tsx` consomment le hook au lieu de leur `useState`.
- **Étape refactor pure** : à la fin du ticket l'écran est encore l'empilement actuel, les
  tests existants passent inchangés. C'est ce qui rend les tickets suivants sûrs.

Critères : `pnpm test` vert sans modifier un test ; un déplacement de visée dans le
planétarium déplace le cadre du grand champ.

### T-0016 — Coque à trois colonnes

- Nouveau `src/ui/Coque.tsx` : `topbar` + `aside.materiel` + `div.scene` + `aside.seance`,
  en CSS grid `grid-template-columns: 20rem 1fr 24rem` sur `height: 100dvh`.
- `src/ui/styles.css` : la coque remplace `main { max-width: 70rem }`. Les deux `aside`
  scrollent (`overflow-y: auto`), la scène **jamais**. `min-height: 0` sur les pistes de
  grid, sinon le canevas pousse la grille et le scroll de page revient.
- Repli sous 1100 px : une colonne, panneaux en accordéon sous la scène (la scène garde
  `aspect-ratio: 16/9`). Cibles ≥ 44 px conservées (`--cible-clic`).
- `@media print` (`styles.css:425`) : la coque et les deux panneaux disparaissent, le plan de
  session reste imprimable — §11.2.

Critères : aucun scroll horizontal ni vertical de page à 1440×900 ; mode nuit basculé, aucun
canal vert ou bleu dans la coque ; impression = plan seul.

### T-0017 — Panneau « Matériel » (gauche)

Extraction depuis `App.tsx:392-466` et `App.tsx:472-510` vers `src/ui/PanneauMateriel.tsx` :
focale, ouverture, mode capteur, comparaison de cadres, type d'objectif (aujourd'hui perdu
dans `GrandChamp.tsx:313-322` alors que c'est une propriété du matériel), suivi + mise en
station + monture ; puis les lectures directes de ce matériel (champ L/H, échantillonnage et
son diagnostic, pupille, pouvoir séparateur, NPF, pose max suivi) en `TracedValue`.

Critères : changer la focale redessine le cadre sur la scène sans que rien d'autre bouge ;
chaque nombre reste dépliable jusqu'à sa formule (§1.5.2) ; le type d'objectif pilote le mode
de projection disponible pour la scène.

### T-0018 — Panneau « Séance » à onglets (droite)

`src/ui/PanneauSeance.tsx` — groupe « Séance » toujours visible en tête (lieu, longitude,
altitude, date, Bortle, SQM, masque d'horizon), puis quatre onglets :

| Onglet | Contenu | Provenance |
|---|---|---|
| Explorer | couches (figures, frontières, astérismes, cadre, horizon), mode de temps, facteur, pas astronomiques, projection, champ, vue réaliste | `Planetarium.tsx:470-624` |
| Cible | fiche de cadrage, détectabilité, pose, intégration | `FicheCible` monté tel quel |
| Nuit | fenêtre nocturne, fond de ciel, plan de session ordonné, pointage | `App.tsx:512-568` + `PlanSessionVue` |
| Filé | carte de pose max, pose unitaire, durée, intervalle, température, autonomie, espace carte, séquence | `GrandChamp.tsx:381-552` |

`GrandChamp.tsx` perd son canevas et devient le contenu de l'onglet Filé (renommer en
`PanneauFile.tsx`). Un clic sur un objet de la scène bascule sur l'onglet Cible.

Critères : un seul jeu de réglages visible à la fois ; aucun onglet ne dépasse une hauteur
d'écran en 1440×900 au niveau Confirmé ; l'onglet actif survit à un changement de matériel.

### T-0019 — Incrustation du filé dans le cadre, sur la scène

Le cœur du lot. `src/ui/scene-overlay.ts` (nouveau, ~80 lignes) :

1. Rendre `dessineChamp` dans un `OffscreenCanvas` 1920×1080 avec **le `Vue` de la scène**
   (donc le même projecteur que `dessineCiel`) — les arcs tombent exactement sur les étoiles
   du ciel environnant.
2. Dans la boucle RAF (`Planetarium.tsx:274-352`), après `dessineCiel` : `ctx.save()`, tracer
   le contour du cadre depuis `contourCadreJ2000` + projecteur, `ctx.clip()`,
   `ctx.drawImage(offscreen, 0, 0)`, `ctx.restore()`, puis retracer le liseré du cadre par
   dessus. Si `dessine-ciel.ts` garde son tracé de contour en local, l'exporter — ne pas le
   réécrire (§3.3 interdit deux codes de projection).
3. Le rendu offscreen est **statique** : recalculé sur changement de pointage, fov, mode,
   date, matériel, pose, durée, Voie lactée, mode nuit. Pas à 60 Hz.
4. Activer l'incrustation **fige le temps** (`modeTemps = 'FIGE'`) : un filé est une
   composition fixe, et `GrandChamp.tsx:9-11` note déjà que la vue animée reste le §3.
5. Le vignettage se centre sur le canevas, pas sur le cadre : désactivé en incrustation, son
   chiffre en diaphragmes reste dans le panneau, et l'écran le dit.
6. Si la projection de la scène ≠ celle de l'objectif (stéréographique alors que l'objectif
   est rectilinéaire), afficher la mention et un bouton « voir comme l'objectif » qui pose
   `mode = MODE_CADRE | MODE_FISHEYE` et `fov = champ du cadre` — ce qui donne le filé plein
   écran par simple cadrage, sans second mode d'affichage.

Critères : pose unitaire portée au-delà de la pose max du cadre → les étoiles s'ovalisent
**dans le cadre, sur la scène**, et la traînée en pixels s'affiche dans le panneau ; durée
totale portée de 5 à 480 min → les arcs s'allongent autour du pôle de l'époque, jamais
recentré ; le rendu de l'incrustation ne fait pas tomber le compteur d'images du ciel.

### T-0020 — Tiroir « Vérification » et tests de coque

- `src/ui/Verification.tsx` : `<details>` ou panneau glissant portant `App.tsx:653-753`
  (état du socle, export/import, matrice de dégradation, registre de constantes). Accessible
  depuis la topbar, fermé par défaut.
- `ModeNuit` (`App.tsx:651`) remonte dans la topbar : un interrupteur + le curseur de
  luminance dans un popover.
- Nouveau `tests/coque.test.tsx` : présence des trois régions, bascule d'onglets, un clic
  objet ouvre l'onglet Cible, l'incrustation fige le temps.
- Mettre à jour les tests qui interrogent l'ancienne mise en page :
  `tests/contrat-entree.test.tsx`, `tests/previsu-champ.test.tsx`, `tests/mode-nuit.test.tsx`,
  `tests/cible.test.tsx`. Les tests de moteurs (`grand-champ`, `file-etoiles`, `projection`…)
  ne doivent **pas** changer — s'ils changent, c'est qu'un moteur a bougé, ce que ce lot
  interdit.

## Fichiers

Nouveaux : `src/ui/Coque.tsx`, `src/ui/PanneauMateriel.tsx`, `src/ui/PanneauSeance.tsx`,
`src/ui/Verification.tsx`, `src/ui/scene-etat.ts`, `src/ui/scene-overlay.ts`,
`tests/coque.test.tsx`.

Modifiés : `src/App.tsx` (de 758 lignes à une composition d'une centaine),
`src/ui/Planetarium.tsx` (garde canevas + boucle + interactions, perd ses réglages),
`src/ui/GrandChamp.tsx` → `PanneauFile.tsx` (perd son canevas), `src/ui/styles.css`,
`src/ui/dessine-ciel.ts` (export du tracé de contour de cadre, si local).

Intouchés : tout `src/core/`, `src/data/`, `src/registry/`, `src/ui/dessine-champ.ts`.

## Vérification

```bash
pnpm typecheck && pnpm test        # aucun test de moteur modifié
pnpm dev                           # port 5173 déjà occupé au dernier scan ovrsee : le libérer
```

À l'écran, dans l'ordre :

1. 1440×900 : aucune barre de défilement de page. La scène remplit la colonne centrale.
2. Focale 120 → 400 mm : le cadre se resserre sur la scène, champ et échantillonnage
   changent à gauche, rien ne bouge à droite.
3. Capteur plein format → APS-C : cadre plus serré, échantillonnage **inchangé** (§5.1), la
   note de recadrage apparaît.
4. Onglet Filé, pose 8 s → 60 s : les étoiles s'ovalisent dans le cadre, l'avertissement de
   dépassement et le bouton de correction apparaissent.
5. Durée 14 min → 240 min : les arcs s'allongent, la troncature aux bords est signalée, le
   pôle reste où il est.
6. Clic sur M31 dans la scène : l'onglet Cible s'ouvre avec cadrage, détectabilité, pose.
7. Mode nuit : coque, panneaux, onglets et canevas en rouge sur noir, curseur de luminance
   au plancher, aucune animation non sollicitée (§11.1).
8. Impression : le plan de session seul, sans panneaux ni canevas.
9. `ovrsee` : rescan des pages pour rafraîchir les captures, périmées depuis le lot 4.
