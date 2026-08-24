/**
 * §2.3 — Base matériel : point zéro système et grandeurs capteur.
 *
 * `ZP_sys` est la brillance de ciel produisant 1 e⁻/s/px pour un pixel de 1 µm à f/1. Il se
 * déduit hors application du point zéro photométrique de la bande passante, de l'efficacité
 * quantique du capteur, de la transmission optique et du gain en e⁻/ADU — courbes QE
 * constructeur et mesures de gain de Photons to Photos.
 *
 * Il n'existe AUCUNE fonction de calibration, et aucun écran n'invite à en effectuer une :
 * l'optimum de pose est plat, une erreur d'un facteur 2 coûte 2 à 5 points de SNR, que la
 * plage utile affichée absorbe.
 * Cette plage se calcule dans `exposure.ts` (`PLAGE_UTILE_POSE`) et s'affiche sur la fiche
 * cible ; la perte de SNR, elle, ne s'affiche nulle part — sa formule reste au formulaire de
 * l'Annexe B sous `PERTE_SNR` (T-0063).
 *
 * Le Lot 0 pose le schéma et la valeur de repli. Le remplissage de la base relève du Lot 1.
 */

import { K, ref, type ConstantRef } from '../registry/constants.ts'
import { valide, type DomaineId } from '../registry/domains.ts'

/**
 * Les champs optionnels sont ceux que le PRD marque `[À VÉRIFIER]` en Annexe A. Ils restent
 * absents plutôt que remplis d'une valeur plausible : un moteur qui en a besoin doit
 * traiter l'absence, pas consommer une invention.
 */
export interface Boitier {
  readonly id: string
  readonly libelle: string
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly pitchUm: number
  /** Dimensions du recadrage APS-C. Le pitch, lui, ne change pas (§5.1). */
  readonly recadrageApsc: ModeRecadrage
  /** Bruit de lecture, par ISO. Clé = ISO. */
  readonly readNoiseE: Readonly<Record<number, number>>
  /** Absent → aucun palier ne justifie l'ISO retenu : c'est la saisie qui le fixe (§7.2). */
  readonly seuilDoubleGainIso?: number
  readonly fullWellE?: number
  /** Absent → point zéro générique C-14, affiché [ESTIMÉ] (§2.3). */
  readonly zpSys?: number
  readonly tailleRawMo: number
  readonly autonomieCipa?: number
  readonly source: string
}

/** Dimensions du recadrage APS-C. Le pitch, lui, ne change pas (§5.1). */
export interface ModeRecadrage {
  readonly capteurLMm: number
  readonly capteurHMm: number
}

export type CapteurMode = 'FULL_FRAME' | 'APSC_CROP'

export interface CapteurEffectif {
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly pitchUm: number
  /** Renseigné au basculement en APS-C : le message anti-confusion de §5.1. */
  readonly noteRecadrage?: string
}

/**
 * Dimensions à donner au moteur optique pour un mode de recadrage donné.
 *
 * LE RECADRAGE NE GROSSIT RIEN : il change `capteur_L_mm` et `capteur_H_mm`, donc le champ,
 * et rien d'autre. Le pitch est inchangé, donc l'échantillonnage, la NPF et la pose max le
 * sont aussi. Un débutant croit très souvent gagner de la portée en passant en APS-C.
 */
export function capteurEffectif(boitier: Boitier, mode: CapteurMode): CapteurEffectif {
  if (mode === 'FULL_FRAME') {
    return {
      capteurLMm: boitier.capteurLMm,
      capteurHMm: boitier.capteurHMm,
      pitchUm: boitier.pitchUm,
    }
  }
  return {
    capteurLMm: boitier.recadrageApsc.capteurLMm,
    capteurHMm: boitier.recadrageApsc.capteurHMm,
    pitchUm: boitier.pitchUm,
    noteRecadrage:
      'Recadrage, pas grossissement — même détail, moins de champ. L’échantillonnage, la ' +
      'pose maximale et le pouvoir séparateur restent identiques : le capteur jette des ' +
      'pixels sur les bords, il n’en ajoute aucun au centre.',
  }
}

/** §7.1 — `zp_source`, à afficher partout où une pose l'est. */
export type ZpSource = 'BASE_MATERIEL' | 'GENERIQUE'

