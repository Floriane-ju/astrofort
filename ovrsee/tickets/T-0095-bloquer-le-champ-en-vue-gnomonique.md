---
{
  "id": "T-0095",
  "titre": "Bloquer le champ en vue gnomonique",
  "colonne": "revue",
  "priorite": "moyenne",
  "tags": ["planetarium", "projection"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

Faire en sorte que le champ de vision maximum en vue gnomonique soit de 150 degrès (laisser 180 degrès pour la vue stéréographique)
Si en vue stéréographique on est à plus de 150 degrès, automatiquement passer à 150 degrès en gnomonique.

En gnomonique, R(θ) = tan(θ) et l'échelle pixel vaut (largeur / 2) / R(fov / 2) : elle tend
vers zéro quand le champ tend vers 180°, et tout le ciel s'effondre sur le pixel central.
Rien ne plante — c'est ce qui rend le défaut coûteux. Mesuré : l'étirement du bord par
rapport au centre vaut 1/cos²(fov/2), soit 14,9× à 150°, 33× à 160°, 13 000× à 179°.
La stéréographique (2·tan(θ/2)) et l'équidistante (θ) restent finies à 180° : elles gardent
le plafond de §3.3.

Le plafond de 150° est une **convention produit**, pas une valeur du PRD — §3.3 ne donne à
MODE_CADRE que « champ = FOV matériel §5.1 », et le planétarium l'offre en plus comme
projection libre. La convention est documentée comme telle dans le registre.

## Critères d'acceptation

- [x] `FOV_MAX_GNOMONIQUE_DEG` = 150° au registre, avec sa source et sa tolérance de
      convention produit — aucun seuil écrit dans un moteur ni dans l'UI.
- [x] Le curseur de champ du panneau Explorer s'arrête à 150° en gnomonique, à 180° en
      stéréographique et en équidistante.
- [x] La molette, le pincement et les touches `+` / `-` s'arrêtent au même plafond : les
      bornes sont relues à chaque geste, la projection pouvant changer sans démonter l'écouteur.
- [x] Regarder 180° en stéréographique puis basculer en gnomonique ramène le champ à 150°.
      Revenir en stéréographique ne rend pas le champ perdu : la borne descend, elle ne remonte pas.
- [x] Le plafond est posé dans `majVue`, seul passage obligé de toute écriture de vue — aucun
      chemin (geste, clavier, curseur, changement de projection, panneau matériel) ne le contourne.
