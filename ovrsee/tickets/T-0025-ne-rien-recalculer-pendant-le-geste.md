---
{
  "id": "T-0025",
  "titre": "Ne rien recalculer pendant le geste",
  "epic": "T-0021",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "performance",
    "rendu",
    "file",
    "ui"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-17",
  "plan": "2026-08-15-tickets-cout-du-file-incruste-dans-le-cadre.md"
}
---

## Contexte

L'effet qui produit l'incrustation (`src/ui/Planetarium.tsx:278`) a `azimutDeg`,
`hauteurDeg`, `rotationDeg`, `fovDeg` et `file.dureeTotaleMin` en dépendances. Or
le panoramique réécrit l'azimut et la hauteur **à chaque `pointermove`**
(`Planetarium.tsx:484`), et le curseur de durée réécrit la durée à chaque cran de
5 min (`src/ui/PanneauFile.tsx:356`).

Chaque événement de souris déclenche donc une passe complète de `dessineChamp`,
synchrone, sur le fil principal — des millions de projections entre deux images.
C'est ce qui rend le panoramique inutilisable, indépendamment du nombre d'étoiles
calculées : même divisé par dix, un rendu par mouvement de souris reste un rendu
de trop.

Le rendu est **statique par nature** — c'est déjà le principe posé en T-0019 :
une image par changement de réglage, redéposée par la boucle. Il manque juste la
distinction entre « le réglage a changé » et « le réglage est en train de
changer ». Pendant le geste, le cadre peut continuer à montrer l'image
précédente : elle est périmée d'un demi-mouvement, pas fausse.

Avec T-0022, c'est le premier à faire : plus gros gain ressenti, aucun risque sur
l'image produite.

## Critères d'acceptation

- [x] Un panoramique complet à la souris, incrustation active, ne déclenche qu'un
      seul appel à `rendIncrustation` — compté : `tests/rendu-differe.test.ts`
      envoie 60 événements à 60 Hz et compte 1 rendu
- [x] Un glissement du curseur de durée de 5 à 480 min ne déclenche qu'un seul
      appel à `rendIncrustation` — compté sur les 96 crans
- [x] Une fois le geste terminé, l'image affichée correspond aux réglages
      courants : jamais une image périmée qui subsiste — le report lit la
      dernière peinture demandée, pas celle capturée au premier événement, et un
      changement franc remplace le report au lieu de s'y ajouter (testé)
- [x] Le report est perceptible sans être trompeur : l'écran dit que le filé se
      recalcule, ou l'image précédente reste lisible telle quelle — pas de cadre
      vide pendant le geste
- [x] Les changements qui ne sont pas des gestes continus (bascule aperçu/filé,
      Voie lactée, mode nuit, matériel) restent immédiats

## Réalisation

`src/ui/rendu-differe.ts` : `maintenant()` rend tout de suite, `bientot()` repousse
l'échéance de 120 ms à chaque appel, `enAttente()` dit à l'écran ce qui se passe.
Vingt-cinq lignes, sans dépendance, testables au chronomètre truqué — parce que
« un seul rendu par panoramique » est un critère qui se compte.

Le composant fournit la distinction. Une clé de geste — azimut, hauteur,
rotation, champ, durée totale — est comparée à celle du rendu précédent : si elle
seule a changé et qu'une image existe déjà, le rendu est reporté ; sinon il part
immédiatement. Les bascules (aperçu/filé, Voie lactée, mode nuit, matériel, profils)
ne touchent pas cette clé et restent donc franches, sans délai ajouté.

Pendant le report, la ligne d'état de la scène affiche « filé en cours de
recalcul, le cadre montre l'image précédente » : elle est périmée d'un
demi-mouvement, pas fausse, et l'écran le dit plutôt que de laisser croire que
l'image suit le geste. Une passe reportée est annulée au démontage et à
l'extinction de l'incrustation.

## Réserve

Le comptage porte sur la mécanique de report, pas sur le composant monté : il n'y
a pas de DOM dans cette suite de tests. Le câblage — quelle clé, quels
changements restent francs — n'est vérifié qu'à la lecture.
