---
{
  "status": "open",
  "title": "Le fond du ciel montre la pollution lumineuse — 5 tickets ovrsee",
  "opened": "2026-08-21",
  "closed": null,
  "commits": [
    {
      "sha": "dd0680c",
      "date": "2026-08-21",
      "files": [
        "scripts/bench-ciel.ts",
        "scripts/bench-incrustation.ts",
        "src/App.tsx",
        "src/core/fond-ciel-rendu.ts",
        "src/core/moon.ts",
        "src/core/projection.ts",
        "src/core/sol.ts",
        "src/registry/bortle.ts",
        "src/registry/constants.ts",
        "src/registry/formulas.ts",
        "src/ui/BarreHaut.tsx",
        "src/ui/MenuInfos.tsx",
        "src/ui/PanneauExplorer.tsx",
        "src/ui/Planetarium.tsx",
        "src/ui/RegionSeance.tsx",
        "src/ui/balayage-ecran.ts",
        "src/ui/couleurs.ts",
        "src/ui/dessine-champ.ts",
        "src/ui/dessine-ciel.ts",
        "src/ui/dessine-fond-ciel.ts",
        "src/ui/dessine-sol.ts",
        "src/ui/planetarium-boucle.ts",
        "src/ui/planetarium-incrustation.ts",
        "src/ui/scene-overlay.ts",
        "tests/cadre.test.ts",
        "tests/coque.test.tsx",
        "tests/dessine-ciel.test.ts",
        "tests/fond-ciel.test.ts",
        "tests/previsu-champ.test.tsx",
        "tests/projection.test.ts",
        "tests/scene-etat.test.ts"
      ]
    },
    {
      "sha": "2c26788",
      "date": "2026-08-21",
      "files": [
        "tests/plan-session.test.ts"
      ]
    },
    {
      "sha": "73a3876",
      "date": "2026-08-21",
      "files": []
    },
    {
      "sha": "14b4ba9",
      "date": "2026-08-21",
      "files": []
    }
  ]
}
---

# Le fond du ciel montre la pollution lumineuse — 5 tickets ovrsee

## Context

La case **« Vue réaliste — plafonnée par le fond de ciel »** (`src/ui/PanneauExplorer.tsx:114`)
ne fait aujourd'hui qu'une chose : plafonner la magnitude limite du rendu par `mLimOeil`
(`src/core/projection.ts:246-267`). Le fond, lui, reste `#05070d` quel que soit le site
(`src/ui/couleurs.ts:105`, `src/ui/dessine-ciel.ts:426`).

Conséquences observées :

- l'effet est **invisible** dans le cas par défaut — Bortle 4,5 → `mLimOeil` 6,05 contre 6,5
  au champ de référence : 0,45 mag, soit quelques dizaines de points d'un pixel qui
  disparaissent ;
- au-delà du champ de bascule `60 × 10^((6,5 − mLimOeil)/5)` (74° à B4,5 ; 150° à B8) le `min`
  renvoie la valeur du zoom : la case est **inerte par construction** ;
- le ciel d'un centre-ville et celui d'un col de montagne se rendent avec **le même fond**, ce
  qui est la moitié fausse de la promesse « le ciel tel qu'il serait vu » (§3.3, critère
  d'acceptation ligne 657 du PRD).

Objectif : la vue réaliste éclaircit le fond selon le fond de ciel réel du site, dans l'esprit
du dégradé de référence — centre-ville gris-bleu pâle, pleine montagne quasi noir.

Le PRD ne spécifie pas la couleur du fond : §3.3 ne donne à `sb_ciel` que « plafonne
`mag_limite` en vue réaliste ». C'est donc une **extension de rendu**, documentée comme telle
dans le registre (précédent : `FOV_MAX_GNOMONIQUE_DEG`, convention produit assumée, T-0095).
`prd.md` n'est pas modifié.

## Modèle physique retenu

