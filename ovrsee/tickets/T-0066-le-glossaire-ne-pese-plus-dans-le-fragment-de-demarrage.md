---
{
  "id": "T-0066",
  "titre": "Le glossaire ne pèse plus dans le fragment de démarrage",
  "colonne": "backlog",
  "priorite": "basse",
  "charge": "s",
  "tags": ["audit", "performance", "bundle"],
  "cree": "2026-08-18",
  "maj": "2026-08-18",
  "epic": "T-0054",
  "plan": null
}
---

## Contexte

Constat **O3** de l'audit T-0054.

`pnpm build` produit un fragment unique de 542,21 Ko (179,89 Ko gzip) et le
signale : « Some chunks are larger than 500 kB ». Aucun `import()` dynamique
n'existe dans `src/`.

L'audit a cherché ce qui est **réellement** détachable, et la réponse est plus
étroite qu'elle n'en a l'air. Le registre pèse 144 Ko de source, mais :

- `src/registry/constants.ts` (47 Ko) est importé par 39 modules — tous les
  moteurs le lisent par `K()`. Non détachable.
- `src/registry/formulas.ts` (18 Ko) est importé par `src/core/traced.ts`, donc
  par toute valeur tracée. Non détachable.
- `src/registry/glossaire.ts` (**53 Ko**) n'est importé que par
  `src/ui/Terme.tsx` et `src/ui/TracedValue.tsx` — l'explication §10.1/§10.2.
  Détachable.

53 Ko de source sur 542 Ko de fragment : le gain est réel mais modeste, et il ne
se paie que si le report ne dégrade pas le contrat §10.1 — une glose qui
apparaît en retard, ou pas du tout hors ligne, coûterait plus que les octets
gagnés. C'est pour ça que ce ticket est en priorité basse : il n'est utile que si
la mesure le confirme.

Le service worker précache déjà tout ce que `pnpm build` produit
(`vite.config.ts:16`, `globPatterns`) : un fragment différé reste disponible hors
ligne, à condition d'être bien précaché.

## Critères d'acceptation

- [ ] Le poids du fragment principal avant / après est relevé, et le gain
      constaté est écrit — s'il ne vaut pas le report, le ticket se ferme sur ce
      constat plutôt que sur un changement
- [ ] Si le report est fait : le glossaire est chargé par `import()` et
      l'avertissement de Vite disparaît
- [ ] Une glose reste disponible hors ligne : le fragment différé est précaché
      par le service worker, et un démarrage sans réseau l'affiche toujours
- [ ] Une glose demandée avant l'arrivée du fragment ne laisse pas un blanc :
      l'attente est visible ou imperceptible, jamais un terme muet
- [ ] `pnpm test` et `pnpm build` restent verts
