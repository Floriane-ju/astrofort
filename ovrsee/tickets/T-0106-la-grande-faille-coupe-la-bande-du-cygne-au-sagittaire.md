---
{
  "id": "T-0106",
  "titre": "La Grande Faille coupe la bande du Cygne au Sagittaire",
  "epic": "T-0101",
  "colonne": "a-specifier",
  "priorite": "basse",
  "charge": "l",
  "tags": [
    "planetarium",
    "rendu",
    "donnees"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

T-0105 a livré la moitié analytique de la non-uniformité en longitude : le bulbe du Sagittaire
est maintenant une demi-magnitude au-dessus de l'anticentre, par un profil `(1 + cos l)/2` qui
n'a demandé aucune donnée nouvelle. Reste l'autre moitié, celle qui ne se dérive pas.

**La Grande Faille** est le nuage de poussière qui coupe la bande en deux du Cygne au
Sagittaire. C'est une structure sombre, pas une variation douce : aucun profil analytique en
(l, b) ne la produit. Elle exige une **carte de brillance**, donc une donnée à embarquer.

Conséquence pour l'utilisateur du grand champ : le repère qu'il cherche dans le viseur — « la
bande se sépare ici » — n'existe toujours pas dans le rendu.

## Pourquoi ce ticket n'est pas prêt

La carte tombe sous §12.2 (un clone doit démarrer sans réseau) et sous la matrice de
dégradation §12.5 : un paquet binaire de plus dans `public/data/`, versionné, précaché.

Questions à fermer avant de le passer en `pret` :

1. **Quelle source ?** Une carte de brillance du fond stellaire intégré, à résolution grossière
   (le degré suffit : la bande est floutée au rendu de toute façon). Licence compatible, et
   accessible hors ligne une fois convertie.
2. **Quel budget d'octets ?** Une grille (l, b) au degré sur ±40° de latitude fait
   360 × 80 valeurs. À un octet par valeur, ~29 ko avant compression — à comparer au poids des
   paquets existants (`deepsky-1.bin` fait 17 ko, `hyg-1.bin` un mégaoctet) et à arbitrer contre
   le gain visuel.
3. **La carte remplace-t-elle le modèle analytique** de T-0102 et T-0105, ou le module-t-elle ?
   Si elle le remplace, `SB_VOIE_LACTEE_PLAN_MAG`, `SB_VOIE_LACTEE_BULBE_MAG` et l'échelle de
   latitude deviennent inutiles au rendu de la bande ; si elle le module, il faut dire lequel
   des deux fait autorité. La seconde voie a un avantage net : elle garde un rendu correct
   quand le paquet manque, ce que §12.5 demande de toute façon.
4. **Le découpage du planétarium tient-il ?** `dessine-ciel.ts` peint la bande en tranches de
   latitude × segments de longitude de 18°, pas calé sur la Faille — une structure sombre à bord
   net ne se rend pas avec un pas choisi pour que la couleur ne marche pas d'un 255e.

## Critères d'acceptation

À écrire quand les questions ci-dessus sont fermées. Un ticket dont on ne sait pas écrire ce
qu'on constatera n'est pas mûr — il reste ici en attendant.

Ce qui est déjà sûr : le rendu ne doit pas devenir dépendant du réseau, et la bande sans la
carte doit rester exactement celle de T-0105, pas une version dégradée.
