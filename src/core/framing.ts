/**
 * §6.1 — verdict de domaine, et §6.2 — verdict de cadrage par cible.
 *
 * Deux règles de produit portées ici plutôt que rappelées ailleurs :
 *
 *   1. une cible écartée l'est toujours AVEC SA CAUSE et avec la focale qui la rendrait
 *      cadrable — un refus muet n'apprend rien ;
 *   2. aucune compensation par recadrage logiciel n'est jamais proposée. Recadrer ne crée
 *      pas de pixels : un objet de 44 px de diamètre reste un objet de 44 px.
 */

import { K } from '../registry/constants.ts'
import {
  CIBLES_EXEMPLES,
  RAPPORT_AXES_ORIENTATION,
  TABLE_CADRAGE,
  TABLE_DOMAINES,
  type Domaine,
  type VerdictCadrage,
} from '../registry/verdicts.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const DEG_PAR_RADIAN = 180 / Math.PI
const ARCMIN_PAR_DEG = 60
const ARCSEC_PAR_ARCMIN = 60
const POURCENT = 100

export type { Domaine, VerdictCadrage }

/**
 * Jamais proposé, et énoncé une seule fois : c'est la phrase qui remplace le réflexe
 * « je recadrerai au traitement ».
 */
export const REFUS_RECADRAGE_LOGICIEL =
  'Recadrer au traitement n’ajoute aucun pixel : l’objet garde le diamètre en pixels ' +
  'calculé ici. Seule une focale plus longue le change.'

// ---------------------------------------------------------------------------
// §6.1 — verdict de domaine
// ---------------------------------------------------------------------------

export interface VerdictDomaine {
  readonly tailleMinDeg: Traced<number>
  readonly tailleMaxDeg: Traced<number>
  readonly domaine: Domaine
  readonly phrase: string
  /** 5 à 8 cibles réelles du catalogue tombant dans la fenêtre de cadrage. */
  readonly cibles: readonly ObjetCielProfond[]
  /** Renseigné quand le catalogue ne contient aucune cible à cette échelle. */
  readonly causeAbsence?: string
}

/** Grand axe d'un objet, en degrés. `null` quand le catalogue ne donne pas la dimension. */
export function tailleDeg(objet: ObjetCielProfond): number | null {
  return objet.majAxArcmin === null ? null : objet.majAxArcmin / ARCMIN_PAR_DEG
}

/**
 * Cibles du catalogue dont la taille tombe dans la fenêtre de cadrage, les plus brillantes
 * d'abord. Un objet sans magnitude passe après ceux qui en ont : il n'est pas écarté, il
 * n'est simplement pas mis en avant.
 */
export function ciblesDansFenetre(
  catalogue: readonly ObjetCielProfond[],
  tailleMinDeg: number,
  tailleMaxDeg: number,
  limite: number = CIBLES_EXEMPLES.max,
): readonly ObjetCielProfond[] {
  const dans = catalogue.filter((o) => {
    const taille = tailleDeg(o)
    return taille !== null && taille >= tailleMinDeg && taille <= tailleMaxDeg
  })
  return dans
    .slice()
    .sort((a, b) => (a.vMag ?? Number.POSITIVE_INFINITY) - (b.vMag ?? Number.POSITIVE_INFINITY))
    .slice(0, limite)
}

/**
 * Ce que ce setup peut réellement cadrer, annoncé à la validation du profil matériel —
 * avant que l'utilisateur ne cherche par lui-même et ne se heurte au matériel.
 */
