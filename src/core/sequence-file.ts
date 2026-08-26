/**
 * §9.4 — Logistique de séquence de filé.
 *
 * Traduit une durée souhaitée en paramètres d'intervallomètre et en contraintes matérielles
 * VÉRIFIABLES AVANT DE SORTIR. Deux règles y sont dures :
 *
 *   1. L'intervalle inter-pose dépasse C-09 → l'application refuse et chiffre le trou produit
 *      dans chaque trace. C'est un défaut irréparable en post-traitement.
 *   2. La réduction de bruit sur longue exposition du boîtier occupe un temps égal à la pose
 *      après chaque image : l'intervalle effectif devient supérieur à la pose, et la séquence
 *      est ruinée. Sa désactivation est une consigne bloquante, pas un conseil.
 *
 * Aucune autonomie de batterie n'est modélisée (T-0150) : seule la durée de prise de vue est
 * connue, et elle sert de rappel, pas de prédiction.
 */

import { K } from '../registry/constants.ts'
import { longueurArcDeg } from './file-etoiles.ts'
import { rappelBatterie } from './rappel-batterie.ts'
import { trace, type Traced } from './traced.ts'

const S_PAR_MIN = 60
const S_PAR_H = 3600

export interface EntreeSequenceFile {
  readonly dureeTotaleMin: number
  readonly tPoseS: number
  readonly intervalleS: number
  readonly tailleRawMo: number
  /** Espace disponible sur la carte. Absent : aucune interruption n'est annoncée. */
  readonly espaceLibreGo?: number | null
  /** Déclinaison de la zone visée : elle fixe l'arc obtenu et la longueur d'un trou. */
  readonly decDeg: number
  /** Réduction de bruit longue exposition déclarée active sur le boîtier. */
  readonly reductionBruitActive?: boolean
}

export interface InterruptionStockage {
  readonly nPosesTenues: number
  readonly dureeTenueMin: number
  readonly arcObtenuDeg: Traced<number>
  readonly message: string
}

export interface SequenceFile {
  readonly nPoses: Traced<number>
  readonly volumeGo: Traced<number>
  readonly arcObtenuDeg: Traced<number>
  /** Renseigné quand l'intervalle dépasse C-09 : la séquence est refusée, le trou chiffré. */
  readonly intervalleRefuse: string | null
  readonly consignesBloquantes: readonly string[]
  readonly interruptionStockage: InterruptionStockage | null
  readonly messages: readonly string[]
}

/** Longueur du trou laissé dans chaque trace par un intervalle inter-pose, en degrés. */
export function trouTraceDeg(intervalleS: number, decDeg: number): Traced<number> {
  // Un trou est un arc : celui que l'étoile décrit pendant que l'obturateur est fermé.
  return trace({
    value: longueurArcDeg(intervalleS / S_PAR_MIN, decDeg).value,
    formula: 'TROU_TRACE',
    inputs: { intervalle_s: intervalleS, dec_deg: decDeg },
    constants: ['ROTATION_CIEL_DEG_H'],
  })
}

export function sequenceFile(entree: EntreeSequenceFile): SequenceFile {
  const dureeTotaleS = entree.dureeTotaleMin * S_PAR_MIN
  const cadenceS = entree.tPoseS + entree.intervalleS
  const nPosesValeur = Math.floor(dureeTotaleS / cadenceS)
  const volume = (nPosesValeur * entree.tailleRawMo) / K('MO_PAR_GO')

  const nPoses = trace({
    value: nPosesValeur,
    formula: 'NOMBRE_POSES_FILE',
    inputs: {
      duree_totale_s: dureeTotaleS,
      t_pose_s: entree.tPoseS,
      intervalle_s: entree.intervalleS,
    },
  })

  const volumeGo = trace({
    value: volume,
    formula: 'VOLUME_STOCKAGE',
    inputs: { n_poses: nPosesValeur, taille_raw_mo: entree.tailleRawMo },
    constants: ['MO_PAR_GO'],
  })

  const arcObtenuDeg = longueurArcDeg(entree.dureeTotaleMin, entree.decDeg)

  const intervalleMax = K('INTERVALLE_INTER_POSE_FILE_MAX_S')
  const trou = trouTraceDeg(entree.intervalleS, entree.decDeg)
  const intervalleRefuse =
    entree.intervalleS > intervalleMax
      ? `Intervalle de ${entree.intervalleS} s refusé : au-delà de ${intervalleMax} s, chaque ` +
        `trace porte un trou de ${trou.value.toFixed(3)}° — ` +
        `${(trou.value * S_PAR_H).toFixed(0)}" — à chaque pose, et ce défaut est irréparable ` +
        'en post-traitement.'
      : null

  const consignesBloquantes: string[] = [
    'Désactiver la réduction de bruit sur longue exposition du boîtier avant de partir : ' +
      'activée, elle occupe un temps égal à la pose après chaque image, l’intervalle effectif ' +
      'dépasse la pose et les traces sortent pointillées.',
  ]
  if (entree.reductionBruitActive === true) {
    consignesBloquantes.push(
      `Réduction de bruit déclarée active : l’intervalle effectif serait d’au moins ` +
        `${entree.tPoseS} s au lieu de ${entree.intervalleS} s, soit un trou de ` +
        `${trouTraceDeg(entree.tPoseS, entree.decDeg).value.toFixed(2)}° dans chaque trace. ` +
        'La séquence est à refaire entièrement si elle part comme ça.',
    )
  }

  let interruptionStockage: InterruptionStockage | null = null
  const espaceLibre = entree.espaceLibreGo ?? null
  if (espaceLibre !== null) {
    const nTenues = Math.floor((espaceLibre * K('MO_PAR_GO')) / entree.tailleRawMo)
    if (nTenues < nPosesValeur) {
      const dureeTenueMin = (nTenues * cadenceS) / S_PAR_MIN
      const arc = longueurArcDeg(dureeTenueMin, entree.decDeg)
      interruptionStockage = {
        nPosesTenues: nTenues,
        dureeTenueMin,
        arcObtenuDeg: arc,
        message:
          `La carte n’accepte que ${nTenues} images : la séquence s’interrompra après ` +
          `${dureeTenueMin.toFixed(0)} min, pour un arc réellement obtenu de ` +
          `${arc.value.toFixed(2)}° au lieu de ${arcObtenuDeg.value.toFixed(2)}°.`,
      }
    }
  }

  const messages: string[] = []
  if (entree.tPoseS < K('T_POSE_FILE_MIN_S') || entree.tPoseS > K('T_POSE_FILE_MAX_S')) {
    messages.push(
      `Pose de ${entree.tPoseS} s hors de la plage recommandée en filé ` +
        `(${K('T_POSE_FILE_MIN_S')} à ${K('T_POSE_FILE_MAX_S')} s) : plus court multiplie les ` +
        'fichiers sans rien gagner, plus long ramène le bruit thermique et le risque de ciel ' +
        'cramé de la pose unique.',
    )
  }
  messages.push(
    `${nPosesValeur} poses de ${entree.tPoseS} s empilées en mode éclaircir, ` +
      `${volume.toFixed(1)} Go de fichiers, arc obtenu ${arcObtenuDeg.value.toFixed(2)}° à ` +
      `δ = ${entree.decDeg.toFixed(0)}°.`,
  )
  const rappel = rappelBatterie(entree.dureeTotaleMin)
  if (rappel !== null) messages.push(rappel)

  return {
    nPoses,
    volumeGo,
    arcObtenuDeg,
    intervalleRefuse,
    consignesBloquantes,
    interruptionStockage,
    messages,
  }
}
