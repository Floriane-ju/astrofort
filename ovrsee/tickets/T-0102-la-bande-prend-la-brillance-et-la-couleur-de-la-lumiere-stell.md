---
{
  "id": "T-0102",
  "titre": "La bande prend la brillance et la couleur de la lumière stellaire",
  "epic": "T-0101",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "planetarium",
    "rendu",
    "registre"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

Le socle du modèle additif : registre et moteur, sans toucher aux rendus. Rien ne change à
l'écran à la fin de ce ticket — les deux enfants suivants branchent ce qu'il pose.

Aujourd'hui la bande n'a **ni brillance ni couleur propres**. Elle emprunte une teinte
d'interface (`palette.voieLactee`) et une opacité de convention (`OPACITE_BANDE_GALACTIQUE`).
C'est pourquoi elle ne peut pas se composer physiquement : il n'y a rien à composer.

## Modèle

Deux entrées de registre, sur le précédent de `CHROMA_FOND_CIEL_*` (extension de rendu assumée,
T-0097) :

- `SB_VOIE_LACTEE_PLAN_MAG` — brillance de surface de la bande dans le plan galactique.
  **La seule valeur nouvelle qui pilote l'aspect, donc la seule à sourcer sérieusement.** Les
  parties brillantes de la bande sont couramment citées autour de 21 mag/as² en V, le bulbe du
  Sagittaire plutôt 20,5. `ordreDeGrandeur: true`. À sourcer explicitement — jamais à caler sur
  une capture d'écran, ce que la règle « aucun nombre en dur » cherche précisément à éviter.
- `CHROMA_VOIE_LACTEE_R / _V / _B` — chromaticité de la lumière stellaire galactique intégrée,
  B−V ≈ +0,9 (géantes K plus rougissement par la poussière) : chaude, R > V > B, de l'ordre de
  1,00 : 0,86 : 0,66 avant normalisation.

**Contrainte de définition du triplet chroma** : il est normalisé pour que sa luminance WCAG
égale celle de `CHROMA_FOND_CIEL_*` (0,719). Sans cette normalisation, bande et fond à brillance
égale ne rendraient pas la même luminance, et l'exposition `K_EXPOSITION_FOND_CIEL` — seule
constante libre du modèle de fond — cesserait de s'appliquer aux deux. C'est cette contrainte
qui rend les deux contributeurs comparables, et elle est testable.

L'échelle de décroissance en latitude **n'est pas dupliquée** :
`ECHELLE_LATITUDE_GALACTIQUE_DEG` (20°, C-33) est déjà au registre et vaut pour la bande comme
pour la densité stellaire.

## Ce qui change

- `src/registry/constants.ts` — les deux entrées ci-dessus. Les quatre constantes retirées le
  sont en T-0104, pas ici : elles ont encore des appelants.
- `src/core/fond-ciel-rendu.ts` — deux fonctions, sur le modèle de `brillanceLuneNl` :
  - `brillanceVoieLacteeNl(bDeg)` : réutilise `nanolamberts` (déjà importée).
  - `composantesAvecBande(bCielNl, bBandeNl, modeNuit)` : somme pondérée des deux
    chromaticités, sœur de `composantesFond`. `composantesFond` **n'est pas généralisée** :
    `tests/fond-ciel.test.ts` vérifie sa table Bortle exacte à 1/255 près.
- `src/ui/couleurs.ts` — `bandeRealiste(...)`, enveloppe `css()` de la fonction core, exactement
  comme `fondRealiste` (ligne 205).

## Critères d'acceptation

- [x] À brillance de surface égale, bande et fond rendent la **même luminance WCAG** ; seule la
      chromaticité diffère. C'est le test de la normalisation du triplet.
- [x] `brillanceVoieLacteeNl` décroît strictement avec |b| et vaut `nanolamberts(SB_..._PLAN_MAG)`
      exactement à b = 0.
- [x] La chromaticité de la bande est plus chaude que celle du fond : rapport R/B de la bande
      strictement supérieur à celui de `CHROMA_FOND_CIEL_*`.
- [x] Mode nuit : `composantesAvecBande` ne rend aucune composante verte ni bleue pour la part
      de la bande.
- [x] `SB_VOIE_LACTEE_PLAN_MAG` porte une source nommée dans son entrée de registre, pas un
      renvoi au rendu.
- [x] Aucun rendu n'est modifié : la suite passe sans toucher `dessine-ciel.ts` ni
      `dessine-champ.ts`.

## Livré

- `src/registry/constants.ts` — `SB_VOIE_LACTEE_PLAN_MAG` (C-44, 21,0 mag/as², ordre de
  grandeur) et `CHROMA_VOIE_LACTEE_R/_V/_B` (C-45 à C-47, rapports bruts 1,00 : 0,86 : 0,66
  tirés de B−V ≈ +0,9). **Aucune échelle de latitude nouvelle** :
  `ECHELLE_LATITUDE_GALACTIQUE_DEG` (20°, C-33) sert aux deux, la lumière intégrée et le
  comptage d'étoiles décroissant du même plan.
- `src/core/fond-ciel-rendu.ts` — `brillanceVoieLacteeNl(b)`, sœur de `brillanceLuneNl`. Elle
  n'entre PAS dans `brillanceFondNl` : verser la bande au fond de ciel ferait baisser la
  magnitude limite à l'intérieur de la Voie lactée, donc afficher moins d'étoiles là où le ciel
  en montre le plus.
- `src/ui/couleurs.ts` — `bandeRealiste(bCiel, bBande, modeNuit)` rend `{ couleur, part }`, et
  `CHROMA_BANDE` normalise le triplet **au chargement** pour que sa luminance WCAG égale celle
  de `CHROMA_FOND_CIEL_*`. La normalisation est calculée, pas écrite : c'est le rapport R/V/B
  qui porte la physique, jamais son échelle.
- `tests/voie-lactee.test.ts` — 7 tests : brillance au plan, décroissance stricte, symétrie des
  deux hémisphères, égalité de luminance bande/fond à brillance égale, teinte chaude R ≥ V ≥ B
  contre un fond bleu, effacement en ville et affirmation sur ciel noir, mode nuit rouge pur.

**Limite déclarée.** Le mode nuit n'est pas normalisé : une chromaticité (1, 0, 0) ne PEUT pas
atteindre la luminance du fond — le rouge n'apporte que 0,2126 de la luminance — et la forcer
saturerait le canal. Le mode nuit protège l'adaptation à l'obscurité (§11.1), il ne promet pas
la fidélité photométrique. Marqué dans le code.

**Vérification.** `pnpm typecheck` vert. Aucun rendu touché par ce ticket.
