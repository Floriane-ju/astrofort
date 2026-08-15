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
 */

import { K } from '../registry/constants.ts'
import { SaisieRefuseeError } from '../registry/domains.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { FamilleFiltre } from '../registry/filters.ts'
import {
  REMPLISSAGE_MIN_PLANIFIABLE,
  VERDICTS_PLANIFIABLES,
  type VerdictCadrage,
} from '../registry/verdicts.ts'
import { creneauCible, type CreneauCible, type Intervalle } from './creneaux.ts'
import { detectabilite, type Detectabilite, type VerdictDetectabilite } from './detectability.ts'
import type { Site } from './ephem.ts'
import { ficheCadrage, type FicheCadrage } from './framing.ts'
import {
  dureeLisible,
  fluxCiel,
  fluxObjet,
  planIntegration,
  poseUnitaire,
  type PlanIntegration,
  type PoseUnitaire,
} from './exposure.ts'
import { planCalibration, type PlanCalibration } from './calibration.ts'
import {
  deltaSbLune,
  etatLune,
  positionEquatorialeLune,
  sbCielAvecLune,
  separationDeg,
  type FenetreUtile,
} from './moon.ts'
import type { FenetreNocturne } from './night.ts'
import type { MasqueHorizon } from './site.ts'
import { altitudeCulmination } from './site.ts'
import type { TypeMonture } from './tracking.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const MINUTES_PAR_HEURE = 60
const S_PAR_MINUTE = 60
const MS_PAR_MINUTE = 60000
const ARCMIN_PAR_DEG = 60
const HEURES_PAR_TOUR = 24
const DEG_PAR_HEURE = 360 / HEURES_PAR_TOUR

export type NiveauUtilisateurPlan = 'DEBUTANT' | 'CONFIRME'

export type CauseEcart =
  | 'DONNEE_MANQUANTE'
  | 'CADRAGE'
  | 'HAUTEUR'
  | 'RELIEF'
  | 'FENETRE'
  | 'HORS_PORTEE'
  | 'CONFLIT_CRENEAU'
  | 'BUDGET'

export interface CibleEcartee {
  readonly designation: string
  readonly code: CauseEcart
  readonly cause: string
}

export interface PoidsScoring {
  readonly cadrage: number
  readonly hauteur: number
  readonly signal: number
  readonly fenetre: number
  readonly lune: number
}

/** Poids C-15 par défaut : exposés et réglables, jamais appris (§8.3). */
export function poidsParDefaut(): PoidsScoring {
  return Object.freeze({
    cadrage: K('POIDS_SCORING_CADRAGE'),
    hauteur: K('POIDS_SCORING_HAUTEUR'),
    signal: K('POIDS_SCORING_SNR'),
    fenetre: K('POIDS_SCORING_FENETRE'),
    lune: K('POIDS_SCORING_LUNE'),
  })
}

export interface ContexteSession {
  readonly site: Site
  readonly nuit: FenetreNocturne
  readonly fenetreUtile: FenetreUtile
  readonly masque: MasqueHorizon
  readonly fovHDeg: number
  readonly echApx: number
  readonly dMm: number
  readonly capteurHMm: number
  readonly pitchUm: number
  readonly ouvertureN: number
  readonly zpSys: number
  readonly zpEstime: boolean
  readonly readNoiseE: number | null
  readonly tailleRawMo: number
  readonly isoSession: number
  /** Fond de ciel sans Lune, avant pénalité de crépuscule (§2.2). */
  readonly sbCielNoir: number
  readonly mLimOeil: number | null
  readonly tMaxS: number | null
  readonly snrCible: number
  readonly typeMonture: TypeMonture
  readonly niveau: NiveauUtilisateurPlan
  readonly filtres?: readonly FamilleFiltre[]
  readonly poids?: PoidsScoring
  readonly seuilHauteurDeg?: number
}

export interface DetailScore {
  readonly cadrage: number
  readonly hauteur: number
  readonly signal: number
  readonly fenetre: number
  readonly lune: number
}

