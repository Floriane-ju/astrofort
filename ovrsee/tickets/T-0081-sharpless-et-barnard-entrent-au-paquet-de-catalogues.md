---
{
  "id": "T-0081",
  "titre": "Sharpless et Barnard entrent au paquet de catalogues",
  "colonne": "pret",
  "priorite": "haute",
  "epic": "T-0079",
  "tags": [
    "prd",
    "donnees",
    "catalogue"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
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

**Source épinglée :** Stellarium DSO catalog v3.23
- URL : https://raw.githubusercontent.com/Stellarium/stellarium/9ca023a97f344975e1faa96f91b20a4c18a7c02b/nebulae/default/catalog.txt
- SHA-256 : 38a7c8c19b07bb3b2a659769acf4e5611a261732727d8e541c52ce691ab607aa
- Commit : 9ca023a97f344975e1faa96f91b20a4c18a7c02b (« Updated DSO catalog to v3.23 (#4853) »)

**Catalogues extraits et filtrés :**
- Sharpless (Sh2-) : 313 objets source, X après filtrage doublons NGC/IC
- Barnard (B) : 343 objets source, Y après filtrage doublons NGC/IC
- Caldwell (C) : écartés (109 redésignations NGC/IC)
- **Total paquet deepsky** : X + Y objets (mesurés à la construction)

**Modificatifs au code :**
- `scripts/build-catalogs.ts` : 
  - Ajout source `SOURCE_STELLARIUM_DSO`, groupe de construction `deepsky`
  - Fonction `extraitDesignationsNgcIc()` pour identifier les doublons
  - Fonction `construitCataloguesComplementaires()` qui filtre les objets avec NGC/IC présents dans OpenNGC
  - Mapping de types Stellarium DSO vers types du projet
- `src/data/bootstrap.ts` : extension de `chargeObjetsCielProfond()` pour charger deepsky aux côtés d'openngc
- `tests/catalog.test.ts` : ajout test de non-chevauchement NGC/IC, vérification explicite de Sh2-276
- `prd.md` §12.2 : mise à jour du tableau avec volume et comptage réels après filtrage
