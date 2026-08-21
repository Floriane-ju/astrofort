---
{
  "id": "T-0068",
  "titre": "Le canevas du planétarium se nomme et s'annonce",
  "colonne": "fait",
  "priorite": "haute",
  "charge": "s",
  "tags": [
    "audit",
    "accessibilite",
    "ui"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
  "epic": "T-0067",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **A1** de l'audit du 19 août 2026.

`src/ui/Planetarium.tsx:171` rend `<canvas className="planetarium">` sans `role`, sans
`aria-label`, sans `aria-describedby`. Pour une technologie d'assistance, la vue centrale de
l'application — celle qui occupe toute la colonne du milieu et qui donne son nom au projet —
n'existe pas. Un canevas est une boîte de pixels : le navigateur ne peut rien en déduire.

`src/ui/PlanSession.tsx:276` fait la faute symétrique et plus discrète :
`<div className="schema" aria-label="Schéma du cadre, cible au centre">`. Un `aria-label` posé
sur une `<div>` sans rôle **n'est pas exposé** — l'intention est bonne, l'effet est nul.

## Critères d'acceptation

- [x] Le canevas porte un rôle explicite — `role="img"` tant qu'il n'est pas interactif,
      `role="application"` si T-0069 le rend pilotable — et un nom accessible
- [x] Une description associée dit ce que la vue montre en ce moment : visée, champ, instant
- [x] Le schéma de cadre de `src/ui/PlanSession.tsx:276` porte un rôle qui rend son `aria-label`
      effectif
- [x] Le nom et la description viennent des mêmes valeurs que les lectures affichées : aucune
      chaîne dupliquée qui puisse dériver
- [x] Un test de `tests/` vérifie la présence du nom accessible sur le rendu statique, comme
      `tests/coque.test.tsx` le fait déjà pour la structure de la coque
