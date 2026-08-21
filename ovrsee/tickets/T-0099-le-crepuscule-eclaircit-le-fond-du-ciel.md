---
{
  "id": "T-0099",
  "titre": "Le crépuscule éclaircit le fond du ciel",
  "epic": "T-0096",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "planetarium",
    "rendu",
    "nuit"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-le-fond-du-ciel-montre-la-pollution-lumineuse-5-tickets-ovrs.md"
}
---

## Contexte

C'est le plus gros mensonge de la vue réaliste : à 21 h en juin, Soleil à −6°, le vrai ciel est
bleu franc et l'on ne voit qu'une poignée d'étoiles. L'app rend le même fond qu'en pleine nuit,
et la même magnitude limite. Le curseur de temps traverse le crépuscule à chaque séance :
`fenetreNocturne` (`src/core/night.ts:108`) connaît déjà les seuils, personne n'en tire la
brillance du ciel.

La contribution crépusculaire s'ajoute en nanolamberts, comme les autres contributeurs de
T-0096.

La table vient de Patat, Ugolnikov & Postylyakov (2006), A&A 455, 385, Table 1 : brillance V du
ciel au zénith à Paranal, ajustée par un polynôme du second degré sur une distance zénithale
solaire de 95° à 105° — soit une dépression de **5° à 15°**, et non de 0° à 20°. Le domaine ne
couvre donc ni le crépuscule civil ni la nuit astronomique : sous 5°, la valeur du bord de table
est retenue et le déclare ; au-delà, le polynôme n'est pas prolongé — son sommet est à 18,3°
puis il redescend, ce qui ferait réapparaître un ciel clair en pleine nuit.

L'ajustement mesure un TOTAL, lueur nocturne de Paranal comprise (V = 21,61 mag/as², Patat 2003,
A&A 400, 1183). La contribution du crépuscule seul est la différence, sans quoi une lueur
nocturne serait comptée deux fois.

**Question de site fermée par la source elle-même** (§5 de l'article) : Paranal (2600 m) et CrAO
(600 m) ont des brillances « very close » en crépuscule clair, Paranal n'étant plus sombre que
d'environ 30 % en crépuscule PROFOND. La table sert donc pour un site de plaine là où elle
compte — le crépuscule qui efface les étoiles — et l'écart de 0,3 mag se concentre là où la
contribution est déjà résiduelle. Limite déclarée, aucune correction d'altitude appliquée : il
n'existe pas de table par altitude à citer.

## Critères d'acceptation

- [ ] La table est au registre avec sa citation complète, ses bornes, et l'interdiction
      d'extrapoler au-delà — même règle que `TABLE_BORTLE`.
- [ ] Au-delà de −18° (nuit astronomique) la contribution est exactement nulle : le fond
      redevient celui du site, au pixel près.
- [ ] Contribution monotone croissante quand le Soleil remonte, et continue au raccord des
      −18° : glisser le curseur de temps ne produit aucun saut visible.
- [ ] La magnitude limite suit le fond de ciel effectif : à Soleil −6°, la vue réaliste ne
      montre qu'une poignée d'étoiles. Hors table Bortle, elle plafonne au bord et le déclare —
      elle ne cesse pas de plafonner.
- [ ] Une nuit d'été à haute latitude ne produit ni fond noir ni valeur absente : le cas est
      rendu et nommé. Correction de l'énoncé : à 50° c'est la nuit ASTRONOMIQUE qui est nulle
      (Soleil à 16,6° sous l'horizon au milieu de nuit, contribution déjà retombée à zéro) ; le
      crépuscule nautique permanent commence vers 54,5°, et là la contribution ne s'annule
      jamais.
- [ ] Hors périmètre, et dit : la teinte ne vire pas vers l'azimut du Soleil.