export interface EtapePlan {
  readonly objet: ObjetCielProfond
  readonly creneauAlloue: Intervalle
  readonly dureeAlloueeMin: number
  readonly tPoseS: number
  readonly nPoses: number
  readonly volumeGo: number
  readonly verdict: VerdictDetectabilite | null
  readonly verdictCadrage: VerdictCadrage
  readonly score: Traced<number>
  readonly detailScore: DetailScore
  readonly deltaSbLuneMag: Traced<number>
  readonly sbCielEffectif: number
  /** Faux quand l'intégration requise dépasse ce que la nuit alloue : le plan le dit. */
  readonly integrationComplete: boolean
  readonly nNuits: number
  readonly consigne: string
  readonly creneau: CreneauCible
  readonly pose: PoseUnitaire
  readonly integration: PlanIntegration
  readonly cadrage: FicheCadrage
  readonly detect: Detectabilite
}

export interface BudgetNuit {
  readonly disponibleMin: number
  readonly captureMin: number
  readonly calibrationMin: number
  readonly miseEnStationMin: number
  readonly pointageMin: number
  readonly margeMin: number
  readonly totalMin: Traced<number>
  readonly tient: boolean
}

export interface PlanSession {
  readonly etapes: readonly EtapePlan[]
  readonly ciblesEcartees: readonly CibleEcartee[]
  /**
   * Décompte complet par cause, y compris les exclusions non listées une par une. Un plan
   * maigre s'explique : sans ce décompte, l'utilisateur croit le ciel vide alors que c'est
   * le catalogue qui ne porte pas la donnée.
   */
  readonly comptesEcartees: Readonly<Record<string, number>>
  readonly budget: BudgetNuit
  readonly poids: PoidsScoring
  readonly calibration: PlanCalibration | null
  readonly message: string
  /** Renseignée quand aucune cible ne passe : la contrainte qui a dominé le pré-filtrage. */
  readonly contrainteDominante?: string
  readonly alternative?: string
  /** Ce que le catalogue ne porte pas, quand ça borne le plan plus que le ciel. */
  readonly noteCouvertureCatalogue?: string
  /** Rappelé sur chaque plan : l'application ne prétend pas connaître la météo. */
  readonly avertissementMeteo: string
}

export const AVERTISSEMENT_METEO =
  'Aucun filtre météo n’est appliqué : l’application calcule ce que le ciel permet, pas ce ' +
  'que les nuages autoriseront. Un plan complet n’annonce donc pas une nuit dégagée — ' +
  'vérifier la couverture nuageuse reste à la charge de l’observateur, hors de l’application.'

// ---------------------------------------------------------------------------
// Scoring — §8.3
// ---------------------------------------------------------------------------

function borne(valeur: number): number {
  return Math.min(1, Math.max(0, valeur))
}

export function scoreCadrage(remplissage: number): number {
  const cible = K('REMPLISSAGE_CADRE_CIBLE')
  return borne(1 - Math.abs(remplissage - cible) / cible)
}

export function scoreHauteur(altCulminationDeg: number): number {
  return borne(
    (altCulminationDeg - K('SEUIL_HAUTEUR_IMAGERIE_DEG')) / K('ETENDUE_SCORE_HAUTEUR_DEG'),
  )
}

export function scoreSignal(dureeCreneauMin: number, tRequisMin: number): number {
  return tRequisMin <= 0 ? 0 : borne(dureeCreneauMin / tRequisMin)
}

export function scoreFenetre(dureeCreneauMin: number, dureeNuitMin: number): number {
  return dureeNuitMin <= 0 ? 0 : borne(dureeCreneauMin / dureeNuitMin)
}

export function scoreLune(deltaSb: number): number {
  return borne(1 - deltaSb / K('TOLERANCE_LUNE_DELTA_SB_MAG'))
}

function scoreGlobal(detail: DetailScore, poids: PoidsScoring): Traced<number> {
  const valeur =
    poids.cadrage * detail.cadrage +
    poids.hauteur * detail.hauteur +
    poids.signal * detail.signal +
    poids.fenetre * detail.fenetre +
    poids.lune * detail.lune
  return trace({
    value: valeur,
    formula: 'SCORE_CIBLE',
    inputs: {
      s_cadrage: detail.cadrage,
      s_hauteur: detail.hauteur,
      s_signal: detail.signal,
      s_fenetre: detail.fenetre,
      s_lune: detail.lune,
    },
    constants: [
      'POIDS_SCORING_CADRAGE',
      'POIDS_SCORING_HAUTEUR',
      'POIDS_SCORING_SNR',
      'POIDS_SCORING_FENETRE',
      'POIDS_SCORING_LUNE',
    ],
  })
}

// ---------------------------------------------------------------------------
// Évaluation d'une candidate
// ---------------------------------------------------------------------------

