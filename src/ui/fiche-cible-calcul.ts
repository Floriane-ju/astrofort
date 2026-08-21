/**
 * La chaîne de calcul de la fiche : d'une cible saisie jusqu'à « pose 13 s, 252 images,
 * 8,3 Go », en passant par §6.1 domaine, §6.2 cadrage, §6.3 détectabilité et §7 pose.
 *
 * Aucune de ces fonctions ne connaît React : elles prennent des valeurs et rendent des
 * valeurs tracées. C'est ce qui rend la chaîne vérifiable de bout en bout.
 */

import { ficheCadrage, verdictDomaine, type FicheCadrage, type VerdictDomaine } from '../core/framing.ts'
import { detectabilite, type Detectabilite } from '../core/detectability.ts'
import {
  attenuationBrute,
  dureeLisible,
  fluxCiel,
  fluxE,
  fluxObjet,
  fluxObjetReel,
  integrationRequiseS,
  planIntegration,
  poseUnitaire,
  type FluxObjetReel,
  type PlanIntegration,
  type PoseUnitaire,
} from '../core/exposure.ts'
import { planCalibration, type PlanCalibration } from '../core/calibration.ts'
import type { CielSousLaLune } from '../core/moon.ts'
import { explication, type Explication } from '../core/explain.ts'
import {
  conseilFiltre,
  recommandationsEquipement,
  type ConseilFiltre,
  type SortieRecommandations,
} from '../core/recommandations.ts'
import { K } from '../registry/constants.ts'
import type { FamilleFiltre } from '../registry/filters.ts'
import type { ProfilOptique } from '../core/optics.ts'
import { masseAir } from '../core/site.ts'
import type { Traced } from '../core/traced.ts'
import type { TypeObjet, ObjetCielProfond } from '../data/deepsky.ts'
import type { Boitier, IsoRetenu, PointZeroSysteme } from '../data/equipment.ts'

/** Le matériel et le ciel sous lesquels une cible est évaluée. */
export interface ContexteFiche {
  readonly optique: ProfilOptique
  readonly capteurHMm: number
  readonly pitchUm: number
  readonly ouvertureN: number
  readonly boitier: Boitier
  readonly zeroSysteme: PointZeroSysteme
  /** §7.2 — l'ISO retenu, recommandé par le double gain ou choisi à la main. */
  readonly iso: IsoRetenu
  readonly sbCiel: number
  readonly mLimOeil: number | null
  /** Plafond de pose : monture avec suivi (§5.2), ou pose NPF sans suivi (§9.1). */
  readonly tMaxS: number | null
  readonly catalogue: readonly ObjetCielProfond[]
  /** Classe Bortle déclarée, quand elle l'est : elle conditionne le conseil filtre (§7.5). */
  readonly bortle: number | null
  readonly suiviActif: boolean
  readonly focaleMm: number
}

/**
 * T-0089 — l'état du ciel sous la Lune retenu par la fiche. Jamais implicite : soit la Lune
 * est évaluée à un instant nommé, soit elle ne l'est pas et la fiche dit pourquoi. Le fond
 * de ciel noir du site n'est jamais présenté comme le ciel de la nuit sans le dire.
 */
export type LuneFiche =
  | { readonly evaluee: true; readonly instant: Date; readonly ciel: CielSousLaLune }
  | { readonly evaluee: false; readonly cause: string }

/** Les six champs de la fiche, tels que l'utilisateur les voit — donc des chaînes. */
export interface SaisieCible {
  readonly typeObjet: TypeObjet
  readonly mInt: string
  readonly aArcmin: string
  readonly bArcmin: string
  readonly posAngDeg: string
}

export interface Resultat {
  readonly domaine: VerdictDomaine
  /** §8.1 — le ciel sous la Lune tel qu'il a été retenu, ou la raison de son absence. */
  readonly lune: LuneFiche
  /** Fond de ciel effectivement employé : celui du site, dégradé par la Lune si elle l'est. */
  readonly sbCielEffectif: number
  readonly cadrage: FicheCadrage
  readonly detect: Detectabilite
  readonly eCiel: Traced<number>
  readonly eObj: Traced<number> | null
  /**
   * §7.6 — l'extinction atmosphérique appliquée au flux de l'objet, avec la masse d'air et
   * la hauteur qui la produisent. Toujours présente : un refus se lit, il ne disparaît pas.
   */
  readonly extinction: FluxObjetReel | null
  /** Hauteur à laquelle la cible a été évaluée. `null` quand elle n'est pas connue. */
  readonly hauteurEvaluationDeg: number | null
  readonly pose: PoseUnitaire | null
  readonly integration: PlanIntegration | null
  readonly calibration: PlanCalibration | null
  readonly explique: Explication | null
}

