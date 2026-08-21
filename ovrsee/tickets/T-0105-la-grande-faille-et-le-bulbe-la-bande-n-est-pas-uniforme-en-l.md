---
{
  "id": "T-0105",
  "titre": "Le bulbe : la bande n'est pas uniforme en longitude",
  "epic": "T-0101",
  "colonne": "fait",
  "priorite": "basse",
  "charge": "m",
  "tags": [
    "planetarium",
    "rendu"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

Après T-0101, la bande est juste en largeur, en couleur et en contraste, mais **lisse en
longitude** : sa brillance ne dépend que de la latitude galactique. Le ciel réel ne ressemble
pas à cela — la région du Sagittaire est nettement plus brillante que l'anticentre, de l'ordre
d'une demi-magnitude par arcseconde carrée, soit plus que l'écart entre deux crans de Bortle.
Un modèle uniforme en longitude rend l'anticentre trop brillant, ou le bulbe trop faible,
jamais les deux justes.

**Périmètre arbitré** : ce ticket ne traite que le bulbe, qui se dérive d'un profil analytique
à coût nul en données. La Grande Faille, qui exige une carte (l, b) embarquée sous §12.2,
part en T-0106. Les deux écarts avaient été écrits ensemble ; les séparer permet de livrer le
bulbe sans toucher au précache ni à la matrice de dégradation.

## Le modèle

Le profil en longitude est le **premier mode de Fourier**, pas une bosse posée sur le
Sagittaire. Un disque exponentiel regardé de l'intérieur donne une lumière intégrée maximale
vers le centre, minimale vers l'anticentre, monotone entre les deux : sa première harmonique
est `(1 + cos l)/2`. C'est ce qui permet de modéliser le bulbe **sans largeur en longitude à
choisir** — une gaussienne aurait demandé un σ que rien ne source.

```
SB(l, b) = SB_ANTICENTRE + (SB_BULBE − SB_ANTICENTRE) × (1 + cos l)/2  +  2,5 log10( e^(|b|/h) )
```

Les deux bornes sont des brillances observables, donc discutables sur pièce :
`SB_VOIE_LACTEE_PLAN_MAG` = 21,0 devient la valeur de l'anticentre, et
`SB_VOIE_LACTEE_BULBE_MAG` = 20,5 celle du centre galactique.

## Critères d'acceptation

- [x] `brillanceVoieLacteeNl(0, 0)` vaut la brillance du bulbe ; `brillanceVoieLacteeNl(180, 0)`
      celle de l'anticentre.
- [x] La brillance décroît **strictement** du centre à l'anticentre : aucune bosse, aucun palier.
- [x] Le profil est symétrique en longitude : `l` et `360 − l` rendent la même brillance.
- [x] Le profil en longitude **module** celui en latitude, il ne le remplace pas : le rapport
      bulbe/anticentre est le même à toute latitude.
- [x] Aucune donnée nouvelle, aucun paquet binaire, aucun accès réseau : `public/data/` est
      inchangé.
- [x] Le pas de découpe en longitude du planétarium est **mesuré**, pas supposé : la marche de
      couleur entre deux segments voisins reste sous 1/255 sur toute la table Bortle. À 24° elle
      passait à 2/255 — le pas retenu est 18°.
- [x] Bortle 9 : la bande n'élève le fond de plus de 0,15 mag nulle part, à aucune longitude.
- [x] Bortle 1 : le bulbe élève le fond plus que l'anticentre, et l'anticentre de plus d'une
      magnitude.
- [x] Coût de rendu chiffré avant/après (`pnpm bench:ciel --realiste`) : 14 607 → 16 754
      projections par image (+14,7 %), GC cumulé 4,5–6,6 ms → 6,8–7,1 ms sur 200 images. Le
      temps par image reste dans le bruit.
- [ ] **Contrôle à l'œil non fait** : l'extension navigateur n'était pas connectée. À vérifier
      sur `pnpm dev` — bande continue sans couture aux raccords de segments, bulbe visiblement
      plus brillant que l'anticentre, aucune encoche alignée en travers de la bande.

## Limites déclarées

- L'échelle de latitude ne dépend pas de la longitude, alors que le bulbe est plus épais que le
  disque. La corriger demanderait une seconde échelle sans source.
- L'aperçu de champ évalue **une seule longitude par image**, celle de la visée : découper ses
  polygones en longitude rouvrirait la couture que T-0104 évite. Un très grand angle ignore donc
  quelques dixièmes de magnitude d'écart entre ses bords.
- À Bortle 8, le bulbe élève le fond de 0,160 mag au lieu de 0,103 — le seuil de 0,15 mag écrit
  dans la prose du plan y saute. Le test, lui, porte sur Bortle 9 (0,103) et tient. C'est le bon
  sens physique : le Sagittaire est la dernière chose qu'on devine dans un ciel pourri.
