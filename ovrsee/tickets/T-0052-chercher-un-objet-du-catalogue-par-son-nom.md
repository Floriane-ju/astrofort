---
{
  "id": "T-0052",
  "titre": "Chercher un objet du catalogue par son nom",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "s",
  "tags": [
    "catalogue",
    "cible"
  ],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "plan": null
}
---

## Contexte

Le tiroir de réglages propose `catalogue.slice(0, 400)`
(`src/ui/MenuReglages.tsx:53`). Le CSV d'OpenNGC est trié alphabétiquement par
`Name`, et `construitObjets` (`scripts/build-catalogs.ts:176`) conserve cet
ordre jusqu'au binaire : les 400 premières entrées sont donc `IC0001` →
`IC0430`. Sur ~14 000 objets, ce select n'en montre que des IC, et jamais un
Messier ni un NGC. M45 existe au catalogue ; il est inatteignable par ce chemin.

Le plafond n'est pas le vrai problème — l'absence de recherche l'est. Un
catalogue de 14 000 entrées ne se parcourt pas, il s'interroge. Ce ticket pose
la fonction qui répond ; T-0053 lui donne son champ.

**Ce qui doit se chercher.** La désignation (`M45`, `NGC0224`, `IC0434`) et les
noms communs (`Pléiades`, `Andromède`) — c'est-à-dire les deux moitiés que
`libelleObjet` (`src/ui/FicheCible.tsx:127`) affiche déjà. `nomsCommuns` porte
plusieurs noms séparés par `|` : chacun se cherche.

**Insensible à la casse et aux accents.** « pleiades » doit trouver
« Pléiades ». `String.prototype.normalize('NFD')` puis retrait des marques
diacritiques suffit — pas de dépendance.

**Classement, pas seulement filtrage.** Une saisie de trois lettres ramène des
centaines d'objets ; l'ordre décide de ce qu'on voit. Deux règles seulement :
un préfixe passe devant une occurrence interne, puis le plus brillant devant le
plus faible — le tri par magnitude est déjà celui de `ciblesVisibles`
(`src/core/visibles.ts:71`), et pour une bonne raison : c'est l'ordre dans
lequel un observateur pense au ciel.

**La recherche ne plafonne pas, le rendu oui.** Aucun objet du catalogue n'est
hors d'atteinte ; le nombre de résultats *rendus* est un argument de la
fonction, pas une limite du catalogue. La distinction est le cœur du ticket :
c'est elle qui fait la différence avec l'état actuel.

Une saisie vide ne ramène rien : proposer 14 000 entrées avant la première
frappe est le défaut qu'on corrige, pas un état par défaut acceptable.

Cette fonction ne connaît ni l'horizon ni le verdict — c'est la question de
`ciblesVisibles`, et elle a déjà son chemin dans l'onglet Cible (T-0045).
Chercher dans le catalogue, c'est chercher dans le catalogue entier, y compris
sous l'horizon.

## Critères d'acceptation

- [x] Une fonction pure, testée, rend les objets du catalogue dont la
      désignation ou l'un des noms communs contient la saisie.
- [x] La casse et les accents sont ignorés : « pleiades » trouve « Pléiades ».
- [x] Un objet dont le nom *commence* par la saisie passe avant un objet où
      elle apparaît plus loin.
- [x] À rang égal, l'objet le plus brillant vient d'abord ; un objet sans
      magnitude ne passe pas devant un objet qui en a une.
- [x] `M45` est trouvable, et par « M45 » comme par « pléiades ».
- [x] Le nombre de résultats rendus est un paramètre ; la portée de la
      recherche est le catalogue entier, sans plafond.
- [x] Une saisie vide ou blanche ne rend aucun résultat.