interface Candidate {
  readonly objet: ObjetCielProfond
  readonly creneau: CreneauCible
  readonly cadrage: FicheCadrage
  readonly detect: Detectabilite
  readonly pose: PoseUnitaire
  readonly integration: PlanIntegration
  readonly deltaSbLuneMag: Traced<number>
  readonly sbCielEffectif: number
  readonly detailScore: DetailScore
  readonly score: Traced<number>
}

function instantMedian(creneau: CreneauCible, repli: Date): Date {
  const premier = creneau.creneaux[0]
  const dernier = creneau.creneaux[creneau.creneaux.length - 1]
  if (premier === undefined || dernier === undefined) return repli
  return new Date((premier.debut.getTime() + dernier.fin.getTime()) / 2)
}

function evalueCandidate(
  contexte: ContexteSession,
  objet: ObjetCielProfond,
  fenetre: Intervalle,
  sbCielBase: number,
  poids: PoidsScoring,
): Candidate | CibleEcartee {
  const majAxArcmin = objet.majAxArcmin
  if (majAxArcmin === null || objet.vMag === null) {
    return {
      designation: objet.designation,
      code: 'DONNEE_MANQUANTE',
      cause:
        'Dimensions ou magnitude absentes du catalogue : aucun verdict n’est produit, donc ' +
        'aucune place dans le plan. Une estimation inventée serait pire qu’une absence.',
    }
  }

  const cadrage = ficheCadrage({
    fovHDeg: contexte.fovHDeg,
    echApx: contexte.echApx,
    capteurHMm: contexte.capteurHMm,
    tailleMajArcmin: majAxArcmin,
    tailleMinArcmin: objet.minAxArcmin,
    posAngDeg: objet.posAngDeg,
  })
  if (!cadrage.faisable || !VERDICTS_PLANIFIABLES.includes(cadrage.verdict)) {
    return {
      designation: objet.designation,
      code: 'CADRAGE',
      cause:
        (cadrage.cause ?? cadrage.message) +
        (cadrage.verdict === 'MOSAIQUE_REQUISE'
          ? ' Une mosaïque demande autant de sessions partielles que de tuiles : elle ne tient ' +
            'pas dans un créneau d’une nuit et n’entre donc pas au plan.'
          : ''),
    }
  }

  const creneau = creneauCible({
    site: contexte.site,
    adH: objet.adDeg / DEG_PAR_HEURE,
    decDeg: objet.decDeg,
    fenetre,
    masque: contexte.masque,
    typeMonture: contexte.typeMonture,
    ...(contexte.seuilHauteurDeg === undefined ? {} : { seuilHauteurDeg: contexte.seuilHauteurDeg }),
  })
  if (creneau.causeExclusion !== undefined || creneau.dureeTotaleMin.value <= 0) {
    const code: CauseEcart =
      creneau.causeExclusion === 'HAUTEUR' || creneau.causeExclusion === 'JAMAIS_LEVE'
        ? 'HAUTEUR'
        : creneau.causeExclusion === 'RELIEF'
          ? 'RELIEF'
          : 'FENETRE'
    return { designation: objet.designation, code, cause: creneau.message }
  }

  // La Lune est évaluée au milieu du créneau de la cible : c'est là que la dégradation est
  // représentative de la session, plutôt qu'à un instant arbitraire de la nuit.
  const instant = instantMedian(creneau, fenetre.debut)
  const lune = etatLune(contexte.site, instant)
  const posLune = positionEquatorialeLune(instant, contexte.site)
  const delta = deltaSbLune({
    sbCielNoirMag: sbCielBase,
    altitudeLuneDeg: lune.altitudeDeg,
    altitudeCibleDeg: creneau.altCulminationDeg.value,
    separationDeg: separationDeg(
      objet.adDeg / DEG_PAR_HEURE,
      objet.decDeg,
      posLune.adH,
      posLune.decDeg,
    ),
    anglePhaseDeg: lune.anglePhaseDeg,
  })
  const sbCielEffectif = sbCielAvecLune(sbCielBase, delta.value)

  const detect = detectabilite({
    mInt: objet.vMag,
    aArcmin: majAxArcmin,
    bArcmin: objet.minAxArcmin,
    typeObjet: objet.type,
    sbCiel: sbCielEffectif,
    mLimOeil: contexte.mLimOeil,
    dMm: contexte.dMm,
    lune: { altitudeDeg: lune.altitudeDeg },
  })
  const sbObj = detect.sbObj.value
  if (sbObj === null) {
    return {
      designation: objet.designation,
      code: 'DONNEE_MANQUANTE',
      cause: detect.explication,
    }
  }

  const fluxCommun = {
    zpSys: contexte.zpSys,
    pitchUm: contexte.pitchUm,
    ouvertureN: contexte.ouvertureN,
    zpEstime: contexte.zpEstime,
  }
  const eCiel = fluxCiel({ sbMagArcsec2: sbCielEffectif, ...fluxCommun })
  const eObj = fluxObjet({ sbMagArcsec2: sbObj, ...fluxCommun })
  const pose = poseUnitaire({
    eCiel: eCiel.value,
    readNoiseE: contexte.readNoiseE,
    tMaxS: contexte.tMaxS,
    zpEstime: contexte.zpEstime,
  })
  const integration = planIntegration({
    eObj: eObj.value,
    eCiel: eCiel.value,
    tPoseS: pose.tRecommandeS.value,
    readNoiseE: pose.readNoiseUtiliseE,
    snrCible: contexte.snrCible,
    tailleRawMo: contexte.tailleRawMo,
    dureeCreneauS: creneau.dureeTotaleMin.value * S_PAR_MINUTE,
  })
  if (integration.horsDePortee) {
    return {
      designation: objet.designation,
      code: 'HORS_PORTEE',
      cause: integration.messages[0] ?? 'Cible hors de portée de ce setup.',
    }
  }

  const tRequisMin = integration.tRequisS.value / S_PAR_MINUTE
  const detailScore: DetailScore = {
    cadrage: scoreCadrage(cadrage.remplissage.value),
    hauteur: scoreHauteur(creneau.altCulminationDeg.value),
    signal: scoreSignal(creneau.dureeTotaleMin.value, tRequisMin),
    fenetre: scoreFenetre(
      creneau.dureeTotaleMin.value,
      contexte.nuit.dureeReferenceH * MINUTES_PAR_HEURE,
    ),
    lune: scoreLune(delta.value),
  }

  return {
    objet,
    creneau,
    cadrage,
    detect,
    pose,
    integration,
    deltaSbLuneMag: delta,
    sbCielEffectif,
    detailScore,
    score: scoreGlobal(detailScore, poids),
  }
}

