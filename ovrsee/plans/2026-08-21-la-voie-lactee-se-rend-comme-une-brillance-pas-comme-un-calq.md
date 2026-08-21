---
{
  "status": "closed",
  "title": "La Voie lactée se rend comme une brillance, pas comme un calque rose",
  "opened": "2026-08-21",
  "closed": "2026-08-21",
  "commits": [
    {
      "sha": "46fb479",
      "date": "2026-08-21",
      "files": [
        "scripts/bench-ciel.ts",
        "src/core/fond-ciel-rendu.ts",
        "src/core/galactique.ts",
        "src/registry/constants.ts",
        "src/registry/glossaire.ts",
        "src/ui/couleurs.ts",
        "src/ui/dessine-champ.ts",
        "src/ui/dessine-ciel.ts",
        "tests/dessine-ciel.test.ts",
        "tests/previsu-champ.test.tsx",
        "tests/voie-lactee.test.ts"
      ]
    }
  ]
}
---

# La Voie lactée se rend comme une brillance, pas comme un calque rose

## Contexte

Le planétarium peint la Voie lactée en **stries concentriques magenta couvrant tout le ciel**.
Le ciel réel — même au grand angle — montre une bande blanc-gris diffuse, sans bord franc,
large d'une dizaine de degrés, qui s'efface dès que le site est pollué.

Trois défauts visibles, **un seul mécanisme fautif** :

| Défaut | Cause |
|---|---|
| Stries à bords francs | `TRANCHES_BANDE` — 13 traits de 5° d'alpha discret, aucun flou, aucun plancher soustrait à la coupure (`src/ui/dessine-ciel.ts:183,342`) |
| Bande sur tout le ciel | coupure à `LATITUDE_BANDE_GALACTIQUE_MAX_DEG = 30` → ±30° peints à alpha ≥ 0,10 |
| Magenta | `voieLactee: 'rgb(205 125 175)'` (`src/ui/couleurs.ts:117`) — la lumière stellaire intégrée a B−V ≈ +0,9, elle est blanc-chaud |

Le mécanisme commun est `alpha × couleur saturée fixe`. Il n'a aucun contenu physique : l'alpha
et la couleur sont indépendants, donc une opacité faible d'une couleur saturée reste criarde, et
la bande ne peut pas s'effacer autrement qu'en s'éteignant d'un coup à un seuil calé à la main.

**T-0100 a livré hier le bon patron pour exactement ce problème** (`src/ui/dessine-fond-ciel.ts:146-156`) :
un contributeur de brillance se compose en **part de la brillance totale**, avec la couleur de la
somme. Alpha et couleur y sont couplés — une part élevée d'une couleur proche du fond reste
invisible. C'est ce couplage qui manque à la bande. Le halo lunaire et la Voie lactée sont le
même problème : une source de lumière diffuse ajoutée par-dessus le fond de ciel.

## Le modèle

Une seule règle, celle que le projet applique déjà (§8.1, T-0096 à T-0100) : **les brillances
s'additionnent en nanolamberts, jamais en magnitudes.**

```
B_bande(b)  = nanolamberts( SB_VOIE_LACTEE_PLAN_MAG + 2,5·log10( e^(|b|/h) ) )
              avec h = ECHELLE_LATITUDE_GALACTIQUE_DEG (déjà au registre)

part(b)     = B_bande(b) / (B_ciel + B_bande(b))
couleur(b)  = css( B_ciel·chroma_ciel + B_bande(b)·chroma_stellaire )
```

Vérification aux trois bouts de la table Bortle, avec `SB_VOIE_LACTEE_PLAN_MAG = 21,0` :

| Fond de ciel | part à b=0 | élévation du fond à b=0 | Rendu |
|---|---|---|---|
| Bortle 1 — 21,9 | 0,70 | −1,29 mag | bande franche |
| Bortle 4 — 21,3 | 0,57 | −0,71 mag | nette, atténuée |
| Bortle 8 — 18,5 | 0,09 | −0,10 mag | invisible |

Et en latitude, à Bortle 4 : b=20° → −0,30 mag, b=40° → −0,07 mag, b=60° → −0,03 mag. La bande
s'éteint d'elle-même en s'éloignant du plan, **sans coupure ni plancher**, parce que la part
élevée y multiplie une couleur devenue indiscernable du fond.

