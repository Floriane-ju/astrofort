---
{
  "id": "T-0055",
  "titre": "Le démarrage ne reste plus bloqué sur « Vérification en cours… »",
  "colonne": "backlog",
  "priorite": "haute",
  "charge": "s",
  "tags": ["audit", "securite", "robustesse", "demarrage"],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **S2** de l'audit T-0054.

`src/App.tsx:157-166` enchaîne `void demarre().then(setEtat).then(…)` sans
`.catch()` ni nettoyage au démontage. Côté moteur, `src/data/bootstrap.ts:106`
appelle `manifestes.map(resoudPaquet)` **hors** du `try` de `chargeManifeste`
(`bootstrap.ts:58-66`) : un `manifest.json` qui n'est pas un tableau lève, la
promesse remonte en rejet non géré, `etat` reste `null`, et
`src/ui/Verification.tsx:35` affiche « Vérification en cours… » indéfiniment.

C'est exactement ce que l'en-tête de `bootstrap.ts:5` s'interdit : « Aucune ne
doit produire un écran blanc ni une erreur technique brute : chaque échec a une
cause nommée et une conduite à tenir. » Aujourd'hui l'échec n'a ni cause ni
conduite — il a un libellé d'attente qui ment.

Le manifeste est le point d'entrée de tout le contrôle d'intégrité : c'est la
frontière qu'il faut tenir, pas seulement l'appelant.

## Critères d'acceptation

- [ ] Un `manifest.json` qui n'est pas un tableau d'objets ne fait plus rejeter
      `demarre()` : `verifieCatalogues()` retourne un `EtatCatalogues` avec
      `manifesteLu: false` et une `cause` nommée, comme pour un manifeste absent
- [ ] La chaîne de `src/App.tsx` porte un `.catch()` : tout échec de démarrage
      pose un état affichable, jamais un rejet non géré
- [ ] Le panneau Vérification distingue trois états — en cours, échoué avec sa
      cause, abouti — et ne peut plus rester sur « en cours » après un échec
- [ ] L'effet de démarrage ne pose plus d'état après démontage
- [ ] Un test couvre le manifeste malformé et constate la cause affichée
