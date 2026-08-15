/**
 * §7.1 flux du fond de ciel · §7.2 pose unitaire · §7.3 nombre de poses et intégration.
 *
 * Trois points du PRD sont câblés ici, parce qu'ils sont contre-intuitifs :
 *
 *   1. LE FLUX DE FOND DE CIEL PAR PIXEL NE DÉPEND PAS DU DIAMÈTRE. Il dépend du rapport
 *      d'ouverture et du pas des pixels. Deux setups de même f/N et même pitch collectent
 *      le même fond de ciel par pixel, quel que soit leur diamètre.
 *   2. UN CIEL PLUS NOIR EXIGE DES POSES PLUS LONGUES, pas plus courtes : t_opt ∝ 1 / E_ciel.
 *   3. SNR ∝ √T. Doubler la qualité quadruple le temps.
 *
 * Et aucune calibration : le point zéro est livré par boîtier, en lecture seule. L'optimum
 * de pose est plat, la plage utile [t/2 ; t×2] absorbe l'incertitude (§2.3, §7.1).
 */

import { K } from '../registry/constants.ts'
import { valide, type DomaineId } from '../registry/domains.ts'
import { VALEURS_OBTURATEUR_S } from '../registry/verdicts.ts'
import type { Flag, Traced } from './traced.ts'
import { trace } from './traced.ts'

const S_PAR_MIN = 60
const S_PAR_H = 3600

// ---------------------------------------------------------------------------
// §7.1 — estimateur de flux
// ---------------------------------------------------------------------------

export interface EntreeFlux {
  readonly sbMagArcsec2: number
  readonly zpSys: number
  readonly pitchUm: number
  readonly ouvertureN: number
  /** Vrai quand le point zéro vient du générique C-14 : la sortie porte [ESTIMÉ] (§2.3). */
  readonly zpEstime?: boolean
}

/**
 * Conversion brute d'une brillance de surface en flux, sans garde de domaine. Réservée aux
 * usages où la valeur est déjà validée : notamment le calcul de sensibilité de §10.2, qui
 * perturbe légèrement chaque entrée et ne doit pas buter sur une borne.
 */
export function fluxE(sb: number, zpSys: number, pitchUm: number, ouvertureN: number): number {
  return K('BASE_MAGNITUDE') ** (-(sb - zpSys) / K('POGSON')) * (pitchUm / ouvertureN) ** 2
}

function flux(entree: EntreeFlux, champ: DomaineId, formula: 'FLUX_CIEL' | 'FLUX_OBJET'): Traced<number> {
  const sb = valide(champ, entree.sbMagArcsec2)
  const zpSys = valide('zp_sys', entree.zpSys)
  const pitchUm = valide('pitch_um', entree.pitchUm)
  const ouvertureN = valide('ouverture_N', entree.ouvertureN)

  const flags: Flag[] = entree.zpEstime === true ? ['ESTIME'] : []
  return trace({
    value: fluxE(sb, zpSys, pitchUm, ouvertureN),
    formula,
    inputs: { sb: sb, zp_sys: zpSys, pitch_um: pitchUm, ouverture_N: ouvertureN },
    constants: entree.zpEstime === true ? ['POGSON', 'ZP_SYS_GENERIQUE'] : ['POGSON'],
    flags,
    ...(entree.zpEstime === true
      ? {
          note:
            'Point zéro générique : le flux est estimé. La plage utile de pose absorbe ' +
            'l’incertitude — il n’existe aucune calibration à effectuer.',
        }
      : {}),
  })
}

/** Flux du fond de ciel, e⁻/s/px. Refuse une brillance hors du domaine plutôt qu'extrapoler. */
export function fluxCiel(entree: EntreeFlux): Traced<number> {
  return flux(entree, 'sb_ciel', 'FLUX_CIEL')
}

/** Flux de l'objet, e⁻/s/px, à partir de sa brillance de surface (§6.3). */
export function fluxObjet(entree: EntreeFlux): Traced<number> {
  return flux(entree, 'sb_obj', 'FLUX_OBJET')
}

// ---------------------------------------------------------------------------
// §7.2 — pose unitaire optimale
// ---------------------------------------------------------------------------

export type RegimePose = 'NOMINAL' | 'LIMITE_SUIVI'

export interface EntreePose {
  readonly eCiel: number
  /** `null` quand la base matériel ne donne pas la courbe du boîtier : repli à 3 e⁻. */
  readonly readNoiseE: number | null
  /** Plafond de la monture (§5.2), ou pose NPF quand il n'y a pas de suivi (§9.1). */
  readonly tMaxS: number | null
  /** Mode permissif C-03 = 3 : ciel pollué, suivi imprécis, vent. */
  readonly permissif?: boolean
  readonly zpEstime?: boolean
}

