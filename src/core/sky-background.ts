/**
 * §2.2, §4.1 — établissement du fond de ciel d'un site.
 *
 * Trois sources, par ordre de priorité décroissante :
 *   1. sqm_mesure      saisi par l'utilisateur → prévaut toujours
 *   2. viirs           atlas de pollution lumineuse aux coordonnées → Bortle estimé
 *   3. bortle_declare  saisi à la main, échelle 1 à 9
 */

import {
  SB_PLANCHER_NATUREL,
  interpoleBortle,
  mLimOeilDepuisSb,
} from '../registry/bortle.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

export type SourceSb = 'TABLE_BORTLE' | 'SQM_MESURE' | 'VIIRS'

export interface EntreeFondDeCiel {
  /** Mesure au sky quality meter, mag/arcsec². Prioritaire sur tout le reste. */
  readonly sqmMesure?: number | undefined
  /** Bortle estimé aux coordonnées par l'atlas VIIRS. */
  readonly bortleViirs?: number | undefined
  /** Bortle saisi à la main. */
  readonly bortleDeclare?: number | undefined
  /** L'utilisateur a confirmé un SQM plus sombre que le fond de ciel naturel. */
  readonly sqmConfirme?: boolean | undefined
}

export interface FondDeCiel {
  readonly sbCiel: Traced<number>
  /** `null` quand la mesure sort du domaine de la table : aucune valeur n'est extrapolée. */
  readonly mLimOeil: Traced<number | null>
  readonly sourceSb: SourceSb
  /**
   * Renseigné quand la saisie doit être confirmée avant d'être exploitée — un SQM plus
   * sombre que le fond de ciel naturel le plus sombre connu (§2.2).
   */
  readonly confirmationRequise?: string
}

export class FondDeCielIndeterminableError extends Error {
  constructor() {
    super(
      'Aucune source de fond de ciel : renseigner un SQM mesuré, un Bortle estimé par ' +
        'VIIRS ou un Bortle déclaré (§4.1).',
    )
    this.name = 'FondDeCielIndeterminableError'
  }
}

function depuisBortle(bortle: number, source: SourceSb): FondDeCiel {
  const ligne = interpoleBortle(bortle)
  return {
    sourceSb: source,
    sbCiel: trace({
      value: ligne.sb,
      formula: 'INTERPOLATION_BORTLE',
      inputs: { bortle },
    }),
    mLimOeil: trace({
      value: ligne.mLimOeil,
      formula: 'INTERPOLATION_BORTLE',
      inputs: { bortle },
    }),
  }
}

/**
 * Établit le fond de ciel du site. Lève `BortleHorsTableError` si un Bortle hors [1 ; 9]
 * est fourni : la saisie est refusée plutôt qu'extrapolée.
 */
export function fondDeCiel(entree: EntreeFondDeCiel): FondDeCiel {
  const { sqmMesure, bortleViirs, bortleDeclare, sqmConfirme } = entree

  if (sqmMesure !== undefined) {
    const mLim = mLimOeilDepuisSb(sqmMesure)
    const horsTable = mLim === null
    const result: FondDeCiel = {
      sourceSb: 'SQM_MESURE',
      sbCiel: trace({
        value: sqmMesure,
        formula: 'MESURE_SQM',
        inputs: { sqm_mesure: sqmMesure },
        note: 'Mesure au SQM : elle prévaut sur le Bortle estimé du profil.',
      }),
      mLimOeil: trace({
        value: mLim,
        formula: 'INVERSION_BORTLE',
        inputs: { sb_ciel: sqmMesure },
        ...(horsTable
          ? {
              flags: ['DONNEE_MANQUANTE' as const],
              note:
                'Brillance hors du domaine de la table : la magnitude limite à l’œil nu ' +
                'n’est pas extrapolée.',
            }
          : {}),
      }),
    }
    if (sqmMesure > SB_PLANCHER_NATUREL && sqmConfirme !== true) {
      return {
        ...result,
        confirmationRequise:
          `Un SQM de ${sqmMesure} mag/arcsec² dépasse le fond de ciel naturel le plus ` +
          `sombre connu (${SB_PLANCHER_NATUREL} mag/arcsec², limité par la lueur ` +
          'atmosphérique, la lumière zodiacale et la lumière stellaire intégrée). ' +
          'Confirmer la saisie ou la corriger.',
      }
    }
    return result
  }

  if (bortleViirs !== undefined) return depuisBortle(bortleViirs, 'VIIRS')
  if (bortleDeclare !== undefined) return depuisBortle(bortleDeclare, 'TABLE_BORTLE')

  throw new FondDeCielIndeterminableError()
}