export function verdictDomaine(
  fovHDeg: number,
  catalogue: readonly ObjetCielProfond[] = [],
): VerdictDomaine {
  const min = fovHDeg * K('REMPLISSAGE_CADRE_MIN')
  const max = fovHDeg * K('REMPLISSAGE_CADRE_MAX')
  const ligne = TABLE_DOMAINES.find((l) => min < l.borneHauteDeg) ?? TABLE_DOMAINES[0]!
  const cibles = ciblesDansFenetre(catalogue, min, max)
  const inputs = { fov_h_deg: fovHDeg }
  const constants = ['REMPLISSAGE_CADRE_MIN', 'REMPLISSAGE_CADRE_MAX'] as const

  return {
    tailleMinDeg: trace({ value: min, formula: 'FENETRE_CADRAGE', inputs, constants }),
    tailleMaxDeg: trace({ value: max, formula: 'FENETRE_CADRAGE', inputs, constants }),
    domaine: ligne.domaine,
    phrase: ligne.phrase,
    cibles,
    ...(cibles.length === 0
      ? {
          causeAbsence:
            `Aucune cible cataloguée entre ${min.toFixed(2)}° et ${max.toFixed(2)}° : à cette ` +
            'échelle, le catalogue embarqué est vide. Aucune liste par défaut hors fenêtre ' +
            'n’est proposée en remplacement.',
        }
      : {}),
  }
}

/**
 * Focale qui cadrerait proprement une cible donnée. La valeur vise le milieu de la fenêtre
 * C-05 ; la plage couvre la fenêtre entière, du tiers à la moitié du champ.
 */
export function focaleIdeale(tailleObjetDeg: number, capteurHMm: number): Traced<number> {
  const focalePour = (remplissage: number): number => {
    const fovDeg = tailleObjetDeg / remplissage
    return capteurHMm / (2 * Math.tan(fovDeg / (2 * DEG_PAR_RADIAN)))
  }
  return trace({
    value: focalePour(K('REMPLISSAGE_CADRE_CIBLE')),
    formula: 'FOCALE_IDEALE',
    inputs: { taille_objet_deg: tailleObjetDeg, capteur_h_mm: capteurHMm },
    constants: ['REMPLISSAGE_CADRE_CIBLE', 'REMPLISSAGE_CADRE_MIN', 'REMPLISSAGE_CADRE_MAX'],
    range: [focalePour(K('REMPLISSAGE_CADRE_MIN')), focalePour(K('REMPLISSAGE_CADRE_MAX'))],
    note: REFUS_RECADRAGE_LOGICIEL,
  })
}

// ---------------------------------------------------------------------------
// §6.2 — verdict de cadrage par cible
// ---------------------------------------------------------------------------

export interface EntreeCadrage {
  readonly fovHDeg: number
  readonly echApx: number
  readonly capteurHMm: number
  readonly tailleMajArcmin: number
  readonly tailleMinArcmin?: number | null
  /** Angle de position du grand axe. Souvent absent du catalogue. */
  readonly posAngDeg?: number | null
}

export interface FicheCadrage {
  readonly remplissage: Traced<number>
  readonly verdict: VerdictCadrage
  /** Faux dès que le verdict « faisable » doit être refusé, cause à l'appui. */
  readonly faisable: boolean
  readonly message: string
  readonly diamPx: Traced<number>
  /** Renseigné en mosaïque : le nombre de tuiles est aussi le facteur sur le temps total. */
  readonly nTuiles?: Traced<number>
  /** `null` quand le catalogue ne donne pas l'angle de position. */
  readonly angleBoitierDeg: number | null
  readonly noteOrientation: string
  /** Cause du refus, quand il y en a un : elle nomme toujours ce qui bloque. */
  readonly cause?: string
  /** Focale qui rendrait la cible cadrable, quand elle ne l'est pas. */
  readonly focaleIdealeMm?: Traced<number>
}