export interface PointZeroSysteme {
  readonly valeur: number
  readonly source: ZpSource
  readonly estime: boolean
  readonly constante: ConstantRef | null
  readonly note?: string
}

/**
 * Point zéro système d'un boîtier. Boîtier absent de la base → générique C-14, affiché
 * [ESTIMÉ], la plage utile de pose absorbant l'incertitude.
 */
export function pointZeroSysteme(boitier: Boitier | null): PointZeroSysteme {
  if (boitier?.zpSys !== undefined) {
    return { valeur: boitier.zpSys, source: 'BASE_MATERIEL', estime: false, constante: null }
  }
  return {
    valeur: K('ZP_SYS_GENERIQUE'),
    source: 'GENERIQUE',
    estime: true,
    constante: ref('ZP_SYS_GENERIQUE'),
    note:
      'Boîtier absent de la base matériel : point zéro générique appliqué. La plage utile ' +
      'de pose absorbe l’incertitude — une pose de 10, 15 ou 20 s est indifférente quand ' +
      'l’optimum est 13 s.',
  }
}

export interface IsoRetenu {
  readonly iso: number
  /** `null` quand la base ne donne pas la courbe : le moteur applique alors son repli. */
  readonly readNoiseE: number | null
  /** ISO que le seuil de double gain justifie, quand ce seuil est connu. */
  readonly isoRecommandeParSeuil: number | null
  /** Vrai quand l'ISO affiché n'est pas celui que le double gain recommande. */
  readonly choisiParUtilisateur: boolean
  readonly message: string
}

/**
 * §7.2 — choix de l'ISO par le double gain de conversion.
 *
 * Les capteurs à bascule d'amplification voient leur bruit de lecture chuter brutalement
 * au-delà d'un seuil d'ISO. Or t_opt ∝ RN² : diviser le bruit de lecture par deux divise la
 * pose optimale par quatre. Au-delà du seuil, le bruit ne baisse plus mais la capacité de
 * saturation chute proportionnellement — les étoiles brillantes crament pour rien.
 *
 * L'ISO reste modifiable : le seuil justifie une recommandation, il n'impose pas un réglage.
 * Un ISO hors de la courbe du boîtier ne fait pas inventer un bruit de lecture — il rend
 * `readNoiseE` nul, et le moteur de pose applique son repli en l'affichant [ESTIMÉ] (§5.1).
 */
export function isoRecommande(boitier: Boitier | null, isoChoisi: number | null = null): IsoRetenu {
  if (boitier === null) {
    return {
      iso: isoChoisi ?? 0,
      readNoiseE: null,
      isoRecommandeParSeuil: null,
      choisiParUtilisateur: isoChoisi !== null,
      message:
        'Aucun boîtier de la base : le bruit de lecture de repli sera appliqué et affiché ' +
        '[ESTIMÉ], et aucun ISO n’est recommandé.',
    }
  }
  const isos = Object.keys(boitier.readNoiseE)
    .map(Number)
    .sort((a, b) => a - b)
  const seuil = boitier.seuilDoubleGainIso
  const recommande =
    seuil === undefined
      ? (isos[isos.length - 1] ?? null)
      : (isos.find((iso) => iso >= seuil) ?? isos[isos.length - 1] ?? seuil)
  const retenu = isoChoisi ?? recommande ?? 0
  const readNoiseE = boitier.readNoiseE[retenu] ?? null
  return {
    iso: retenu,
    readNoiseE,
    isoRecommandeParSeuil: seuil === undefined ? null : recommande,
    choisiParUtilisateur: isoChoisi !== null && isoChoisi !== recommande,
    message: messageIso(retenu, seuil, recommande, readNoiseE),
  }
}

function messageIso(
  retenu: number,
  seuil: number | undefined,
  recommande: number | null,
  readNoiseE: number | null,
): string {
  const justification =
    seuil === undefined
      ? `ISO ${retenu} : le seuil de double gain de ce boîtier n’est pas renseigné, aucun ` +
        'palier ne justifie donc un autre réglage.'
      : retenu === recommande
        ? `ISO ${retenu} : c’est le premier palier au-dessus du seuil de double gain de ce ` +
          `boîtier (${seuil}). Monter plus haut ne réduit plus le bruit de lecture et ` +
          'sacrifie la dynamique.'
        : `ISO ${retenu}, choisi à la main : le seuil de double gain de ce boîtier ` +
          `(${seuil}) recommande ISO ${String(recommande)}. En dessous, le bruit de lecture ` +
          'impose des poses plus longues ; au-dessus, la dynamique est sacrifiée sans gain.'
  return readNoiseE === null
    ? `${justification} Le bruit de lecture n’est pas connu à cet ISO : le repli du registre ` +
      'sera appliqué et affiché [ESTIMÉ].'
    : justification
}

