---
{
  "id": "T-0116",
  "titre": "Le filé couvre tout le planétarium, sans son propre fond",
  "colonne": "pret",
  "priorite": "haute",
  "charge": "m",
  "epic": "T-0114",
  "tags": [
    "rendu",
    "file",
    "planetarium"
  ],
  "cree": "2026-08-23",
  "maj": "2026-08-23",
  "plan": "2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md"
}
---

## Contexte

Le filé ne se voit que dans le cadre du capteur. L'image est rendue hors écran à la définition de
la scène, puis déposée sous `ctx.clip()` du contour du cadre (`incrusteDansLeCadre`,
`src/ui/scene-overlay.ts:124`), et la sélection d'étoiles est resserrée sur l'étendue de ce cadre
(`cadreSelection`, T-0023). Tout ce qui est autour reste un ciel d'étoiles ponctuelles.

Ce qui est demandé : les traces couvrent **tout le planétarium**. Le plein ciel **remplace**
l'incrustation clippée — un seul chemin de rendu.

Le cadre ne disparaît pas pour autant : son contour reste tracé par-dessus. Quand tout le ciel
file, c'est lui, et lui seul, qui dit ce que le capteur enregistre vraiment.

## Ce qui doit devenir vrai

- **Plus de canevas hors écran, plus de clip.** La passe se dessine directement dans le contexte de
  la scène par le point d'entrée qui existe déjà (`surLeFond`, `planetarium-boucle.ts`).
  `rendIncrustation` et `incrusteDansLeCadre` n'ont plus d'appelant. `cadreSelection` et
  `filtreArcCadre` (`src/core/file-etoiles.ts`) non plus : ils partent avec, sauf appelant restant.
- **La passe ne peint plus son fond.** Le planétarium peint déjà le vrai fond de ciel du site —
  pollution lumineuse, halo lunaire, crépuscule (§3.7, T-0097 à T-0100). Un fond plein par-dessus
  l'effacerait.
- **La passe ne peint plus sa bande galactique.** Le planétarium a la sienne (§3.6, T-0103). Deux
  bandes superposées, rendues par deux paramétrages, se liraient comme un défaut — c'est
  exactement ce que T-0104 avait unifié.
- **La couche d'étoiles ponctuelles ne peint plus** pendant le filé : les traces la remplacent.
  Sinon chaque trace porte un point net à une extrémité, ce qu'aucune pose ne produit. Elle
  continue en revanche d'alimenter `cibles` et les noms : sans cela le survol et le clic perdent
  les étoiles (T-0085, T-0107 à T-0109).
- **Les compteurs ne se publient plus par image.** `poseRenduFile` passait par un rendu React à
  chaque peinture ; en plein ciel dans la boucle, ce serait trente rendus par seconde — le défaut
  de T-0056. Ils se publient au rythme du diagnostic (`PERIODE_DIAGNOSTIC_MS`).
- **La mention de vignettage se réécrit.** `MENTION_VIGNETTAGE_INCRUSTATION`
  (`src/ui/scene-overlay.ts:31`) parle d'une incrustation qui n'existe plus. Le vignettage reste
  éteint : il appartient au cadre du capteur, pas au ciel.

## Critères d'acceptation

- [ ] Filé actif : des traces sur toute la surface du planétarium, pas seulement dans le cadre
- [ ] Le contour du cadre reste visible par-dessus les traces
- [ ] Le fond du ciel reste celui du planétarium — halo d'horizon, Lune, crépuscule inchangés — et
      une seule bande de Voie lactée est visible
- [ ] Aucune étoile ponctuelle peinte sous une trace ; survol, clic et noms d'étoiles continuent de
      fonctionner (test)
- [ ] Le sol et le relief masquent toujours ce qui est dessous : aucune trace peinte sous
      l'horizon (§4.1)
- [ ] Les compteurs du panneau Filé ne provoquent pas plus d'un rendu React par période de
      diagnostic (test)
- [ ] `pnpm bench:file` mesuré avant / après en plein ciel — c'est la mesure de l'epic T-0114, et
      elle chiffre le retour du facteur ~6 que T-0023 avait gagné
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée
