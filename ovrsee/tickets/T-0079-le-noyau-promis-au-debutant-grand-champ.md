---
{
  "id": "T-0079",
  "titre": "Le noyau promis au débutant grand champ",
  "type": "epic",
  "colonne": "pret",
  "priorite": "haute",
  "tags": [
    "prd",
    "audit",
    "coeur-metier"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "plan": null
}
---

## Contexte

L'audit PRD ↔ code du 19 août 2026 a trouvé trois features spécifiées, citées comme
obligatoires au MVP, et absentes du code. Les trois touchent le persona primaire — le
débutant grand champ — et chacune fausse une sortie plutôt que de manquer visiblement :

- le masque d'horizon est plat à 0°, donc aucune cible n'est jamais bloquée par le relief ;
- Sharpless et Barnard manquent, donc le domaine `TRES_GRAND_CHAMP` est quasi vide ;
- rien de ce que l'utilisateur saisit ne survit au rechargement, et l'export sort vide.

Aucune ne plante. C'est ce qui les rend coûteuses : l'application répond, et elle a tort.

## Critères d'acceptation

- [ ] Les trois tickets enfants sont soldés.
- [ ] Un plan de séance produit depuis le site de référence cite au moins une cible du
      domaine grand champ issue de Sharpless ou de Barnard.
- [ ] Une cible bloquée par le relief est écartée avec la cause `RELIEF`, pas `HAUTEUR`.
- [ ] Un rechargement de la page retrouve le lieu, le matériel et la date saisis.
