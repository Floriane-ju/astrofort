---
{
  "id": "T-0007",
  "titre": "Coquille PWA et persistance du stockage §12.1, §12.3",
  "colonne": "revue",
  "priorite": "haute",
  "charge": "m",
  "tags": ["lot-0", "offline"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

§12.3 est la vraie contrainte du choix web, et ce n'est pas le volume : c'est l'éviction.
Neuf mégaoctets de catalogues effacés silencieusement, c'est une application vide au
prochain démarrage hors réseau, sur le terrain, sans moyen de la recharger.

Les catalogues sont retéléchargeables ; les profils, sites, masques d'horizon édités et
plans de session ne le sont pas. L'export JSON manuel est obligatoire au MVP.

## Critères d'acceptation

- [ ] La coquille et les paquets obligatoires sont mis en cache à la première visite
- [ ] `persist()` est demandé après la première action utile, jamais au chargement
- [ ] `persisted()` est vérifié à chaque démarrage ; si faux, le risque est expliqué et
      l'installation proposée
- [ ] Catalogues absents ou corrompus et hors réseau → mode dégradé documenté, ni écran
      blanc ni erreur technique brute
- [ ] Un export JSON contient toutes les données produites par l'utilisateur, et son
      réimport les restaure sans perte
- [ ] Sans WebGL 2, le planétarium et les prévisualisations sont désactivés avec la cause
      nommée, les moteurs de calcul restant utilisables
