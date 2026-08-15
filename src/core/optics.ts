/**
 * §5.1 — Profil optique et capteur.
 *
 * Deux pièges du PRD sont câblés ici plutôt que rappelés en commentaire ailleurs :
 *
 *   1. le champ est l'arctangente PARTOUT, sans condition de bascule — l'approximation
 *      linéaire 57,3 × d / f donne 205,7° à 10 mm sur plein format, valeur impossible ;
 *   2. le recadrage APS-C change les dimensions du capteur, jamais le pitch : ni
 *      l'échantillonnage, ni la NPF, ni la pose max n'en dépendent. Le recadrage ne
 *      grossit rien, et l'application le dit (voir `capteurEffectif`, base matériel).
 */

import { K } from '../registry/constants.ts'
import { valide } from '../registry/domains.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const DEG_PAR_RADIAN = 180 / Math.PI
const UM_PAR_MM = 1000

/** §5.1 — quatre régimes, pour un seeing courant de 2 à 3" (C-04). */
export type DiagnosticEchantillonnage =
  | 'SUR_ECHANTILLONNE'
  | 'NOMINAL'
  | 'SOUS_ECHANTILLONNE_MODERE'
  | 'GRAND_CHAMP_ASSUME'

export interface EntreeOptique {
  readonly focaleMm: number
  readonly ouvertureN: number
  /** Dimensions effectives, recadrage déjà appliqué (voir `capteurEffectif`). */
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly pitchUm: number
}

export interface ProfilOptique {
  readonly fovLDeg: Traced<number>
  readonly fovHDeg: Traced<number>
  readonly dMm: Traced<number>
  readonly echApx: Traced<number>
  readonly dawesAs: Traced<number>
  readonly diagEch: DiagnosticEchantillonnage
  readonly messageDiag: string
  /**
   * Vrai seulement si l'échantillonnage mérite un signalement. Le sous-échantillonnage est
   * le régime NORMAL du grand champ : à 8,80 "/px l'application n'affiche aucune alerte.
   */
  readonly alerte: boolean
}

/** Champ angulaire d'une dimension de capteur. Arctangente, sans exception (§5.1). */
export function fovDeg(dimensionMm: number, focaleMm: number): Traced<number> {
  return trace({
    value: 2 * Math.atan(dimensionMm / (2 * focaleMm)) * DEG_PAR_RADIAN,
    formula: 'FOV',
    inputs: { dimension_capteur_mm: dimensionMm, focale_mm: focaleMm },
  })
}

/**
 * Focale équivalente 24 × 36 — §9.1. Elle ne sert QU'au repère de la règle des 500, qui
 * n'est pas un moteur : aucun verdict de cadrage ni de pose n'en dépend, et le champ reste
 * calculé sur les dimensions réelles du capteur.
 */
export function focaleEquivalente24x36(
  focaleMm: number,
  capteurLMm: number,
  capteurHMm: number,
): Traced<number> {
  const diagonaleReference = Math.hypot(K('FORMAT_REFERENCE_L_MM'), K('FORMAT_REFERENCE_H_MM'))
  const diagonale = Math.hypot(valide('capteur_mm', capteurLMm), valide('capteur_mm', capteurHMm))
  return trace({
    value: (valide('focale_mm', focaleMm) * diagonaleReference) / diagonale,
    formula: 'FOCALE_EQUIVALENTE',
    inputs: { focale_mm: focaleMm, capteur_L_mm: capteurLMm, capteur_H_mm: capteurHMm },
    constants: ['FORMAT_REFERENCE_L_MM', 'FORMAT_REFERENCE_H_MM'],
  })
}

interface Diagnostic {
  readonly diagEch: DiagnosticEchantillonnage
  readonly messageDiag: string
  readonly alerte: boolean
}

function diagnostique(echApx: number): Diagnostic {
  if (echApx < K('ECHANTILLONNAGE_NOMINAL_MIN')) {
    return {
      diagEch: 'SUR_ECHANTILLONNE',
      messageDiag:
        'Sur-échantillonné : à cette finesse, chaque pixel collecte du bruit plutôt que du ' +
        'signal. Une focale plus courte, ou un capteur au pitch plus large, ramènerait dans ' +
        'le régime nominal.',
      alerte: true,
    }
  }
  if (echApx <= K('ECHANTILLONNAGE_NOMINAL_MAX')) {
    return {
      diagEch: 'NOMINAL',
      messageDiag: 'Échantillonnage nominal pour la longue pose, au seeing courant.',
      alerte: false,
    }
  }
  if (echApx <= K('ECHANTILLONNAGE_SOUS_MODERE_MAX')) {
    return {
      diagEch: 'SOUS_ECHANTILLONNE_MODERE',
      messageDiag: 'Sous-échantillonnage modéré : acceptable, et courant en grand champ.',
      alerte: false,
    }
  }
  return {
    diagEch: 'GRAND_CHAMP_ASSUME',
    messageDiag:
      'Grand champ assumé : la résolution est limitée par le pixel, pas par l’optique. ' +
      'Ce n’est pas un défaut à corriger, c’est le régime normal du grand champ.',
    alerte: false,
  }
}

/**
 * Grandeurs dérivées du train optique. Lève `SaisieRefuseeError` en nommant le champ fautif
 * plutôt que de produire une valeur infinie ou NaN (§5.1).
 */
export function profilOptique(entree: EntreeOptique): ProfilOptique {
  const focaleMm = valide('focale_mm', entree.focaleMm)
  const ouvertureN = valide('ouverture_N', entree.ouvertureN)
  const capteurLMm = valide('capteur_mm', entree.capteurLMm)
  const capteurHMm = valide('capteur_mm', entree.capteurHMm)
  const pitchUm = valide('pitch_um', entree.pitchUm)

  const echApx = (K('RADIAN_EN_ARCSEC') * pitchUm) / (focaleMm * UM_PAR_MM)
  const dMm = focaleMm / ouvertureN

  return {
    fovLDeg: fovDeg(capteurLMm, focaleMm),
    fovHDeg: fovDeg(capteurHMm, focaleMm),
    dMm: trace({
      value: dMm,
      formula: 'DIAMETRE_PUPILLE',
      inputs: { focale_mm: focaleMm, ouverture_N: ouvertureN },
    }),
    echApx: trace({
      value: echApx,
      formula: 'ECHANTILLONNAGE',
      inputs: { pitch_um: pitchUm, focale_mm: focaleMm },
      constants: ['RADIAN_EN_ARCSEC'],
      note:
        'L’échantillonnage ne dépend que du pitch et de la focale : un recadrage de capteur ' +
        'ne le change pas.',
    }),
    dawesAs: trace({
      value: K('DAWES_NUMERATEUR') / dMm,
      formula: 'DAWES',
      inputs: { d_mm: dMm },
      constants: ['DAWES_NUMERATEUR'],
    }),
    ...diagnostique(echApx),
  }
}
