---
{
  "id": "T-0059",
  "titre": "Les catalogues se construisent depuis des sources épinglées",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "audit",
    "securite",
    "chaine-approvisionnement",
    "donnees"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **S3** de l'audit T-0054.

`scripts/build-catalogs.ts` télécharge ses quatre sources depuis des références
mouvantes :

- `:39` HYG — `.../HYG-Database/main/hyg/CURRENT/hygdata_v41.csv`
- `:41` OpenNGC — `.../OpenNGC/master/database_files/NGC.csv`
- `:49` OpenNGC addendum — `.../OpenNGC/master/database_files/addendum.csv`
- `:56` Stellarium — `.../stellarium/master/skycultures/modern/index.json`

`main`, `master` et `CURRENT` désignent ce que l'amont y met aujourd'hui. Le
`sha256` inscrit au manifeste atteste ce que **la construction a produit**,
jamais ce qu'elle a **téléchargé** : un changement amont — accident, ou
compromission du dépôt — entre dans les paquets binaires sans que rien ne le
signale, et le manifeste régénéré le certifie de bonne foi.

La portée est limitée — la construction tourne sur un poste de dev, à la
demande, et les `.bin` sont versionnés dans git, donc un diff les montre. Ce qui
manque est le signal : aujourd'hui, une source qui change et une source qui a
été altérée se ressemblent.

Épingler un SHA de commit dans l'URL `raw.githubusercontent.com` suffit :
l'adresse devient immuable, et la mettre à jour devient un geste conscient.

## Critères d'acceptation

- [x] Les quatre URL citent un SHA de commit, pas une branche ni `CURRENT`
- [x] L'empreinte SHA-256 de chaque fichier **source téléchargé** est consignée
      dans le script, et un écart interrompt la construction en nommant la source
- [x] Le message d'interruption dit quoi faire : vérifier l'amont, puis relever
      le SHA et l'empreinte ensemble
- [~] `pnpm data:build` régénère les quatre paquets à l'identique — les `sha256`
      de `public/data/manifest.json` sont inchangés : **trois sur quatre**. Le
      quatrième, `constellations`, change parce que la source Stellarium avait
      dérivé sans le dire — voir « Résultat ». La construction est idempotente
      une fois l'épinglage posé.
- [x] La procédure de mise à jour d'une source est écrite en tête du script

## Résultat

Les quatre sources sont épinglées à un SHA de commit, avec l'empreinte SHA-256 du
fichier téléchargé consignée à côté de l'URL. `telecharge` lit désormais les octets
bruts, les compare à l'empreinte attendue et interrompt la construction en nommant la
source, avec la marche à suivre. La procédure de mise à jour est en tête du script.

Vérifications :

- `pnpm data:build` deux fois de suite — sortie identique, construction idempotente.
- `pnpm typecheck` et `pnpm test` (484 tests) au vert.
- Empreinte volontairement faussée : la construction s'arrête, nomme
  « Stellarium (culture « modern ») », affiche attendu / reçu et n'écrit rien.

Trois paquets sur quatre se régénèrent à l'identique — `hyg`, `openngc`,
`openngc-noms`. **`constellations` change**, et c'est justement le signal qui manquait :
la source Stellarium avait bougé depuis la dernière construction, sans que rien ne le
dise. Le commit amont `daace2ad` du 5 mars 2026, « Asterism typofix (Fix #4801) »,
corrige l'astérisme « The Three Patriarchs » : il pointait α/β/γ **Trianguli**, il pointe
désormais α/β/γ **Trianguli Australis**. La correction amont est la bonne — les Trois
Patriarches sont le nom ancien du Triangle austral — elle est donc reprise, et le paquet
régénéré (269 638 octets, `e6052103…`) l'intègre.
