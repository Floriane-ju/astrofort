---
{
  "id": "T-0101",
  "titre": "La Voie lactée se rend comme une brillance, pas comme un calque rose",
  "type": "epic",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "l",
  "tags": [
    "planetarium",
    "rendu",
    "prd"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

Le planétarium peint la Voie lactée en stries concentriques magenta couvrant tout le ciel. Le
ciel réel — même au grand angle — montre une bande blanc-gris diffuse, sans bord franc, large
d'une dizaine de degrés, qui s'efface dès que le site est pollué.

Trois défauts visibles, **un seul mécanisme fautif** :

| Défaut | Cause |
|---|---|
| Stries à bords francs | `TRANCHES_BANDE` — 13 traits de 5° d'alpha discret, aucun flou, aucun plancher soustrait à la coupure (`src/ui/dessine-ciel.ts:183,342`) |
| Bande sur tout le ciel | coupure à `LATITUDE_BANDE_GALACTIQUE_MAX_DEG` = 30 → ±30° peints à alpha ≥ 0,10 |
| Magenta | `voieLactee: 'rgb(205 125 175)'` (`src/ui/couleurs.ts:117`) — la lumière stellaire intégrée a B−V ≈ +0,9, elle est blanc-chaud |

Le mécanisme commun est `alpha × couleur saturée fixe`. Il n'a aucun contenu physique : l'alpha
et la couleur sont indépendants, donc une opacité faible d'une couleur saturée reste criarde, et
la bande ne peut s'effacer qu'en s'éteignant d'un coup à un seuil calé à la main.

**T-0100 a livré le patron juste pour ce problème** (`src/ui/dessine-fond-ciel.ts:146-156`) : un
contributeur de brillance se compose en PART de la brillance totale, avec la couleur de la
somme. Alpha et couleur y sont couplés — une part élevée d'une couleur proche du fond reste
invisible. C'est ce couplage qui manque à la bande. Le halo lunaire et la Voie lactée sont le
même problème : une source diffuse ajoutée par-dessus le fond de ciel.

## Modèle

Une seule règle, celle du projet depuis §8.1 et T-0096 : les brillances s'additionnent en
nanolamberts, jamais en magnitudes.

```
B_bande(b) = nanolamberts( SB_VOIE_LACTEE_PLAN_MAG + 2,5·log10( e^(|b|/h) ) )
             avec h = ECHELLE_LATITUDE_GALACTIQUE_DEG (déjà au registre)
part(b)    = B_bande(b) / (B_ciel + B_bande(b))
couleur(b) = css( B_ciel·chroma_ciel + B_bande(b)·chroma_stellaire )
```

Ce que le modèle produit, sans aucun seuil, avec `SB_VOIE_LACTEE_PLAN_MAG` = 21,0 :

| Fond de ciel | part à b=0 | élévation du fond à b=0 |
|---|---|---|
| Bortle 1 — 21,9 | 0,70 | −1,29 mag |
| Bortle 4 — 21,3 | 0,57 | −0,71 mag |
| Bortle 8 — 18,5 | 0,09 | −0,10 mag |

En latitude à Bortle 4 : b=20° → −0,30 mag, b=40° → −0,07 mag, b=60° → −0,03 mag. La bande
s'éteint d'elle-même en s'éloignant du plan parce que la part élevée y multiplie une couleur
devenue indiscernable du fond.

Conséquence : `contrasteVoieLactee` et ses quatre constantes de convention
(`SB_VOIE_LACTEE_PLEINE_MAG` 21,5 · `SB_VOIE_LACTEE_EFFACEE_MAG` 19,0 ·
`LATITUDE_BANDE_GALACTIQUE_MAX_DEG` 30 · `OPACITE_BANDE_GALACTIQUE` 0,45) disparaissent. Deux
entrées les remplacent : la brillance de la bande au plan, et sa chromaticité.

## Décisions arbitrées, valables pour les enfants

1. **La bande n'entre pas dans `sbEffectifRendu`.** Elle ne plafonne pas la magnitude limite.
   L'y verser ferait BAISSER le nombre d'étoiles affichées à l'intérieur de la Voie lactée,
   soit l'inverse du ciel. C'est une couche de rendu, pas un fond de ciel.
2. **Seule la bande perd le rose.** L'entrée de palette `voieLactee` reste `rgb(205 125 175)` :
   elle ne sert plus qu'au réticule du centre galactique et aux labels, où une teinte
   d'interface est légitime. La bande ne lit plus la palette — sa couleur est calculée.
3. **Mode nuit : un seul chemin.** La chromaticité de la bande devient (1, 0, 0) en mode nuit,
   le modèle additif tourne à l'identique. Pas de seconde branche de rendu.
4. **Vue réaliste décochée** : le fond fixe `#05070d` ne correspond à aucune brillance, donc le
   contraste de la bande y est approché. C'est le mode qui ne promet pas le réalisme — limite à
   marquer `ponytail:`, pas à corriger.
5. **Le trait, pas le polygone**, reste la géométrie du planétarium (raison inchangée,
   `dessine-ciel.ts:176-179` : un polygone rompu au bord du champ se referme n'importe où).
   L'aperçu de champ garde ses polygones, il n'a pas ce problème.

## Critères d'acceptation

- [x] T-0102 à T-0104 sont livrés ; chacun se vérifie seul.
- [x] Un seul moteur de brillance : `dessine-ciel.ts` et `dessine-champ.ts` l'appellent, aucun
      des deux n'écrit de couleur.
- [x] Aucune opacité de convention, aucune coupure de latitude, aucun seuil de contraste dans
      le chemin de la bande : un `grep` des quatre constantes retirées ne rend rien.
- [x] Bortle 8 : la bande n'élève le fond de plus de 0,15 mag nulle part — invisible PAR LE
      MODÈLE, sans branche `if`.
- [x] Bortle 1 : élévation du fond au plan galactique supérieure à 1 mag.
- [x] La magnitude limite rendue est identique avec et sans la couche Voie lactée, à la même
      minute et dans la même direction (décision 1).
- [x] Mode nuit : la bande ne rend que du rouge, aucune composante verte ni bleue.
- [x] Le seul écart restant avec une photographie de référence est la non-uniformité en
      longitude, et il est ticketé (T-0105) plutôt que laissé implicite.

## Livré

Épique soldée par T-0102, T-0103 et T-0104. T-0105 reste ouvert en `à spécifier` : c'est le seul
écart assumé avec une photographie de référence.

**Ce que le modèle produit**, mesuré et non supposé :

| Fond de ciel | part à b=0 | élévation du fond à b=0 |
|---|---|---|
| Bortle 1 — 21,9 | 0,69 | −1,26 mag |
| Bortle 4 — 21,3 | 0,56 | −0,88 mag |
| Bortle 7 — 20,5 | 0,38 | −0,51 mag |
| Bortle 9 — 18,0 | 0,06 | −0,06 mag |

Bilan registre : **−4 constantes de convention, +4 entrées physiques** (une brillance, trois
rapports de chromaticité). Le comportement Bortle est passé d'une rampe calée sur deux seuils à
un résultat dérivé.

**Ce qui reste à constater à l'œil, et n'a pas pu l'être.** Les critères visuels de T-0103 —
bande continue sur le Triangle d'été, effacement progressif au curseur Bortle, absence de bord
au zoom, croisement propre avec le halo lunaire — demandent l'application. L'extension Chrome
n'était pas connectée pendant cette session : ils sont **non vérifiés**, pas vérifiés.
