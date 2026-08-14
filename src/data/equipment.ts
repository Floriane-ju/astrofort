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
 *
 * Le Lot 0 pose le schéma et la valeur de repli. Le remplissage de la base relève du Lot 1.
 */

import { K, ref, type ConstantRef } from '../registry/constants.ts'

export interface Boitier {
  readonly id: string
  readonly libelle: string
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly pitchUm: number
  /** Bruit de lecture, par ISO. Clé = ISO. */
  readonly readNoiseE: Readonly<Record<number, number>>
  readonly seuilDoubleGainIso: number
  readonly fullWellE: number
  readonly zpSys: number
  readonly tailleRawMo: number
  readonly autonomieCipa: number
  readonly source: string
}

/** Dimensions du recadrage APS-C. Le pitch, lui, ne change pas (§5.1). */
export interface ModeRecadrage {
  readonly capteurLMm: number
  readonly capteurHMm: number
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
  if (boitier !== null) {
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

/**
 * Perte de rapport signal sur bruit pour un facteur de pose C effectif (§2.3).
 * Sert à montrer que l'optimum est plat, donc qu'aucune calibration n'est nécessaire.
 */
export function perteSnr(cEffectif: number): number {
  return 1 - Math.sqrt(cEffectif / (cEffectif + 1))
}

/** Plage utile d'une pose : [t/2 ; t×2], présentée comme équivalente (§2.3). */
export function plageUtilePose(tOptS: number): readonly [number, number] {
  const FACTEUR_PLAGE = 2
  return [tOptS / FACTEUR_PLAGE, tOptS * FACTEUR_PLAGE]
}

/** La base est remplie au Lot 1 ; le repli générique fonctionne dès maintenant. */
export const BASE_BOITIERS: readonly Boitier[] = Object.freeze([])

export function chercheBoitier(id: string): Boitier | null {
  return BASE_BOITIERS.find((b) => b.id === id) ?? null
}
