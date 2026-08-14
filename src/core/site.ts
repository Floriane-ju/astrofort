/**
 * §4.1 — Conséquences site-dépendantes, calculées à la validation du site.
 *
 * L'application annonce à la validation quelle part du ciel austral est hors de portée
 * depuis ce site. Information structurante que rien d'autre ne donne.
 */

import { K } from '../registry/constants.ts'
import type { Traced } from './traced.ts'
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
