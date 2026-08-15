---
{
  "id": "T-0011",
  "titre": "Lot 3 — Planification nocturne, mode nuit et pointage sans GoTo",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "xl",
  "tags": [
    "lot-3"
  ],
  "cree": "2026-08-14",
  "maj": "2026-08-15",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md"
}
---

## Contexte

§8.1 fenêtre nocturne et Lune · §8.2 créneaux et méridien · §8.3 plan de session ordonné ·
§8.4 cheminement et carte de pointage · §7.5 et §10.3 recommandations · §11 mode nuit et
ergonomie terrain. Dépend des Lots 0 à 2.

À l'issue de ce lot, l'application est utilisable sur le terrain.

## Critères d'acceptation

- [x] Un plan de session complet, ordonné, budgété et exportable est produit
- [x] Les créneaux se centrent sur le milieu de nuit vrai, jamais sur minuit légal
- [x] Le cheminement d'étoiles permet d'atteindre une cible sans pointage automatique
- [x] Le mode nuit ne laisse subsister aucune composante verte ou bleue dans l'interface
- [x] Hors réseau, le plan reste complet et l'absence de filtre météo est mentionnée
      explicitement — l'app ne prétend pas que la nuit sera dégagée

## Ce qui a été livré

`core/moon.ts` (Krisciunas & Schaefer 1991, fenêtre utile) · `core/creneaux.ts` (créneaux,
méridien GEM, cause d'exclusion nommée) · `core/session.ts` (pré-filtrage, scoring C-15,
allocation, budget) · `core/pointage.ts` (carte directe et cheminement, angle du zénith) ·
`core/recommandations.ts` (§7.5 et §10.3) · `core/plan-texte.ts` (export imprimable) ·
`registry/filters.ts` · `ui/PlanSession.tsx` · `ui/ModeNuit.tsx` · palette rouge pur.

73 tests ajoutés, 242 au total. Le mode dégradé du crépuscule nautique est câblé : à 52° N
au solstice, la nuit astronomique est nulle et la fenêtre nautique la remplace, pénalité de
fond de ciel chiffrée.

## Points ouverts, hérités du lot

- **Couverture du catalogue.** OpenNGC ne publie une magnitude V que pour 4 154 objets sur
  12 458 : les grandes nébuleuses en émission (NGC 7000, Dentelles, California) n'en ont pas
  et sont donc écartées du plan automatique. Aucune magnitude n'est inventée ; le plan
  affiche le décompte et renvoie à la saisie manuelle. Une conversion B → V demanderait un
  terme de couleur sourcé, absent du registre.
- **Noms d'étoiles.** Le paquet HYG embarqué encode 12 octets par étoile sans bloc de noms :
  les ancrages de §8.4 sont désignés par magnitude et position, pas par leur nom propre.
  Ajouter les noms suppose de régénérer le binaire.
- **Web Worker §12.1.** Le plan est calculé sur le thread de rendu. Le pré-filtrage dur borne
  le coût à quelques dizaines de candidates — 35 ms sur le catalogue complet. À déporter le
  jour où ce plafond bouge.