export interface Conseils {
  readonly filtre: ConseilFiltre
  readonly recommandations: SortieRecommandations
}

export function nombreOuNull(texte: string): number | null {
  const valeur = Number(texte)
  return texte.trim() === '' || !Number.isFinite(valeur) ? null : valeur
}

/**
 * `permissif` est le mode C-03 = 3 de §7.2 : il n'est jamais déduit du contexte, il est
 * demandé. Une pose divisée par trois se choisit, elle ne s'applique pas en silence.
 */
export function evalue(
  contexte: ContexteFiche,
  saisie: SaisieCible,
  snrCible: number,
  iso: IsoRetenu,
  lune: LuneFiche,
  permissif = false,
): Resultat {
  const fovHDeg = contexte.optique.fovHDeg.value
  // T-0089 — le plan de séance dose la pose sous le ciel réel de la nuit (§8.1) ; la fiche
  // le faisait sous le ciel noir du site, et annonçait donc une autre pose pour la même
  // cible. Un seul fond de ciel traverse maintenant toute la chaîne.
  const sbCiel = lune.evaluee ? lune.ciel.sbCielEffectif : contexte.sbCiel
  const domaine = verdictDomaine(fovHDeg, contexte.catalogue)
  const a = nombreOuNull(saisie.aArcmin)
  const b = nombreOuNull(saisie.bArcmin)
  const m = nombreOuNull(saisie.mInt)

  const cadrage = ficheCadrage({
    fovHDeg,
    echApx: contexte.optique.echApx.value,
    capteurHMm: contexte.capteurHMm,
    tailleMajArcmin: a ?? 0,
    tailleMinArcmin: b,
    posAngDeg: nombreOuNull(saisie.posAngDeg),
  })

  const detect = detectabilite({
    mInt: m,
    aArcmin: a,
    bArcmin: b,
    typeObjet: saisie.typeObjet,
    sbCiel,
    mLimOeil: contexte.mLimOeil,
    dMm: contexte.optique.dMm.value,
    // La tolérance lunaire du type d'objet (§6.3) n'est portée que si la Lune est évaluée :
    // annoncer « Lune sous l'horizon » sans l'avoir calculée serait une affirmation gratuite.
    ...(lune.evaluee
      ? {
          lune: {
            altitudeDeg: lune.ciel.altLuneDeg,
            separationDeg: lune.ciel.separationDeg,
          },
        }
      : {}),
  })

  const zpEstime = contexte.zeroSysteme.estime
  const eCiel = fluxCiel({
    sbMagArcsec2: sbCiel,
    zpSys: contexte.zeroSysteme.valeur,
    pitchUm: contexte.pitchUm,
    ouvertureN: contexte.ouvertureN,
    zpEstime,
  })

  /**
   * §7.6 — la hauteur à laquelle la cible est éteinte : sa CULMINATION, la même convention
   * que celle du modèle lunaire de cette fiche et du plan de séance. Une cible personnalisée
   * n'a pas de coordonnées, donc pas de hauteur : l'extinction n'est alors pas supposée, et
   * la durée annoncée se présente comme un plancher.
   */
  const hauteurEvaluationDeg = lune.evaluee ? lune.ciel.altitudeCibleDeg : null

  const sbObj = detect.sbObj.value
  if (sbObj === null) {
    return {
      domaine,
      lune,
      sbCielEffectif: sbCiel,
      cadrage,
      detect,
      eCiel,
      eObj: null,
      extinction: null,
      hauteurEvaluationDeg,
      pose: null,
      integration: null,
      calibration: null,
      explique: null,
    }
  }

  const eObj = fluxObjet({
    sbMagArcsec2: sbObj,
    zpSys: contexte.zeroSysteme.valeur,
    pitchUm: contexte.pitchUm,
    ouvertureN: contexte.ouvertureN,
    zpEstime,
  })
  const extinction = fluxObjetReel(eObj, masseAir(hauteurEvaluationDeg))
  const eObjReel = extinction.eObjReel.value

  // Extinction refusée hors du domaine de l'approximation plane : la chaîne s'arrête là,
  // et l'écran affiche le refus plutôt qu'une intégration extrapolée (§7.6, borne dure).
  if (eObjReel === null) {
    return {
      domaine,
      lune,
      sbCielEffectif: sbCiel,
      cadrage,
      detect,
      eCiel,
      eObj,
      extinction,
      hauteurEvaluationDeg,
      pose: null,
      integration: null,
      calibration: null,
      explique: null,
    }
  }

  const pose = poseUnitaire({
    eCiel: eCiel.value,
    readNoiseE: iso.readNoiseE,
    tMaxS: contexte.tMaxS,
    zpEstime,
    permissif,
  })

  const integration = planIntegration({
    eObj: eObjReel,
    eCiel: eCiel.value,
    tPoseS: pose.tRecommandeS.value,
    readNoiseE: pose.readNoiseUtiliseE,
    snrCible,
    tailleRawMo: contexte.boitier.tailleRawMo,
    eObjPlage: extinction.plageEObj,
  })

  const calibration = planCalibration({
    tPoseS: pose.tAfficheeS,
    iso: iso.iso,
    nPoses: integration.nPoses.value,
    autoguidage: false,
  })

  return {
    domaine,
    lune,
    sbCielEffectif: sbCiel,
    cadrage,
    detect,
    eCiel,
    eObj,
    extinction,
    hauteurEvaluationDeg,
    pose,
    integration,
    calibration,
    explique: expliqueVerdict(contexte, saisie, snrCible, {
      cadrage,
      detect,
      eCiel,
      eObj,
      extinction,
      hauteurEvaluationDeg,
      pose,
      integration,
      sbObj,
      sbCiel,
    }),
  }
}

