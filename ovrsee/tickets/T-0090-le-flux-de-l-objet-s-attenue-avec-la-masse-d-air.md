---
{
  "id": "T-0090",
  "titre": "Le flux de l'objet s'atténue avec la masse d'air",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "prd",
    "pose",
    "physique"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
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

- [ ] `E_obj` est atténué par `10^(−0,4 × k × X)`, X étant la masse d'air de la cible et k la
      constante d'extinction du registre.
- [ ] La masse d'air employée est affichée à côté de l'intégration, avec la hauteur qui la
      produit — la précision affichée ne dépasse pas celle du modèle (§12.4).
- [ ] Sur la fiche cible, l'instant ou la hauteur d'évaluation est explicite ; dans le plan,
      c'est la masse d'air moyenne du créneau alloué.
- [ ] Le résultat tracé cite la formule et la constante d'extinction, dépliable jusqu'à sa
      source (§10.2).
- [ ] La sortie porte sa plage : k est marqué ordre de grandeur au registre (0,15 à 0,30),
      donc l'intégration s'affiche avec sa fourchette, jamais comme une valeur exacte (§2.1).
- [ ] Sous 15° de hauteur, l'approximation plane de la masse d'air n'est plus valide : le
      calcul est refusé ou l'approximation remplacée, jamais extrapolée en silence.
- [ ] Un test vérifie les deux valeurs de référence : ×1,37 au zénith et ×1,88 à 30° sur
      `T_requis`, à k = 0,172.
- [ ] Question ouverte tranchée dans le ticket : le fond de ciel suit-il la masse d'air, ou
      reste-t-il à sa valeur zénithale ?