/**
 * Boîtier de référence de l'Annexe A : plein format 35,9 × 23,9 mm, 7008 × 4672 px.
 * Bruit de lecture, capacité de saturation, point zéro système et autonomie CIPA sont
 * marqués `[À VÉRIFIER]` par le PRD — seule la valeur de travail sourcée est portée ici.
 */
export const BOITIER_REFERENCE: Boitier = Object.freeze({
  id: 'reference-plein-format-33mp',
  libelle: 'Plein format 33 Mpx (référence Annexe A)',
  capteurLMm: 35.9,
  capteurHMm: 23.9,
  // 35,9 mm / 7008 px = 5,12 µm.
  pitchUm: 5.12,
  recadrageApsc: Object.freeze({ capteurLMm: 23.5, capteurHMm: 15.6 }),
  // Valeur de travail de l'Annexe A, au-delà du seuil de double gain.
  readNoiseE: Object.freeze({ 640: 1.5 }),
  seuilDoubleGainIso: 640,
  tailleRawMo: 33,
  source: 'PRD Annexe A — valeurs de travail ; courbes complètes [À VÉRIFIER] Photons to Photos',
})

/**
 * Un seul boîtier sourcé pour l'instant. Tout autre matériel passe par le mode `custom` de
 * §5.1 : dimensions, pitch et ouverture saisis à la main, point zéro générique [ESTIMÉ].
 */
export const BASE_BOITIERS: readonly Boitier[] = Object.freeze([BOITIER_REFERENCE])

/** §5.1 — l'entrée `custom` du sélecteur : tout matériel absent de la base. */
export const ID_BOITIER_CUSTOM = 'custom'

/**
 * §5.1 — le boîtier saisi à la main, tel que l'utilisateur le tape : des chaînes, dont les
 * vides sont significatifs. Un champ laissé vide n'est pas zéro, c'est une valeur inconnue.
 */
export interface SaisieBoitier {
  readonly boitierId: string
  readonly capteurLMm: string
  readonly capteurHMm: string
  readonly pitchUm: string
  readonly readNoiseE: string
  readonly seuilDoubleGainIso: string
  readonly fullWellE: string
  readonly zpSys: string
  readonly tailleRawMo: string
  readonly autonomieCipa: string
}

export interface BoitierResolu {
  readonly boitier: Boitier
  /**
   * Grandeurs qu'aucune saisie ne renseigne et qu'une valeur générique du registre remplace.
   * Elles s'affichent, et les sorties qui en dépendent portent [ESTIMÉ] (§2.3, §7.1).
   */
  readonly estimations: readonly string[]
}

/** Vide = inconnu ; renseigné = validé par le domaine du registre, refus nommant le champ. */
function champ(texte: string, domaine: DomaineId): number | null {
  if (texte.trim() === '') return null
  return valide(domaine, Number(texte))
}

/** Une grandeur sans laquelle rien ne se calcule : le refus nomme le champ (§5.1). */
function champRequis(texte: string, domaine: DomaineId): number {
  return texte.trim() === '' ? valide(domaine, Number.NaN) : valide(domaine, Number(texte))
}

/**
 * §5.1 — le boîtier retenu : celui de la base, ou celui que la saisie décrit.
 *
 * Les dimensions et le pitch sont exigés : sans eux, ni champ ni échantillonnage n'existent,
 * et une valeur inventée produirait un cadrage faux sans le dire. Les grandeurs du mode
 * avancé, elles, tolèrent l'absence — le registre fournit son repli, l'application l'affiche,
 * et la sortie porte [ESTIMÉ] plutôt que de passer pour une mesure.
 */
