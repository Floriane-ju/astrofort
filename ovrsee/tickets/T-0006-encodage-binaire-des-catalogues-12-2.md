---
{
  "id": "T-0006",
  "titre": "Encodage binaire des catalogues §12.2",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": ["lot-0", "donnees"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

Le CSV source de HYG v3 pèse ~30 Mo ; l'encodage à 12 octets par étoile le ramène à
1,7 Mo, facteur 18 par l'encodage seul. Le paquet de base doit tenir sous 10 Mo. Le
script de génération télécharge les sources publiques et se lance explicitement — jamais
au `postinstall`, la politique pnpm bloquant les scripts de cycle de vie.

## Critères d'acceptation

- [ ] Un script génère les paquets binaires HYG v3 (mag ≤ 9) et OpenNGC depuis les sources publiques
- [ ] Le paquet de base obligatoire ne dépasse pas 10 Mo
- [ ] Sur 100 positions décodées, l'écart maximal à la source reste inférieur à 1 seconde d'arc
- [ ] Un paquet tronqué ou corrompu est détecté par somme de contrôle et jamais servi comme complet
