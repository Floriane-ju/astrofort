/**
 * §8.1 — Fenêtre nocturne, et §4.1 — décalage du midi solaire vrai.
 *
 * Le milieu de nuit ne tombe pas à minuit légal : l'application centre ses créneaux sur le
 * milieu de nuit vrai, jamais sur l'heure ronde. À haute latitude, la nuit astronomique
 * peut être nulle une partie de l'année — le site n'est pas refusé pour autant, la période
 * concernée est annoncée.
 */

import { Body, SearchAltitude, SearchRiseSet } from 'astronomy-engine'
import { K } from '../registry/constants.ts'
import type { Site } from './ephem.ts'
import { observateur, verifieDomaineDesSeries, versDate } from './ephem.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const MINUTES_PAR_HEURE = 60
const MS_PAR_MINUTE = 60_000
const JOURS_DE_RECHERCHE = 2

/** Sens de recherche d'astronomy-engine : +1 en montée, −1 en descente. */
const DESCENTE = -1
const MONTEE = +1

export type EtatNuit =
  /** Nuit astronomique complète : le Soleil descend sous −18°. */
  | 'NUIT_ASTRONOMIQUE'
  /** Le Soleil ne descend jamais sous −18° : crépuscule permanent. */
  | 'PAS_DE_NUIT_ASTRONOMIQUE'
  /** Le Soleil ne se lève pas : nuit polaire. */
  | 'NUIT_POLAIRE'

export interface FenetreNocturne {
  readonly etat: EtatNuit
  readonly coucherSoleil: Date | null
  readonly leverSoleil: Date | null
  readonly debutNuitAstronomique: Date | null
  readonly finNuitAstronomique: Date | null
  readonly milieuNuitVrai: Date | null
  readonly dureeNuitH: number
  /** Phrase adressée à l'utilisateur quand la nuit est dégradée ou absente. */
  readonly cause?: string
}

/**
 * Décalage du midi solaire vrai par rapport à l'heure légale, en minutes (§4.1).
 * Positif : le midi solaire tombe après le midi légal.
 */
export function offsetMidiSolaireMin(
  longitudeDeg: number,
  offsetFuseauH: number,
): Traced<number> {
  const DEG_PAR_HEURE = 360 / 24
  const valeur =
    (longitudeDeg / DEG_PAR_HEURE) * MINUTES_PAR_HEURE - offsetFuseauH * MINUTES_PAR_HEURE
  return trace({
    value: valeur,
    formula: 'OFFSET_MIDI_SOLAIRE',
    inputs: { longitude_deg: longitudeDeg, offset_fuseau_h: offsetFuseauH },
    note:
      'Le milieu de nuit ne tombe pas à minuit légal : les créneaux se centrent sur le ' +
      'milieu de nuit vrai.',
  })
}

function milieu(debut: Date, fin: Date): Date {
  return new Date((debut.getTime() + fin.getTime()) / 2)
}

function dureeHeures(debut: Date, fin: Date): number {
  return (fin.getTime() - debut.getTime()) / (MS_PAR_MINUTE * MINUTES_PAR_HEURE)
}

/**
 * Fenêtre nocturne à partir d'un instant de départ — typiquement l'après-midi du jour
 * d'observation. Aucun appel réseau (§12.4).
 */
export function fenetreNocturne(site: Site, depart: Date): FenetreNocturne {
  verifieDomaineDesSeries(depart)
  const obs = observateur(site)

  const coucherSoleil = versDate(
    SearchRiseSet(Body.Sun, obs, DESCENTE, depart, JOURS_DE_RECHERCHE),
  )
  const leverSoleil = versDate(
    SearchRiseSet(Body.Sun, obs, MONTEE, coucherSoleil ?? depart, JOURS_DE_RECHERCHE),
  )

  if (coucherSoleil === null || leverSoleil === null) {
    const soleilCirculaire = site.latitudeDeg >= 0 ? 'soleil de minuit' : 'nuit polaire'
    return {
      etat: 'NUIT_POLAIRE',
      coucherSoleil,
      leverSoleil,
      debutNuitAstronomique: null,
      finNuitAstronomique: null,
      milieuNuitVrai: null,
      dureeNuitH: 0,
      cause:
        `À la latitude ${site.latitudeDeg}°, le Soleil ne franchit pas l'horizon à cette ` +
        `date (${soleilCirculaire}). Aucune fenêtre nocturne n'est produite.`,
    }
  }

  const debut = versDate(
    SearchAltitude(
      Body.Sun,
      obs,
      DESCENTE,
      coucherSoleil,
      JOURS_DE_RECHERCHE,
      K('HAUTEUR_CREPUSCULE_ASTRONOMIQUE_DEG'),
    ),
  )
  const fin =
    debut === null
      ? null
      : versDate(
          SearchAltitude(
            Body.Sun,
            obs,
            MONTEE,
            debut,
            JOURS_DE_RECHERCHE,
            K('HAUTEUR_CREPUSCULE_ASTRONOMIQUE_DEG'),
          ),
        )

  if (debut === null || fin === null) {
    return {
      etat: 'PAS_DE_NUIT_ASTRONOMIQUE',
      coucherSoleil,
      leverSoleil,
      debutNuitAstronomique: null,
      finNuitAstronomique: null,
      milieuNuitVrai: milieu(coucherSoleil, leverSoleil),
      dureeNuitH: 0,
      cause:
        `À la latitude ${site.latitudeDeg}°, le Soleil ne descend pas sous ` +
        `${K('HAUTEUR_CREPUSCULE_ASTRONOMIQUE_DEG')}° à cette date : la nuit astronomique est ` +
        'nulle. Le crépuscule nautique reste exploitable pour les cibles les plus brillantes.',
    }
  }

  return {
    etat: 'NUIT_ASTRONOMIQUE',
    coucherSoleil,
    leverSoleil,
    debutNuitAstronomique: debut,
    finNuitAstronomique: fin,
    milieuNuitVrai: milieu(debut, fin),
    dureeNuitH: dureeHeures(debut, fin),
  }
}