Conséquence : `contrasteVoieLactee` et ses quatre constantes de convention
(`SB_VOIE_LACTEE_PLEINE_MAG` 21,5 · `SB_VOIE_LACTEE_EFFACEE_MAG` 19,0 ·
`LATITUDE_BANDE_GALACTIQUE_MAX_DEG` 30 · `OPACITE_BANDE_GALACTIQUE` 0,45) **disparaissent**.
Deux entrées les remplacent : la brillance de la bande au plan, et sa chromaticité.

### Décisions arbitrées

1. **La bande n'entre pas dans `sbEffectifRendu`.** Elle ne plafonne pas la magnitude limite.
   L'y verser ferait *baisser* le nombre d'étoiles affichées à l'intérieur de la Voie lactée,
   soit l'inverse du ciel. Elle est une couche de rendu, pas un fond de ciel.
2. **Seule la bande perd le rose.** L'entrée de palette `voieLactee` reste `rgb(205 125 175)` :
   elle ne sert plus qu'au réticule du centre galactique et aux labels, où une teinte
   d'interface est légitime. La bande ne lit plus la palette du tout — sa couleur est calculée.
3. **Mode nuit : un seul chemin.** La chromaticité de la bande devient `(1, 0, 0)` en mode nuit,
   le modèle additif tourne à l'identique. Pas de seconde branche de rendu.
4. **Vue réaliste décochée** : le fond fixe `#05070d` ne correspond à aucune brillance, donc le
   contraste de la bande y est approché. C'est le mode qui ne promet pas le réalisme — limite à
   marquer `ponytail:`, pas à corriger.