Une seule règle de composition, celle que le projet applique déjà pour la Lune
(`src/registry/formulas.ts:391-394`) : **les brillances s'additionnent en nanolamberts**, jamais
en magnitudes.

```
B_total(direction) = B_site × vanRhijn(h)      ← halo du site, T-0098
                   + B_crepuscule(h_soleil)    ← T-0099
                   + B_lune(ρ, h_lune, α)      ← T-0100, déjà implémenté
sb_effectif        = sb⁻¹(B_total)
```

**Rendu écran** — la luminance d'écran est proportionnelle à la brillance physique, avec **une**
constante libre (l'exposition) calée pour que le ciel le plus noir de la table Bortle soit juste
au-dessus du noir :

```
Y_ecran = K_EXPOSITION_FOND_CIEL × nanolamberts(sb)     K = 5,07e-5 Y/nL
          → Y = 0,003 à sb = 21,9 (B1)
```

Le rapport B9/B1 vaut alors 36×, exactement le rapport physique. Chromaticité fixe (bleu-violet
`0,62 : 0,72 : 1,00` en lumière linéaire), échelonnée par la luminance :

| | B1 | B4 | B6 | B8 | B9 | B6 horizon | B4 + pleine Lune |
|---|---|---|---|---|---|---|---|
| sb | 21,9 | 21,3 | 19,9 | 18,5 | 18,0 | 18,9 | 18,8 |
| fond | `#06070a` | `#0b0c10` | `#1c1f25` | `#3a3f4a` | `#494f5d` | `#30343d` | `#323641` |

**Briques déjà présentes, à réutiliser — rien à réécrire :**

| Besoin | Existe déjà |
|---|---|
| sb → nanolamberts | `nanolamberts()` — `src/core/moon.ts:106` |
| masse d'air valide à l'horizon | `masseAirKS()` — `src/core/moon.ts:99` |
| extinction V | `K('EXTINCTION_V_MAG_PAR_MASSE_AIR')` = 0,172 |
| halo lunaire complet (Krisciunas & Schaefer 1991) | `deltaSbLune()`, `diffusionKS()`, `sbCielAvecLune()` — `src/core/moon.ts` |
| Bortle → sb | `interpoleBortle()` — `src/registry/bortle.ts:69` |
| sb → mag limite œil nu | `mLimOeilDepuisSb()` — `src/registry/bortle.ts:86` |
| `sbCiel` déjà transmis à la boucle de rendu | `EntreeDessin.sbCiel` — `src/ui/dessine-ciel.ts:111` |
| balayage écran / dichotomie sur un prédicat de direction | `dessineSol()` — `src/ui/dessine-sol.ts` |
| valeur tracée affichable | `trace()` / `TracedValue` |

## Décisions arbitrées

1. **Mode nuit : le fond reste noir.** Le mode nuit protège l'adaptation à l'obscurité sur le
   terrain ; éclaircir tout le canevas le rendrait inutile. En mode nuit la vue réaliste ne
   change que la magnitude limite. Le test `tests/dessine-ciel.test.ts:421` (aucune composante
   verte ni bleue) reste vert sans modification.
2. **Bortle toujours renseigné** — défaut 4,5 (`src/ui/app-saisie.ts:22`). Pas de branche
   « fond de ciel inconnu » : `sbCiel` est toujours défini.
3. **Hors table Bortle, la magnitude limite plafonne, elle n'est pas extrapolée.** Sous la Lune
   ou au crépuscule, `sb_effectif` descend sous 18 et `mLimOeilDepuisSb` rend `null`. On borne
   au bord de table (4,0) **en le déclarant**, comme `src/registry/contrast.ts:47` plafonne le
   seuil de Blackwell au-delà du dernier palier. Aujourd'hui `magnitudeRendue` ne plafonne
   **rien** quand `mLimOeil` est `null` — un ciel plus clair montre donc plus d'étoiles. C'est
   un bug, corrigé en T-0100.
4. **Le contraste des repères est compensé, pas re-arbitré.** Chaque teinte conserve le
   **rapport de contraste WCAG qu'elle a aujourd'hui** contre le fond de référence `#05070d`.
   Mesuré : `frontieres` tombe de 2,14:1 à 1,15:1 et `figures` de 4,51:1 à 1,84:1 sur un fond
   B9 — les repères disparaissent, exactement ce que §3.7 interdit (« un fond peint par-dessus
   le repérage masque ce qui sert à s'orienter »). Préserver le rapport existant évite
   d'introduire un seuil arbitraire et de re-litiger la palette.
5. **Le sol ne s'éclaircit pas** dans ce lot. Hors périmètre, dit explicitement dans l'épique.
6. **Pas d'asymétrie en azimut.** Le dôme lumineux d'une ville est plus clair de son côté ;
   l'atlas VIIRS qui le donnerait est écarté par le PRD §4.1 (réseau exigé). Le halo du site
   reste donc symétrique en azimut — limite déclarée dans le glossaire.

## Livrable : 5 fichiers dans `ovrsee/tickets/`

Aucun index à mettre à jour (`ovrsee/` n'en a pas). `"plan"` est à renseigner avec le nom du
plan capturé dans `ovrsee/plans/` s'il existe, sinon `null`. Front-matter JSON entre `---`,
puis `## Contexte` et `## Critères d'acceptation` — format de `T-0095`.

---

### 1. `T-0096-le-fond-du-ciel-montre-la-pollution-lumineuse-du-site.md`

```json
{
  "id": "T-0096",
  "titre": "Le fond du ciel montre la pollution lumineuse du site",
  "type": "epic",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "l",
  "tags": ["planetarium", "rendu", "prd"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
```

**Contexte** — reprendre la section *Context* ci-dessus, condensée : ce que la case fait
aujourd'hui, pourquoi elle paraît inerte (les deux chiffres : 0,45 mag au défaut, champ de
bascule 74°), et la promesse §3.3 tenue à moitié. Nommer la règle de composition additive en
nanolamberts et le fait que `moon.ts` la pratique déjà. Nommer les six décisions arbitrées.

**Critères d'acceptation**
- [ ] T-0097 à T-0100 sont livrés ; chacun se vérifie seul.
- [ ] Un seul moteur calcule `sb_effectif` : tous les contributeurs passent par lui, aucun
      n'écrit de couleur.
- [ ] Le fond de ciel affiché est une valeur tracée : l'utilisateur peut lire sa décomposition
      (site, halo d'horizon, crépuscule, Lune) comme il lit `magnitude_limite_rendue`.
- [ ] Hors périmètre, dit dans l'app et pas seulement dans le ticket : le sol ne s'éclaircit
      pas, le halo reste symétrique en azimut (atlas VIIRS écarté §4.1), la teinte du
      crépuscule ne vire pas vers l'azimut du Soleil.
- [ ] Mode nuit : le fond reste `#000000` dans les quatre tickets.

---

### 2. `T-0097-le-fond-du-ciel-prend-la-luminance-du-site.md`

```json
{
  "id": "T-0097",
  "titre": "Le fond du ciel prend la luminance du site",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
```

**Contexte** — le socle : teinte uniforme dérivée de `sbCiel`, plus la compensation de
contraste des repères. Donner le modèle `Y = K × nanolamberts(sb)`, la table des sept couleurs,
et le fait que l'exposition est **une seule** constante de registre — le rapport B9/B1 de 36×
est physique, pas choisi. Citer la mesure de contraste : `frontieres` 2,14:1 → 1,15:1 sur fond
B9 sans compensation.

**Fichiers**
- `src/registry/constants.ts` — `K_EXPOSITION_FOND_CIEL` (5,066e-5 Y/nL, source : « extension
  de rendu, calée pour Y = 0,003 à sb = 21,9 (B1) ; le rapport des luminances est physique »)
  et la chromaticité `CHROMA_FOND_CIEL_R/V/B` (0,62 / 0,72 / 1,00).
- `src/core/fond-ciel-rendu.ts` *(nouveau)* — `luminanceEcran(sb): Traced<number>` et
  `composantesFond(sb): readonly [number, number, number]` en lumière linéaire. Pur, aucun
  littéral (`tests/registry.test.ts:43` interdit tout nombre non trivial dans `src/core/`).
- `src/ui/couleurs.ts` — `fondRealiste(sb)` (encodage sRGB) et
  `ajusteContrasteSurFond(teinte, fond)` : résout la luminance de la teinte pour retrouver son
  rapport WCAG contre `#05070d`, plafonne au blanc et le signale. `palette()` gagne une
  variante `paletteRealiste(sb)` ; `palette(modeNuit)` reste inchangée.
- `src/ui/planetarium-boucle.ts`, `src/ui/Planetarium.tsx` — `vueRealiste` entre dans
  `EtatBoucle` : il n'y est pas aujourd'hui, seul `magLimite` en dépend.
- `src/ui/dessine-ciel.ts:426` et `src/ui/dessine-champ.ts:290` — le `fillRect` du fond prend
  la teinte réaliste. Le champ incrusté (§9.5) suit le même fond : deux fonds différents dans
  une même image se verraient.
- `src/ui/PanneauExplorer.tsx` — l'intitulé de la case ne mentionne plus la seule magnitude.

**Critères d'acceptation**
- [ ] Case décochée : le fond est `#05070d`, inchangé au pixel près.
- [ ] Case cochée, Bortle 1 → `#06070a` ; Bortle 6 → `#1c1f25` ; Bortle 9 → `#494f5d`
      (tolérance 1/255 par canal). Un SQM mesuré prévaut sur le Bortle : la teinte suit
      `sbCiel`, jamais le champ Bortle saisi.
- [ ] Aucune couleur écrite en dur : l'exposition et la chromaticité viennent du registre,
      `tests/registry.test.ts` reste vert.
- [ ] Chaque teinte de repère conserve, à 2 % près, le rapport de contraste qu'elle a
      aujourd'hui sur `#05070d` — vérifié à B1, B6 et B9.
- [ ] Mode nuit : fond `#000000`, aucune composante verte ni bleue écrite
      (`tests/dessine-ciel.test.ts:421` inchangé et vert).
- [ ] L'aperçu incrusté (§9.5) et le planétarium montrent le même fond.
- [ ] `pnpm bench:file` ne régresse pas : le fond reste **un** `fillRect`.

---

### 3. `T-0098-le-halo-s-eclaircit-vers-l-horizon.md`

```json
{
  "id": "T-0098",
  "titre": "Le halo s'éclaircit vers l'horizon",
  "colonne": "pret",
  "priorite": "basse",
  "charge": "m",
  "tags": ["planetarium", "rendu", "performance"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
```

**Contexte** — un fond uniforme est faux dans un détail que l'œil connaît : le ciel est plus
clair près de l'horizon. La couche émissive est vue sous une épaisseur croissante (van Rhijn,
1921), atténuée par l'extinction du trajet :

```
B(h) = B_zenith × vanRhijn(h) × 10^(−0,4 k (X(h) − 1))
vanRhijn(h) = 1 / √(1 − (R/(R+H))² cos²h)        H ≈ 90 km, couche d'airglow
```

Chiffré avec `masseAirKS` et k = 0,172 : ×3,19 à l'horizon (−1,26 mag/as²), ×2,08 à 20°,
×1,31 à 45°, 1,00 au zénith. Sans le terme d'extinction, van Rhijn seul donnerait ×6 à
l'horizon — valeur non observée. *(Corrigé à la livraison de T-0098 : le plan annonçait ×2,9 à
l'horizon, valeur d'une couche émissive plus haute que les 90 km retenus. Les trois autres
étaient justes.)*

**Implémentation** — pas de gradient d'écran : les courbes iso-hauteur ne sont des cercles à
l'écran qu'en stéréographique visée au zénith, et deviennent des coniques en gnomonique. On
généralise le balayage de `src/ui/dessine-sol.ts` (240 rayons, dichotomie 12 passes sur
`Projecteur.inverse`) d'un prédicat `sousLeSol` à un prédicat `hauteur < h_i`, pour N paliers
de hauteur venus du registre, peints du plus bas au plus haut. Le commentaire d'en-tête de
`dessine-sol.ts` explique pourquoi le balayage écran est la bonne géométrie — même raison ici.
`ponytail:` N paliers plutôt qu'un dégradé continu ; passer au dégradé si les paliers se voient.

**Critères d'acceptation**
- [ ] Le nombre de paliers et la hauteur de la couche émissive sont au registre, avec source
      (van Rhijn 1921) ; aucun nombre dans le moteur.
- [ ] Test du profil : `B(0°)/B(90°)` vaut 3,19 ± 0,05 à k = 0,172 ; monotone décroissant de
      l'horizon au zénith ; exactement 1,00 au zénith.
- [ ] Le halo est peint **sous** le sol, la bande galactique et tous les repères : visée basse,
      le relief le recouvre (mêmes règles d'ordre que §3.7 et T-0094).
- [ ] Visée au zénith, champ 60° : le halo est concentrique et sans discontinuité visible ;
      visée à l'horizon : les paliers suivent la crête, pas le bord du canevas.
- [ ] Vrai dans les trois projections, y compris à 150° en gnomonique (T-0095).
- [ ] `pnpm bench:file` : le surcoût par image est mesuré et inscrit dans le ticket. Au-delà
      d'un budget déclaré, le nombre de paliers baisse — pas la fréquence d'image.
- [ ] Mode nuit : aucun halo.

---

### 4. `T-0099-le-crepuscule-eclaircit-le-fond-du-ciel.md`

```json
{
  "id": "T-0099",
  "titre": "Le crépuscule éclaircit le fond du ciel",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu", "nuit"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
```

**Contexte** — c'est le mensonge le plus gros de la vue réaliste : à 21 h en juin, Soleil à
−6°, le vrai ciel est bleu franc et l'on ne voit qu'une poignée d'étoiles. L'app rend le même
fond qu'en pleine nuit et la même magnitude limite. Le curseur de temps traverse le crépuscule
à chaque séance : `fenetreNocturne` (`src/core/night.ts:108`) connaît déjà les seuils, personne
n'en tire la brillance du ciel.

La contribution crépusculaire s'ajoute en nanolamberts comme les autres. **La table
sb(dépression solaire) reste à figer** : elle doit venir d'une source publiée et citée — piste
`Patat, Ugolnikov & Postylyakov (2006), A&A 455, 385`, brillance V du ciel de Paranal de 0° à
−20° de dépression. Rien n'est codé avant que la source soit lue : une valeur plausible
inventée finit en constante puis en test faux.

D'où `a-specifier` : ce ticket se spécifie avant de se coder.

**Critères d'acceptation**
- [ ] La table est au registre avec sa citation complète, ses bornes, et l'interdiction
      d'extrapoler au-delà (même règle que `TABLE_BORTLE`).
- [ ] Au-delà de −18° (nuit astronomique) la contribution est exactement nulle : le fond
      redevient celui du site, au pixel près.
- [ ] Contribution monotone croissante quand le Soleil remonte ; continue au raccord des −18°
      (pas de saut visible en faisant glisser le curseur de temps).
- [ ] La magnitude limite suit le fond de ciel effectif : à Soleil −6°, la vue réaliste ne
      montre qu'une poignée d'étoiles. Hors table Bortle, elle plafonne au bord et le déclare
      (décision 3), elle ne cesse pas de plafonner.
- [ ] Une nuit d'été à 50° de latitude — crépuscule nautique permanent — ne produit ni fond
      noir ni valeur absente : le cas est rendu et nommé.
- [ ] Hors périmètre et dit : la teinte ne vire pas vers l'azimut du Soleil.

---

### 5. `T-0100-la-lune-eclaircit-le-ciel-autour-d-elle.md`

```json
{
  "id": "T-0100",
  "titre": "La Lune éclaircit le ciel autour d'elle",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu", "lune"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
```

**Contexte** — une pleine Lune haute lève le fond de ciel de 2 à 3 mag/as² : plus que quatre
crans de Bortle. Le plan de séance le chiffre déjà (`deltaSbLune`, §8.1), le planétarium
l'ignore — fond et magnitude limite identiques Lune levée ou couchée. Le moteur existe
entièrement : `deltaSbLune`, `diffusionKS(ρ)`, `sbCielAvecLune`, `masseAirKS`. Il ne manque que
son branchement au rendu.

Le halo lunaire est le seul contributeur **naturellement radial** : `diffusionKS(ρ)` est une
fonction de la séparation angulaire à la Lune. Un dégradé radial centré sur la position écran
de la Lune est donc la géométrie juste, pas une approximation — Rayleigh près d'elle, Mie
au-delà.

Ce ticket corrige aussi un bug existant : `magnitudeRendue`
(`src/core/projection.ts:257-259`) ne plafonne **rien** quand `mLimOeil` est `null`. Un ciel
hors table — donc plus clair que Bortle 9 — montre aujourd'hui *plus* d'étoiles qu'un ciel de
banlieue. Corriger dans `magnitudeRendue`, où tous les appelants passent.

**Critères d'acceptation**
- [ ] Lune sous l'horizon : contribution exactement nulle, quelle que soit la phase (règle 1
      de `moon.ts`, piège classique D1). Vérifié par test.
- [ ] Pleine Lune à 60° de hauteur, Bortle 4 : le fond près de la Lune est nettement plus clair
      qu'à 120° d'elle ; le profil suit `diffusionKS`, décroissant avec ρ.
- [ ] Aucune duplication du modèle : le rendu appelle `deltaSbLune` / `diffusionKS`, il ne
      recalcule ni la phase ni la masse d'air.
- [ ] La position écran de la Lune vient du même `etatLune` que le corps dessiné : le halo est
      centré sur la Lune affichée, à toute projection et toute rotation de cadre.
- [ ] `magnitudeRendue` plafonne aussi quand `sb_effectif` sort de la table : borne de table
      (4,0) et cause déclarée, jamais « pas de plafond ». Test de non-régression sur ce chemin.
- [ ] Le plan de séance et le planétarium annoncent le même fond de ciel à la même minute pour
      la même direction — un seul moteur, deux écrans (règle T-0089).
- [ ] Mode nuit : aucun halo.
```

## Ordre d'exécution

`T-0097` d'abord — il pose le moteur, la constante d'exposition et la compensation de
contraste. `T-0098`, `T-0099`, `T-0100` sont ensuite indépendants ; `T-0099` attend sa source
publiée, `T-0100` est le moins cher (moteur déjà écrit) et corrige le bug de plafond.

## Vérification

Ce lot ne produit que des fichiers Markdown dans `ovrsee/tickets/` :

```bash
ls ovrsee/tickets/T-009[6-9]* ovrsee/tickets/T-0100*
head -14 ovrsee/tickets/T-0096-*.md          # front-matter JSON valide, entre --- ---
python3 -c "import json,sys,glob,re
for f in sorted(glob.glob('ovrsee/tickets/T-0[019]*')):
    t=open(f).read().split('---')[1]
    json.loads(t)"                            # les 5 front-matter parsent
```

Aucun code touché, donc `pnpm typecheck && pnpm test` doit rester exactement dans l'état du
`main` courant — à lancer quand même pour le prouver.

La vérification des tickets eux-mêmes est dans leurs critères : chacun est exécutable seul, et
`T-0097` est le seul dont dépendent les trois autres.
