---
{
  "id": "T-0057",
  "titre": "Les données désérialisées sont validées avant d'entrer",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "securite",
    "validation"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constats **S4**, **S5** et **S6** de l'audit T-0054 — trois manifestations d'une
même frontière mal tenue : la désérialisation. Les saisies d'interface, elles,
sont bien validées (`src/registry/domains.ts`) ; ce qui entre par un fichier ou
par `localStorage` ne l'est pas.

**Le réimport.** `src/data/persistence.ts:109-127` vérifie `format`, `version` et
que les trois sections sont des tableaux. Aucun élément n'est validé avant `put`
(`persistence.ts:135-137`). Un export retouché à la main pose
`latitudeDeg: "abc"` dans IndexedDB, d'où des `NaN` dans toute la chaîne de
calcul — et persistés, donc rejoués à chaque démarrage.

**Le message d'erreur n'arrive pas.** `src/App.tsx:394-397` : `surImport`
n'entoure ni `JSON.parse` ni `importeDonneesUtilisateur` d'un `try`. Le texte
d'`ExportInvalideError`, pourtant rédigé pour être lu
(`persistence.ts:102-107`), part en rejet non géré. L'utilisateur voit un import
qui ne fait rien.

**Le mode nuit.** `src/ui/ModeNuit.tsx:44` fusionne
`{ ...ETAT_INITIAL, ...(JSON.parse(brut) as object) }` sans valider. Pas
d'injection possible — le CSSOM rejette une valeur invalide dans
`setProperty` (`ModeNuit.tsx:67`) — mais l'état peut devenir incohérent.

## Critères d'acceptation

- [x] Chaque site, profil et plan d'un fichier d'export est validé champ par
      champ avant `put` : type attendu, et plage de `src/registry/domains.ts`
      quand le champ en a une
- [x] Un enregistrement invalide est refusé en nommant le champ et
      l'enregistrement fautifs ; l'import n'écrit rien à moitié
- [x] Un fichier qui n'est pas du JSON, et un export invalide, affichent tous
      deux leur cause à l'écran — plus aucun rejet non géré sur ce chemin
- [x] `litEtatPersiste` ignore les champs de forme inattendue et retombe sur
      `ETAT_INITIAL` pour eux, au lieu de les propager
- [x] Un test couvre : JSON illisible, export de mauvaise version, site à
      latitude non numérique, `localStorage` de mode nuit corrompu
