---
{
  "id": "T-0084",
  "titre": "Le cadre se tourne, et adopte l'angle suggéré d'un clic",
  "colonne": "fait",
  "priorite": "moyenne",
  "epic": "T-0083",
  "tags": [
    "prd",
    "cadrage",
    "planetarium"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

§3.5 spécifie `angle_rotation_cadre` « manipulable à la souris », et une rotation suggérée :
« si une cible allongée est dans le cadre, l'app propose l'angle alignant son grand axe sur
la grande dimension du capteur. Un clic applique. »

L'angle est calculé (`src/core/framing.ts:164`, `angleBoitierDeg`) et affiché. Rien ne
l'applique, et le cadre ne tourne pas : `angleRotationDeg` dans le code
(`src/core/horloges.ts:99`) est la rotation du CIEL, pas celle du boîtier.

Ce n'est pas cosmétique : le taux de remplissage de §6.2 est calculé contre la petite
dimension du champ. Sur une cible allongée, tourner le boîtier de 90° change le verdict de
cadrage — c'est le geste que le PRD veut rendre évident, et il est absent.

## Critères d'acceptation

- [ ] Le cadre de la scène se tourne par un geste continu, dans les bornes 0–360°.
- [ ] La rotation est portée par le profil de cadre, et le contour projeté suit — bords
      courbes compris à grand champ (§3.5).
- [ ] Quand une cible du cadre a un rapport d'axes supérieur au seuil du registre, l'angle
      suggéré est affiché et un geste unique l'applique.
- [ ] Une cible sans angle de position au catalogue ne produit aucun angle suggéré, et
      l'absence de donnée est nommée (§6.2).
- [ ] Le verdict de cadrage et le taux de remplissage se recalculent après rotation.
- [ ] Le multi-cadres du PRD est tranché dans le ticket : trois profils comparés, ou §3.5
      ramené aux deux profils réellement utiles (plein format contre recadrage APS-C).

## Arbitrages tranchés

**Le roulis appartient au boîtier, pas à la vue.** `VueScene.rotationDeg` alimentait à la
fois `projecteur()` et `contourCadreJ2000()` : le cadre et la vue tournaient du même angle,
donc le contour ne bougeait jamais à l'écran — seul le ciel tournait derrière lui. Le champ
s'appelle désormais `rotationCadreDeg` et le planétarium projette par `vuePlanetarium()`, sans
roulis. Le nom distinct est délibéré : c'est lui qui empêche de repasser le magasin tel quel à
`projecteur()`. §3.3 ne fait dépendre du mode que la fonction radiale R(θ), donc la scène garde
le zénith en haut. Les prévisualisations de §9.2 et §9.3, elles, gardent le roulis : elles
rendent l'image du capteur, pas la scène.

**Remplissage orienté : boîte englobante de l'ellipse.** Deux formes ont été écartées. La corde
du rectangle le long du grand axe donnerait, à 45°, plus de marge qu'un grand axe aligné sur la
grande dimension — faux, et sans marge pour la rotation de champ ni les gradients de bord. La
boîte englobante d'un RECTANGLE grossirait une cible ronde d'un facteur √2 à 45°, alors qu'un
disque n'a pas d'orientation. Retenue : la boîte englobante de l'ellipse de §6.3,
`u = √(maj²cos²φ + min²sin²φ)`, `v = √(maj²sin²φ + min²cos²φ)`, remplissage
`max(u/FOV_L, v/FOV_H)`. Elle se réduit exactement à `maj/FOV_H` à φ = 90°, ce qui préserve la
calibration de `TABLE_CADRAGE` et de `REMPLISSAGE_MIN_PLANIFIABLE`. Vérifié : une cible
4,5° × 1,0° à 120 mm plein format passe de 0,395 (`CADRAGE_OPTIMAL`) à 0,265
(`CADRAGE_LARGE`) selon l'orientation du boîtier.

**Multi-cadres : deux profils, pas trois.** `profilsDeCadre` ne construit que le capteur
déclaré et son recadrage — plein format contre APS-C, la seule comparaison qui réponde à une
question réelle (§5.1 : cadre plus serré, échantillonnage inchangé). Un troisième profil
supposerait un troisième capteur physique que rien ne renseigne. `PROFILS_CADRE_MAX` (C-31)
reste à 3 comme borne du PRD et garde-fou de lisibilité, avec son refus au-delà.

**Trois issues nommées pour la rotation suggérée.** `rotationSuggeree` n'appliquait pas le seuil
`RAPPORT_AXES_ORIENTATION` du registre : une cible ronde munie d'un angle de position au
catalogue produisait une suggestion inutile. Elle rend désormais toujours un message, et
`angleDeg = null` dans les deux cas où aucun angle n'est suggérable — cible sous le seuil
d'allongement, angle de position ou petit axe absent du catalogue. Le badge du menu ne compte
que les suggestions applicables : une absence motivée se lit, elle n'alerte pas.

## Ce qui a changé

- `src/registry/formulas.ts` → `REMPLISSAGE_ORIENTE`, avec les deux formes écartées en note.
- `src/core/framing.ts` → `remplissageCadre()`, `EntreeCadrage.fovLDeg` et `angleGrandAxeDeg` ;
  `ficheCadrage` en dérive remplissage et verdict.
- `src/core/cadre.ts` → `angleGrandAxeDansCadre()` exporté, `rotationSuggeree` rend un message
  dans tous les cas, `ProfilCadre.capteurHMm` ajouté (la focale idéale de §6.1 en a besoin).
- `src/ui/scene-etat.ts` → `rotationCadreDeg` et `vuePlanetarium()`.
- `src/ui/planetarium-gestes.ts` → `roulisApresGlisser()`, geste Maj + glisser sur la scène.
- `src/ui/MenuInfos.tsx` → remplissage et verdict recalculés à chaque rotation, bouton
  « Appliquer » conditionné à un angle réellement suggérable.

## Ce qui reste ouvert

- L'angle suggéré ne vaut que pour l'instant affiché : la rotation de champ le périme au fil de
  la nuit, et le message le dit. Rien ne suit encore cette dérive au cours d'un créneau — ce
  serait un ticket à part, et il demande de trancher ce qu'on affiche : l'angle au début du
  créneau, à la culmination, ou l'écart total.
- Le geste tourne le premier profil comme le second : les deux cadres partagent un roulis. Un
  boîtier par profil n'a de sens que si le multi-cadres passe un jour à des capteurs distincts.