export interface PoseUnitaire {
  readonly tOptS: Traced<number>
  readonly tRecommandeS: Traced<number>
  /** Arrondie à une valeur d'obturateur usuelle : un boîtier ne propose pas 13,43 s. */
  readonly tAfficheeS: number
  /** [t/2 ; t×2], présentée comme équivalente (§2.3). */
  readonly plageUtileS: Traced<readonly [number, number]>
  readonly regime: RegimePose
  readonly message: string
  /** Perte de rapport signal sur bruit quand la monture bride la pose. */
  readonly perteSnrBridee?: number
  readonly readNoiseUtiliseE: number
  readonly readNoiseEstime: boolean
}

/** Valeur d'obturateur usuelle la plus proche (§2.3). */
export function arrondiObturateur(tS: number): number {
  return VALEURS_OBTURATEUR_S.reduce((meilleure, valeur) =>
    Math.abs(valeur - tS) < Math.abs(meilleure - tS) ? valeur : meilleure,
  )
}

export function poseUnitaire(entree: EntreePose): PoseUnitaire {
  const readNoiseEstime = entree.readNoiseE === null
  const rn = readNoiseEstime ? K('READ_NOISE_DEFAUT_E') : valide('read_noise_e', entree.readNoiseE!)
  const constanteC = entree.permissif === true ? 'FACTEUR_POSE_C_PERMISSIF' : 'FACTEUR_POSE_C_DEFAUT'
  const tOpt = (K(constanteC) * rn ** 2) / entree.eCiel

  const flags: Flag[] = []
  if (readNoiseEstime || entree.zpEstime === true) flags.push('ESTIME')

  const tOptS = trace({
    value: tOpt,
    formula: 'POSE_OPTIMALE',
    inputs: { c_facteur: K(constanteC), read_noise_e: rn, e_ciel: entree.eCiel },
    constants: readNoiseEstime ? [constanteC, 'READ_NOISE_DEFAUT_E'] : [constanteC],
    flags,
    ...(readNoiseEstime
      ? {
          note:
            `Bruit de lecture inconnu pour ce boîtier : ${K('READ_NOISE_DEFAUT_E')} e⁻ appliqué ` +
            'et affiché. La pose optimale varie comme le carré de cette valeur.',
        }
      : {}),
  })

  const tMax = entree.tMaxS
  const bride = tMax !== null && tMax < tOpt
  const tRecommande = bride ? tMax : tOpt
  const regime: RegimePose = bride ? 'LIMITE_SUIVI' : 'NOMINAL'

  // C effectif atteint quand la monture bride : E_ciel × t / RN², d'où la perte de §2.3.
  const cEffectif = bride ? (entree.eCiel * tMax) / rn ** 2 : K(constanteC)
  const perte = 1 - Math.sqrt(cEffectif / (cEffectif + 1))

  const plage: readonly [number, number] = [Math.floor(tRecommande / 2), Math.floor(tRecommande * 2)]

  return {
    tOptS,
    tRecommandeS: trace({
      value: tRecommande,
      formula: 'POSE_RETENUE',
      inputs: { t_opt_s: tOpt, t_max_suivi_s: tMax ?? Number.NaN },
      flags,
    }),
    tAfficheeS: arrondiObturateur(tRecommande),
    plageUtileS: trace({
      value: plage,
      formula: 'PLAGE_UTILE_POSE',
      inputs: { t_recommande_s: tRecommande },
      note:
        `Poser ${plage[0]} s, ${arrondiObturateur(tRecommande)} s ou ${plage[1]} s revient au ` +
        'même : l’optimum est plat. Cette plage est aussi ce qui rend toute calibration ' +
        'inutile.',
    }),
    regime,
    message: bride
      ? 'La monture bride la pose avant la physique : le bruit de lecture dominera, pour une ' +
        `perte de rapport signal sur bruit d’environ ${(perte * 100).toFixed(0)} %. Soigner la ` +
        'mise en station est le levier ; à défaut, le grand champ (§9) reste entièrement ouvert.'
      : 'Poser plus longtemps n’apporterait quasi rien et augmenterait le risque de perte : ' +
        'rafale, avion, étoile brillante saturée.',
    ...(bride ? { perteSnrBridee: perte } : {}),
    readNoiseUtiliseE: rn,
    readNoiseEstime,
  }
}

// ---------------------------------------------------------------------------
// §7.3 — nombre de poses et intégration totale
// ---------------------------------------------------------------------------

export interface EntreeIntegration {
  readonly eObj: number
  readonly eCiel: number
  readonly tPoseS: number
  readonly readNoiseE: number
  readonly snrCible: number
  readonly tailleRawMo: number
  /** Durée exploitable d'une nuit sur cette cible (§8.2). Absente : pas de découpe. */
  readonly dureeCreneauS?: number | null
}

export interface PlanIntegration {
  readonly tRequisS: Traced<number>
  readonly nPoses: Traced<number>
  readonly volumeGo: Traced<number>
  readonly nNuits?: Traced<number>
  /** Vrai quand l'intégration dépasse le plafond : la cible est annoncée hors de portée. */
  readonly horsDePortee: boolean
  readonly loiFondamentale: string
  readonly messages: readonly string[]
}

