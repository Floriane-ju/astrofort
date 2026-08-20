---
{
  "id": "T-0086",
  "titre": "Un boîtier absent de la base se saisit à la main",
  "colonne": "fait",
  "priorite": "haute",
  "epic": "T-0083",
  "tags": [
    "prd",
    "materiel",
    "contrat-entree"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-20",
  "plan": null
}
---

## Contexte

§5.1 décrit un `boitier_preset` tiré d'une base matériel, un mode `custom` en repli — « mode
`custom` couvrant tout matériel absent » — et six champs éditables en mode avancé :
`pitch_um`, `read_noise_e`, `seuil_double_gain_iso`, `full_well_e`, `zp_sys`, `taille_raw_mo`,
`autonomie_cipa`. §7.1 exige que `zp_source` soit affiché, et §2.3 qu'un boîtier absent
produise des sorties marquées `[ESTIMÉ]`.

Le code n'a qu'un boîtier : `BASE_BOITIERS = [BOITIER_REFERENCE]`
(`src/data/equipment.ts:177`), et `PanneauMateriel.tsx:72` le dit lui-même — « un seul
boîtier en base, la ligne devient un select le jour où ». Focale et ouverture se saisissent,
le capteur non. Un utilisateur dont le boîtier n'est pas celui de l'Annexe A obtient donc
l'échantillonnage, la NPF, la pose optimale et le budget stockage d'un autre appareil, sans
que rien ne le signale.

Le chemin `[ESTIMÉ]` du PRD est écrit dans les moteurs (`zpEstime`, `RN = 3,0 e⁻`) et
inatteignable : il n'existe aucun boîtier pour le déclencher.

## Critères d'acceptation

- [x] Un sélecteur de boîtier, alimenté par la base, avec une entrée `custom`.
- [x] En `custom`, les grandeurs capteur se saisissent, bornées par le registre, un refus
      nommant le champ fautif.
- [x] Un champ non renseigné applique la valeur générique du registre, l'affiche, et marque
      la sortie `[ESTIMÉ]` — jamais un résultat annoncé comme mesuré (§2.3, §7.1).
- [x] `zp_source` est affiché partout où une pose est affichée.
- [x] Le recadrage APS-C reste un mode du boîtier : il change les dimensions du capteur,
      jamais le pitch (§5.1).
- [x] L'ISO retenu est visible et modifiable, avec la mention du seuil de double gain qui le
      justifie (§7.2).
- [x] Le boîtier saisi part dans l'export de §12.3.
- [x] Un test couvre le cas limite de §5.1 : boîtier custom sans bruit de lecture → RN de
      repli appliqué, affiché, sortie `[ESTIMÉ]`.

## Réalisation

- `src/data/equipment.ts` — `resoutBoitier(saisie)` rend le boîtier de la base choisi, ou
  construit celui que la saisie décrit. Dimensions et pitch sont exigés : sans eux, ni champ
  ni échantillonnage n'existent, et le refus passe par `valide()`, donc nomme déjà le champ.
  Les grandeurs du mode avancé tolèrent l'absence — chacune rend une phrase d'estimation que
  l'interface affiche. `seuilDoubleGainIso` devient optionnel : sans seuil déclaré, aucun
  palier ne justifie un ISO, et le prétendre serait une invention.
- `isoRecommande(boitier, isoChoisi)` — l'ISO reste recommandé par le double gain et devient
  modifiable. Un ISO hors de la courbe du boîtier ne fait inventer aucun bruit de lecture :
  `readNoiseE` est nul, le moteur applique le repli du registre et l'affiche `[ESTIMÉ]`.
- `zp_source` (§7.1) — `PointZeroSysteme` porte désormais `BASE_MATERIEL` / `GENERIQUE`, et
  `libelleZpSource()` l'affiche partout où une pose l'est : panneau matériel, fiche cible
  (§7.1/§7.2), onglet Filé (§9.2) et en-tête du plan imprimable (§11.2).
- `src/registry/` — `TAILLE_RAW_MO_GENERIQUE` (C-37, ordre de grandeur) comble le seul champ
  requis sans repli existant ; domaine `iso_capture` pour borner l'ISO saisi. Les six autres
  replis existaient déjà (`READ_NOISE_DEFAUT_E`, `ZP_SYS_GENERIQUE`, champs optionnels).
- `src/ui/PanneauMateriel.tsx` — sélecteur de boîtier alimenté par `BASE_BOITIERS` plus
  l'entrée `custom`, trois champs géométriques et les six grandeurs avancées, repliées
  derrière un `<details>` pour le débutant comme §5.1 le demande. Les bornes et libellés des
  champs viennent de `DOMAINES` : aucun min/max réécrit.
- `src/ui/app-calcul.ts` — le boîtier n'est plus une constante de module : il est résolu dans
  `evalueMateriel`, donc une saisie fautive sort en cause nommée au lieu de faire tomber
  l'application. Point zéro, ISO et estimations voyagent avec le reste du calcul.
- `src/data/db.ts` + `persistence.ts` — `ProfilMateriel` transporte les grandeurs du boîtier
  saisi et l'ISO retenu, chacune validée à l'import par son domaine du registre. Réserve : la
  banque `profils` n'a aujourd'hui aucun écrivain — comme `sites` et `plans`, elle n'est
  alimentée par aucun écran. Le schéma et l'export sont prêts ; l'enregistrement d'un profil
  reste à ouvrir, et ne relève pas de ce ticket.
- `tests/boitier.test.ts` — dix tests, dont le cas limite de §5.1 : boîtier custom sans bruit
  de lecture → `READ_NOISE_DEFAUT_E` appliqué, `readNoiseEstime`, `flags` `ESTIME`, et la
  phrase d'estimation qui porte la valeur. Plus le refus nommant le champ, le recadrage APS-C
  qui ne touche pas au pitch, et l'ISO changé qui n'invente pas de bruit de lecture.
- `tests/contrat-entree.test.tsx` — deux tests d'écran : l'entrée `custom` du sélecteur, et
  `zp_source` + ISO présents là où la pose est affichée.

`pnpm typecheck` : sans erreur. `pnpm test` : 504 tests, 42 fichiers, tout au vert.