export function resoutBoitier(saisie: SaisieBoitier): BoitierResolu {
  const deLaBase = BASE_BOITIERS.find((b) => b.id === saisie.boitierId)
  if (deLaBase !== undefined) return { boitier: deLaBase, estimations: [] }

  const capteurLMm = champRequis(saisie.capteurLMm, 'capteur_mm')
  const capteurHMm = champRequis(saisie.capteurHMm, 'capteur_mm')
  const pitchUm = champRequis(saisie.pitchUm, 'pitch_um')
  const readNoiseE = champ(saisie.readNoiseE, 'read_noise_e')
  const seuilDoubleGainIso = champ(saisie.seuilDoubleGainIso, 'seuil_double_gain_iso')
  const fullWellE = champ(saisie.fullWellE, 'full_well_e')
  const zpSys = champ(saisie.zpSys, 'zp_sys')
  const tailleRawMo = champ(saisie.tailleRawMo, 'taille_raw_mo')
  const autonomieCipa = champ(saisie.autonomieCipa, 'autonomie_cipa')

  const estimations: string[] = []
  if (readNoiseE === null) {
    estimations.push(
      `bruit de lecture : ${K('READ_NOISE_DEFAUT_E')} e⁻ du registre appliqués et affichés ` +
        '[ESTIMÉ] — la pose optimale varie comme son carré.',
    )
  } else if (seuilDoubleGainIso === null) {
    estimations.push(
      `bruit de lecture : ${readNoiseE} e⁻ saisis, mais sans seuil de double gain aucun ISO ` +
        'ne leur est rattaché — le repli du registre s’applique et s’affiche [ESTIMÉ].',
    )
  }
  if (zpSys === null) {
    estimations.push(
      `point zéro système : générique ${K('ZP_SYS_GENERIQUE')} mag, zp_source GENERIQUE ` +
        '[ESTIMÉ] — la plage utile de pose absorbe l’incertitude.',
    )
  }
  if (tailleRawMo === null) {
    estimations.push(
      `taille de fichier RAW : ${K('TAILLE_RAW_MO_GENERIQUE')} Mo génériques [ESTIMÉ] — le ` +
        'budget de stockage est un ordre de grandeur, pas une mesure.',
    )
  }
  if (fullWellE === null) {
    estimations.push(
      'capacité de saturation : inconnue — aucune sortie n’en dépend aujourd’hui, la ' +
        'saturation des étoiles brillantes n’est donc pas chiffrée.',
    )
  }
  if (autonomieCipa === null) {
    estimations.push('autonomie CIPA : inconnue — le budget batterie n’est pas chiffré.')
  }

  return {
    boitier: Object.freeze({
      id: ID_BOITIER_CUSTOM,
      libelle: `Boîtier saisi — ${capteurLMm} × ${capteurHMm} mm, pitch ${pitchUm} µm`,
      capteurLMm,
      capteurHMm,
      pitchUm,
      // Le recadrage reste un mode du boîtier : il change les dimensions, jamais le pitch.
      recadrageApsc: Object.freeze(recadrageApsc(capteurLMm, capteurHMm)),
      readNoiseE: Object.freeze(
        readNoiseE === null || seuilDoubleGainIso === null ? {} : { [seuilDoubleGainIso]: readNoiseE },
      ),
      ...(seuilDoubleGainIso === null ? {} : { seuilDoubleGainIso }),
      ...(fullWellE === null ? {} : { fullWellE }),
      ...(zpSys === null ? {} : { zpSys }),
      tailleRawMo: tailleRawMo ?? K('TAILLE_RAW_MO_GENERIQUE'),
      ...(autonomieCipa === null ? {} : { autonomieCipa }),
      source: 'saisie utilisateur — mode custom',
    }),
    estimations,
  }
}

/**
 * §5.1 — le recadrage d'un boîtier saisi : le capteur APS-C de référence, jamais plus grand
 * que le capteur déclaré. Le pitch, lui, ne change pas — c'est tout l'objet du mode.
 */
function recadrageApsc(capteurLMm: number, capteurHMm: number): ModeRecadrage {
  return {
    capteurLMm: Math.min(capteurLMm, BOITIER_REFERENCE.recadrageApsc.capteurLMm),
    capteurHMm: Math.min(capteurHMm, BOITIER_REFERENCE.recadrageApsc.capteurHMm),
  }
}

/** §7.1 — `zp_source` doit être affiché partout où une pose l'est. */
export function libelleZpSource(zeroSysteme: PointZeroSysteme): string {
  return (
    `point zéro système ${zeroSysteme.valeur} mag · zp_source ${zeroSysteme.source}` +
    (zeroSysteme.estime ? ' [ESTIMÉ]' : '')
  )
}
