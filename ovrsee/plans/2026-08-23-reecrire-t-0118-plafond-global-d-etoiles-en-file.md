---
{
  "status": "open",
  "title": "Réécrire T-0118 — plafond global d'étoiles en filé",
  "opened": "2026-08-23",
  "closed": null,
  "commits": []
}
---

# Réécrire T-0118 — plafond global d'étoiles en filé

## Contexte

T-0118 est écrit comme une **dégradation pendant le geste** : la passe s'allège tant que la souris
bouge, et la passe complète repasse au repos. Deux images pour une même scène.

L'utilisateur tranche autrement : **le plafond est global**. Dès que le mode filé est actif —
immobile comme en mouvement — le nombre d'étoiles est plafonné. Une seule image, un seul coût,
rien qui change sous la main.

C'est plus simple et plus honnête. La version « allégée pendant le geste » demandait deux chemins
de rendu, une mention qui apparaît et disparaît, et une règle sur les compteurs qui ne vaut que
pendant le mouvement. Un plafond permanent supprime les trois. Et il reste vrai que la profondeur
mag 15 ne sert à personne en filé : ces étoiles ne produisent pas de trace lisible, elles
produisent du temps de calcul.

Reste à savoir **combien**. Le ticket doit donc porter un levier réglable et un protocole de banc,
pas un nombre décidé d'avance.

Ce plan ne touche que `ovrsee/tickets/`. Aucun code.

## Décisions prises (réponses de l'utilisateur)

1. **Levier = budget d'étoiles, converti en magnitude limite.** Une constante « N étoiles lues au
   plus » ; la passe en déduit une magnitude plafond via la loi de comptage déjà au registre
   (`PENTE_COMPTAGE_ETOILES`, 0,6/mag) et l'angle solide du champ. Le coût reste borné à 10° comme
   à 180°, et l'image reste uniforme sur tout le ciel — ce qu'un plafond de magnitude fixe ne donne
   pas (le nombre d'étoiles y suit l'angle solide, ~9× entre 60° et 180°).
2. **Compteurs = ce qui est peint**, plus une mention permanente disant que l'aperçu est plafonné à
   N étoiles et que le capteur en enregistrerait davantage. Pas de seconde passe de comptage à
   pleine profondeur : c'est précisément le coût qu'on supprime.

## Le fichier à réécrire

`ovrsee/tickets/T-0118-moins-d-etoiles-pendant-le-geste-si-le-budget-ne-tient-pa.md`

Le titre change, donc le nom de fichier aussi (convention `T-NNNN-<slug>`) :
→ `ovrsee/tickets/T-0118-le-file-plafonne-le-nombre-d-etoiles.md` (`git mv`).

Frontmatter : `titre` réécrit, `maj` → `2026-08-23`. Le reste ne bouge pas — `colonne: "pret"`,
`priorite: "haute"`, `epic: "T-0114"`, `charge: "s"`, tags, `plan`.

### Nouveau titre

« Le filé plafonne le nombre d'étoiles »

### Contexte à écrire

- La mesure de T-0117 rate le budget dès le cas usuel rapide : 141 ms pour 60°, 120 min,
  50 mm f/1,4, contre ~33 ms d'intervalle de boucle. Pire cas 287 ms. Seul 10 mm f/2,8 tient
  (13 ms). Chiffres inchangés, ils restent la justification.
- Le levier reste le même : à 50 mm f/1,4 la magnitude limite descend à 15,1, le semis génératif
  entre en jeu, 177 377 étoiles lues au pire cas.
- **Ce qui change** : le plafond ne suit plus le geste, il suit le mode. Filé actif
  (`file.apercu === 'FILE'`, `src/ui/planetarium-incrustation.ts:70`) ⇒ plafond, immobile comme en
  mouvement. Écrire pourquoi : une passe qui change de profondeur sous la main donne deux images
  pour une scène, et une mention qui clignote au rythme du geste ; un plafond permanent donne une
  image, un coût, une phrase.
- L'aperçu de champ (`apercu === 'CHAMP'`, pose unitaire) n'est pas concerné : les arcs y sont
  courts, la passe ne coûte rien, et c'est là que la profondeur du capteur est le propos.

### « Ce qui doit devenir vrai » à écrire

- Une constante de registre porte le **budget d'étoiles lues** en filé — même grandeur que
  `etoilesVisitees` (`src/ui/dessine-champ.ts:88-93`), le compteur que le banc rapporte déjà. Elle
  vit dans `src/registry/constants.ts` sous `C-33`, avec source, unité et tolérance
  (`ordreDeGrandeur: true` — la modulation par la latitude galactique fait varier le comptage réel
  autour de la cible).
