---
{
  "id": "T-0062",
  "titre": "Les sources du registre s'affichent toutes",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "audit",
    "tracabilite",
    "registre"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-19",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **M1** de l'audit T-0054, moitié fonctionnelle.

Le registre §2.1 déclare la source de chacune de ses tables. Une seule des trois
arrive à l'écran :

| Constante | Emplacement | Affichée ? |
|---|---|---|
| `SOURCE_TABLE_CONTRASTE` | `src/registry/contrast.ts:44` | oui — `src/ui/FicheCible.tsx:710` |
| `SOURCE_TABLE_BORTLE` | `src/registry/bortle.ts:38` | **non** |
| `SOURCE_TABLE_FILTRES` | `src/registry/filters.ts:79` | **non** |

Ce n'est pas du code mort à balayer, c'est une promesse écrite et non tenue. Les
deux textes existent, sont rédigés pour être lus, et disent des choses qu'on ne
peut pas deviner du résultat :

- Bortle : « Échelle de Bortle (Sky & Telescope, 2001) ; lignes 4 et 8 ancrées
  sur le socle. Interpolation autorisée entre deux lignes, extrapolation
  interdite hors [1 ; 9]. » — c'est-à-dire la limite de validité du chiffre que
  l'utilisateur saisit lui-même dans le panneau Nuit.
- Filtres : « Largeurs de bande usuelles par famille de filtres. Aucune donnée
  commerciale, aucune marque, aucun prix (§10.3). » — c'est-à-dire pourquoi
  aucun filtre n'est nommé.

Elles doivent apparaître là où leur table agit : le fond de ciel pour Bortle, le
conseil de filtre pour les filtres.

## Critères d'acceptation

- [x] `SOURCE_TABLE_BORTLE` est lisible depuis l'endroit où le Bortle est saisi
      ou son fond de ciel affiché
- [x] `SOURCE_TABLE_FILTRES` est lisible depuis l'endroit où un filtre est
      conseillé
- [x] Les trois sources se présentent de la même façon — la traçabilité se lit
      d'un seul geste, pas de trois façons différentes
- [x] Aucune constante `SOURCE_TABLE_*` du registre ne reste sans consommateur
