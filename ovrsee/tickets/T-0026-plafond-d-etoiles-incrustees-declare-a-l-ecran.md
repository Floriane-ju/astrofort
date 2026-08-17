---
{
  "id": "T-0026",
  "titre": "Plafond d’étoiles incrustées, déclaré à l’écran",
  "epic": "T-0021",
  "colonne": "a-specifier",
  "priorite": "basse",
  "charge": "s",
  "tags": [
    "performance",
    "rendu",
    "file",
    "honnetete"
  ],
  "cree": "2026-08-15",
  "maj": "2026-08-17",
  "plan": "2026-08-15-tickets-cout-du-file-incruste-dans-le-cadre.md"
}
---

## Contexte

Filet de sécurité, à ne poser que si T-0022 à T-0025 ne suffisent pas : un
plafond dur sur le nombre d'étoiles tracées dans une incrustation, pour qu'aucune
combinaison de réglages ne puisse rendre l'écran inutilisable.

Le dépôt a déjà le précédent et la manière : `SEMIS_ETOILES_TOTAL` plafonne le
semis à 300 000 étoiles sur la sphère, et `MENTION_SEMIS` (`src/data/semis.ts`)
le **dit à l'écran** — « le plafond est déclaré à l'écran, jamais silencieux ».
Un plafond de rendu qui ne s'annonce pas ferait croire à un ciel complet là où
il manque des étoiles : c'est exactement ce que le produit s'interdit.

**Ce ticket n'est pas mûr**, et c'est délibéré. Deux questions ouvertes :

1. **La valeur.** Inconnue tant que T-0021 n'a pas chiffré le coût réel par
   étoile, après les optimisations. Un plafond posé sur les chiffres d'aujourd'hui
   serait périmé le jour où il entre.
2. **Le critère de tri.** Garder les plus brillantes est simple mais ment sur la
   densité — le semis existe précisément pour rendre la densité fidèle
   (§9.2). Une décimation qui préserve la modulation par la latitude galactique
   est plus juste, et plus chère à écrire. Le choix n'est pas tranché.

Si la mesure finale de T-0021 montre que le pire cas tient, **fermer ce ticket
sans le faire** est le bon résultat.

## Ce que la mesure de T-0021 a répondu — et ce qu'elle laisse ouvert

T-0022 à T-0025 sont livrés. Le pire cas passe de 5,04 s à **0,77 s** de calcul
par passe, et cette passe ne se déclenche plus qu'une fois par geste au lieu
d'une fois par `pointermove`. Ce ticket ne meurt donc **pas** : 0,77 s de fil
principal bloqué au relâchement du geste reste perceptible.

Les chiffres à travailler, tirés du banc (`scripts/bench-incrustation.ts`), pire
cas scène 180° / 480 min / 50 mm f/1,4 :

- 177 377 étoiles lues, **28 858 arcs construits** après filtrage géométrique ;
- 11,5 M projections, soit ≈ 400 projections par arc conservé ;
- ≈ 27 µs par arc conservé, tout compris.

Un plafond de 10 000 arcs ramènerait le pire cas sous 300 ms. C'est un ordre de
grandeur, pas une valeur arrêtée : elle se pose une fois qu'on aura décidé du
tri.

## Critères d'acceptation

- [ ] La valeur du plafond est fixée à partir de la mesure de T-0021, et justifiée
      par elle
- [ ] Le critère de tri est tranché entre « les plus brillantes » et « décimation
      à densité préservée », avec la raison écrite
- [ ] Le plafond est déclaré à l'écran quand il mord, à la manière de
      `MENTION_SEMIS` — jamais silencieux
- [ ] Le plafond ne mord pas dans les réglages usuels : il ne se voit que dans le
      pire cas
