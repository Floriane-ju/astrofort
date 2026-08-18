---
{
  "id": "T-0043",
  "titre": "Choisir sa cible parmi ce que le ciel offre",
  "type": "epic",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "ui",
    "cible",
    "planetarium"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": "2026-08-18-choisir-sa-cible-parmi-ce-que-le-ciel-offre.md"
}
---

## Contexte

L'onglet Cible se remplit aujourd'hui de trois façons : saisie manuelle des six
champs, clic sur un objet de la scène (`ouvreCible`, `src/ui/seance-etat.ts:107`),
ou choix dans un `<select>` alimenté par les **400 premières entrées** du catalogue
OpenNGC (`src/ui/FicheCible.tsx:209-222`) — 400 entrées prises dans l'ordre du
binaire, sans rapport ni avec le lieu, ni avec l'heure, ni avec le matériel déclaré.

Rien dans l'interface ne répond donc à la question qu'on se pose réellement devant
le ciel : *avec ce setup, ce soir, qu'est-ce que je peux viser ?* Et une fois la
cible choisie, rien ne l'amène sous les yeux — il faut la retrouver à la main en
glissant sur le planétarium.

Cet epic regroupe le calcul de ce qui est réellement visible, la liste qui en
découle dans l'onglet Cible, le bouton qui centre la cible choisie, et le tiroir
de réglages en haut à droite où le choix brut dans le catalogue est relogé : il ne
disparaît pas, il quitte le chemin principal.

Le cadrage n'entre pas dans les critères : un objet trop grand ou trop petit pour
le capteur déclaré reste listé. `ciblesDansFenetre` (`src/core/framing.ts:65`)
n'est pas réutilisée ici.

## Critères d'acceptation

- [x] L'onglet Cible propose une liste des objets au-dessus de l'horizon à
      l'instant affiché, retenus sur le verdict de détectabilité du setup, sans
      filtre de cadrage.
- [x] Un bouton amène la cible choisie au centre du planétarium sans changer le
      champ.
- [x] Une roue crantée en haut à droite ouvre un tiroir de réglages.
- [x] Le choix brut dans le catalogue vit dans ce tiroir, et nulle part ailleurs.
- [x] Les quatre tickets enfants sont soldés.
