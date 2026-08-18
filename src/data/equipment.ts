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
  readonly seuilDoubleGainIso: number
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

export interface PointZeroSysteme {
  readonly valeur: number
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
    return { valeur: boitier.zpSys, estime: false, constante: null }
  }
  return {
    valeur: K('ZP_SYS_GENERIQUE'),
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
  readonly message: string
}

/**
 * §7.2 — choix de l'ISO par le double gain de conversion.
 *
 * Les capteurs à bascule d'amplification voient leur bruit de lecture chuter brutalement
 * au-delà d'un seuil d'ISO. Or t_opt ∝ RN² : diviser le bruit de lecture par deux divise la
 * pose optimale par quatre. Au-delà du seuil, le bruit ne baisse plus mais la capacité de
 * saturation chute proportionnellement — les étoiles brillantes crament pour rien.
 */
export function isoRecommande(boitier: Boitier | null): IsoRetenu {
  if (boitier === null) {
    return {
      iso: 0,
      readNoiseE: null,
      message:
        'Aucun boîtier de la base : le bruit de lecture de repli sera appliqué et affiché ' +
        '[ESTIMÉ], et aucun ISO n’est recommandé.',
    }
  }
  const isos = Object.keys(boitier.readNoiseE)
    .map(Number)
    .sort((a, b) => a - b)
  const seuil = boitier.seuilDoubleGainIso
  const retenu = isos.find((iso) => iso >= seuil) ?? isos[isos.length - 1] ?? seuil
  return {
    iso: retenu,
    readNoiseE: boitier.readNoiseE[retenu] ?? null,
    message:
      `ISO ${retenu} : c’est le premier palier au-dessus du seuil de double gain de ce ` +
      `boîtier (${seuil}). Monter plus haut ne réduit plus le bruit de lecture et sacrifie ` +
      'la dynamique.',
  }
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
