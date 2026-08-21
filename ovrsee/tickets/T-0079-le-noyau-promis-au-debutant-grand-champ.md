---
{
  "id": "T-0079",
  "titre": "Le noyau promis au débutant grand champ",
  "type": "epic",
  "colonne": "fait",
  "priorite": "haute",
  "tags": [
    "prd",
    "audit",
    "coeur-metier"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
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

- [x] Les trois tickets enfants sont soldés.
- [x] Un plan de séance produit depuis le site de référence cite au moins une cible du
      domaine grand champ issue de Sharpless ou de Barnard.
- [x] Une cible bloquée par le relief est écartée avec la cause `RELIEF`, pas `HAUTEUR`.
- [x] Un rechargement de la page retrouve le lieu, le matériel et la date saisis.

## Solde — 21 août 2026

Les trois enfants sont livrés (T-0080, T-0081, T-0082), et chaque critère de l'épique a été
vérifié plutôt que déduit de leur état :

- **Grand champ** — `tests/plan-session.test.ts`, « cite une cible Sharpless ou Barnard dans un
  plan de grand champ » : ajouté à la clôture, il produit un plan sur le CATALOGUE RÉEL (13 132
  objets, OpenNGC + complément) depuis le site de référence, et exige au moins une désignation
  `Sh2-` ou `B`. Sans ce test, les deux catalogues pouvaient être au paquet sans jamais
  ressortir du scoring, et l'épique se soldait sur une promesse.
- **Relief** — `tests/creneaux.test.ts:73` : la cause d'exclusion est bien `RELIEF`, pas
  `HAUTEUR`.
- **Rechargement** — `tests/saisie-persistee.test.ts` : le lieu et son ciel déclaré, les
  relevés de relief, le boîtier saisi à la main, le site et le profil de séance.

**Observé au passage, hors périmètre de l'épique.** Au-delà d'environ 30° de champ horizontal,
le pré-filtrage écarte TOUTES les cibles sur `CADRAGE` — 4 544 sur 13 132, le reste en
`DONNEE_MANQUANTE`. Un plan à 24 mm f/2 sort donc vide. À 7°, 11,4° et 20°, il cite bien
`B348`, `B144` et `B138`. Le seuil de remplissage minimal de §6.2 mérite d'être regardé pour le
très grand champ : c'est un ticket à ouvrir, pas un défaut de cette épique.
