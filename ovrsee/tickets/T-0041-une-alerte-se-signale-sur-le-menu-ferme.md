---
{
  "id": "T-0041",
  "titre": "Une alerte se signale sur le menu fermé",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0038",
  "tags": [
    "ui",
    "coque",
    "a11y"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Sous le canevas, un refus se voyait sans rien faire : « Incrustation demandée
alors que la couche Cadre matériel est éteinte », « aucun profil », « trop de
profils », l'avertissement d'époque, la cause remontée par le calcul du ciel.
Rangés dans un menu fermé par défaut, ces messages deviennent invisibles — on
règle quelque chose, rien ne se passe à l'écran, et l'explication est derrière
un clic qu'on ne pense pas à faire.

Le menu doit donc porter l'information qu'il a quelque chose à dire. Une
pastille sur son bouton suffit ; ce qui compte est qu'elle distingue un état
normal d'un état à lire.

## Critères d'acceptation

- [x] Quand au moins une cause, un refus ou un avertissement est actif, le
      bouton du menu fermé le signale visuellement.
- [x] Le signalement disparaît dès que la dernière cause disparaît.
- [x] Le nombre de messages en attente est annoncé en texte sur le bouton, pas
      seulement par une couleur — lisible en mode nuit, où la palette est
      réduite au rouge.
- [x] Le signalement est exposé aux technologies d'assistance (le bouton porte
      un libellé qui change avec l'état, ou un `aria-live` sur le compte).
- [x] Une suggestion de rotation en attente compte comme un message à lire :
      son bouton « Appliquer » ne doit pas rester introuvable.