// ---------------------------------------------------------------------------
// Allocation de la nuit
// ---------------------------------------------------------------------------

function chevauche(a: Intervalle, b: Intervalle): boolean {
  return a.debut.getTime() < b.fin.getTime() && b.debut.getTime() < a.fin.getTime()
}

function duree(intervalle: Intervalle): number {
  return intervalle.fin.getTime() - intervalle.debut.getTime()
}

/** Ce qui reste d'un sous-créneau une fois retiré tout ce qui est déjà alloué. */
function intervallesLibres(
  sous: Intervalle,
  occupes: readonly Intervalle[],
): readonly Intervalle[] {
  let libres: Intervalle[] = [{ debut: sous.debut, fin: sous.fin }]
  for (const occupe of occupes) {
    const suivants: Intervalle[] = []
    for (const libre of libres) {
      if (!chevauche(libre, occupe)) {
        suivants.push(libre)
        continue
      }
      if (occupe.debut.getTime() > libre.debut.getTime()) {
        suivants.push({ debut: libre.debut, fin: occupe.debut })
      }
      if (occupe.fin.getTime() < libre.fin.getTime()) {
        suivants.push({ debut: occupe.fin, fin: libre.fin })
      }
    }
    libres = suivants
  }
  return libres
}

/**
 * Le PLUS LONG morceau libre du créneau de la cible, d'au plus `dureeMaxMin` minutes. Le
 * plus long, et non le premier venu : prendre les neuf minutes qui précèdent une cible déjà
 * placée, quand quatre heures restent libres ensuite, produirait un plan absurde.
 */
function alloueCreneau(
  creneau: CreneauCible,
  occupes: readonly Intervalle[],
  dureeMaxMin: number,
): Intervalle | null {
  const libres = creneau.creneaux.flatMap((sous) => intervallesLibres(sous, occupes))
  const meilleur = libres.reduce<Intervalle | null>(
    (max, libre) => (max === null || duree(libre) > duree(max) ? libre : max),
    null,
  )
  if (meilleur === null || duree(meilleur) <= 0) return null
  const alloue = Math.min(Math.ceil(dureeMaxMin * MS_PAR_MINUTE), duree(meilleur))
  return { debut: meilleur.debut, fin: new Date(meilleur.debut.getTime() + alloue) }
}

