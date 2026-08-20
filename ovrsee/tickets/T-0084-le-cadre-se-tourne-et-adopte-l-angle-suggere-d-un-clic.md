---
{
  "id": "T-0084",
  "titre": "Le cadre se tourne, et adopte l'angle suggéré d'un clic",
  "colonne": "pret",
  "priorite": "moyenne",
  "epic": "T-0083",
  "tags": [
    "prd",
    "cadrage",
    "planetarium"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
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
