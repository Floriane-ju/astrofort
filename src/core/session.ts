/**
 * §8.3 — Plan de session ordonné.
 *
 * La sortie est UNE CHRONOLOGIE, PAS UN PALMARÈS. Un palmarès n'est pas exécutable sur le
 * terrain ; une chronologie l'est. Quatre règles tiennent ce module :
 *
 *   1. PRÉ-FILTRAGE PAR CONTRAINTE DURE, chaque exclusion nommant sa cause. La liste des
 *      écartées n'est jamais mélangée à la chronologie.
 *   2. SCORING EXPLICITE ET EXPOSÉ (C-15) : chaque cible porte la décomposition de son score.
 *   3. ARBITRAGE DES CONFLITS PAR SCORE. Les créneaux se chevauchent : la nuit est une
 *      ressource à allouer, pas une liste à trier. L'allocation se fait donc par score
 *      décroissant — c'est l'arbitrage de §8.3 — et le plan est rendu dans l'ordre du temps.
 *   4. JAMAIS DE TRONCATURE SILENCIEUSE. Un budget dépassé retire une cible entière, et
 *      une intégration qui ne tient pas dans la nuit annonce son nombre de nuits.
 *
 * Ce fichier assemble ; les trois étages qu'il assemble vivent à côté : le vocabulaire dans
 * `session-types.ts`, le scoring dans `session-score.ts`, le tri des candidates dans
 * `session-candidates.ts` et l'allocation de la nuit dans `session-nuit.ts`.
 */

import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Intervalle } from './creneaux.ts'
import { dureeLisible } from './exposure.ts'
import { planCalibration } from './calibration.ts'
import { evalueCandidate, preFiltre } from './session-candidates.ts'
import { alloueCreneau, calculeBudget, retireJusquAuBudget } from './session-nuit.ts'
import {
  AVERTISSEMENT_METEO,
  normalisePoids,
  poidsParDefaut,
  type Candidate,
  type CauseEcart,
  type CibleEcartee,
  type ContexteSession,
  type EtapePlan,
  type PlanSession,
  type PoidsScoring,
} from './session-types.ts'

export {
  AVERTISSEMENT_METEO,
  normalisePoids,
  poidsParDefaut,
  type BudgetNuit,
  type CauseEcart,
  type CibleEcartee,
  type ContexteSession,
  type DetailScore,
  type EtapePlan,
  type PlanSession,
  type PoidsScoring,
} from './session-types.ts'
export {
  scoreCadrage,
  scoreFenetre,
  scoreHauteur,
  scoreLune,
  scoreSignal,
} from './session-score.ts'

const MS_PAR_MINUTE = 60000
const S_PAR_MINUTE = 60

export function planSession(
  contexte: ContexteSession,
  catalogue: readonly ObjetCielProfond[],
): PlanSession {
  // Le plan travaille toujours sur des poids normalisés : ce que la saisie livre est brut.
  const poids = normalisePoids(contexte.poids ?? poidsParDefaut())
  const debut = contexte.nuit.debutReference
  const fin = contexte.nuit.finReference

  if (debut === null || fin === null) {
    return planVide(
      contexte,
      poids,
      [],
      new Map(),
      contexte.nuit.cause ??
        'Aucune fenêtre nocturne exploitable à cette date depuis ce site : aucun plan n’est produit.',
    )
  }

  const sbCielBase = contexte.sbCielNoir - contexte.nuit.penaliteSbMag
  const prefiltre = preFiltre(contexte, catalogue)
  const ecartees: CibleEcartee[] = [...prefiltre.ecartees]
  const comptes = new Map(prefiltre.comptes)
  const retenues = evalueCandidates(contexte, prefiltre.candidates, { debut, fin }, sbCielBase, poids, ecartees, comptes)

  if (retenues.length === 0) {
    return planVide(contexte, poids, ecartees, comptes, null)
  }

  const etapes = alloueLaNuit(contexte, retenues, ecartees)
  const calibration = calibrationDeSession(contexte, etapes)
  const budget = calculeBudget(contexte, etapes, calibration)
  const etapesRetenues = retireJusquAuBudget(etapes, budget, contexte, ecartees, calibration)
  const budgetFinal =
    etapesRetenues.length === etapes.length
      ? budget
      : calculeBudget(contexte, etapesRetenues, calibration)

  return {
    etapes: etapesRetenues,
    ciblesEcartees: ecartees,
    comptesEcartees: Object.fromEntries(comptes),
    budget: budgetFinal,
    poids,
    calibration,
    message:
      `${etapesRetenues.length} cible${etapesRetenues.length > 1 ? 's' : ''} dans la nuit, ` +
      `ordonnée${etapesRetenues.length > 1 ? 's' : ''} par créneau. Budget total ` +
      `${dureeLisible(budgetFinal.totalMin.value * S_PAR_MINUTE)} sur ` +
      `${dureeLisible(budgetFinal.disponibleMin * S_PAR_MINUTE)} disponibles.`,
    ...(noteCouverture(comptes) === undefined
      ? {}
      : { noteCouvertureCatalogue: noteCouverture(comptes)! }),
    avertissementMeteo: AVERTISSEMENT_METEO,
  }
}

