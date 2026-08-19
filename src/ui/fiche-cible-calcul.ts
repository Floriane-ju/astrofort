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
  dureeLisible,
  fluxCiel,
  fluxE,
  fluxObjet,
  integrationRequiseS,
  planIntegration,
  poseUnitaire,
  type PlanIntegration,
  type PoseUnitaire,
} from '../core/exposure.ts'
import { planCalibration, type PlanCalibration } from '../core/calibration.ts'
import { explication, type Explication } from '../core/explain.ts'
import {
  conseilFiltre,
  recommandationsEquipement,
  type ConseilFiltre,
  type SortieRecommandations,
} from '../core/recommandations.ts'
import type { FamilleFiltre } from '../registry/filters.ts'
import type { ProfilOptique } from '../core/optics.ts'
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
  readonly cadrage: FicheCadrage
  readonly detect: Detectabilite
  readonly eCiel: Traced<number>
  readonly eObj: Traced<number> | null
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

export function evalue(
  contexte: ContexteFiche,
  saisie: SaisieCible,
  snrCible: number,
  iso: IsoRetenu,
): Resultat {
  const fovHDeg = contexte.optique.fovHDeg.value
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
    sbCiel: contexte.sbCiel,
    mLimOeil: contexte.mLimOeil,
    dMm: contexte.optique.dMm.value,
  })

  const zpEstime = contexte.zeroSysteme.estime
  const eCiel = fluxCiel({
    sbMagArcsec2: contexte.sbCiel,
    zpSys: contexte.zeroSysteme.valeur,
    pitchUm: contexte.pitchUm,
    ouvertureN: contexte.ouvertureN,
    zpEstime,
  })

  const sbObj = detect.sbObj.value
  if (sbObj === null) {
    return { domaine, cadrage, detect, eCiel, eObj: null, pose: null, integration: null, calibration: null, explique: null }
  }

  const eObj = fluxObjet({
    sbMagArcsec2: sbObj,
    zpSys: contexte.zeroSysteme.valeur,
    pitchUm: contexte.pitchUm,
    ouvertureN: contexte.ouvertureN,
    zpEstime,
  })

  const pose = poseUnitaire({
    eCiel: eCiel.value,
    readNoiseE: iso.readNoiseE,
    tMaxS: contexte.tMaxS,
    zpEstime,
  })

  const integration = planIntegration({
    eObj: eObj.value,
    eCiel: eCiel.value,
    tPoseS: pose.tRecommandeS.value,
    readNoiseE: pose.readNoiseUtiliseE,
    snrCible,
    tailleRawMo: contexte.boitier.tailleRawMo,
  })

  const calibration = planCalibration({
    tPoseS: pose.tAfficheeS,
    iso: iso.iso,
    nPoses: integration.nPoses.value,
    autoguidage: false,
  })

  return {
    domaine,
    cadrage,
    detect,
    eCiel,
    eObj,
    pose,
    integration,
    calibration,
    explique: expliqueVerdict(contexte, saisie, snrCible, {
      cadrage,
      detect,
      eCiel,
      eObj,
      pose,
      integration,
      sbObj,
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
    readonly pose: PoseUnitaire
    readonly integration: PlanIntegration
    readonly sbObj: number
  },
): Explication {
  const point = {
    sb_obj: r.sbObj,
    sb_ciel: contexte.sbCiel,
    t_pose_s: r.pose.tRecommandeS.value,
    read_noise_e: r.pose.readNoiseUtiliseE,
    snr_cible: snrCible,
  }
  const sortie = (v: Readonly<Record<string, number>>): number =>
    integrationRequiseS(
      {
        eObj: fluxE(v.sb_obj!, contexte.zeroSysteme.valeur, contexte.pitchUm, contexte.ouvertureN),
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
    // La fiche évalue une cible hors contexte de nuit : la Lune est portée par le plan
    // de session (§8.1), pas ici. Seul le fond de ciel déclaré déclenche le conseil.
    deltaSbLuneMag: 0,
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
