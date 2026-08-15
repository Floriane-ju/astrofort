---
{
  "id": "T-0003",
  "titre": "Registre de constantes §2.1 et formulaire Annexe B",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "m",
  "tags": ["lot-0", "registre"],
  "cree": "2026-08-14",
  "maj": "2026-08-14",
  "plan": "2026-08-14-plan-initialisation-d-astrofort.md",
  "epic": "T-0001"
}
---

## Contexte

§2.1 impose une source unique pour toute valeur non dérivable d'une formule, chaque
entrée portant valeur, unité, source, tolérance et sections consommatrices. §1.5 impose
que tout nombre affiché soit dépliable jusqu'à sa formule. Les deux exigences ne peuvent
pas être ajoutées après coup sans retoucher chaque moteur : le registre et le formulaire
doivent exister avant le premier moteur.

Le facteur 57,296 figure au registre mais est marqué remplacé par l'arctangente : aucun
moteur ne doit le consommer (§5.1, Annexe C).

## Critères d'acceptation

- [ ] Les constantes astronomiques exactes et C-01 à C-16 sont portées avec source et tolérance
- [ ] Le registre est gelé à l'exécution, sans mécanisme d'ajustement
- [ ] Chaque formule de l'Annexe B a une entrée avec son expression littérale et son unité
- [ ] Un résultat de moteur porte sa formule, ses entrées et ses constantes sources
- [ ] Une constante marquée « ordre de grandeur » fait sortir une plage, jamais une valeur exacte
- [ ] Un test échoue sur toute constante numérique non triviale écrite en dur dans `src/core/`
