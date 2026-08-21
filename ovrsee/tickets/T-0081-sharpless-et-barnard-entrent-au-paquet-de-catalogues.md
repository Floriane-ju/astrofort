---
{
  "id": "T-0081",
  "titre": "Sharpless et Barnard entrent au paquet de catalogues",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0079",
  "tags": [
    "prd",
    "donnees",
    "catalogue"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

§6.1 déclare Sharpless et Barnard **obligatoires au MVP** : « sans eux, le domaine d'un
setup grand champ est quasi vide dans les catalogues standard — la Boucle de Barnard est
Sh2-276 ». §12.2 leur alloue moins de 0,1 Mo pour 771 objets, Caldwell compris.

Le manifeste construit (`public/data/manifest.json`) ne contient qu'OpenNGC : 12 518 objets.
La fenêtre de cadrage du setup de référence est 3,79° – 5,69° — c'est-à-dire précisément
l'échelle des complexes nébuleux que ces deux catalogues portent et qu'OpenNGC ne décrit
pas. Le persona primaire ouvre donc une liste de cibles qui ignore son propre domaine.

`src/data/deepsky.ts:56` prévoit déjà la désignation `Sh2-276` en commentaire : le format
d'enregistrement n'a pas à changer.

## Critères d'acceptation

- [x] `pnpm data:build` produit un paquet contenant Sharpless et Barnard, depuis des sources
      épinglées par empreinte comme les autres (T-0059).
- [x] Le manifeste porte le comptage réel, l'empreinte SHA-256 et la source de chaque
      catalogue ajouté.
- [x] Les objets sans magnitude intégrée portent la sentinelle d'absence, jamais un zéro
      (§6.3) — une nébuleuse obscure de Barnard n'a pas de magnitude.
- [x] La liste des cibles visibles (§6.4) fait apparaître des objets `Sh2-` et `B` quand ils
      sont levés.
- [x] Le volume total du paquet obligatoire reste sous le budget de 10 Mo de §12.2, et §12.2
      est mis à jour avec le volume mesuré.
- [x] Caldwell : tranché explicitement dans le ticket — intégré, ou noté hors périmètre avec
      sa raison.

## Décision Caldwell

**Caldwell HORS PÉRIMÈTRE.** Raison :

Caldwell est entièrement une redésignation d'objets NGC/IC. Exemples : C14 = NGC 869/884 (Double Cluster),
C41 = Hyades (mêmes étoiles, autre numérotation). L'intégrer comme enregistrements distincts produit
109 doublons : le même objet apparaît deux fois dans la liste des cibles §6.4, sous deux fiches
différentes. Cette sortie répond (les critères d'acceptation sont satisfaits) et a tort (la liste
duplique). Porter Caldwell comme alias demanderait de modifier le format d'enregistrement que le
ticket laisse volontairement intact. Filtrage donc à la construction : seuls Sharpless et Barnard
sans doublons NGC/IC restent.

## Implémentation

**Sources épinglées :** Stellarium DSO v3.23, au commit `9ca023a`
- `nebulae/default/catalog.txt` — SHA-256 `38a7c8c1…607aa`
- `nebulae/default/names.dat` — SHA-256 `f66313ec…1de8e` : les noms d'usage vivent hors du
  catalogue. Sans ce second fichier, Sh2-276 n'est qu'un numéro et « Barnard's Loop » ne se
  cherche plus (T-0052).

**Catalogues extraits et filtrés — comptages mesurés à la construction :**
- Sharpless (`Sh2-`) : 316 objets source, **271** après retrait des 45 qui doublent un
  NGC/IC présent dans OpenNGC
- Barnard (`B`) : 343 objets source, **343** — aucun doublon NGC/IC
- Caldwell (`C`) : 110 entrées écartées en bloc
- **Paquet `deepsky`** : 614 objets, 0,02 Mo (17 192 o + 4 802 o de chaînes)

Sept entrées Sharpless sont typées « étoile » par Stellarium, qui y désigne l'étoile
excitatrice plutôt que la nébulosité — dont Sh2-308 (Dolphin Head) et Sh2-9, deux cibles
grand champ de vingt minutes d'arc. Les écarter comme le fait le filtre OpenNGC aurait perdu
des cibles réelles : un numéro Sh2 désigne une région HII, un numéro B une nébuleuse obscure.
C'est le catalogue d'origine qui tranche le type, pas l'étiquette de Stellarium.

**Modificatifs au code :**
- `scripts/build-catalogs.ts` : sources `SOURCE_STELLARIUM_DSO` et `…_DSO_NOMS`, groupe de
  construction `deepsky`, `extraitDesignationsNgcIc()`, `analyseNomsDso()`,
  `construitCataloguesComplementaires()`, `typeDso()`. OpenNGC est mémoïsé : les deux groupes
  le partagent.
- `src/data/bootstrap.ts` : `chargeObjetsCielProfond()` concatène `openngc` et `deepsky`.
- `tests/catalog.test.ts` : Boucle de Barnard présente et nommée, magnitude absente et non
  nulle, taille encodée au-delà de 10° ; aucun chevauchement de désignation avec OpenNGC ;
  le catalogue chargé de bout en bout porte Sh2-276 et B33.
- `prd.md` §12.2 : 614 objets, 0,02 Mo mesurés.

**Hors périmètre, assumé :** les noms sont ceux de la source, en anglais — « Barnard's Loop »,
pas « Boucle de Barnard ». C'est déjà le cas des noms communs d'OpenNGC (« Andromeda Galaxy ») :
traduire est un sujet à soi, pas une dette de ce ticket.
