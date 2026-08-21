---
{
  "id": "T-0090",
  "titre": "Le flux de l'objet s'atténue avec la masse d'air",
  "colonne": "en-cours",
  "priorite": "haute",
  "tags": [
    "prd",
    "pose",
    "physique"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

Nouvelle feature §7.6 du PRD 1.2.

L'extinction atmosphérique n'existe aujourd'hui qu'à l'intérieur du modèle de brillance
lunaire (`src/core/moon.ts:176`, constante L-04 = 0,172 mag/masse d'air). `fluxObjet()` et
`fluxCiel()` (`src/core/exposure.ts`) ignorent la hauteur de la cible : tout est calculé comme
si l'objet était hors atmosphère.

Or `T_requis ∝ 1 / E_obj²` quand le fond de ciel domine, ce qui est le régime nominal du
grand champ. L'intégration annoncée est donc sous-estimée :

| Hauteur | Masse d'air | Perte à k = 0,172 | T_requis sous-estimé de |
|---|---|---|---|
| zénith | 1,0 | 0,17 mag | ×1,37 |
| 30° (seuil C-01) | 2,0 | 0,34 mag | ×1,88 |

À k = 0,25, valeur de plaine dans la tolérance annoncée du registre, le facteur à 30° passe
à 2,5. Une cible basse coûte donc près du double du temps annoncé, et `S_hauteur` de §8.3
pondère par un proxy linéaire un effet déjà calculable exactement.

`masseAir()` existe (`src/core/site.ts:109`) et n'est aujourd'hui qu'informatif.

Portée retenue : l'atténuation de `E_obj`. Le fond de ciel croît lui aussi avec la masse
d'air, ce qui allonge encore `T_requis` — l'ignorer laisse le résultat optimiste, donc la
correction partielle va dans le bon sens et jamais dans le mauvais. Le terme de ciel est
posé comme question ouverte, pas comme dette silencieuse.

## Critères d'acceptation

- [x] `E_obj` est atténué par `10^(−0,4 × k × X)`, X étant la masse d'air de la cible et k la
      constante d'extinction du registre.
- [x] La masse d'air employée est affichée à côté de l'intégration, avec la hauteur qui la
      produit — la précision affichée ne dépasse pas celle du modèle (§12.4).
- [x] Sur la fiche cible, l'instant ou la hauteur d'évaluation est explicite ; dans le plan,
      c'est la masse d'air moyenne du créneau alloué.
- [x] Le résultat tracé cite la formule et la constante d'extinction, dépliable jusqu'à sa
      source (§10.2).
- [x] La sortie porte sa plage : k est marqué ordre de grandeur au registre (0,15 à 0,30),
      donc l'intégration s'affiche avec sa fourchette, jamais comme une valeur exacte (§2.1).
- [x] Sous 15° de hauteur, l'approximation plane de la masse d'air n'est plus valide : le
      calcul est refusé ou l'approximation remplacée, jamais extrapolée en silence.
- [x] Un test vérifie les deux valeurs de référence : ×1,37 au zénith et ×1,88 à 30° sur
      `T_requis`, à k = 0,172.
- [x] Question ouverte tranchée dans le ticket : le fond de ciel suit-il la masse d'air, ou
      reste-t-il à sa valeur zénithale ?

## Décisions

**Le fond de ciel ne suit pas la masse d'air — question tranchée.** Il reste à sa valeur
déclarée, et l'extinction ne porte que sur l'objet. La raison est photométrique, pas
pratique : une magnitude de catalogue est mesurée HORS atmosphère, donc elle doit être
éteinte ; une brillance de fond de ciel vient d'un SQM ou de la table Bortle §2.2, tous deux
relevés depuis le sol, donc déjà éteints. L'atténuer une seconde fois compterait l'extinction
deux fois. Ce que le modèle laisse de côté est autre chose : la diffusion supplémentaire qui
éclaircit réellement le ciel à basse hauteur. L'ignorer rend le résultat optimiste, donc
l'erreur va toujours dans le sens du confort, jamais du plan irréalisable. Un test garde ce
sens fermé dans les deux régimes de §7.3.

**`S_hauteur` reste au scoring, avec une autre justification.** La rampe linéaire de §8.3
était un substitut à l'extinction non modélisée ; celle-ci est désormais chiffrée dans
`T_requis`, donc portée par `S_signal`. Le terme n'est pas retiré pour autant : ce qu'il pèse
maintenant, c'est ce que `T_requis` ne modélise pas — turbulence, réfraction différentielle,
gradient de pollution lumineuse, qualité de suivi près de l'horizon. Le poids n'a donc pas
bougé, mais sa raison a changé, et elle est écrite ici plutôt que laissée en double
silencieux. Le jour où l'un de ces effets sera chiffré, c'est ce terme-là qu'il faudra revoir.

**Deux hauteurs d'évaluation, chacune nommée à l'écran.** La fiche n'a pas de créneau : elle
éteint à la CULMINATION, la même convention que son modèle lunaire, et affiche
« culmination à 47,3° ». Le plan en a un : il éteint à la masse d'air MOYENNE du créneau et
affiche « moyenne du créneau ». La fiche annonce donc un plancher, le plan le coût réel. Le
test de T-0089 a été réécrit en conséquence : il exige toujours la même pose unitaire — le
fond de ciel est identique — et rejoue l'intégration du plan avec la masse d'air de la fiche
pour prouver que la masse d'air est la SEULE divergence.

## Écart assumé

Le critère demandait la masse d'air moyenne du créneau **alloué**. C'est la moyenne du
créneau entier qui est employée : l'allocation dépend de `T_requis`, qui dépend de la masse
d'air, qui dépendrait de l'allocation. Trancher la boucle demanderait deux passes et ferait
diverger le score affiché de l'intégration affichée. La moyenne du créneau est calculée sur
les échantillons déjà produits par `creneauCible`, donc sans éphéméride supplémentaire.
