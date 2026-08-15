/**
 * §7.4 — Plan de calibration et dithering.
 *
 * C'est l'étape systématiquement oubliée, et celle qui ruine le plus de sessions. L'ordre
 * affiché n'est pas alphabétique : FLATS > DARKS > OFFSETS. À f/2,8 sur plein format, le
 * vignettage atteint un à deux diaphragmes dans les coins — sans flats, l'image garde un
 * halo central et des angles sombres que rien ne rattrape ensuite.
 *
 * Rien ici n'est une calibration du matériel au sens de §2.3 : ce sont des poses de
 * calibration prises sur le terrain, pas un réglage du point zéro système.
 */

import { K } from '../registry/constants.ts'
import { valide } from '../registry/domains.ts'
import { DITHERING_PX, PRESCRIPTIONS_CALIBRATION } from '../registry/verdicts.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const S_PAR_MIN = 60

export interface BibliothequeDarks {
  readonly iso: number
  readonly tPoseS: number
  readonly tempC: number
}

export interface EntreeCalibration {
  readonly tPoseS: number
  readonly iso: number
  readonly nPoses: number
  readonly tempCapteurC?: number | null
  /** Bibliothèque existante à valider ou à invalider. */
  readonly biblioDarks?: BibliothequeDarks | null
  readonly autoguidage?: boolean
  /** Vrai quand la focale ou l'orientation a changé depuis les flats de la cible précédente. */
  readonly changementFocaleOuOrientation?: boolean
}

export interface LotCalibration {
  readonly type: 'FLATS' | 'DARKS' | 'OFFSETS'
  readonly nombre: number
  readonly plage: readonly [number, number]
  readonly consigne: string
}

export interface PlanCalibration {
  /** Dans l'ordre d'importance affiché : flats d'abord. */
  readonly lots: readonly LotCalibration[]
  readonly surcoutTempsMin: Traced<number>
  readonly dithering: string
  /** `null` quand aucune bibliothèque n'est fournie : rien à valider. */
  readonly biblioDarksValide: boolean | null
  readonly causeInvalidation?: string
  readonly avertissements: readonly string[]
}

function nombrePrescrit(type: LotCalibration['type']): LotCalibration {
  const p = PRESCRIPTIONS_CALIBRATION.find((x) => x.type === type)!
  return { type, nombre: p.defaut, plage: [p.min, p.max], consigne: p.consigne }
}

/**
 * Valide une bibliothèque de darks existante. L'écart de température toléré est C-10 :
 * au-delà, le courant d'obscurité n'a plus la même statistique et la soustraction dégrade
 * l'image au lieu de la nettoyer.
 */
export function valideBibliothequeDarks(
  biblio: BibliothequeDarks,
  session: { readonly iso: number; readonly tPoseS: number; readonly tempC: number | null },
): { readonly valide: boolean; readonly cause?: string } {
  if (biblio.iso !== session.iso) {
    return {
      valide: false,
      cause: `Bibliothèque prise à ISO ${biblio.iso}, session à ISO ${session.iso} : les darks ne sont pas transposables.`,
    }
  }
  if (Math.abs(biblio.tPoseS - session.tPoseS) > 0) {
    return {
      valide: false,
      cause: `Bibliothèque prise à ${biblio.tPoseS} s, session à ${session.tPoseS} s : un dark ne vaut que pour la durée exacte de la pose.`,
    }
  }
  if (session.tempC === null) {
    return {
      valide: false,
      cause:
        'Température de capteur inconnue pour cette session : la bibliothèque ne peut pas être ' +
        'validée, de nouveaux darks sont prescrits par précaution.',
    }
  }
  const ecart = Math.abs(biblio.tempC - session.tempC)
  if (ecart > K('ECART_TEMPERATURE_DARKS_C')) {
    return {
      valide: false,
      cause:
        `Écart de température de ${ecart.toFixed(0)} °C entre la bibliothèque (${biblio.tempC} °C) ` +
        `et la session (${session.tempC} °C), au-delà des ${K('ECART_TEMPERATURE_DARKS_C')} °C ` +
        'tolérés : la bibliothèque est invalidée, de nouveaux darks sont prescrits.',
    }
  }
  return { valide: true }
}

export function planCalibration(entree: EntreeCalibration): PlanCalibration {
  const tempC =
    entree.tempCapteurC === null || entree.tempCapteurC === undefined
      ? null
      : valide('temp_capteur_c', entree.tempCapteurC)

  const lots = [nombrePrescrit('FLATS'), nombrePrescrit('DARKS'), nombrePrescrit('OFFSETS')]
  const darks = lots.find((l) => l.type === 'DARKS')!

  const validation =
    entree.biblioDarks === null || entree.biblioDarks === undefined
      ? null
      : valideBibliothequeDarks(entree.biblioDarks, {
          iso: entree.iso,
          tPoseS: entree.tPoseS,
          tempC,
        })

  const avertissements = [
    'Ne pas toucher à la bague de mise au point avant les flats : ils ne corrigent le ' +
      'vignettage que pour la mise au point et l’orientation exactes de la session.',
  ]
  if (entree.changementFocaleOuOrientation === true) {
    avertissements.push(
      'Changement de focale ou d’orientation : les flats de la cible précédente ne sont plus ' +
        'valides, il en faut de nouveaux pour cette cible.',
    )
  }
  if (tempC === null) {
    avertissements.push(
      'Température de capteur non renseignée : elle décide de la validité d’une bibliothèque ' +
        'de darks d’une session à l’autre.',
    )
  }

  return {
    lots,
    surcoutTempsMin: trace({
      value: (darks.nombre * entree.tPoseS) / S_PAR_MIN,
      formula: 'TEMPS_DARKS',
      inputs: { n_darks: darks.nombre, t_pose_s: entree.tPoseS },
      note:
        'À ajouter au budget de session, hors mise en place. Les darks se prennent en fin de ' +
        'session, capteur encore froid.',
    }),
    dithering:
      entree.autoguidage === true
        ? `Dithering de ${DITHERING_PX.min} à ${DITHERING_PX.max} px entre poses, piloté par ` +
          'l’autoguidage. Il supprime le bruit à motif fixe et les colonnes chaudes que les ' +
          'darks laissent passer.'
        : `Sans autoguidage : dithering à chaque pose, de ${DITHERING_PX.min} à ` +
          `${DITHERING_PX.max} px, en exploitant la dérive naturelle. Il supprime le bruit à ` +
          'motif fixe et les colonnes chaudes — ce que les darks, eux, ne suppriment pas.',
    biblioDarksValide: validation === null ? null : validation.valide,
    ...(validation?.cause === undefined ? {} : { causeInvalidation: validation.cause }),
    avertissements,
  }
}
