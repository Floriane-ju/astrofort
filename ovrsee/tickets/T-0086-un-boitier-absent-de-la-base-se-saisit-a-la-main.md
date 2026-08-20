---
{
  "id": "T-0086",
  "titre": "Un boîtier absent de la base se saisit à la main",
  "colonne": "pret",
  "priorite": "haute",
  "epic": "T-0083",
  "tags": [
    "prd",
    "materiel",
    "contrat-entree"
  ],
  "cree": "2026-08-19",
  "maj": "2026-08-19",
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

- [ ] Un sélecteur de boîtier, alimenté par la base, avec une entrée `custom`.
- [ ] En `custom`, les grandeurs capteur se saisissent, bornées par le registre, un refus
      nommant le champ fautif.
- [ ] Un champ non renseigné applique la valeur générique du registre, l'affiche, et marque
      la sortie `[ESTIMÉ]` — jamais un résultat annoncé comme mesuré (§2.3, §7.1).
- [ ] `zp_source` est affiché partout où une pose est affichée.
- [ ] Le recadrage APS-C reste un mode du boîtier : il change les dimensions du capteur,
      jamais le pitch (§5.1).
- [ ] L'ISO retenu est visible et modifiable, avec la mention du seuil de double gain qui le
      justifie (§7.2).
- [ ] Le boîtier saisi part dans l'export de §12.3.
- [ ] Un test couvre le cas limite de §5.1 : boîtier custom sans bruit de lecture → RN de
      repli appliqué, affiché, sortie `[ESTIMÉ]`.