function orientation(
  tailleMajArcmin: number,
  tailleMinArcmin: number | null | undefined,
  posAngDeg: number | null | undefined,
): { readonly angleBoitierDeg: number | null; readonly noteOrientation: string } {
  const rapport =
    tailleMinArcmin === null || tailleMinArcmin === undefined || tailleMinArcmin === 0
      ? 1
      : tailleMajArcmin / tailleMinArcmin

  if (rapport <= RAPPORT_AXES_ORIENTATION) {
    return {
      angleBoitierDeg: null,
      noteOrientation:
        'Cible assez ronde pour que l’orientation du boîtier ne change rien : garder le ' +
        'cadrage par défaut.',
    }
  }
  if (posAngDeg === null || posAngDeg === undefined) {
    return {
      angleBoitierDeg: null,
      noteOrientation:
        'La cible est allongée, mais le catalogue ne donne pas son angle de position : ' +
        'orientation par défaut du boîtier. Aucun angle n’est affiché faute de donnée.',
    }
  }
  return {
    angleBoitierDeg: posAngDeg,
    noteOrientation:
      `Cible allongée (rapport ${rapport.toFixed(1)}) : orienter le boîtier à ` +
      `${posAngDeg.toFixed(0)}° pour aligner le grand axe sur la grande dimension du capteur.`,
  }
}

/**
 * Taux de remplissage, orientation, mosaïque et « trop petit » pour une cible donnée.
 *
 * Le diamètre en pixels tranche indépendamment du remplissage : une cible peut occuper une
 * fraction acceptable du champ et rester un amas de pixels sans détail exploitable.
 */
export function ficheCadrage(entree: EntreeCadrage): FicheCadrage {
  const { fovHDeg, echApx, capteurHMm, tailleMajArcmin } = entree
  const tailleObjetDeg = tailleMajArcmin / ARCMIN_PAR_DEG
  const remplissage = tailleObjetDeg / fovHDeg
  const ligne = TABLE_CADRAGE.find((l) => remplissage >= l.remplissageMin) ?? TABLE_CADRAGE[TABLE_CADRAGE.length - 1]!
  const diamPx = (tailleMajArcmin * ARCSEC_PAR_ARCMIN) / echApx
  const tropPetitEnPixels = diamPx < K('DIAMETRE_PIXELS_MIN')
  const faisable = ligne.faisable && !tropPetitEnPixels

  const causes: string[] = []
  if (!ligne.faisable) {
    causes.push(
      `${ligne.message} La cible n’occupe que ${(remplissage * POURCENT).toFixed(2)} % du champ.`,
    )
  }
  if (tropPetitEnPixels) {
    causes.push(
      `Elle ne fait que ${diamPx.toFixed(0)} px de diamètre, sous les ` +
        `${K('DIAMETRE_PIXELS_MIN')} px en deçà desquels aucun détail n’est exploitable.`,
    )
  }
  if (causes.length > 0) causes.push(REFUS_RECADRAGE_LOGICIEL)

  const nTuilesValeur =
    remplissage > 1
      ? Math.ceil(remplissage * (1 + K('RECOUVREMENT_MOSAIQUE'))) ** 2
      : null

  return {
    remplissage: trace({
      value: remplissage,
      formula: 'REMPLISSAGE',
      inputs: { taille_objet_deg: tailleObjetDeg, fov_h_deg: fovHDeg },
    }),
    verdict: ligne.verdict,
    faisable,
    message: ligne.message,
    diamPx: trace({
      value: diamPx,
      formula: 'DIAMETRE_PIXELS',
      inputs: { taille_objet_arcsec: tailleMajArcmin * ARCSEC_PAR_ARCMIN, ech_apx: echApx },
      constants: ['DIAMETRE_PIXELS_MIN'],
    }),
    ...(nTuilesValeur === null
      ? {}
      : {
          nTuiles: trace({
            value: nTuilesValeur,
            formula: 'NOMBRE_TUILES',
            inputs: { taille_objet_deg: tailleObjetDeg, fov_h_deg: fovHDeg },
            constants: ['RECOUVREMENT_MOSAIQUE'],
            note:
              `Le nombre de tuiles multiplie d’autant le temps total de session : ` +
              `${nTuilesValeur} fois la durée d’une cible unique.`,
          }),
        }),
    ...orientation(tailleMajArcmin, entree.tailleMinArcmin, entree.posAngDeg),
    ...(faisable ? {} : { cause: causes.join(' ') }),
    ...(faisable ? {} : { focaleIdealeMm: focaleIdeale(tailleObjetDeg, capteurHMm) }),
  }
}
