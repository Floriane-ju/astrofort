---
{
  "id": "T-0099",
  "titre": "Le crépuscule éclaircit le fond du ciel",
  "epic": "T-0096",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["planetarium", "rendu", "nuit"],
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

**La table sb(dépression solaire) reste à figer, et c'est pourquoi ce ticket est à spécifier.**
Elle doit venir d'une source publiée et citée — piste : Patat, Ugolnikov & Postylyakov (2006),
A&A 455, 385, brillance V du ciel de Paranal de 0° à −20° de dépression solaire. Rien n'est codé
avant que la source soit lue et vérifiée : une valeur plausible inventée finit en constante,
puis en test unitaire faux, ce qui verrouille l'erreur.

Question ouverte à fermer avant de coder : la table est-elle utilisable telle quelle pour un
site de plaine, ou faut-il déclarer explicitement qu'elle décrit un site de montagne ?

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
- [ ] Une nuit d'été à 50° de latitude, crépuscule nautique permanent, ne produit ni fond noir
      ni valeur absente : le cas est rendu et nommé.
- [ ] Hors périmètre, et dit : la teinte ne vire pas vers l'azimut du Soleil.
