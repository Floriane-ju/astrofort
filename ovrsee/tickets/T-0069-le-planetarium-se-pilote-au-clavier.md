---
{
  "id": "T-0069",
  "titre": "Le planétarium se pilote au clavier",
  "colonne": "a-specifier",
  "priorite": "haute",
  "charge": "l",
  "tags": [
    "audit",
    "accessibilite",
    "planetarium"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "epic": "T-0067",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **A2** de l'audit du 19 août 2026.

`src/ui/Planetarium.tsx:176-178` ne câble que `onPointerDown`, `onPointerMove` et `onPointerUp`.
Aucun `onKeyDown`, aucun `tabIndex` nulle part dans `src/ui/*.tsx` hors la fermeture des tiroirs
à `Échap`. Ni la visée, ni le zoom, ni la sélection d'un objet ne s'atteignent au clavier.

WCAG 2.1.1 (Clavier) est un critère de **niveau A** — le plancher, pas l'ambition. Et §11.2 dit
« aucune information critique dépendant du survol : tout est accessible au clic » : la règle vise
le même besoin, elle s'arrête juste au pointeur.

Quatre tickets ont déjà travaillé les gestes de pointage — T-0029 à T-0032 pour le pincement,
T-0036 pour le défilement à deux doigts. Les bornes de zoom et les pas de visée existent donc
déjà : ce ticket les rebranche sur le clavier, il n'en invente pas.

## Critères d'acceptation

- [ ] Le canevas est focusable et se signale comme tel (T-0070 fournit l'indicateur)
- [ ] Les flèches déplacent la visée, `+` et `-` zooment, dans les mêmes bornes que la molette
      (T-0030) — un même geste logique, deux entrées
- [ ] Une cible se choisit sans pointeur, soit sur le canevas soit par la liste des visibles
      (T-0045), et le choix est le même dans les deux cas
- [ ] Tout pas de déplacement et toute borne viennent de `src/registry/` : aucun nombre en dur,
      ni dans le gestionnaire de touches ni dans l'UI
- [ ] Les raccourcis sont énoncés à l'écran, pas seulement dans le code
- [ ] Le geste clavier ne relance pas le calcul pendant la répétition de touche — même règle que
      T-0025 pour le pointeur
- [ ] Un test couvre visée, zoom et sélection au clavier
