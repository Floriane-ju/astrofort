/**
 * §3.2 — Curseur temporel et plafond de vitesse.
 *
 * Le plafond de défilement est dérivé de la LISIBILITÉ, pas de la puissance machine. Un
 * réglage de vitesse fixe produit une animation fluide en vue large et illisible en vue
 * serrée : c'est l'erreur classique des planétariums grand public. Ici, le curseur de
 * vitesse est couplé au zoom.
 *
 * Le chiffre qui condamne le temps réel : à 32 px/°, ×1 donne 0,13 px/s. L'animation ne
 * montre rien. L'application le dit et propose un facteur utile plutôt que d'animer dans
 * le vide.
 */

import { K } from '../registry/constants.ts'
import { trace, type Traced } from './traced.ts'

export type ModeTemps = 'MAINTENANT' | 'FIGE' | 'DEFILEMENT' | 'PAS_ASTRONOMIQUES'

/**
 * Les pas sont calés sur des périodes réelles, pas sur des durées rondes : « +1 heure »
 * n'enseigne rien, un jour sidéral enseigne que les étoiles reviennent et pas les planètes.
 */
export type PasAstronomique =
  | 'JOUR_SIDERAL'
  | 'JOUR_SOLAIRE'
  | 'MOIS_SYNODIQUE'
  | 'ANNEE_TROPIQUE'

export interface DescriptionPas {
  readonly libelle: string
  readonly dureeS: number
  readonly enseigne: string
}

export function pasAstronomique(pas: PasAstronomique): DescriptionPas {
  const S_PAR_JOUR = K('JOUR_SOLAIRE_S')
  switch (pas) {
    case 'JOUR_SIDERAL':
      return {
        libelle: 'Jour sidéral',
        dureeS: K('JOUR_SIDERAL_S'),
        enseigne:
          'Le ciel étoilé revient à l’identique ; les planètes et la Lune, elles, ont bougé.',
      }
    case 'JOUR_SOLAIRE':
      return {
        libelle: 'Jour solaire',
        dureeS: S_PAR_JOUR,
        enseigne: 'Le Soleil revient à la même place ; les étoiles ont pris quatre minutes d’avance.',
      }
    case 'MOIS_SYNODIQUE':
      return {
        libelle: 'Mois synodique',
        dureeS: K('MOIS_SYNODIQUE_J') * S_PAR_JOUR,
        enseigne: 'La Lune retrouve la même phase.',
      }
    case 'ANNEE_TROPIQUE':
      return {
        libelle: 'Année tropique',
        dureeS: K('ANNEE_TROPIQUE_J') * S_PAR_JOUR,
        enseigne: 'La même saison revient, donc le même ciel à la même heure.',
      }
  }
}

export const PAS_ASTRONOMIQUES: readonly PasAstronomique[] = Object.freeze([
  'JOUR_SIDERAL',
  'JOUR_SOLAIRE',
  'MOIS_SYNODIQUE',
  'ANNEE_TROPIQUE',
])

export type EtatLisibilite = 'IMPERCEPTIBLE' | 'LISIBLE' | 'RAPIDE' | 'REPLIEMENT'

export function pxParDegre(largeurPx: number, fovDeg: number): number {
  return largeurPx / fovDeg
}

/** v_ecran = 15,041 × facteur × px_par_degre / 3600. */
export function vitesseEcran(facteurVitesse: number, pxParDeg: number): Traced<number> {
  const S_PAR_H = 3600
  return trace({
    value: (K('ROTATION_CIEL_DEG_H') * facteurVitesse * pxParDeg) / S_PAR_H,
    formula: 'VITESSE_ECRAN',
    inputs: { facteur: facteurVitesse, px_par_degre: pxParDeg },
    constants: ['ROTATION_CIEL_DEG_H'],
  })
}