/**
 * Les candidates du pré-filtrage passées aux moteurs, triées en retenues et écartées.
 *
 * Le refus de domaine est absorbé par `evalueCandidate` lui-même (§12.5) : chaque appelant
 * de ce moteur en a besoin, pas seulement le plan.
 */
function evalueCandidates(
  contexte: ContexteSession,
  candidates: readonly ObjetCielProfond[],
  fenetre: Intervalle,
  sbCielBase: number,
  poids: PoidsScoring,
  ecartees: CibleEcartee[],
  comptes: Map<CauseEcart, number>,
): readonly Candidate[] {
  const retenues: Candidate[] = []
  for (const objet of candidates) {
    const resultat = evalueCandidate(contexte, objet, fenetre, sbCielBase, poids)
    if ('code' in resultat) {
      ecartees.push(resultat)
      comptes.set(resultat.code, (comptes.get(resultat.code) ?? 0) + 1)
    } else {
      retenues.push(resultat)
    }
  }
  return retenues
}

/**
 * Allocation par score décroissant : c'est l'arbitrage de §8.3 quand deux créneaux se
 * chevauchent. Le plan est ensuite rendu dans l'ordre du temps — une chronologie.
 */
function alloueLaNuit(
  contexte: ContexteSession,
  retenues: readonly Candidate[],
  ecartees: CibleEcartee[],
): readonly EtapePlan[] {
  const parScore = retenues.slice().sort((a, b) => b.score.value - a.score.value)
  const occupes: Intervalle[] = []
  const etapes: EtapePlan[] = []

  for (const candidate of parScore) {
    const tRequisMin = candidate.integration.tRequisS.value / S_PAR_MINUTE
    const alloue = alloueCreneau(candidate.creneau, occupes, tRequisMin)
    if (alloue === null) {
      ecartees.push({
        designation: candidate.objet.designation,
        code: 'CONFLIT_CRENEAU',
        cause:
          'Son créneau est déjà entièrement alloué à une cible de score supérieur. ' +
          'L’arbitrage est exposé plutôt que les deux cibles planifiées en même temps : ' +
          'elle est reportée à une autre nuit.',
      })
      continue
    }
    occupes.push(alloue)
    etapes.push(construitEtape(candidate, alloue, contexte))
  }

  return etapes.sort(
    (a, b) => a.creneauAlloue.debut.getTime() - b.creneauAlloue.debut.getTime(),
  )
}

/**
 * La calibration est prise une fois pour la session : même ISO, même optique, et des darks à
 * la pose de la première cible du plan (§7.4).
 */
function calibrationDeSession(contexte: ContexteSession, etapes: readonly EtapePlan[]) {
  const premiere = etapes[0]
  if (premiere === undefined) return null
  return planCalibration({
    tPoseS: premiere.tPoseS,
    iso: contexte.isoSession,
    nPoses: etapes.reduce((somme, e) => somme + e.nPoses, 0),
    autoguidage: false,
  })
}