- La passe convertit ce budget en **magnitude plafond** pour la couche du semis, à partir de la loi
  de comptage `N(<m) ∝ 10^(0,6 m)` et de la fraction de sphère couverte par le champ
  (`(1 − cos r)/2`, `r` = `rayonChampDeg` déjà calculé à `dessine-champ.ts:118-121`) :

  ```
  magPlafond = SEUIL + log10( 1 + (N / (SEMIS_ETOILES_TOTAL × fractionCiel))
                                  × (10^(PENTE × (SEMIS_MAG_MAX − SEUIL)) − 1) ) / PENTE
  ```

  Fonction pure, dans `src/core/` — `galactique.ts` tient déjà `magnitudeLimitePrevisu` et la
  physique de profondeur. Aucun des cinq symboles n'est un nombre écrit : `SEUIL` =
  `SEUIL_MAG_ETOILES_REELLES`, `PENTE` = `PENTE_COMPTAGE_ETOILES`, etc. `src/data/semis.ts:60`
  tire ses magnitudes avec exactement cette loi : le ticket exige que les deux la partagent, pas
  qu'elles la récrivent chacune.
- La couche du semis est **coupée** si `magPlafond` retombe sous `SEUIL_MAG_ETOILES_REELLES` :
  c'est déjà la garde de `dessine-champ.ts:208`, elle suffit.
- **Le catalogue réel n'est pas plafonné.** Il vaut ~15 000 étoiles sur toute la sphère, c'est le
  ciel reconnaissable, et ce n'est pas lui qui coûte. Le ticket le dit, pour qu'on ne « complète »
  pas le plafond dessus plus tard.
- Les compteurs du panneau disent ce qui est peint. Une mention à l'écran, **permanente tant que le
  filé est actif**, dit que l'aperçu est plafonné à N étoiles et que le capteur en enregistrerait
  davantage. Un plafond muet se lit comme un ciel pauvre, donc comme un bug.
- La mention rejoint les lectures existantes du panneau Filé (`src/ui/panneau-file-lectures.ts`) ;
  son texte vit au registre comme `MENTION_VIGNETTAGE_INCRUSTATION` l'a fait avant elle.

### Critères d'acceptation à écrire

- [ ] Le budget de T-0114 est tenu **au pire cas** (180°, 480 min, 50 mm f/1,4) au banc, filé actif
- [ ] Le coût mesuré ne varie pas d'un facteur d'ordre de grandeur entre 60° et 180° à durée égale
      — c'est le test que le plafond est bien un budget d'étoiles et non un plafond de magnitude
- [ ] La valeur de N est **choisie par la mesure** : `pnpm bench:file --planetarium` rejoué pour
      plusieurs candidats, tableau (N, ms par cas, verdict) écrit dans le ticket, et la valeur
      retenue justifiée par ce tableau
- [ ] L'aperçu de champ (`apercu === 'CHAMP'`) est **inchangé** — `pnpm bench:file --empreinte`,
      condensés identiques
- [ ] Aucun plafond, seuil ni facteur écrit hors de `src/registry/`
- [ ] La mention « aperçu plafonné » est présente tant que le filé est actif, absente sinon (test)
- [ ] `pnpm typecheck && pnpm test` verts, sortie réelle rapportée

## Retombée sur l'epic T-0114

`ovrsee/tickets/T-0114-...md:107-109`, « Ordre recommandé », dit encore :

> T-0118 **seulement si** le budget ne tient pas. T-0118 peut mourir sans être fait

Deux fois faux depuis la mesure : le corps de l'epic (`:73-74`) écrit déjà « T-0118 est donc
requis, et non plus conditionnel ». Ce paragraphe est réécrit — l'ordre reste
T-0115 → T-0116 → T-0117 → T-0118, la condition tombe, et la mention du plafond permanent
remplace « plafond silencieux » (`:77-78`), qui visait la version pendant-le-geste.

Rien d'autre n'est touché dans T-0114 : les tableaux de mesure restent tels quels.

T-0117 (`:53-54`) renvoie à T-0118 pour le cas dégradé — la phrase reste vraie, on n'y touche pas.

## Vérification

- `git status` ne montre que `ovrsee/tickets/` : un fichier renommé, un modifié.
- `ls ovrsee/tickets/T-0118*` — un seul fichier, ancien nom disparu.
- Frontmatter relu : `colonne: "pret"`, `priorite: "haute"`, `epic: "T-0114"`, `maj: "2026-08-23"`.
- Relecture croisée : plus aucune occurrence de « pendant le geste » ni « conditionnel » à propos
  de T-0118 dans `ovrsee/tickets/` ni dans le plan
  `ovrsee/plans/2026-08-23-file-plein-ciel-en-temps-reel-creation-des-tickets.md:143-153`
  (ce dernier est l'archive d'une décision passée : **on n'y touche pas**, il dit ce qui était vrai
  ce jour-là).
- Rien à compiler ni à tester : aucun code touché.