// ---------------------------------------------------------------------------
// Plan complet
// ---------------------------------------------------------------------------

interface PreFiltrage {
  readonly candidates: readonly ObjetCielProfond[]
  /** Écartées nommées, plafonnées : une liste de douze mille lignes n'aide personne. */
  readonly ecartees: readonly CibleEcartee[]
  readonly comptes: ReadonlyMap<CauseEcart, number>
}

/**
 * Pré-filtrage sans éphéméride : les contraintes dures qui se tranchent à l'arithmétique
 * seule. Chaque exclusion porte sa cause, et seules les candidates survivantes — les plus
 * brillantes — vont au calcul de créneau, qui est le poste coûteux.
 */
function preFiltre(
  contexte: ContexteSession,
  catalogue: readonly ObjetCielProfond[],
): PreFiltrage {
  const seuil = contexte.seuilHauteurDeg ?? K('SEUIL_HAUTEUR_IMAGERIE_DEG')
  const tailleMin = contexte.fovHDeg * REMPLISSAGE_MIN_PLANIFIABLE * ARCMIN_PAR_DEG
  const tailleMax = contexte.fovHDeg * ARCMIN_PAR_DEG
  const cap = K('CIBLES_CANDIDATES_MAX')
  const infini = Number.POSITIVE_INFINITY

  const retenues: ObjetCielProfond[] = []
  const ecartees: CibleEcartee[] = []
  const comptes = new Map<CauseEcart, number>()

  const ecarte = (objet: ObjetCielProfond, code: CauseEcart, cause: string): void => {
    comptes.set(code, (comptes.get(code) ?? 0) + 1)
    if (ecartees.length < cap) ecartees.push({ designation: objet.designation, code, cause })
  }

  for (const objet of catalogue) {
    const taille = objet.majAxArcmin
    if (taille === null || objet.vMag === null) {
      // Comptées, pas listées une par une : elles sont des milliers, et une liste de
      // milliers de lignes noierait les exclusions que l'utilisateur peut corriger.
      comptes.set('DONNEE_MANQUANTE', (comptes.get('DONNEE_MANQUANTE') ?? 0) + 1)
      continue
    }
    if (taille < tailleMin || taille > tailleMax) {
      ecarte(
        objet,
        'CADRAGE',
        `Taille de ${taille.toFixed(0)}’ hors de ce que ce setup cadre : la fenêtre utile va ` +
          `de ${tailleMin.toFixed(0)}’ à ${tailleMax.toFixed(0)}’. Recadrer au traitement ` +
          'n’ajoute aucun pixel.',
      )
      continue
    }
    const alt = altitudeCulmination(contexte.site.latitudeDeg, objet.decDeg).value
    if (alt <= seuil) {
      ecarte(
        objet,
        'HAUTEUR',
        `La cible culmine à ${alt.toFixed(1)}° depuis ce site, sous le seuil de ${seuil}° : ` +
          'elle est hors du domaine, quelle que soit l’heure et quelle que soit la date.',
      )
      continue
    }
    retenues.push(objet)
  }

  return {
    candidates: retenues
      .sort((a, b) => (a.vMag ?? infini) - (b.vMag ?? infini))
      .slice(0, cap),
    ecartees,
    comptes,
  }
}

