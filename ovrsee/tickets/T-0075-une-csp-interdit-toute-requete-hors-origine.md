---
{
  "id": "T-0075",
  "titre": "Une CSP interdit toute requête hors origine",
  "colonne": "a-specifier",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "securite",
    "pwa"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
  "epic": "T-0074",
  "plan": "2026-08-19-audit-general-design-accessibilite-securite-pratiques.md"
}
---

## Contexte

Constat **C1** de l'audit du 19 août 2026.

Ni `<meta http-equiv="Content-Security-Policy">` dans `index.html`, ni fichier d'en-têtes :
aucun `vercel.json`, `netlify.toml` ni `_headers` dans le dépôt.

Ce n'est pas un trou d'exploitation, et il faut le dire pour ne pas se tromper de motif : il n'y a
pas de backend, pas d'`innerHTML`, pas d'`eval`, pas de secret, et les deux seuls `fetch` de
l'application (`src/data/bootstrap.ts:60,82`) sont de même origine. T-0054 l'avait déjà vérifié.

L'intérêt est ailleurs, et il est propre à ce projet. §13.1 exclut tout serveur applicatif ;
§13.3 demande qu'aucune donnée de profil, de site ou de plan de session ne soit transmise. Une
directive `connect-src 'self'` **fait tenir cette promesse par le navigateur**, à l'exécution,
pour toujours — au lieu d'une revue de code à recommencer à chaque dépendance ajoutée. C'est le
seul mécanisme qui rend le critère §13.3 vérifiable autrement qu'en inspectant le trafic à la
main.

## Critères d'acceptation

- [ ] Une CSP est servie : en-tête si la cible d'hébergement le permet, `<meta>` sinon — et la
      raison du choix est écrite, parce que les deux ne protègent pas exactement la même chose
- [ ] `connect-src 'self'` est en place, et le critère §13.3 est constatable en tentant une
      requête sortante depuis la console : elle est refusée par le navigateur
- [ ] `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` sont posés
- [ ] L'application démarre, le service worker s'enregistre et les quatre paquets binaires se
      chargent sans aucune violation en console, en développement comme après
      `pnpm build && pnpm preview`
- [ ] Toute directive assouplie pour les besoins de Vite en développement est écrite avec sa
      raison et ne s'applique pas à la production
