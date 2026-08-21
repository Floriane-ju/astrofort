---
{
  "id": "T-0098",
  "titre": "Le halo s'éclaircit vers l'horizon",
  "epic": "T-0096",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "m",
  "tags": ["planetarium", "rendu", "performance"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-le-fond-du-ciel-montre-la-pollution-lumineuse-5-tickets-ovrs.md"
}
---

## Contexte

Un fond uniforme est faux dans un détail que l'œil connaît : le ciel est plus clair près de
l'horizon. La couche émissive y est vue sous une épaisseur croissante (van Rhijn, 1921), et ce
trajet plus long est lui-même atténué par l'extinction :

```
B(h)        = B_zenith × vanRhijn(h) × 10^(−0,4 k (X(h) − 1))
vanRhijn(h) = 1 / sqrt(1 − (R/(R+H))² cos²h)      H ≈ 90 km, couche d'airglow
```

Chiffré avec `masseAirKS()` (`src/core/moon.ts:99`) et k = `EXTINCTION_V_MAG_PAR_MASSE_AIR`
(0,172) : ×3,19 à l'horizon, soit −1,26 mag/as² ; ×2,08 à 20° ; ×1,31 à 45° ; 1,00 au zénith.
Le
terme d'extinction n'est pas décoratif — van Rhijn seul donnerait ×6 à l'horizon, valeur non
observée.

**Géométrie.** Pas de dégradé d'écran : les courbes iso-hauteur ne sont des cercles à l'écran
qu'en stéréographique visée au zénith, et deviennent des coniques en gnomonique. On généralise
le balayage de `src/ui/dessine-sol.ts` — 240 rayons depuis le centre, dichotomie de 12 passes
sur `Projecteur.inverse` — en remplaçant le prédicat `sousLeSol` par « hauteur inférieure à
h_i », pour N paliers de hauteur venus du registre, peints du plus bas au plus haut.
L'en-tête de `dessine-sol.ts` explique pourquoi le balayage en angle écran est la bonne
géométrie et pourquoi mailler le ciel est un piège : même raison ici.

`ponytail:` N paliers plutôt qu'un dégradé continu ; passer au dégradé seulement si les paliers
se voient.

## Critères d'acceptation

- [x] Nombre de paliers et hauteur de la couche émissive au registre, avec source (van Rhijn
      1921) ; aucun nombre dans le moteur.
- [x] Profil testé : `B(0°)/B(90°)` = 3,19 ± 0,05 à k = 0,172 ; strictement décroissant de
      l'horizon au zénith ; exactement 1,00 au zénith.
- [x] Le halo est peint sous le sol, sous la bande galactique et sous tous les repères : visée
      basse, le relief le recouvre (mêmes règles d'ordre que §3.7 et T-0094).
- [x] Visée au zénith, champ 60° : halo concentrique, sans discontinuité visible. Visée à
      l'horizon : les paliers suivent la crête, pas le bord du canevas.
- [x] Vrai dans les trois projections, y compris à 150° en gnomonique (T-0095).
- [x] Surcoût par image mesuré au banc et inscrit ici. Au-delà d'un budget déclaré, c'est le
      nombre de paliers qui baisse, pas la fréquence d'image.
- [x] Mode nuit : aucun halo.

## Livré

- `src/ui/balayage-ecran.ts` *(nouveau)* — le balayage écran de `dessine-sol.ts`, extrait pour
  être partagé : `frontiereEcran`, `remplitRegion`, `traceFrontiere`, plus une finesse
  réglable. `dessine-sol.ts` passe de 133 à 35 lignes et garde exactement son rendu.
- `src/core/sol.ts` — `sousLaHauteur(h, matriceCiel)`, le prédicat des paliers, même géométrie
  que `sousLeSol`.
- `src/core/fond-ciel-rendu.ts` — `vanRhijn`, `facteurHaloHorizon`, `bornesPaliersHalo`,
  `hauteurRepresentative`. `extinctionV` est extraite de `moon.ts` et partagée : deux
  écritures de la même atténuation finiraient par diverger d'un facteur 0,4.
- `src/registry/constants.ts` — `HAUTEUR_COUCHE_EMISSIVE_KM` (C-42, 90 km, van Rhijn 1921),
  `RAYON_TERRE_KM` (A-TER), `PALIERS_HALO_HORIZON` (C-43, 12).
- `src/ui/dessine-fond-ciel.ts` *(nouveau)* — `dessineHaloHorizon`, peint entre le `fillRect`
  du fond et la bande galactique, donc sous le sol et sous tous les repères.

**Correction du ticket : le rapport à l'horizon vaut 3,19, pas 2,9.** Les trois autres valeurs
annoncées sont justes (×2,08 à 20°, ×1,31 à 45°, 1,00 au zénith) ; seule celle de l'horizon
l'était pour une couche émissive plus haute que les 90 km retenus. Avec H = 90 km et
R = 6371 km : van Rhijn(0°) = 6,01, extinction 10^(−0,4 × 0,172 × 4) = 0,531, produit 3,19 —
soit 1,26 mag/as² entre le zénith et l'horizon, et non 1,15. C'est cette valeur qui est testée.

**Surcoût mesuré au banc** (`node scripts/bench-ciel.ts [--realiste]`, scène de référence
1920×1080, champ 30°, 83 479 étoiles) : **0,75 ms/image → 1,04 ms/image, soit +0,29 ms**. Le
budget d'une image à 30 im/s est 33 ms : le halo en prend 0,9 %. Le compte de GC passe de 14 à
27 pour 200 images — les `inverse()` du balayage, 11 paliers × 96 rayons × 10 sondes. Sous le
budget déclaré, le nombre de paliers reste à 12.

**Vérification.** `pnpm typecheck && pnpm test` : 683 tests verts, dont le profil dans les
trois projections y compris à 150° en gnomonique, et l'ordre halo-puis-sol dans la passe.