export function planSession(
  contexte: ContexteSession,
  catalogue: readonly ObjetCielProfond[],
): PlanSession {
  const poids = contexte.poids ?? poidsParDefaut()
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

  const fenetre: Intervalle = { debut, fin }
  const sbCielBase = contexte.sbCielNoir - contexte.nuit.penaliteSbMag
  const prefiltre = preFiltre(contexte, catalogue)
  const ecartees: CibleEcartee[] = [...prefiltre.ecartees]
  const comptes = new Map(prefiltre.comptes)
  const retenues: Candidate[] = []

  for (const objet of prefiltre.candidates) {
    // Une cible hors du domaine de validité d'un moteur est écartée avec sa cause : elle ne
    // fait pas tomber le plan entier (§12.5 — jamais d'erreur technique brute).
    let resultat: Candidate | CibleEcartee
    try {
      resultat = evalueCandidate(contexte, objet, fenetre, sbCielBase, poids)
    } catch (erreur) {
      if (!(erreur instanceof SaisieRefuseeError)) throw erreur
      resultat = {
        designation: objet.designation,
        code: 'HORS_PORTEE',
        cause: erreur.message,
      }
    }
    if ('code' in resultat) {
      ecartees.push(resultat)
      comptes.set(resultat.code, (comptes.get(resultat.code) ?? 0) + 1)
    } else {
      retenues.push(resultat)
    }
  }

  if (retenues.length === 0) {
    return planVide(contexte, poids, ecartees, comptes, null)
  }

  // Allocation par score décroissant : c'est l'arbitrage de §8.3 quand deux créneaux se
  // chevauchent. Le plan est ensuite rendu dans l'ordre du temps — une chronologie.
  const parScore = retenues.slice().sort((a, b) => b.score.value - a.score.value)
  const limite =
    contexte.niveau === 'DEBUTANT' ? K('CIBLES_MAX_DEBUTANT') : Number.POSITIVE_INFINITY
  const occupes: Intervalle[] = []
  const etapes: EtapePlan[] = []

  for (const candidate of parScore) {
    if (etapes.length >= limite) {
      ecartees.push({
        designation: candidate.objet.designation,
        code: 'BUDGET',
        cause:
          `Plan limité à ${K('CIBLES_MAX_DEBUTANT')} cibles au niveau débutant, avec une marge ` +
          'de temps élargie. Passer au niveau confirmé lève cette limite.',
      })
      continue
    }
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

  etapes.sort((a, b) => a.creneauAlloue.debut.getTime() - b.creneauAlloue.debut.getTime())

  // La calibration est prise une fois pour la session : même ISO, même optique, et des
  // darks à la pose de la première cible du plan (§7.4).
  const premiere = etapes[0]
  const calibration =
    premiere === undefined
      ? null
      : planCalibration({
          tPoseS: premiere.tPoseS,
          iso: contexte.isoSession,
          nPoses: etapes.reduce((somme, e) => somme + e.nPoses, 0),
          autoguidage: false,
        })

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

function calculeBudget(
  contexte: ContexteSession,
  etapes: readonly EtapePlan[],
  calibration: PlanCalibration | null,
): BudgetNuit {
  const disponibleMin = contexte.nuit.dureeReferenceH * MINUTES_PAR_HEURE
  const captureMin = etapes.reduce((somme, e) => somme + e.dureeAlloueeMin, 0)
  const calibrationMin = calibration === null ? 0 : calibration.surcoutTempsMin.value
  const miseEnStationMin = K('TEMPS_MISE_EN_STATION_MIN')
  const pointageMin = K('TEMPS_POINTAGE_PAR_CIBLE_MIN') * etapes.length
  const margeMin =
    contexte.niveau === 'DEBUTANT' ? disponibleMin * K('MARGE_NUIT_DEBUTANT') : 0
  const total = captureMin + calibrationMin + miseEnStationMin + pointageMin + margeMin

  return {
    disponibleMin,
    captureMin,
    calibrationMin,
    miseEnStationMin,
    pointageMin,
    margeMin,
    totalMin: trace({
      value: total,
      formula: 'BUDGET_NUIT',
      inputs: {
        capture_min: captureMin,
        calibration_min: calibrationMin,
        mise_en_station_min: miseEnStationMin,
        pointage_min: pointageMin,
        marge_min: margeMin,
      },
      constants: ['TEMPS_MISE_EN_STATION_MIN', 'TEMPS_POINTAGE_PAR_CIBLE_MIN'],
    }),
    tient: total <= disponibleMin,
  }
}

/** Dépassement : la cible de plus faible score est retirée ENTIÈREMENT (§8.3). */
function retireJusquAuBudget(
  etapes: readonly EtapePlan[],
  budget: BudgetNuit,
  contexte: ContexteSession,
  ecartees: CibleEcartee[],
  calibration: PlanCalibration | null,
): readonly EtapePlan[] {
  let courantes = etapes.slice()
  let courantBudget = budget
  while (!courantBudget.tient && courantes.length > 0) {
    const plusFaible = courantes.reduce((min, e) => (e.score.value < min.score.value ? e : min))
    courantes = courantes.filter((e) => e !== plusFaible)
    ecartees.push({
      designation: plusFaible.objet.designation,
      code: 'BUDGET',
      cause:
        `Budget de nuit dépassé de ` +
        `${(courantBudget.totalMin.value - courantBudget.disponibleMin).toFixed(0)} min : cette ` +
        'cible, de plus faible score, est retirée entièrement. Aucune intégration n’est ' +
        'tronquée pour faire tenir le plan.',
    })
    courantBudget = calculeBudget(contexte, courantes, calibration)
  }
  return courantes
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
