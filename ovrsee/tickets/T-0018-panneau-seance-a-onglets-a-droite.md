---
{
  "id": "T-0018",
  "titre": "Panneau séance à onglets à droite",
  "epic": "T-0014",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "lot-6",
    "ui"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-15",
  "plan": "2026-08-15-lot-6-coque-planetarium-la-scene-au-centre-les-reglages-sur.md"
}
---

## Contexte

La colonne de droite porte ce qu'on veut faire. En tête, toujours visible, le groupe
« Séance » : lieu, longitude, altitude, date, Bortle, SQM, masque d'horizon — le quand et le
d'où. Puis quatre onglets d'intention, un seul jeu de réglages à l'écran à la fois.

| Onglet | Provenance |
|---|---|
| Explorer | couches, mode de temps, facteur, pas astronomiques, projection, champ, vue réaliste — `Planetarium.tsx:470-624` |
| Cible | `FicheCible` monté tel quel |
| Nuit | fenêtre nocturne et fond de ciel `App.tsx:512-568`, plus `PlanSessionVue` |
| Filé | `GrandChamp.tsx:381-552` |

`GrandChamp.tsx` perd son canevas — repris par la scène en T-0019 — et devient
`PanneauFile.tsx`, le contenu de l'onglet Filé.

## Critères d'acceptation

- [x] Le groupe Séance reste visible quel que soit l'onglet actif
- [~] Un seul jeu de réglages visible à la fois — un seul onglet est monté, les autres
      n'existent pas dans le DOM ; la hauteur en 1440×900 n'est **pas vérifiée en navigateur**
- [x] Un clic sur un objet du ciel dans la scène bascule sur l'onglet Cible, garni
- [x] L'onglet actif survit à un changement de matériel ou de lieu
- [~] Aucun contrôle de `Planetarium.tsx` ni de `GrandChamp.tsx` n'est perdu au passage —
      deux exceptions assumées : le bouton « Ouvrir la fiche » cède la place à la bascule
      automatique vers l'onglet Cible, et l'interrupteur de vignettage est retiré parce qu'il
      ne commandait plus rien (voir Réalisation)

## Réalisation

`PanneauSeance.tsx` porte le groupe Séance — lieu, longitude, altitude, date, Bortle, SQM,
masque d'horizon et les trois seuils de déclinaison — puis la barre d'onglets et **un seul**
contenu monté. Les quatre contenus sont assemblés par `App.tsx` et passés en `ReactNode` : le
panneau place, il ne connaît pas ce qu'il place.

L'onglet actif et la cible ne sont pas un `useState` : ils vivent dans `src/ui/seance-etat.ts`,
magasin de module jumeau de `scene-etat.ts`. C'est ce qui permet à un clic dans la scène
d'ouvrir l'onglet Cible sans faire remonter le geste jusqu'à un ancêtre commun, et ce qui rend
la bascule testable sans DOM — l'environnement de test est `node`.

Les réglages du filé (§9.2 à §9.4) rejoignent ce magasin : ils se règlent à droite mais se
dessinent au centre, dans le cadre. `GrandChamp.tsx` devient `PanneauFile.tsx` et perd son
canevas ; `Planetarium.tsx` perd tous ses réglages, qui passent dans `PanneauExplorer.tsx`.
Les couches de tracés et la vue réaliste rejoignent `scene-etat.ts` pour la même raison : elles
sont actionnées à l'autre bout de l'écran de la boucle qui les lit.

Deux choses restent dans la colonne centrale parce que ce sont des lectures et non des
réglages : la ligne d'état (instant, visée, champ, magnitude atteinte, époque) et le bloc du
cadre §3.5 (cible dominante, rotation suggérée, refus sans profil).

Le plan de session échappe aux onglets : rendu en permanence, masqué à l'écran hors de l'onglet
Nuit. Sans cela, imprimer depuis un autre onglet sortait une page blanche — §11.2 veut le plan
imprimable, pas imprimable-si-le-bon-onglet-est-ouvert.

L'interrupteur de vignettage est supprimé : il ne pilotait que le canevas du panneau, qui
n'existe plus, et le vignettage n'est jamais incrusté (T-0019). Le chiffre en diaphragmes
reste ; la case qui ne commandait plus rien part.

## Réserve

Aucune vérification visuelle : ni pilote de navigateur dans cette session, ni port 5173 libre.
La hauteur des onglets en 1440×900 reste à constater à l'œil.