/**
 * §10.2 — la sensibilité est calculée sur la sortie qui porte le verdict : la durée
 * d'intégration requise. Les flux sont recalculés sans garde de domaine, pour que la
 * perturbation d'une entrée ne bute pas sur une borne de saisie.
 */
function expliqueVerdict(
  contexte: ContexteFiche,
  saisie: SaisieCible,
  snrCible: number,
  r: {
    readonly cadrage: FicheCadrage
    readonly detect: Detectabilite
    readonly eCiel: Traced<number>
    readonly eObj: Traced<number>
    readonly extinction: FluxObjetReel
    readonly hauteurEvaluationDeg: number | null
    readonly pose: PoseUnitaire
    readonly integration: PlanIntegration
    readonly sbObj: number
    readonly sbCiel: number
  },
): Explication {
  // §7.6 — la masse d'air entre dans la sensibilité comme les autres entrées : c'est ce qui
  // permet à §10.2 de désigner la HAUTEUR comme facteur dominant quand elle l'est, plutôt
  // que de laisser croire que seule la cible décide du temps de pose.
  const masseAirValeur = r.extinction.masseAir.value
  const point = {
    sb_obj: r.sbObj,
    sb_ciel: r.sbCiel,
    t_pose_s: r.pose.tRecommandeS.value,
    read_noise_e: r.pose.readNoiseUtiliseE,
    snr_cible: snrCible,
    ...(masseAirValeur === null ? {} : { masse_air: masseAirValeur }),
  }
  const sortie = (v: Readonly<Record<string, number>>): number =>
    integrationRequiseS(
      {
        eObj:
          fluxE(v.sb_obj!, contexte.zeroSysteme.valeur, contexte.pitchUm, contexte.ouvertureN) *
          (v.masse_air === undefined ? 1 : attenuationBrute(v.masse_air)),
        eCiel: fluxE(v.sb_ciel!, contexte.zeroSysteme.valeur, contexte.pitchUm, contexte.ouvertureN),
        tPoseS: v.t_pose_s!,
        readNoiseE: v.read_noise_e!,
        snrCible: v.snr_cible!,
        tailleRawMo: contexte.boitier.tailleRawMo,
      },
      v.snr_cible!,
    )

  return explication({
    verdictN1: `${r.detect.verdict} — environ ${dureeLisible(r.integration.tRequisS.value)} d’intégration pour la qualité visée.`,
    phraseFacteur: r.detect.explication,
    etapes: [
      { libelle: 'Brillance de surface de l’objet', trace: r.detect.sbObj },
      { libelle: 'Contraste sur le fond de ciel', trace: r.detect.deltaSb },
      { libelle: 'Flux du fond de ciel', trace: r.eCiel },
      { libelle: 'Flux de l’objet', trace: r.eObj },
      { libelle: 'Masse d’air de la cible', trace: r.extinction.masseAir },
      { libelle: 'Atténuation atmosphérique', trace: r.extinction.attenuation },
      { libelle: 'Flux de l’objet reçu au capteur', trace: r.extinction.eObjReel },
      { libelle: 'Pose optimale', trace: r.pose.tOptS },
      { libelle: 'Pose retenue', trace: r.pose.tRecommandeS },
      { libelle: 'Intégration requise', trace: r.integration.tRequisS },
      { libelle: 'Nombre de poses', trace: r.integration.nPoses },
      { libelle: 'Volume de stockage', trace: r.integration.volumeGo },
    ],
    sortie,
    point,
    contexte: {
      verdict: r.detect.verdict,
      typeObjet: saisie.typeObjet,
      cibleImposee: true,
      cadrageRefuse: !r.cadrage.faisable,
      // §7.6 — sous le seuil d'imagerie, le créneau devient un levier chiffré et non une
      // recommandation de principe : l'extinction y double le temps d'intégration.
      hauteurFaible:
        r.hauteurEvaluationDeg !== null &&
        r.hauteurEvaluationDeg < K('SEUIL_HAUTEUR_IMAGERIE_DEG'),
    },
  })
}

