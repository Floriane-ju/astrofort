---
{
  "id": "T-0108",
  "titre": "Une étoile déjà nommée à l'écran ne se laisse rien peindre au survol",
  "colonne": "revue",
  "priorite": "moyenne",
  "charge": "xs",
  "tags": [
    "planetarium",
    "tests",
    "interaction"
  ],
  "cree": "2026-08-22",
  "maj": "2026-08-21",
  "plan": "2026-08-21-deux-tickets-le-survol-d-une-etoile-deja-nommee-ne-dit-plus.md"
}
---

## Contexte

T-0085 énonce l'invariant en commentaire — le survol ne sert qu'à révéler un nom **masqué** par
le seuil de zoom de §3.4 — et `labelSurvol` (`src/core/labels.ts:97-107`) l'applique par une
heuristique de préfixe : le survol se tait si son titre commence par un label déjà retenu.

Rien ne vérifie l'invariant de bout en bout. C'est ce qui a laissé passer T-0107 : la chaîne
survol → `cibleSousLeCurseur` → `decritCible` → `labelSurvol` produisait un titre qui ne
commençait par aucun label, et le garde-fou s'est tu sans rien signaler. Le doublon de cibles
était la cause, mais l'absence de test d'acceptation est la raison pour laquelle il est arrivé
jusqu'à l'écran.

Ce ticket pose le verrou. `tests/dessine-ciel.test.ts` porte déjà le harnais `rend()` et couvre
`cibles` et `survol` (lignes 528-536 et 544-575) : les cas s'y ajoutent, sans fichier nouveau.

Le troisième critère ci-dessous garde le contre-exemple vivant. Sans lui, T-0107 pourrait être
« corrigé » en supprimant la branche de repli de `src/ui/planetarium-selection.ts:52-63`, ce qui
rendrait injoignables les 5 étoiles brillantes qui n'ont réellement aucune désignation.

## Critères d'acceptation

- [ ] Un test rend un champ contenant une étoile nommée labellisée, appelle `cibleSousLeCurseur`
      sur plusieurs points autour de son pixel et vérifie que `decritCible` ne rend jamais le
      titre de repli — c'est la chaîne complète qui est vérifiée, pas seulement le
      dédoublonnage.
- [ ] Un test vérifie que pour toute étoile dont le label est retenu par `composeLabels`, le
      survol au même point rend `revele === null`.
- [ ] Un test vérifie qu'une étoile brillante réellement sans désignation révèle bien son titre
      de repli au survol.
- [ ] Les positions et magnitudes des tests viennent des paquets chargés ou du harnais existant,
      jamais d'une valeur recopiée.
