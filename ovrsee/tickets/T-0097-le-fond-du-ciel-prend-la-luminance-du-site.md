---
{
  "id": "T-0097",
  "titre": "Le fond du ciel prend la luminance du site",
  "epic": "T-0096",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-le-fond-du-ciel-montre-la-pollution-lumineuse-5-tickets-ovrs.md"
}
---

## Contexte

Socle de l'epic T-0096 : en vue réaliste, le fond prend la luminance du fond de ciel du site.
Teinte uniforme ici ; le dégradé vers l'horizon, le crépuscule et la Lune viennent après et
s'ajoutent à ce socle.

**Modèle.** La luminance d'écran est proportionnelle à la brillance physique du ciel, avec une
seule constante libre — l'exposition — calée pour que le ciel le plus noir de la table Bortle
soit juste au-dessus du noir :

```
Y_ecran = K_EXPOSITION_FOND_CIEL × nanolamberts(sb)     K ≈ 5,07e-5 Y/nL
          → Y = 0,003 à sb = 21,9 (Bortle 1)
```

Le rapport de luminance entre Bortle 9 et Bortle 1 vaut alors 36×, soit exactement le rapport
physique : il n'est pas choisi. `nanolamberts()` existe déjà (`src/core/moon.ts:106`).
Chromaticité fixe, bleu-violet, en lumière linéaire : 0,62 : 0,72 : 1,00.

| Bortle | 1 | 4 | 6 | 8 | 9 |
|---|---|---|---|---|---|
| sb (mag/as²) | 21,9 | 21,3 | 19,9 | 18,5 | 18,0 |
| fond | `#06070a` | `#0b0c10` | `#1c1f25` | `#3a3f4a` | `#494f5d` |

**Le contraste des repères doit être compensé.** Les teintes de la palette ont été choisies sur
un fond quasi noir. Mesuré en rapport WCAG : `frontieres` tombe de 2,14:1 à 1,15:1 et `figures`
de 4,51:1 à 1,84:1 sur un fond Bortle 9. Les repères disparaissent — exactement ce que §3.7
interdit : « un fond peint par-dessus le repérage masque ce qui sert à s'orienter ». La
compensation retient chaque teinte à **son** rapport actuel contre `#05070d`, plutôt que
d'introduire un seuil arbitraire et de re-litiger la palette.

**Fichiers**

- `src/registry/constants.ts` — `K_EXPOSITION_FOND_CIEL` et la chromaticité du fond, sourcées
  comme extension de rendu (« calée pour Y = 0,003 à sb = 21,9 ; le rapport des luminances est
  physique »).
- `src/core/fond-ciel-rendu.ts` (nouveau) — luminance d'écran et composantes linéaires depuis
  `sb`. Pur, aucun littéral : `tests/registry.test.ts:43` interdit tout nombre non trivial dans
  `src/core/`.
- `src/ui/couleurs.ts` — encodage sRGB du fond réaliste, et l'ajustement de contraste d'une
  teinte sur un fond donné. `palette(modeNuit)` reste inchangée ; une variante prend `sb`.
- `src/ui/planetarium-boucle.ts`, `src/ui/Planetarium.tsx` — `vueRealiste` entre dans
  `EtatBoucle` : il n'y est pas aujourd'hui, seul `magLimite` en dépend.
- `src/ui/dessine-ciel.ts:426`, `src/ui/dessine-champ.ts:290` — le `fillRect` du fond prend la
  teinte. L'aperçu incrusté suit le même fond : deux fonds différents dans une même image se
  verraient.
- `src/ui/PanneauExplorer.tsx` — l'intitulé de la case ne parle plus de la seule magnitude.

## Critères d'acceptation

- [x] Case décochée : le fond est `#05070d`, inchangé au pixel près.
- [x] Case cochée : Bortle 1 → `#06070a`, Bortle 6 → `#1c1f25`, Bortle 9 → `#494f5d`, à 1/255
      près par canal.
- [x] Un SQM mesuré prévaut sur le Bortle : la teinte suit `sbCiel`, jamais le champ Bortle.
- [x] Aucune couleur ni exposition écrite en dur : tout vient du registre, avec sa source.
      `tests/registry.test.ts` reste vert.
- [x] Chaque teinte de repère conserve à 2 % près le rapport de contraste qu'elle a aujourd'hui
      sur `#05070d` — vérifié à Bortle 1, 6 et 9.
- [x] Mode nuit : fond `#000000`, aucune composante verte ni bleue écrite —
      `tests/dessine-ciel.test.ts:421` inchangé et vert.
- [x] L'aperçu incrusté (§9.5) et le planétarium montrent le même fond.
- [x] Le fond reste un seul `fillRect` : `pnpm bench:file` ne régresse pas.

## Livré

- `src/registry/constants.ts` — `K_EXPOSITION_FOND_CIEL` (C-38, 5,066e-5 Y/nL) et la
  chromaticité `CHROMA_FOND_CIEL_R/V/B` (C-39 à C-41), déclarées extension de rendu.
- `src/core/fond-ciel-rendu.ts` *(nouveau)* — `luminanceEcran`, `composantesFond`,
  `sbDepuisNanolamberts`, `sbEffectifRendu`. Aucun littéral : `tests/registry.test.ts` vert.
- `src/ui/couleurs.ts` — `fondRealiste`, `ajusteContrasteSurFond`, `paletteRealiste`,
  `paletteScene`. Les coefficients sRGB et WCAG y restent, en tant que définitions d'espace
  de couleur, avec la raison écrite en tête de section.
- `src/ui/dessine-ciel.ts`, `src/ui/dessine-champ.ts` — le fond prend la teinte ; l'aperçu
  incrusté reçoit en plus `sbFond`, le fond EFFECTIF de la direction du cadre, sans quoi le
  rectangle de l'incrustation se verrait dès que le halo d'horizon est actif.
- `src/ui/Planetarium.tsx`, `planetarium-boucle.ts`, `scene-overlay.ts` — `vueRealiste`
  descend jusqu'à la boucle.
- `src/ui/PanneauExplorer.tsx` — « Vue réaliste — fond de ciel et magnitude limite du site »,
  et la note qui déclare ce qui reste hors périmètre.

**Écart assumé.** Le critère « chaque teinte conserve son rapport de contraste à 2 % près »
n'est pas atteignable pour les teintes déjà claires : sur un fond Bortle 9 (`#494f5d`), le
rapport maximal qu'un écran peut produire est 8,2:1, blanc pur compris, alors que `cadre` en
demande 10,6:1, `texte` 13,2:1 et `corps` 15,9:1. La compensation les mène donc au blanc et le
signale (`saturee`). Le test vérifie « rapport tenu à 2 % près OU saturation déclarée ». Les
teintes que le ticket visait — `frontieres` (2,14:1) et `figures` (4,57:1) — sont tenues.

**Vérification.** `pnpm typecheck && pnpm test` : 52 fichiers, 683 tests, verts.
`node scripts/bench-ciel.ts --empreinte` rend `830baeac` sur cette branche comme sur `main` :
case décochée, la scène est inchangée au pixel près. `pnpm bench:file` inchangé — le fond
reste un seul `fillRect`.
