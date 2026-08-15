/**
 * §4.1 — Conséquences site-dépendantes, calculées à la validation du site.
 *
 * L'application annonce à la validation quelle part du ciel austral est hors de portée
 * depuis ce site. Information structurante que rien d'autre ne donne.
 */

import { K } from '../registry/constants.ts'
import { DOMAINES, SaisieRefuseeError, valide } from '../registry/domains.ts'
import type { Flag, Traced } from './traced.ts'
import { trace } from './traced.ts'

const ANGLE_DROIT_DEG = 90

export interface SeuilsSite {
  /** Déclinaison au-delà de laquelle une cible est circumpolaire. */
  readonly decCircumpolaire: Traced<number>
  /** Déclinaison en dessous de laquelle une cible n'atteint jamais le seuil d'imagerie. */
  readonly decMinImagerie: Traced<number>
  /** Déclinaison en dessous de laquelle une cible n'atteint jamais le seuil visuel. */
  readonly decMinVisuel: Traced<number>
}

export function seuilsDeclinaison(latitudeDeg: number): SeuilsSite {
  return {
    decCircumpolaire: trace({
      value: ANGLE_DROIT_DEG - Math.abs(latitudeDeg),
      formula: 'DECLINAISON_CIRCUMPOLAIRE',
      inputs: { latitude_deg: latitudeDeg },
    }),
    decMinImagerie: trace({
      value: latitudeDeg - (ANGLE_DROIT_DEG - K('SEUIL_HAUTEUR_IMAGERIE_DEG')),
      formula: 'DECLINAISON_MIN_IMAGERIE',
      inputs: { latitude_deg: latitudeDeg },
      constants: ['SEUIL_HAUTEUR_IMAGERIE_DEG'],
    }),
    decMinVisuel: trace({
      value: latitudeDeg - (ANGLE_DROIT_DEG - K('SEUIL_HAUTEUR_VISUEL_DEG')),
      formula: 'DECLINAISON_MIN_VISUEL',
      inputs: { latitude_deg: latitudeDeg },
      constants: ['SEUIL_HAUTEUR_VISUEL_DEG'],
    }),
  }
}

/** Une valeur d'obstruction par degré d'azimut, de 0 à 359 (§4.1). */
export const NB_AZIMUTS = 360

export interface MasqueHorizon {
  /** Altitude d'obstruction en degrés, indexée par l'azimut entier. */
  readonly altitudesDeg: readonly number[]
  /** Vrai quand le masque est le repli plat, faute de donnée de relief. */
  readonly estHypothese: boolean
  readonly flags?: readonly Flag[]
  readonly note?: string
}

/**
 * Repli d'un site sans donnée de relief : horizon plat à 0°, marqué [HYP] (§4.1).
 * L'hypothèse est annoncée — un site au pied des Alpes n'a pas d'horizon plat, et une
 * recommandation calculée sur cette base serait fausse la moitié du temps.
 */
export function masquePlat(): MasqueHorizon {
  return Object.freeze({
    altitudesDeg: Object.freeze(Array.from({ length: NB_AZIMUTS }, () => 0)),
    estHypothese: true,
    flags: Object.freeze(['HYP' as const]),
    note:
      'Aucune donnée de relief pour ce site : un horizon plat à 0° est supposé. À compléter ' +
      'à la main pour tenir compte du relief, des arbres et des bâtiments.',
  })
}

/** Masque construit sur un profil d'altitude réel : ce n'est plus une hypothèse (§4.1). */
export function masqueDepuisRelief(altitudesDeg: readonly number[]): MasqueHorizon {
  if (altitudesDeg.length !== NB_AZIMUTS) {
    throw new SaisieRefuseeError(
      'masque_horizon_deg',
      `Saisie refusée : ${DOMAINES.masque_horizon_deg.champ} demande ${NB_AZIMUTS} valeurs, une par degré ` +
        `d'azimut ; ${altitudesDeg.length} reçues. Les azimuts manquants ne sont pas comblés ` +
        'au hasard.',
    )
  }
  for (const altitude of altitudesDeg) {
    valide('masque_horizon_deg', altitude)
  }
  return Object.freeze({
    altitudesDeg: Object.freeze([...altitudesDeg]),
    estHypothese: false,
  })
}

/** Obstruction à un azimut quelconque : l'azimut se referme sur lui-même. */
export function obstructionDeg(masque: MasqueHorizon, azimutDeg: number): number {
  const index = ((Math.round(azimutDeg) % NB_AZIMUTS) + NB_AZIMUTS) % NB_AZIMUTS
  return masque.altitudesDeg[index] ?? 0
}

/** Hauteur atteinte par une cible à sa culmination, depuis ce site. */
export function altitudeCulmination(latitudeDeg: number, decDeg: number): Traced<number> {
  return trace({
    value: ANGLE_DROIT_DEG - Math.abs(latitudeDeg - decDeg),
    formula: 'ALTITUDE_CULMINATION',
    inputs: { latitude_deg: latitudeDeg, dec_deg: decDeg },
  })
}

/** Masse d'air. La formule cesse d'être valide sous environ 15° de hauteur. */
export function masseAir(hauteurDeg: number): Traced<number | null> {
  if (hauteurDeg <= 0) {
    return trace({
      value: null,
      formula: 'MASSE_AIR',
      inputs: { alt_deg: hauteurDeg },
      flags: ['DONNEE_MANQUANTE'],
      note: 'Cible sous l’horizon : aucune masse d’air n’est définie.',
    })
  }
  const valeur = 1 / Math.sin((hauteurDeg * Math.PI) / 180)
  const sousLeDomaine = hauteurDeg < K('HAUTEUR_MIN_MASSE_AIR_DEG')
  return trace({
    value: valeur,
    formula: 'MASSE_AIR',
    inputs: { alt_deg: hauteurDeg },
    ...(sousLeDomaine
      ? {
          flags: ['HORS_DOMAINE' as const],
          note:
            `Sous ${K('HAUTEUR_MIN_MASSE_AIR_DEG')}° de hauteur, l'approximation 1 / sin(alt) ` +
            'sous-estime la masse d’air réelle.',
        }
      : {}),
  })
}