function construitEtape(
  candidate: Candidate,
  alloue: Intervalle,
  contexte: ContexteSession,
): EtapePlan {
  const dureeAlloueeMin =
    (alloue.fin.getTime() - alloue.debut.getTime()) / MS_PAR_MINUTE
  const tRequisMin = candidate.integration.tRequisS.value / S_PAR_MINUTE
  const complete = dureeAlloueeMin >= tRequisMin
  const nPoses = complete
    ? candidate.integration.nPoses.value
    : Math.floor((dureeAlloueeMin * S_PAR_MINUTE) / candidate.pose.tAfficheeS)
  const nNuits = complete ? 1 : Math.ceil(tRequisMin / Math.max(1, dureeAlloueeMin))

  return {
    objet: candidate.objet,
    creneauAlloue: alloue,
    dureeAlloueeMin,
    tPoseS: candidate.pose.tAfficheeS,
    nPoses,
    volumeGo: (nPoses * contexte.tailleRawMo) / K('MO_PAR_GO'),
    verdict: candidate.detect.verdict,
    verdictCadrage: candidate.cadrage.verdict,
    score: candidate.score,
    detailScore: candidate.detailScore,
    deltaSbLuneMag: candidate.deltaSbLuneMag,
    sbCielEffectif: candidate.sbCielEffectif,
    integrationComplete: complete,
    nNuits,
    consigne: consigneTerrain(candidate, complete, nNuits, dureeAlloueeMin),
    creneau: candidate.creneau,
    pose: candidate.pose,
    integration: candidate.integration,
    extinction: candidate.extinction,
    cadrage: candidate.cadrage,
    detect: candidate.detect,
  }
}

function consigneTerrain(
  candidate: Candidate,
  complete: boolean,
  nNuits: number,
  dureeAlloueeMin: number,
): string {
  const base =
    `Poser ${candidate.pose.tAfficheeS} s à l’ISO de session, ` +
    `${dureeAlloueeMin.toFixed(0)} min sur cette cible. ${candidate.cadrage.noteOrientation}`
  if (complete) return base
  return (
    `${base} La nuit ne couvre pas l’intégration requise ` +
    `(${dureeLisible(candidate.integration.tRequisS.value)}) : prévoir ${nNuits} nuits plutôt ` +
    'qu’un plan irréalisable. Aucune intégration n’est tronquée en silence.'
  )
}

function planVide(
  contexte: ContexteSession,
  poids: PoidsScoring,
  ecartees: readonly CibleEcartee[],
  comptes: ReadonlyMap<CauseEcart, number>,
  causeFenetre: string | null,
): PlanSession {
  const dominante = contrainteDominante(comptes)
  return {
    etapes: [],
    ciblesEcartees: ecartees,
    comptesEcartees: Object.fromEntries(comptes),
    budget: calculeBudget(contexte, [], null),
    poids,
    calibration: null,
    message:
      causeFenetre ??
      'Aucune cible du catalogue ne franchit le pré-filtrage cette nuit-là. La liste des ' +
        'cibles écartées est donnée à part : le plan n’est pas rempli avec elles.',
    ...(causeFenetre === null && dominante !== undefined
      ? { contrainteDominante: dominante }
      : {}),
    ...(noteCouverture(comptes) === undefined
      ? {}
      : { noteCouvertureCatalogue: noteCouverture(comptes)! }),
    ...(causeFenetre === null
      ? {
          alternative:
            'Le domaine grand champ et le filé d’étoiles (§9) restent ouverts cette nuit : ils ' +
            'ne dépendent ni du cadrage d’une cible ponctuelle ni de sa hauteur de culmination.',
        }
      : {}),
    avertissementMeteo: AVERTISSEMENT_METEO,
  }
}

/**
 * Le catalogue embarqué ne publie une magnitude visuelle que pour une minorité d'objets :
 * les grandes nébuleuses en émission n'en ont souvent pas. Aucune n'est inventée — mais le
 * plan dit combien d'objets sont écartés pour cette raison, faute de quoi l'utilisateur
 * conclut que le ciel est vide alors que c'est la donnée qui manque.
 */
function noteCouverture(comptes: ReadonlyMap<CauseEcart, number>): string | undefined {
  const manquantes = comptes.get('DONNEE_MANQUANTE') ?? 0
  if (manquantes === 0) return undefined
  return (
    `${manquantes} objets du catalogue sont écartés faute de magnitude ou de dimensions ` +
    'publiées — c’est le cas de beaucoup de grandes nébuleuses en émission. Aucune valeur ' +
    'n’est inventée pour les rattraper : une estimation fabriquée serait pire qu’une absence ' +
    'annoncée. Saisir la cible à la main dans la fiche §6 reste possible.'
  )
}

function contrainteDominante(
  comptes: ReadonlyMap<CauseEcart, number>,
): string | undefined {
  if (comptes.size === 0) return undefined
  const [code, nombre] = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]!
  return `Contrainte dominante : ${code} — ${nombre} cible${nombre > 1 ? 's' : ''} écartée${
    nombre > 1 ? 's' : ''
  } pour ce motif.`
}
