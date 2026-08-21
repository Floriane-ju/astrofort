---
{
  "id": "T-0105",
  "titre": "La Grande Faille et le bulbe : la bande n'est pas uniforme en longitude",
  "epic": "T-0101",
  "colonne": "a-specifier",
  "priorite": "basse",
  "charge": "l",
  "tags": ["planetarium", "rendu", "donnees"],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

Après T-0101, la bande sera juste en largeur, en couleur et en contraste, mais **lisse en
longitude** : sa brillance ne dépendra que de la latitude galactique. Le ciel réel ne ressemble
pas à cela.

Deux écarts, ce sont les deux traits les plus reconnaissables d'une photographie de Voie lactée :

- **Le bulbe.** La région du Sagittaire est nettement plus brillante que l'anticentre — de
  l'ordre d'une demi-magnitude par arcseconde carrée, soit plus que l'écart entre deux crans de
  Bortle. Un modèle uniforme en longitude rend l'anticentre trop brillant, ou le bulbe trop
  faible, jamais les deux justes.
- **La Grande Faille.** Le nuage de poussière qui coupe la bande en deux du Cygne au Sagittaire.
  C'est une structure sombre, pas une variation douce : aucun profil analytique en (l, b) ne la
  produit.

Conséquence pour l'utilisateur du grand champ : le repère qu'il cherche dans le viseur — « la
bande se sépare ici » — n'existe pas dans le rendu.

## Pourquoi ce ticket n'est pas prêt

Il demande une **carte de brillance en (l, b)**, donc une donnée à embarquer. Cela le fait
tomber sous §12.2 (un clone doit démarrer sans réseau) et sous la matrice de dégradation §12.5 :
un paquet binaire de plus dans `public/data/`, versionné, précaché.

Les questions ouvertes, à fermer avant de le passer en `pret` :

1. **Quelle source ?** Une carte de brillance du fond stellaire intégré, à résolution grossière
   (le degré suffit : la bande est floutée au rendu de toute façon). Licence compatible, et
   accessible hors ligne une fois convertie.
2. **Quel budget d'octets ?** Une grille (l, b) au degré sur ±40° de latitude fait
   360 × 80 valeurs. À un octet par valeur, ~29 ko avant compression — à comparer au poids des
   paquets existants et à arbitrer contre le gain visuel.
3. **Un ou deux tickets ?** Le bulbe est une modulation douce, dérivable d'un profil analytique
   en longitude sans aucune donnée nouvelle. La Grande Faille exige la carte. Les séparer
   permettrait de livrer le bulbe tout de suite, à coût nul en données — c'est probablement le
   bon découpage, à confirmer.
4. **La carte remplace-t-elle le profil en latitude** de T-0102, ou le module-t-elle ? Si elle
   le remplace, `SB_VOIE_LACTEE_PLAN_MAG` et l'échelle de latitude deviennent inutiles au rendu
   de la bande ; si elle le module, il faut dire laquelle des deux fait autorité.

## Critères d'acceptation

À écrire quand les questions ci-dessus sont fermées. Un ticket dont on ne sait pas écrire ce
qu'on constatera n'est pas mûr — il reste ici en attendant.

Ce qui est déjà sûr : le rendu ne doit pas devenir dépendant du réseau, et la bande sans la
carte doit rester exactement celle de T-0101, pas une version dégradée.
