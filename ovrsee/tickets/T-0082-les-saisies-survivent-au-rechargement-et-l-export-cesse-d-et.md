---
{
  "id": "T-0082",
  "titre": "Les saisies survivent au rechargement, et l'export cesse d'être vide",
  "colonne": "pret",
  "priorite": "haute",
  "epic": "T-0079",
  "tags": [
    "prd",
    "persistance",
    "donnees"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
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

- [ ] Le site saisi (coordonnées, altitude, Bortle ou SQM, masque) est écrit dans le magasin
      `sites` et rechargé au démarrage.
- [ ] Le profil matériel saisi est écrit dans `profils` et rechargé au démarrage.
- [ ] Un rechargement de la page retrouve l'état de saisie, sans repasser par les valeurs
      par défaut.
- [ ] L'export contient ce site et ce profil ; son réimport les restaure à l'identique.
- [ ] La demande de stockage persistant reste posée après une première action utile, pas au
      chargement (§12.3).
- [ ] Une écriture qui échoue le dit à l'écran plutôt que de perdre la saisie en silence.
- [ ] Le critère de §2.1 est tenu ou explicitement écarté dans le ticket : un plan enregistré
      est recalculé après une mise à jour du registre, jamais servi avec les anciennes valeurs.