/** facteur_max = 600 × 3600 / (15,041 × px_par_degre) — recalculé à chaque zoom. */
export function facteurMax(pxParDeg: number): Traced<number> {
  const S_PAR_H = 3600
  return trace({
    value: (K('V_ECRAN_REPLIEMENT_PX_S') * S_PAR_H) / (K('ROTATION_CIEL_DEG_H') * pxParDeg),
    formula: 'FACTEUR_VITESSE_MAX',
    inputs: { px_par_degre: pxParDeg },
    constants: ['V_ECRAN_REPLIEMENT_PX_S', 'ROTATION_CIEL_DEG_H'],
    note: 'Le plafond dépend du zoom : un champ plus serré abaisse le facteur admissible.',
  })
}

export function etatLisibilite(vEcranPxS: number): EtatLisibilite {
  const v = Math.abs(vEcranPxS)
  if (v < K('V_ECRAN_MIN_PERCEPTIBLE_PX_S')) return 'IMPERCEPTIBLE'
  if (v <= K('V_ECRAN_LISIBLE_MAX_PX_S')) return 'LISIBLE'
  if (v <= K('V_ECRAN_REPLIEMENT_PX_S')) return 'RAPIDE'
  return 'REPLIEMENT'
}

export interface ReglageVitesse {
  /** Facteur retenu, borné par `facteurMax`. */
  readonly facteur: number
  readonly facteurMax: Traced<number>
  readonly vEcran: Traced<number>
  readonly etat: EtatLisibilite
  readonly pxParDegre: number
  /** Vrai quand le facteur demandé a été ramené sous le plafond. */
  readonly ajuste: boolean
  /** Facteur proposé quand le facteur demandé ne montre rien. */
  readonly facteurPropose?: number
  readonly message?: string
}

/** ×60 : une minute par seconde, premier facteur qui rend le mouvement lisible (§3.2). */
const FACTEUR_UNE_MINUTE_PAR_SECONDE = 60

/**
 * Applique le plafond de lisibilité au facteur demandé. L'ajustement est SIGNALÉ : l'app
 * ne laisse jamais l'image se replier en silence, et elle ne corrige jamais sans le dire.
 */
export function reglageVitesse(
  facteurDemande: number,
  largeurPx: number,
  fovDeg: number,
): ReglageVitesse {
  const pxDeg = pxParDegre(largeurPx, fovDeg)
  const plafond = facteurMax(pxDeg)
  const borne = Math.min(Math.abs(facteurDemande), plafond.value)
  const facteur = Math.sign(facteurDemande) * borne
  const ajuste = Math.abs(facteurDemande) > plafond.value
  const vEcran = vitesseEcran(facteur, pxDeg)
  const etat = etatLisibilite(vEcran.value)

  const base = {
    facteur,
    facteurMax: plafond,
    vEcran,
    etat,
    pxParDegre: pxDeg,
    ajuste,
  }

  if (ajuste) {
    return {
      ...base,
      message:
        `Facteur ramené de ×${Math.abs(facteurDemande).toFixed(0)} à ` +
        `×${borne.toFixed(0)} : à ${fovDeg.toFixed(1)}° de champ sur ${largeurPx} px, ` +
        `soit ${pxDeg.toFixed(0)} px/°, au-delà le ciel défile à plus de ` +
        `${K('V_ECRAN_REPLIEMENT_PX_S')} px/s et devient illisible. Le plafond suit le zoom.`,
    }
  }

  if (etat === 'IMPERCEPTIBLE' && facteur !== 0) {
    return {
      ...base,
      facteurPropose: Math.min(FACTEUR_UNE_MINUTE_PAR_SECONDE, plafond.value),
      message:
        `À ×${Math.abs(facteur).toFixed(0)}, le ciel défile à ${vEcran.value.toFixed(2)} px/s : ` +
        'le mouvement est imperceptible et l’animation ne montre rien. ' +
        `×${Math.min(FACTEUR_UNE_MINUTE_PAR_SECONDE, plafond.value).toFixed(0)}, soit une ` +
        'minute par seconde, rend le mouvement lisible.',
    }
  }

  if (etat === 'RAPIDE') {
    return {
      ...base,
      message:
        `${vEcran.value.toFixed(0)} px/s : encore suivable, mais au-delà de la plage ` +
        `confortable de ${K('V_ECRAN_LISIBLE_MAX_PX_S')} px/s.`,
    }
  }

  return base
}
