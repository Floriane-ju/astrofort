---
{
  "id": "T-0118",
  "titre": "Moins d'étoiles pendant le geste, si le budget ne tient pas",
  "colonne": "pret",
  "priorite": "moyenne",
  "charge": "s",
  "epic": "T-0114",
  "tags": [
    "performance",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

**Ticket conditionnel.** Il ne se fait que si la mesure de T-0117 rate le budget de T-0114 : si la
primitive de cercle (T-0115) suffit à tenir l'image, il meurt sans être fait. C'est le même statut
que le cinquième enfant de T-0021, et c'est la mesure qui tranche, pas l'intuition.

Le levier, si besoin : la profondeur atteinte en plein ciel. À 50 mm f/1,4 la magnitude limite
descend à 15,1 et le semis génératif entre en jeu — 177 377 étoiles lues au pire cas. Pendant un
geste, cette profondeur ne sert à rien : l'œil suit le mouvement, pas les étoiles de magnitude 15.

## Ce qui doit devenir vrai

- Pendant le mouvement, la passe se limite : plafond de magnitude, et semis coupé si le plafond
  passe sous le seuil catalographié (`SEUIL_MAG_ETOILES_REELLES`). Les valeurs vivent dans
  `src/registry/constants.ts` avec source, unité et raison — jamais un nombre écrit dans un moteur
  ni dans l'UI.
- Au repos, la passe complète repasse. C'est l'image de référence, et elle ne change pas.
- **Les compteurs du panneau ne se publient pas depuis une image allégée.** Des chiffres tirés
  d'une passe dégradée diraient au panneau qu'il y a moins d'étoiles dans le ciel qu'il n'y en a.
- L'écran dit que l'aperçu est allégé pendant le mouvement. Une dégradation muette se lit comme un
  bug de rendu.

## Critères d'acceptation

- [ ] Le budget de T-0114 est tenu pendant le geste au pire cas (180°, 480 min, 50 mm f/1,4),
      mesuré au banc
- [ ] Au repos, l'image est identique à celle de la passe complète — `pnpm bench:file --empreinte`,
      condensés inchangés
- [ ] Aucun plafond, seuil ni facteur écrit hors de `src/registry/`
- [ ] Les compteurs du panneau Filé ne bougent pas pendant une passe allégée (test)
- [ ] Une mention à l'écran signale l'aperçu allégé, et disparaît au repos
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée
