---
{
  "id": "T-0093",
  "titre": "La sonde WebGL 2 quitte le démarrage",
  "colonne": "fait",
  "priorite": "moyenne",
  "tags": [
    "prd",
    "code-mort",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

Le tiroir de vérification affiche une ligne fausse. Sur un navigateur sans WebGL 2, il
annonce :

> « WebGL 2 n'est pas disponible sur ce navigateur : le planétarium (§3) et les
> prévisualisations de champ et de filé (§9) sont désactivés. »

Rien n'est désactivé. Le planétarium dessine en `getContext('2d')`
(`src/ui/planetarium-boucle.ts:84`), et `App.tsx` monte la scène sur la validité de la saisie,
jamais sur les capacités de rendu. `etat.rendu.webgl2` a **un seul consommateur dans tout le
code** : la ligne de texte qui le proclame (`src/ui/Verification.tsx:40`). La sonde ne
conditionne aucune fonction.

Deux conséquences :

1. C'est la seule ligne fausse d'un tiroir dont le métier est de dire la vérité sur l'état du
   socle. Les trois autres — réseau, stockage persistant, intégrité des paquets — sont exactes
   et portent chacune une conduite à tenir. Celle-ci n'en a aucune, et pour cause : il n'y a
   rien à réparer. Le seul dégât réel est de détourner un utilisateur d'une fonction qui marche.
2. Elle contredit le PRD 1.2 depuis l'arbitrage de §12.1 (Annexe C, décision 16) : Canvas 2D
   est retenu, WebGL 2 n'est pas un prérequis, et la spécification dit désormais que sa
   détection « ne conditionne aucune fonction ».

`detecteWebGL2()` est aussi rangée par le PRD parmi les **trois vérifications du démarrage**,
à égalité avec l'intégrité des catalogues et l'état du stockage. Ce n'en est pas une : c'est
une mesure sans conséquence.

Retenu : la supprimer, plutôt que corriger son libellé. Une capacité qui ne conditionne rien
n'est pas une capacité — c'est une donnée exacte et inactionnable, le défaut que §10.1 et
§11.2 combattent partout ailleurs. La sonde tient en six lignes : si un profil de rendu
justifie un jour WebGL 2 ou WebGPU, elle se réécrit **avec** le code qui l'emploie.

Aucun test ne la couvre : la suppression ne casse rien à réécrire.

## Critères d'acceptation

- [x] `CapacitesRendu`, `CAUSE_SANS_WEBGL2` et `detecteWebGL2()` disparaissent de
      `src/data/bootstrap.ts`, ainsi que le champ `rendu` de `EtatDemarrage`.
- [x] Les deux lignes correspondantes disparaissent de `src/ui/Verification.tsx`.
- [x] Le tiroir de vérification continue d'afficher les trois états qui portent une conduite à
      tenir : réseau, stockage persistant, intégrité des paquets.
- [x] L'en-tête de `bootstrap.ts` ne parle plus de « trois vérifications » : il en reste deux.
- [x] §12.1 du PRD est aligné — la ligne `webgl2_disponible` quitte le tableau Entrées /
      Sorties, et le critère d'acceptation « navigateur sans WebGL 2 » est retiré ou reformulé :
      il n'a plus d'objet si rien ne sonde.
- [x] Le paragraphe de §12.1 qui mentionne la détection informative est mis en cohérence, sans
      revenir sur la décision 16 : Canvas 2D reste le rendu retenu, WebGL 2 et WebGPU restent
      ouverts sur mesure.
- [x] `pnpm typecheck && pnpm test` verts, et la sortie réelle est rapportée.

## Réalisé — 19 août 2026

- `src/data/bootstrap.ts` : `CapacitesRendu`, `CAUSE_SANS_WEBGL2`, `detecteWebGL2()` et le
  champ `rendu` de `EtatDemarrage` supprimés. En-tête : « Deux vérifications » — intégrité des
  catalogues, état du stockage — avec la raison (une mesure sans conduite à tenir n'est pas une
  vérification).
- `src/ui/Verification.tsx` : les deux lignes WebGL 2 (état + cause) retirées. Le tiroir garde
  réseau, stockage persistant, intégrité des paquets.
- `prd.md` §12.1 : ligne `webgl2_disponible` retirée du tableau Entrées / Sorties ; le
  paragraphe STACK dit désormais que rien ne sonde WebGL 2 (décision 16 inchangée : Canvas 2D
  retenu, WebGL 2 / WebGPU ouverts sur mesure) ; le critère « navigateur sans WebGL 2 »
  reformulé — le tiroir ne mentionne plus WebGL 2.

Vérification : `pnpm typecheck` → sortie vide (aucune erreur). `pnpm test` → 42 fichiers,
500 tests passés.

## Réappliqué — 20 août 2026

Le commit de restauration des tickets avait remis la sonde dans le code (le PRD, lui, était
déjà aligné). Les suppressions de `src/data/bootstrap.ts` et `src/ui/Verification.tsx` sont
réappliquées à l'identique.

Vérification : `pnpm typecheck` → sortie vide. `pnpm test` → 42 fichiers, 504 tests passés.
