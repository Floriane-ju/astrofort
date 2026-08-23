---
{
  "id": "T-0117",
  "titre": "Le filé se recalcule pendant le geste",
  "colonne": "pret",
  "priorite": "haute",
  "charge": "s",
  "epic": "T-0114",
  "tags": [
    "rendu",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

T-0025 a sorti le rendu du filé de la boucle : pendant un geste continu, `rendu-differe.ts` attend
120 ms de repos avant de recalculer, et l'écran annonce « recalcul en attente ». C'était la bonne
décision quand une passe coûtait cinq secondes. Elle ne l'est plus si une passe tient dans une
image : ce qu'on voit pendant un panoramique est alors une image périmée d'un demi-mouvement, alors
que la vraie pourrait être là.

Ce ticket ferme la boucle : la trace suit la souris. §9.3 le demandait d'ailleurs déjà pour le
curseur de durée — « prévisu en direct ».

Il **dépend de la mesure** : T-0115 et T-0116 d'abord, et le budget de T-0114 vérifié. Allumer le
temps réel sur une passe qui ne tient pas dans l'image ne donne pas du temps réel, ça donne une
interface qui saccade.

## Ce qui doit devenir vrai

- La passe de filé entre dans la boucle `rAF` et se calcule avec la vue de l'image courante :
  panoramique, zoom, rotation du boîtier, curseur de durée, curseur de temps.
- Le report par geste disparaît pour le filé, et avec lui la lecture « recalcul en attente »
  (`fileEnAttente`, `majLectures`) : il n'y a plus d'attente à annoncer.
- `rendu-differe.ts` garde un appelant hors du filé : `tests/clavier-planetarium.test.ts` s'en sert
  pour T-0069. Le travail dit lequel des deux part — le module entier, ou seulement son usage par
  le filé — et ne laisse pas un module sans usage réel.

## Critères d'acceptation

- [ ] Un panoramique en mode filé met les traces à jour en continu, sans image périmée ni mention
      d'attente
- [ ] Le curseur de durée allonge les traces pendant qu'on le glisse, pas au relâchement
- [ ] Cas usuel (60°, 120 min) : la ligne « images/s » de la scène reste au-dessus de 24 pendant un
      panoramique complet, filé actif. Constaté à l'écran, protocole écrit
- [ ] La passe mesurée au banc tient dans le budget de T-0114 pour ce cas usuel
- [ ] Cas dégradé écrit noir sur blanc : si le pire cas (180°, 480 min, f/1,4) ne tient pas, c'est
      T-0118 qui prend la suite — pas un plafond posé en silence
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée
