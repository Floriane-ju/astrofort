---
{
  "id": "T-0075",
  "titre": "Une CSP interdit toute requête hors origine",
  "colonne": "fait",
  "priorite": "moyenne",
  "charge": "m",
  "tags": [
    "audit",
    "securite",
    "pwa"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-21",
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

- [x] Une CSP est servie : en-tête si la cible d'hébergement le permet, `<meta>` sinon — et la
      raison du choix est écrite, parce que les deux ne protègent pas exactement la même chose
- [x] `connect-src 'self'` est en place, et le critère §13.3 est constatable en tentant une
      requête sortante depuis la console : elle est refusée par le navigateur
- [x] `default-src 'self'`, `object-src 'none'`, `base-uri 'self'` sont posés
- [x] L'application démarre, le service worker s'enregistre et les quatre paquets binaires se
      chargent sans aucune violation en console, en développement comme après
      `pnpm build && pnpm preview`
- [x] Toute directive assouplie pour les besoins de Vite en développement est écrite avec sa
      raison et ne s'applique pas à la production

## Implémentation

La politique est injectée par un greffon Vite (`politiqueDeSecurite()` dans `vite.config.ts`),
pas écrite à la main dans `index.html` : c'est le seul moyen de servir deux politiques — une en
développement, une en production — depuis un même document, et d'empêcher qu'un assouplissement
de développement parte dans l'artefact.

**`<meta>` plutôt qu'en-tête, et pourquoi.** Le dépôt ne fixe aucune cible d'hébergement (§13.1
exclut le serveur applicatif) : ni `vercel.json`, ni `netlify.toml`, ni `_headers`. Un fichier
d'en-têtes n'aurait protégé que l'hébergeur qu'il vise, et rien du tout partout ailleurs. Le
`<meta>` voyage avec `dist/` et vaut sur n'importe quel serveur statique. Contrepartie assumée et
écrite dans le greffon : `frame-ancestors` et `report-uri` sont ignorés en `<meta>` — le jour où
un hébergeur est choisi, la même liste passe en en-tête et gagne l'anti-encadrement.

**Directives.** `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`,
`style-src 'self' 'unsafe-inline'` (React pose des styles en attribut, Vite injecte la feuille par
script ; sans effet sur §13.3), plus en production `script-src 'self'` et `connect-src 'self'`.
En développement seulement : `script-src` accepte l'inline (préambule de rafraîchissement React) et
`connect-src` accepte `ws:`/`wss:` (rechargement à chaud).

**Vérification, sur Chrome sans interface, profil neuf.**
- Production (`pnpm build && pnpm preview`) : les six paquets binaires et le manifeste se chargent
  (hyg 979 ko, openngc 343 ko, constellations 264 ko, openngc-noms 99 ko, deepsky 17 ko,
  deepsky-noms 5 ko), le service worker s'enregistre, aucune violation et aucune erreur en console.
- `fetch('https://example.com/ping')` depuis la console est refusé par le navigateur :
  « Connecting to 'https://example.com/ping' violates the following Content Security Policy
  directive: "connect-src 'self'" » — §13.3 constatable, pas seulement relu.
- Développement (`pnpm dev`) : mêmes paquets chargés, HMR fonctionnel, aucune violation.

**Modificatifs au code :**
- `vite.config.ts` : `CSP_COMMUNE`, `CSP_PRODUCTION`, `CSP_DEVELOPPEMENT`, greffon
  `politiqueDeSecurite()` en tête de la liste des greffons, injection en `head-prepend`
  (une politique en `<meta>` ne couvre que ce qui la suit).
- `tests/csp.test.ts` : les directives exigées sont présentes ; la politique de production ne
  contient ni `ws:` ni joker ; le greffon rend bien deux politiques distinctes selon le mode.

**Hors périmètre, assumé :** pas de `frame-ancestors` ni de rapport de violation — les deux
demandent un en-tête, donc un hébergeur choisi. `style-src` garde `'unsafe-inline'` : le retirer
exigerait de sortir les styles en attribut de React et de changer la façon dont Vite sert la
feuille, pour un gain nul sur la promesse §13.3.