/**
 * §7.5 et §10.3 — le conseil filtre et la recommandation d'équipement ne sont calculés qu'à
 * l'ouverture de l'explication. Jamais de bandeau, jamais de suggestion spontanée.
 */
export function conseilsCible(
  contexte: ContexteFiche,
  r: Resultat,
  entree: {
    readonly typeObjet: TypeObjet
    readonly snrCible: number
    readonly filtreDualBand: boolean
    readonly explicationDepliee: boolean
  },
): Conseils | null {
  if (r.pose === null || r.integration === null || r.eObj === null) return null
  const filtres: readonly FamilleFiltre[] = entree.filtreDualBand ? ['DUAL_BAND'] : []
  const filtre = conseilFiltre({
    typeObjet: entree.typeObjet,
    filtresPossedes: filtres,
    bortle: contexte.bortle,
    // §7.5 — la dégradation lunaire déclenche le conseil filtre au même titre que le
    // Bortle : une nébuleuse en émission reste faisable sous Lune gibbeuse avec un
    // bi-bande, et c'est là que ça se dit.
    deltaSbLuneMag: r.lune.evaluee ? r.lune.ciel.delta.value : 0,
    cadragePlanifiable: r.cadrage.faisable,
    explicationDepliee: entree.explicationDepliee,
    eObj: r.eObj.value,
    eCiel: r.eCiel.value,
    tPoseS: r.pose.tRecommandeS.value,
    readNoiseE: r.pose.readNoiseUtiliseE,
    snrCible: entree.snrCible,
    tailleRawMo: contexte.boitier.tailleRawMo,
  })
  return {
    filtre,
    recommandations: recommandationsEquipement({
      conseilFiltre: filtre,
      verdictDefavorable: r.detect.verdict === 'PHOTO_SEULE' || !r.cadrage.faisable,
      explicationDepliee: entree.explicationDepliee,
      leviersPresentes: (r.explique?.leviers ?? []).map((l) => l.code),
      verdictCadrage: r.cadrage.verdict,
      focaleActuelleMm: contexte.focaleMm,
      focaleIdealeMm: r.cadrage.focaleIdealeMm?.value ?? null,
      nTuiles: r.cadrage.nTuiles?.value ?? null,
      regimeLimiteSuivi: r.pose.regime === 'LIMITE_SUIVI',
      suiviActif: contexte.suiviActif,
      tOptS: r.pose.tOptS.value,
      tMaxSuiviS: contexte.tMaxS,
    }),
  }
}
