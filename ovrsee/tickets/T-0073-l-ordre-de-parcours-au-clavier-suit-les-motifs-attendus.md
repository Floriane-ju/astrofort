---
{
  "id": "T-0073",
  "titre": "L'ordre de parcours au clavier suit les motifs attendus",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "accessibilite",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "epic": "T-0067",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **A6** de l'audit du 19 août 2026.

`src/ui/Coque.tsx` fait le travail sémantique : `<header>`, `<main>`, deux `<details>` qui portent
nativement leur état ouvert/fermé et le clavier. Deux manques subsistent, tous deux dans l'ordre
de parcours plutôt que dans le balisage.

**Le ciel est loin.** Le panneau Matériel — une vingtaine de contrôles — précède `<main>` dans le
DOM, parce que la grille le place à gauche. Au clavier, atteindre la scène demande de traverser
tout le matériel, à chaque fois. C'est exactement le besoin que couvre un lien d'évitement
(WCAG 2.4.1).

**Les régions n'ont pas de nom.** Les deux `<details>` de coque n'exposent rien qui permette de
sauter de l'un à l'autre par la liste des régions.

**Les onglets promettent plus qu'ils ne tiennent.** `src/ui/PanneauSeance.tsx:130-149` porte un
`role="tablist"`, des `role="tab"`, des `aria-selected` et des `aria-controls` corrects — un
balisage exemplaire. Mais le motif ARIA APG *Tabs* que ce rôle annonce implique la navigation aux
flèches et un seul onglet dans l'ordre de tabulation ; ici les quatre onglets sont quatre arrêts
de `Tab`. Le balisage annonce un comportement que le code ne fournit pas, ce qui est plus
déroutant que pas de balisage du tout.

## Critères d'acceptation

- [ ] Un lien d'évitement, premier élément focusable de la page, mène directement à la scène :
      invisible au repos, parfaitement visible au focus
- [ ] Les deux régions de coque — Matériel et Séance — portent un nom accessible
- [ ] Les onglets de séance se parcourent aux flèches, avec un seul onglet dans l'ordre de
      tabulation, conformément au motif que leur `role="tablist"` annonce
- [ ] Sous le repli à 1100 px, où les panneaux redeviennent des accordéons sous la scène, l'ordre
      de parcours reste cohérent avec l'ordre visuel
- [ ] `tests/coque.test.tsx` couvre le lien d'évitement et les noms de région
