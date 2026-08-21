---
{
  "id": "T-0100",
  "titre": "La Lune éclaircit le ciel autour d'elle",
  "epic": "T-0096",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu", "lune"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-le-fond-du-ciel-montre-la-pollution-lumineuse-5-tickets-ovrs.md"
}
---

## Contexte

Une pleine Lune haute lève le fond de ciel de 2 à 3 mag/as² : plus que quatre crans de Bortle.
Le plan de séance le chiffre déjà (`deltaSbLune`, §8.1) ; le planétarium l'ignore — même fond et
même magnitude limite, Lune levée ou couchée.

Le moteur existe entièrement : `deltaSbLune`, `diffusionKS`, `sbCielAvecLune`, `masseAirKS`,
`nanolamberts` (`src/core/moon.ts`, modèle de Krisciunas & Schaefer 1991). Il ne manque que son
branchement au rendu.

Le halo lunaire est le seul contributeur **naturellement radial** : `diffusionKS(rho)` est une
fonction de la séparation angulaire à la Lune — Rayleigh près d'elle, Mie au-delà. Un dégradé
radial centré sur la position écran de la Lune est donc la géométrie juste, pas une
approximation.

**Ce ticket corrige aussi un bug existant.** `magnitudeRendue`
(`src/core/projection.ts:257-259`) ne plafonne rien quand `mLimOeil` vaut `null`. Or `null`
signifie « fond de ciel hors table », donc plus clair que Bortle 9 : un ciel de pleine Lune
montre aujourd'hui **plus** d'étoiles qu'un ciel de banlieue. La correction se pose dans
`magnitudeRendue`, seul passage de tous les appelants.

## Critères d'acceptation

- [x] Lune sous l'horizon : contribution exactement nulle, quelle que soit la phase — règle 1
      de `moon.ts`. Vérifié par test.
- [x] Pleine Lune à 60° de hauteur, Bortle 4 : le fond est nettement plus clair près de la Lune
      qu'à 120° d'elle, et le profil décroît selon `diffusionKS`.
- [x] Aucune duplication du modèle : le rendu appelle `deltaSbLune` / `diffusionKS`, il ne
      recalcule ni la phase, ni la masse d'air, ni l'illuminance.
- [x] La position écran de la Lune vient du même `etatLune` que le corps dessiné : le halo est
      centré sur la Lune affichée, à toute projection et toute rotation de cadre.
- [x] `magnitudeRendue` plafonne aussi quand le fond de ciel effectif sort de la table : borne
      de table et cause déclarée, jamais « pas de plafond ». Test de non-régression sur ce
      chemin.
- [x] Le plan de séance et le planétarium annoncent le même fond de ciel à la même minute pour
      la même direction : un seul moteur, deux écrans.
- [x] Mode nuit : aucun halo.

## Livré

- `src/core/moon.ts` — `brillanceLuneNl(geometrie)` extraite du corps de `deltaSbLune`, qui
  l'appelle désormais : le rendu additionne la MÊME brillance que le plan de séance, il ne
  recalcule ni la phase, ni la masse d'air, ni l'illuminance. `extinctionV` est exportée pour
  la même raison.
- `src/ui/dessine-fond-ciel.ts` — `dessineHaloLune`, dégradé radial centré sur la position
  écran de la Lune, obtenue en projetant le même `etatLune` que le corps dessiné. L'opacité de
  chaque cran est la PART de la Lune dans la brillance totale : là où elle domine, le fond
  composé est exactement celui du modèle ; là où elle s'efface, les paliers d'horizon
  reparaissent intacts. Aucun seuil arbitraire.
- `src/core/projection.ts` — **le bug est corrigé**. `magnitudeRendue` prend maintenant le
  fond de ciel EFFECTIF et non un `mLimOeil` déjà résolu : `null` signifiait « hors table »
  sans dire de quel côté, et la fonction cessait alors de plafonner. Elle borne au bord de
  table via `mLimOeilBorne` (`src/registry/bortle.ts`), pose le drapeau `HORS_DOMAINE` et
  nomme la cause. Test de non-régression sur les deux bords.
- `src/ui/Planetarium.tsx` — `sbEffectifRendu` dans la direction visée, Lune comprise :
  c'est lui qui plafonne la profondeur affichée.

**Limites déclarées**, marquées `ponytail:` dans le code. La hauteur retenue pour l'extinction
du trajet est celle de la Lune sur tout le dégradé — juste là où le halo compte, approché à
90° d'elle. Le rayon écran d'une séparation est mesuré dans une direction et appliqué au
cercle : exact en stéréographique visée sur la Lune, approché ailleurs. Le dégradé s'arrête au
quart de tour, où le terme de Rayleigh (1,06 + cos²ρ) atteint son minimum avant de remonter
vers la contre-Lune.

**Vérification.** `pnpm typecheck && pnpm test` : 683 tests verts. Le fond rendu et celui du
plan de séance coïncident à 2·10⁻⁵ mag/as² près pour la même géométrie — l'écart est l'arrondi
de `NANOLAMBERT_PENTE` (0,92104 pour 0,4·ln10), très en dessous du 1/255 d'un canal.
