---
{
  "id": "T-0058",
  "titre": "La mise à jour du service worker se propose à l'écran",
  "colonne": "backlog",
  "priorite": "moyenne",
  "charge": "s",
  "tags": ["audit", "securite", "pwa", "hors-ligne"],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **S1** de l'audit T-0054.

`vite.config.ts:12` déclare `registerType: 'prompt'`. Ce mode promet une
invite : le nouveau service worker attend que l'utilisateur accepte. Or aucun
`virtual:pwa-register` n'est importé dans `src/` — `dist/registerSW.js`
enregistre bien `/sw.js`, mais rien ne propose jamais l'activation.

Conséquence : un service worker mis à jour reste indéfiniment en attente tant
qu'un onglet reste ouvert. Sur une application de terrain, gardée ouverte toute
une nuit puis rouverte la suivante, un correctif — y compris de sécurité — peut
ne jamais atteindre l'utilisateur.

Deux sorties, à trancher :

- brancher l'invite promise (`useRegisterSW`), et l'afficher là où les autres
  états du socle se lisent déjà — le tiroir Vérification ;
- ou basculer en `registerType: 'autoUpdate'`, si aucune invite n'est voulue.

La première respecte §12.1 : une PWA de terrain ne se recharge pas sous les
doigts de quelqu'un en pleine session.

## Critères d'acceptation

- [ ] Une version nouvellement déployée est signalée à l'écran, et l'utilisateur
      peut l'appliquer d'un geste — ou bien `autoUpdate` est adopté et le choix
      est écrit dans `vite.config.ts`
- [ ] Le mode déclaré dans `vite.config.ts` et le comportement réel coïncident :
      plus de `prompt` sans invite
- [ ] Le signalement ne s'impose pas au milieu d'une session : il attend, il
      n'interrompt pas
- [ ] `pnpm build` produit toujours un `sw.js` qui précache les quatre paquets
      de `public/data/`
