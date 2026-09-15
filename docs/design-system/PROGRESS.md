# Suivi de migration — design system Astrofort

> Périmètre validé : **lots A → D + F**. Lot E (cascade de `label`) écarté.
> Glyphes validés : `✛` → `my_location`, `★` → `star`, `●` → `circle`.

## État : périmètre validé TERMINÉ

```
$ pnpm typecheck    → aucune sortie
$ pnpm test         → Test Files 81 passed (81) · Tests 1312 passed (1312)
```

Suite verte sur trois passes consécutives. Départ : 1306 tests. Arrivée : 1312.
Pas de commande `lint` dans ce dépôt — vérification = `pnpm typecheck && pnpm test`.

## Tableau de bord

| # | Chantier | État | Commit |
|---|---|---|---|
| A1 | `Interrupteur` — 7 sites | ✅ fait | `ac9fa23` |
| A2 | `ChampChoix` — 5 sites sur 7 | ✅ fait | `dcbe45a` |
| A3 | `Tiroir` — 4 sites | ✅ fait | `b0528c1` |
| B1 | `--jour-ecran` — 4 décl. | ✅ fait | `09cff5f` |
| B2 | `--trait-marque` — 3 décl. | ✅ fait | `09cff5f` |
| B3 | `--decalage-souligne` — 2 décl. | ✅ fait | `09cff5f` |
| B4 | `--suivi-saisie/-horaire/-etape` + test de garantie | ✅ fait | `09cff5f` |
| C1 | micro-libellé : test de garantie (sans regroupement) | ✅ fait | `2a05ab7` |
| D1 | `●` → `circle` | ✅ fait | `d9996d4` |
| D2 | `✛` → `my_location` | ✅ fait | `d9996d4` |
| D3 | `★` → `star` | ✅ fait | `d9996d4` |
| D+ | garde-fou : aucun Unicode-dessin dans `src/ui/` | ✅ fait | `d9996d4` |
| F1 | `.facilite-ligne` morte | ✅ fait | `6f20804` |
| F2 | bloc dupliqué (média 1100 px) | ✅ fait | `6f20804` |

## À VÉRIFIER VISUELLEMENT

**Un seul écran, un seul commit.**

| Commit | Écran | Quoi regarder |
|---|---|---|
| `d9996d4` | Carte **« Plan de séance »**, section **schéma de pointage** (§8.4) — ouvrir une cible qui porte au moins un ancrage | Les trois repères ont changé de dessin. Le schéma les positionne au pourcentage avec `translate(-50%, -50%)`, et la boîte d'un glyphe Material n'a pas la chasse d'un caractère de texte : **le centrage optique bouge**. Vérifier que la mire centrale tombe bien au centre du cadre, que les disques d'ancrage ne débordent pas du schéma, et que l'étoile de l'ancrage principal ne chevauche pas son disque. Taille retenue : `var(--texte-legende)` (0,78 rem) via `.schema-astre .icone`, contre 0,65 rem pour les anciens caractères. |

Tous les autres commits sont iso-pixel par construction : A1-A3 ne changent pas
un octet du balisage produit, B et F substituent des valeurs identiques, C1
n'ajoute qu'un test.

## Décisions prises

- **Q1 — pas de couche de primitives sous les couleurs.** Le mode nuit surcharge chaque jeton
  sémantique individuellement, avec une valeur calculée. Une primitive n'aurait aucun
  consommateur : aucun jeton sémantique ne partage sa valeur avec un autre.
- **Q2 — `--texte` (couleur) n'est pas renommé.** Cité en dur par dix tests et par tout le
  produit ; le renommer ne change aucun pixel et élargit le diff pour rien.
- **Q3 — lot E écarté.** La verrue est documentée et ne grandit pas ; la corriger toucherait
  tous les champs de saisie du produit.
- **Q4 — `✛` → `my_location`**, déjà le glyphe « viser » du produit. `★` → `star`,
  `●` → `circle`.
- **Q5 — les trois `letter-spacing` hors échelle sont NOMMÉS, pas fusionnés.** Les ramener sur
  `--suivi-micro` aurait changé la chasse des saisies, des titres d'étape et des horaires.