5. **Le trait, pas le polygone**, reste la géométrie du planétarium (raison inchangée,
   `dessine-ciel.ts:176-179` : un polygone rompu au bord du champ se referme n'importe où).
   L'aperçu de champ garde ses polygones, il n'a pas ce problème.
6. **Longitude ignorée.** Le bulbe du Sagittaire est bien plus brillant que l'anticentre, et la
   Grande Faille coupe la bande en deux. Hors périmètre — ticket séparé, à spécifier : cela
   demande une carte de brillance en (l, b), donc une donnée à embarquer sous §12.2.

## Ce qui change

**`src/registry/constants.ts`** — deux entrées ajoutées, quatre retirées.

- `SB_VOIE_LACTEE_PLAN_MAG` ≈ 21,0 mag/as², `ordreDeGrandeur: true`. **La seule valeur du plan
  qui demande une source à vérifier** : les parties brillantes de la bande sont couramment
  citées autour de 21 mag/as² en V, le bulbe plutôt 20,5. À sourcer explicitement, pas à caler
  sur le rendu.
- `CHROMA_VOIE_LACTEE_R / _V / _B` — lumière stellaire intégrée, B−V ≈ +0,9 (géantes K plus
  rougissement) : chaude, R > V > B, de l'ordre de 1,00 : 0,86 : 0,66 avant normalisation.
  **Contrainte de définition** : le triplet est normalisé pour que sa luminance WCAG égale celle
  de `CHROMA_FOND_CIEL_*` (0,719), sans quoi bande et fond à brillance égale ne rendraient pas
  la même luminance et l'exposition `K_EXPOSITION_FOND_CIEL` ne s'appliquerait plus aux deux.
- Retirées : `SB_VOIE_LACTEE_PLEINE_MAG`, `SB_VOIE_LACTEE_EFFACEE_MAG`,
  `LATITUDE_BANDE_GALACTIQUE_MAX_DEG`, `OPACITE_BANDE_GALACTIQUE`.

**`src/core/fond-ciel-rendu.ts`** — deux fonctions, sur le modèle de `brillanceLuneNl` :

- `brillanceVoieLacteeNl(bDeg)` — brillance de la bande à cette latitude galactique. Réutilise
  `nanolamberts` (déjà importée) et `ECHELLE_LATITUDE_GALACTIQUE_DEG` (déjà au registre : c'est
  la même échelle de décroissance que la densité stellaire, elle n'est pas dupliquée).
- `composantesAvecBande(bCielNl, bBandeNl, modeNuit)` — somme pondérée des deux chromaticités,
  sœur de `composantesFond`. `composantesFond` n'est pas généralisée : `tests/fond-ciel.test.ts`
  vérifie sa table Bortle exacte.

**`src/core/galactique.ts`** — `contrasteVoieLactee` (lignes 75-79) supprimée.
`densiteRelative` reste : elle sert au comptage d'étoiles de `src/data/semis.ts`, usage juste.

**`src/ui/couleurs.ts`** — `bandeRealiste(bCielNl, bBandeNl, modeNuit)`, enveloppe `css()` de la
nouvelle fonction core, exactement comme `fondRealiste` (ligne 205). Palette inchangée.

**`src/ui/dessine-ciel.ts`** — `TRANCHES_BANDE` (183-197) supprimée, `traceBandeVoieLactee`
(342-361) réécrite : un trait par tranche de latitude fine, part et couleur du modèle,
`ctx.filter = blur(...)` pour fondre l'escalier — technique déjà en service à
`src/ui/dessine-champ.ts:126`, pas une nouveauté. `PAS_LATITUDE_BANDE_DEG` descend de 5° au pas
de l'aperçu (2°). `PLAN_GALACTIQUE` (168-171) est conservé tel quel pour l'ancre du label.

**`src/ui/dessine-champ.ts`** — `dessineVoieLactee` (118-166) passe au même modèle. Disparaissent :
`BANDE_B_MAX_DEG = 60`, le `plancher` soustrait, les deux couleurs en dur
(`rgb(150 160 190)` / `rgb(120 0 0)`), l'appel à `contrasteVoieLactee`.

**Tests** — `tests/dessine-ciel.test.ts:317-345` et `tests/previsu-champ.test.tsx:231-232`
testent la rampe supprimée. Ils sont réécrits sur le nouveau critère, pas supprimés : le
comportement testé (« atténuée à Bortle 4, effacée à Bortle 8 ») reste vrai et le devient par
la physique.

## Tickets à créer

Épique **T-0101** — *La Voie lactée se rend comme une brillance, pas comme un calque rose*,
colonne `pret`, priorité `moyenne`, charge `l`, tags `planetarium` `rendu` `prd`.

| Ticket | Titre | Colonne | Charge |
|---|---|---|---|
| T-0102 | La bande prend la brillance et la couleur de la lumière stellaire | `pret` | s |
| T-0103 | Le planétarium compose la bande en part de brillance | `pret` | m |
| T-0104 | L'aperçu de champ compose la bande par le même moteur | `pret` | s |
| T-0105 | La Grande Faille et le bulbe : la bande n'est pas uniforme en longitude | `a-specifier` | l |

T-0102 pose registre et moteur. T-0103 et T-0104 migrent les deux rendus ; **T-0104 retire les
quatre constantes de convention et `contrasteVoieLactee`** — une fois le dernier appelant parti,
pas avant. T-0105 est le seul écart restant avec la photo de référence.

Critères d'acceptation transverses, à répartir :

- À brillance de surface égale, bande et fond rendent la **même luminance WCAG** ; seule la
  chromaticité diffère. C'est le test de la normalisation du triplet chroma.
- Aucune opacité de convention, aucune coupure de latitude, aucun seuil de contraste dans le
  chemin de la bande : `grep` sur les quatre constantes retirées ne rend rien.
- Bortle 8 : la bande n'élève le fond de moins de 0,15 mag nulle part — invisible **par le
  modèle**, sans branche `if`.
- Bortle 1 : élévation du fond au plan galactique supérieure à 1 mag.
- La bande n'entre pas dans `sbEffectifRendu` : la magnitude limite rendue est identique avec
  et sans la couche Voie lactée, à la même minute et dans la même direction.
- Mode nuit : la bande ne rend que du rouge, aucune composante verte ni bleue.
- Un seul moteur : `dessine-ciel.ts` et `dessine-champ.ts` appellent la même fonction de
  brillance ; aucun des deux n'écrit de couleur.
- **Coût de rendu mesuré** à `fov` maximal, avant/après. Le flou par tranche est la dépense
  nouvelle. Si elle coûte des images : couche hors-écran à résolution réduite, floutée une seule
  fois puis composée — le sous-échantillonnage *est* un flou. À mesurer, pas à supposer.

## Vérification

```bash
pnpm typecheck && pnpm test
```

Puis à l'œil, `pnpm dev` — c'est un ticket de rendu, la suite ne juge pas une image :

1. Bortle 1, grand champ sur le Triangle d'été : bande **continue**, sans strie ni bord franc,
   blanc-gris légèrement chaud sur un fond bleu-violet. À comparer à la photo de référence.
2. Curseur Bortle de 1 à 8 : la bande s'efface **progressivement**, sans disparaître d'un coup.
3. Bortle 8 : bande absente, fond inchangé.
4. Mode nuit : bande rouge sombre, fond noir.
5. Zoom du grand champ au champ serré : l'épaisseur suit l'angle, aucun bord n'apparaît.
6. Lune pleine haute : halo lunaire et bande se composent sans couture ni surbrillance à leur
   croisement — deux parts de la même brillance totale.
