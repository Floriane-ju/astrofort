---
{
  "id": "T-0082",
  "titre": "Les saisies survivent au rechargement, et l'export cesse d'être vide",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0079",
  "tags": [
    "prd",
    "persistance",
    "donnees"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "plan": null
}
---

## Contexte

§12.3 est catégorique : « une éviction ne doit jamais détruire une donnée que l'utilisateur a
produite », et l'export JSON manuel est marqué OBLIGATOIRE au MVP.

Les magasins existent (`src/data/db.ts:64` — `sites`, `profils`, `plans`), l'export et
l'import sont écrits et testés (`tests/persistence.test.ts`, 11 cas). Mais **rien n'écrit
jamais dans ces magasins** : la seule écriture est celle de l'import lui-même
(`src/data/persistence.ts:267`). Le lieu, le matériel et la date vivent dans `useState`
(`src/ui/app-saisie.ts:41`) et disparaissent au rechargement. L'export produit donc un
fichier à trois tableaux vides, et le critère d'acceptation de §12.3 — « un fichier JSON
unique contient l'intégralité des données que j'ai produites » — est faux aujourd'hui.

Seul le mode nuit persiste, par `localStorage` (`src/ui/ModeNuit.tsx:82`).

Ce ticket ne traite qu'un site et un profil actifs : le multi-sites de §4.1 est reporté à une
version ultérieure du PRD.

## Critères d'acceptation

- [x] Le site saisi (coordonnées, altitude, Bortle ou SQM, masque) est écrit dans le magasin
      `sites` et rechargé au démarrage.
- [x] Le profil matériel saisi est écrit dans `profils` et rechargé au démarrage.
- [x] Un rechargement de la page retrouve l'état de saisie, sans repasser par les valeurs
      par défaut.
- [x] L'export contient ce site et ce profil ; son réimport les restaure à l'identique.
- [x] La demande de stockage persistant reste posée après une première action utile, pas au
      chargement (§12.3).
- [x] Une écriture qui échoue le dit à l'écran plutôt que de perdre la saisie en silence.
- [x] Le critère de §2.1 est tenu ou explicitement écarté dans le ticket : un plan enregistré
      est recalculé après une mise à jour du registre, jamais servi avec les anciennes valeurs.

## Arbitrage du critère §2.1 — écarté, et pourquoi

Rien ici n'enregistre de plan : le magasin `plans` reste écrit par le seul réimport. Ce
ticket ne persiste que des **entrées** — coordonnées, ciel déclaré, masque relevé, grandeurs
du boîtier — jamais une sortie calculée. Chaque démarrage les repasse dans les moteurs, donc
aucun résultat obtenu sous d'anciennes constantes ne peut être resservi.

Le critère « un plan enregistré est recalculé après une mise à jour du registre » reste donc
entier, et appartient au ticket qui enregistrera un plan : c'est lui qui devra comparer
`versionRegistre` (déjà au schéma, `src/data/db.ts`) à la version du registre au démarrage.