/** Rapport signal sur bruit atteint après un temps d'intégration total (§7.3). */
export function snrApres(entree: Omit<EntreeIntegration, 'snrCible' | 'tailleRawMo'>, tS: number): number {
  const { eObj, eCiel, tPoseS, readNoiseE } = entree
  return (
    (eObj * tS) /
    Math.sqrt((eObj + eCiel) * tS + (tS / tPoseS) * readNoiseE ** 2)
  )
}

/** Temps d'intégration total requis pour un rapport signal sur bruit visé (§7.3). */
export function integrationRequiseS(entree: EntreeIntegration, snrCible: number): number {
  const { eObj, eCiel, tPoseS, readNoiseE } = entree
  return (snrCible ** 2 * (eObj + eCiel + readNoiseE ** 2 / tPoseS)) / eObj ** 2
}

export function planIntegration(entree: EntreeIntegration): PlanIntegration {
  const snrCible = valide('snr_cible', entree.snrCible)
  const plafondS = K('INTEGRATION_PLAFOND_H') * S_PAR_H
  const requis = integrationRequiseS(entree, snrCible)
  const horsDePortee = !Number.isFinite(requis) || requis > plafondS
  const tRequis = horsDePortee ? plafondS : requis

  const nPosesValeur = Math.ceil(tRequis / entree.tPoseS)
  const volume = (nPosesValeur * entree.tailleRawMo) / K('MO_PAR_GO')
  const inputs = {
    snr_cible: snrCible,
    e_obj: entree.eObj,
    e_ciel: entree.eCiel,
    t_pose_s: entree.tPoseS,
    read_noise_e: entree.readNoiseE,
  }

  const messages: string[] = []
  if (horsDePortee) {
    messages.push(
      `Cette cible demanderait plus de ${K('INTEGRATION_PLAFOND_H')} h d’intégration avec ce ` +
        'setup : elle est hors de portée, et l’affichage est plafonné plutôt que de chiffrer ' +
        'des centaines d’heures. Les leviers sont un ciel plus sombre ou une cible plus brillante.',
    )
  }
  const doubleSnr = integrationRequiseS(entree, snrCible * 2)
  if (Number.isFinite(doubleSnr)) {
    messages.push(
      `Viser un rapport signal sur bruit de ${snrCible * 2} au lieu de ${snrCible} demanderait ` +
        `${(doubleSnr / S_PAR_H).toFixed(1)} h, soit quatre fois plus.`,
    )
  }

  const creneau = entree.dureeCreneauS ?? null
  const nNuitsValeur = creneau !== null && creneau > 0 ? Math.ceil(tRequis / creneau) : null
  if (nNuitsValeur !== null && nNuitsValeur > 1) {
    messages.push(
      `La capture se répartit sur ${nNuitsValeur} nuits. Un empilement multi-nuits impose des ` +
        'darks pris à température comparable, sans quoi la bibliothèque est invalidée (§7.4).',
    )
  }
  messages.push(
    `Prévoir ${volume.toFixed(1)} Go de carte : le budget de stockage se vérifie avant la ` +
      'sortie, pas pendant.',
  )

  return {
    tRequisS: trace({
      value: tRequis,
      formula: 'INTEGRATION_REQUISE',
      inputs,
      ...(horsDePortee
        ? {
            flags: ['HORS_DOMAINE' as const],
            note:
              'Affichage plafonné : au-delà, la cible est annoncée hors de portée de ce setup ' +
              'plutôt que chiffrée en centaines d’heures.',
          }
        : {}),
    }),
    nPoses: trace({
      value: nPosesValeur,
      formula: 'NOMBRE_POSES',
      inputs: { t_requis_s: tRequis, t_pose_s: entree.tPoseS },
    }),
    volumeGo: trace({
      value: volume,
      formula: 'VOLUME_STOCKAGE',
      inputs: { n_poses: nPosesValeur, taille_raw_mo: entree.tailleRawMo },
      constants: ['MO_PAR_GO'],
    }),
    ...(nNuitsValeur === null
      ? {}
      : {
          nNuits: trace({
            value: nNuitsValeur,
            formula: 'NOMBRE_NUITS',
            inputs: { t_requis_s: tRequis, duree_creneau_s: creneau ?? Number.NaN },
          }),
        }),
    horsDePortee,
    loiFondamentale:
      'Le rapport signal sur bruit croît comme la racine du temps : DOUBLER LA QUALITÉ ' +
      'QUADRUPLE LE TEMPS.',
    messages,
  }
}

/** Durée lisible, pour les messages destinés à l'utilisateur. */
export function dureeLisible(secondes: number): string {
  if (secondes < S_PAR_H) return `${(secondes / S_PAR_MIN).toFixed(0)} min`
  const heures = Math.floor(secondes / S_PAR_H)
  const minutes = Math.round((secondes - heures * S_PAR_H) / S_PAR_MIN)
  return `${heures} h ${minutes.toString().padStart(2, '0')}`
}