- **Q6 — le micro-libellé reçoit son test, PAS son regroupement.** Écart assumé avec ce que le
  plan proposait. Regrouper les neuf sélecteurs les aurait déplacés dans la cascade : un
  onglet actif, un tiroir ouvert et un survol reposent chacun sur l'ordre de la feuille pour
  surcharger leur couleur. Vingt-sept lignes gagnées contre neuf réordonnancements, dans une
  feuille dont toute la discipline est que rien ne bouge en silence. Et ce n'était pas la
  vraie dette : les quatre valeurs sont déjà des jetons, donc aucune ne peut dériver — ce qui
  pouvait dériver, c'est la dixième règle qui en oublierait un. C'est elle que le test attrape.

## Écarts avec le plan d'audit

- **A2 — sept `<select>` réels, pas huit.** Un des comptages de l'audit portait sur un
  `<select>` cité dans un commentaire de `PanneauCibles.tsx`.
- **A2 — cinq sites migrés sur sept.** Le filtre « Type » de `PanneauCibles` porte un libellé
  en texte brut et une sentinelle `''` ↔ `null` ; le choix de RSB de `Verdicts` porte une
  valeur numérique là où un `<select>` ne rend que des chaînes. Les faire entrer aurait ajouté
  trois props pour deux appelants (règle de décision n° 4 et limite d'explosion). L'en-tête de
  `ChampChoix.tsx` le consigne.
- **A2 — les options restent en `children`, pas en prop `options`.** Deux sites groupent leurs
  choix en `<optgroup>` : une prop en tableau plat les aurait laissés dehors.
- **C1 — neuf règles, pas sept.** L'extraction de l'audit regroupait les jeux de propriétés
  identiques et masquait les règles portant des propriétés supplémentaires.
- **A3 — un test a dû être réécrit.** `echap-fermeture.test.tsx` citait les chaînes littérales
  `className="tiroir tiroir-nuit"` dans deux fichiers : il garantissait la propriété en
  ÉNUMÉRANT les tiroirs, donc il ratait déjà le quatrième (`tiroir-legende`). Il vérifie
  maintenant la construction unique et qu'aucun tiroir ne se bâtit ailleurs.
- **D — une dette non relevée à l'audit.** Voir « Reste à traiter » ci-dessous.

## Reste à traiter — hors périmètre validé

### D4 — `content: '⚠ '` dans `styles.css` (non relevé à l'audit, non validé)

`src/ui/styles.css` pose un caractère Unicode en police de texte sur `.cause::before` et
`.erreur::before`. C'est la même classe de dette que les trois du schéma, et l'équivalent
Material est sans ambiguïté : `warning`, déjà la ligature de `ChampDomaine.tsx:35`.

Je ne l'ai pas fait, pour deux raisons : il n'était pas dans le lot D validé, et il touche
**toute alerte et toute cause du produit** — c'est-à-dire presque chaque panneau. Aligner
inline une boîte de glyphe de 1,25 rem sur un texte à 0,78 rem change le rendu de chaque
message. `mode-nuit.test.tsx:138` cite le caractère en dur et devrait suivre.

### Lot E — la cascade de `label` (écarté, Q3)

`label` impose `text-transform: uppercase` + `--suivi-micro` à tout son sous-arbre, d'où sept
blocs d'annulation (`letter-spacing: 0; text-transform: none`) dans la feuille. Documenté,
stable, non corrigé.

### Lot G — documentation (phase 5, hors périmètre validé)

`docs/design-system/README.md` — jetons, catalogue des composants, règles pour un nouvel
écran — et renvoi depuis `CLAUDE.md` et `.claude/rules/astrofort.md`.

### Hors design system

- **`tests/precharge-vignettes.test.ts` est FLAKY**, et l'était avant ces commits : sur
  l'arbre remisé, il échoue environ une fois sur trois en suite complète (« notifie le magasin
  à chaque image retenue », ligne 233), jamais en isolation. Non touché, signalé ici.
- **Aucun lint dans le dépôt** : pas d'ESLint, pas de Prettier, pas de Stylelint. Hors
  périmètre, et pas d'installation de dépendance sans accord.
