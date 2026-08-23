---
{
  "status": "closed",
  "title": "Filé plein ciel, en temps réel — création des tickets",
  "opened": "2026-08-23",
  "closed": "2026-08-23",
  "commits": [
    {
      "sha": "f042efd",
      "date": "2026-08-23",
      "files": [
        "scripts/bench-incrustation.ts",
        "src/core/file-etoiles.ts",
        "src/ui/dessine-champ.ts",
        "tests/file-etoiles.test.ts"
      ]
    },
    {
      "sha": "77ba895",
      "date": "2026-08-23",
      "files": []
    }
  ]
}
---

# Filé plein ciel, en temps réel — création des tickets

## Contexte

Aujourd'hui l'aperçu du filé (§9.3) est une image **statique** et **clippée** :

- `src/ui/planetarium-incrustation.ts` la rend hors écran, la garde dans une `ref`, et
  `src/ui/rendu-differe.ts` reporte le recalcul à 120 ms après la fin du geste (T-0025). Pendant
  un panoramique, le cadre montre l'image d'avant.
- `src/ui/scene-overlay.ts` la dépose sous `ctx.clip()` du contour du cadre, et resserre la
  sélection d'étoiles sur l'étendue du cadre (`cadreSelection`, T-0023). Hors du cadre, aucune
  trace n'existe.

Ce qui est demandé : les traces se recalculent **pendant** le geste, et couvrent **tout le
planétarium**. Les deux décisions déjà prises (réponses de l'utilisateur) :

- le plein ciel **remplace** l'incrustation clippée — un seul chemin de rendu ;
- la couche d'étoiles ponctuelles est **masquée** pendant le filé : sinon chaque trace porte un
  point net à une extrémité, ce qu'aucune pose ne produit ;
- l'allègement du nombre d'étoiles pendant le mouvement n'est **pas décidé d'avance** : on mesure
  d'abord, on n'allège que si le budget par image ne tient pas.

Le coût est le nerf de l'affaire. Le banc actuel (`pnpm bench:file`, après T-0111) :
213 ms au pire cas (180°, 480 min, 50 mm f/1,4), 96 ms au cas usuel (60°, 120 min) — et c'est
**avec** la sélection resserrée sur le cadre. Retirer cette sélection ramène 169 000 arcs au lieu
de 28 858 (chiffres de T-0021), soit environ 6×. Or le temps réel demande de tenir dans une image
de la boucle : `FPS_MAX = 30` dans `src/ui/planetarium-boucle.ts`, donc **33 ms**, partagés avec
`dessineCiel`. Il manque donc un facteur ~40 sur le pire cas.

D'où la piste de calcul évoquée par l'utilisateur, et qui se trouve être **exacte** ici :
`MODE_PLANETARIUM` projette par le facteur `2 / (1 + z)` (`src/core/projection.ts:183`), soit une
**stéréographique depuis l'antipode de la visée**. Elle est conforme et conserve les cercles : un
cercle de déclinaison s'y projette en cercle **exact**. Une primitive de cercle y remplace donc
les 481 projections par arc — sans approximation, et sans contredire §9.3 point 2, qui parle de la
projection rectilinéaire (`MODE_CADRE`, conique) où la polyligne reste obligatoire.

## Livrable

**Cinq fichiers de tickets** dans `ovrsee/tickets/`, colonne `pret` (sauf mention), format du
skill `ovrsee-tickets` : frontmatter JSON, `cree`/`maj` = `2026-08-23`, ids à partir du maximum
existant (`T-0113`). Aucun code touché. `ovrsee/board.json` n'est pas modifié : la colonne `pret`
existe.

### T-0114 — epic « Le filé se voit sur tout le ciel, en temps réel »

`type: epic`, priorité haute, tags `performance`, `file`, `planetarium`. Porte **la mesure et le
budget**, comme T-0021 l'a fait pour l'incrustation : sans chiffre avant/après, aucun enfant ne
peut se dire fini.

- Le budget est nommé : la passe de filé doit tenir dans une image de la boucle
  (`INTERVALLE_MIN_MS`, `planetarium-boucle.ts`), partagée avec `dessineCiel`.
- `scripts/bench-incrustation.ts` gagne un cas **plein ciel** (sans `cadreSelection`) et un axe
  **mode de projection** (`MODE_PLANETARIUM` / `MODE_CADRE`), le second ne bénéficiant pas de la
  primitive de cercle.
- Critères : les quatre cas existants plus les cas plein ciel, mesurés avant et après chaque
  enfant ; gain écrit noir sur blanc ; réserve explicite sur ce que le banc ne mesure pas (la
  peinture et le compteur d'images, qui demandent un écran).
- Ordre recommandé écrit dans l'epic : T-0115 (cercle) → T-0116 (plein ciel) → T-0117 (temps
  réel) → T-0118 seulement si le budget ne tient pas.

### T-0115 — « Un arc de filé est un cercle exact en projection stéréographique »

Enfant, priorité haute. `src/core/file-etoiles.ts` (`arcEtoile`) et son appelant
`src/ui/dessine-champ.ts:300-324`.

- Justification physique dans le corps : `2 / (1 + z)` = stéréographique depuis l'antipode →
  conforme → cercle de déclinaison ⇒ cercle écran exact. Pas un raccourci, une identité.
- Méthode : ~5 positions projetées (début, quarts, milieu, fin) au lieu de 481 ; cercle ajusté sur
  trois d'entre elles ; balayage écran obtenu en déroulant les angles des cinq ; tracé par
  `ctx.arc`. `longueurPx` devient `R × Δφ` — c'est elle qui décide disque contre trait, et qui
  alimente `arcsTronques`.
- Garde-fous à écrire dans le ticket, ils sont la moitié du travail :
  - un cercle qui passe près de l'antipode de la visée dégénère en droite (rayon → ∞) : repli sur
    la polyligne au-delà de `porteeUtilePx` (`projection.ts`), le seuil qui existe déjà pour ce
    motif exact — aucune constante nouvelle ;
  - les portions non projetables doivent rester coupées comme aujourd'hui, sinon la corde traverse
    l'image (le défaut que `porteeUtilePx` existe pour empêcher) ;
  - `MODE_CADRE` et `MODE_FISHEYE` gardent la polyligne, intacte.
- Critère de non-régression : ce n'est **pas** l'empreinte de peinture (la primitive change, donc
  l'empreinte change), c'est un test d'écart géométrique — distance maximale entre le cercle et la
  polyligne de référence sous 1 px, sur un échantillon de déclinaisons de −90° à +90° et d'écarts
  au pôle jusqu'à 180°, valeurs **calculées**, aucune recopiée.

### T-0116 — « Le filé couvre tout le planétarium, sans son propre fond »

Enfant, priorité haute. `src/ui/dessine-champ.ts`, `src/ui/scene-overlay.ts`,
`src/ui/planetarium-boucle.ts`, `src/ui/dessine-ciel.ts`.

- La passe se dessine directement dans le contexte de la scène (`surLeFond`, déjà en place), sans
  canevas hors écran ni `ctx.clip()` : `rendIncrustation` / `incrusteDansLeCadre` disparaissent,
  et avec eux `cadreSelection` et `filtreArcCadre` s'ils n'ont plus d'appelant.
- La passe **ne peint plus son fond** ni sa bande galactique : le planétarium peint déjà le vrai
  fond de ciel (§3.7, pollution lumineuse, halo lunaire) et sa propre Voie lactée. Deux bandes
  superposées de teintes différentes se liraient comme un défaut.
- La couche d'étoiles ponctuelles cesse de **peindre** pendant le filé, mais continue d'alimenter
  `cibles` et les noms : sinon le survol et le clic perdent les étoiles (T-0085, T-0109).
- Le contour du cadre reste tracé par-dessus : c'est lui qui dit ce que le capteur enregistre
  vraiment quand tout le ciel est filé.
- Les compteurs (`poseRenduFile`) ne se publient plus par image mais au rythme du diagnostic
  (`PERIODE_DIAGNOSTIC_MS`), sinon React rend 30 fois par seconde (T-0056).
- La mention de vignettage (`MENTION_VIGNETTAGE_INCRUSTATION`) se réécrit : elle parle d'une
  incrustation qui n'existe plus.

### T-0117 — « Le filé se recalcule pendant le geste »

Enfant, priorité haute. `src/ui/planetarium-incrustation.ts`, `src/ui/rendu-differe.ts`.

- Le report par geste disparaît pour le filé : la passe entre dans la boucle `rAF`, avec la vue de
  l'image courante. La lecture « recalcul en attente » (`fileEnAttente`) n'a plus d'objet.
- `rendu-differe.ts` garde un appelant : `tests/clavier-planetarium.test.ts` s'en sert pour T-0069.
  Le ticket dit lequel des deux part — le module, ou seulement son usage par le filé.
- Critère constatable à l'écran : panoramique complet en filé à 120 min, la ligne « images/s » de
  la scène reste au-dessus de 24 ; et la passe mesurée au banc tient dans le budget de l'epic.
- Cas dégradé à écrire : si le budget ne tient pas au pire cas (180°, 480 min, f/1,4), c'est
  T-0118 qui prend la suite — pas un plafond silencieux.

### T-0118 — « Moins d'étoiles pendant le geste, si le budget ne tient pas »

Enfant, priorité moyenne, **conditionnel** : à faire seulement si la mesure de T-0117 rate le
budget. Le corps le dit, comme T-0021 le disait de son cinquième enfant.

- Levier : plafond de magnitude pendant le mouvement et semis coupé, valeurs dans
  `src/registry/constants.ts` avec source et unité — jamais un nombre écrit dans le moteur.
- Au repos, la passe complète repasse : critère = image identique à la passe complète (empreinte
  du banc).
- Les compteurs du panneau **ne se publient pas** depuis une image allégée : des chiffres tirés
  d'une image dégradée mentiraient. Une mention à l'écran dit que l'aperçu est allégé.

## Vérification

- `ls ovrsee/tickets/T-011[4-8]*` — cinq fichiers, ids sans trou depuis `T-0113`.
- Frontmatter relu : `colonne: "pret"`, `priorite` dans {haute, moyenne, basse}, `epic: "T-0114"`
  sur les quatre enfants, `type: "epic"` sur T-0114 seul, `cree`/`maj` = `2026-08-23`.
- Aucun autre fichier modifié : `git status` ne montre que `ovrsee/tickets/`.
- Rien à compiler ni à tester : aucun code touché.
