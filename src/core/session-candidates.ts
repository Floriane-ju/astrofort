/**
 * §8.3 — Ce qui décide si une cible entre au plan, avant toute allocation de temps.
 *
 * Deux étages, du moins cher au plus cher : le pré-filtrage par contrainte dure, qui ne
 * demande que de l'arithmétique, puis l'évaluation complète d'une candidate, qui appelle
 * les éphémérides et les moteurs de §6 et §7. Chaque exclusion nomme sa cause.
 */

import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { REMPLISSAGE_MIN_PLANIFIABLE, VERDICTS_PLANIFIABLES } from '../registry/verdicts.ts'
import { creneauCible, type CreneauCible, type Intervalle } from './creneaux.ts'
import { detectabilite } from './detectability.ts'
import { ficheCadrage } from './framing.ts'
import { fluxCiel, fluxObjet, planIntegration, poseUnitaire } from './exposure.ts'
import { cielSousLaLune } from './moon.ts'
import { altitudeCulmination } from './site.ts'
import {
  scoreCadrage,
  scoreFenetre,
  scoreGlobal,
  scoreHauteur,
  scoreLune,
  scoreSignal,
} from './session-score.ts'
import type {
  Candidate,
  CauseEcart,
  CibleEcartee,
  ContexteSession,
  DetailScore,
  PoidsScoring,
} from './session-types.ts'

const MINUTES_PAR_HEURE = 60
const S_PAR_MINUTE = 60
const ARCMIN_PAR_DEG = 60
const HEURES_PAR_TOUR = 24
const DEG_PAR_HEURE = 360 / HEURES_PAR_TOUR

/**
 * §8.1 — la Lune est évaluée au milieu du créneau de la cible : c'est là que la dégradation
 * est représentative de la session, plutôt qu'à un instant arbitraire de la nuit. Exporté
 * parce que c'est une convention du plan, et qu'un autre écran doit pouvoir l'employer.
 */
export function instantLune(creneau: CreneauCible, repli: Date): Date {
  const premier = creneau.creneaux[0]
  const dernier = creneau.creneaux[creneau.creneaux.length - 1]
  if (premier === undefined || dernier === undefined) return repli
  return new Date((premier.debut.getTime() + dernier.fin.getTime()) / 2)
}

/** Le code d'écart que porte un créneau refusé : la cause vient du moteur, pas d'ici. */
function codeExclusionCreneau(creneau: CreneauCible): CauseEcart {
  if (creneau.causeExclusion === 'HAUTEUR' || creneau.causeExclusion === 'JAMAIS_LEVE') {
    return 'HAUTEUR'
  }
  return creneau.causeExclusion === 'RELIEF' ? 'RELIEF' : 'FENETRE'
}

export function evalueCandidate(
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
    return {
      designation: objet.designation,
      code: codeExclusionCreneau(creneau),
      cause: creneau.message,
    }
  }

  const { delta, sbCielEffectif, altLuneDeg, separationDeg } = cielSousLaLune({
    site: contexte.site,
    instant: instantLune(creneau, fenetre.debut),
    adH: objet.adDeg / DEG_PAR_HEURE,
    decDeg: objet.decDeg,
    altitudeCibleDeg: creneau.altCulminationDeg.value,
    sbCielNoirMag: sbCielBase,
  })

  const detect = detectabilite({
    mInt: objet.vMag,
    aArcmin: majAxArcmin,
    bArcmin: objet.minAxArcmin,
    typeObjet: objet.type,
    sbCiel: sbCielEffectif,
    mLimOeil: contexte.mLimOeil,
    dMm: contexte.dMm,
    lune: { altitudeDeg: altLuneDeg, separationDeg },
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

export interface PreFiltrage {
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
export function preFiltre(
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
