/**
 * §7 et §8 — la chaîne de calcul de l'application, d'un lieu et d'un matériel jusqu'au plan
 * de la nuit.
 *
 * Rien n'est dessiné ici : chaque sortie est mémoïsée et distribuée aux régions de la coque.
 * Une saisie refusée ou un domaine dépassé nomme sa cause plutôt que de faire tomber
 * l'application (§12.5).
 */

import { useMemo } from 'react'
import { fenetreNocturne, offsetMidiSolaireMin, type FenetreNocturne } from '../core/night.ts'
import { fenetreUtile as calculeFenetreUtile, type FenetreUtile } from '../core/moon.ts'
import {
  planSession,
  type ContexteSession,
  type PlanSession,
  type PoidsScoring,
} from '../core/session.ts'
import {
  masqueDepuisPoints,
  masquePlat,
  seuilsDeclinaison,
  type MasqueHorizon,
  type SeuilsSite,
} from '../core/site.ts'
import {
  FondDeCielIndeterminableError,
  fondDeCiel,
  type FondDeCiel,
} from '../core/sky-background.ts'
import { profilOptique, type ProfilOptique } from '../core/optics.ts'
import { verdictDomaine, type VerdictDomaine } from '../core/framing.ts'
import { fluxCiel } from '../core/exposure.ts'
import { construitIndex, type IndexCiel } from '../core/index-ciel.ts'
import type { EntreeProfondeur } from '../core/galactique.ts'
import { npf, profilSuivi, type ProfilSuivi } from '../core/tracking.ts'
import { BortleHorsTableError } from '../registry/bortle.ts'
import { SaisieRefuseeError, valide } from '../registry/domains.ts'
import { HorsDomaineSeriesError, type Site } from '../core/ephem.ts'
import type { ProfilCadre } from '../core/cadre.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Etoile } from '../data/catalog.ts'
import {
  capteurEffectif,
  isoRecommande,
  pointZeroSysteme,
  resoutBoitier,
  type Boitier,
  type CapteurEffectif,
  type CapteurMode,
  type IsoRetenu,
  type PointZeroSysteme,
} from '../data/equipment.ts'
import { K } from '../registry/constants.ts'
import type { Traced } from '../core/traced.ts'
import { modeObjectif } from './PanneauMateriel.tsx'
import type { SaisieLieu, SaisieMateriel } from './app-saisie.ts'
import type { MaterielFile } from './planetarium-materiel.ts'
import type { ContexteFiche } from './fiche-cible-calcul.ts'
import type { PanneauFileProps } from './PanneauFile.tsx'

/** Objectif de qualité retenu pour le plan de la nuit : « correct » au sens de §7.3. */
const PRESET_SNR_PLAN = 10

/**
 * T-0149 — ce que le LIEU et la DATE donnent, sans rien savoir du matériel.
 *
 * Séparé de `Calcul` parce que les deux tombent pour des raisons différentes : une focale
 * effacée en cours de frappe ne rend pas la nuit incalculable, et la scène n'a besoin que
 * de ce bloc-ci pour se dessiner (§12.5).
 */
export type CalculCiel =
  | {
      readonly ok: true
      readonly nuit: FenetreNocturne
      readonly ciel: FondDeCiel
      readonly seuils: SeuilsSite
      readonly offsetMidi: Traced<number>
    }
  | { readonly ok: false; readonly erreur: string }

/** §5.1, §5.2 et §9.1 — ce que le MATÉRIEL déclaré produit, ou la cause de son refus. */
export type Calcul =
  | {
      readonly ok: true
      readonly optique: ProfilOptique
      readonly suivi: ProfilSuivi
      readonly poseNpf: Traced<number | null>
      readonly capteur: CapteurEffectif
      readonly ouvertureN: number
      /** §5.1 — le boîtier retenu : celui de la base, ou celui que la saisie décrit. */
      readonly boitier: Boitier
      readonly zeroSysteme: PointZeroSysteme
      readonly iso: IsoRetenu
      /** Grandeurs remplacées par un générique du registre : la sortie porte [ESTIMÉ]. */
      readonly estimations: readonly string[]
      readonly noteRecadrage?: string
    }
  | { readonly ok: false; readonly erreur: string }

export interface ChaineCalcul {
  readonly calcul: Calcul
  /** T-0149 — le ciel du site : il se calcule même quand le matériel est incomplet. */
  readonly ciel: CalculCiel
  readonly site: Site
  readonly masque: MasqueHorizon
  readonly fenetreUtile: FenetreUtile | null
  /** Index de sélection : construit une fois, lu par la scène et par l'onglet Explorer. */
  readonly index: IndexCiel
  readonly profilsCadre: readonly ProfilCadre[]
  /** Absent quand le matériel n'est pas chiffrable : la scène n'incruste alors rien. */
  readonly materielFile: MaterielFile | null
  /** §8.3 — le contexte de la nuit, partagé par le plan de séance et la liste du catalogue. */
  readonly contexteSession: ContexteSession | null
  readonly plan: PlanSession | null
  /** Le matériel et le ciel sous lesquels la fiche évalue une cible (§6, §7). */
  readonly contexteFiche: ContexteFiche | null
  /**
   * §6.1 — ce que ce setup cadre. Sortie du MATÉRIEL et du catalogue, pas d'une cible : elle
   * se lit dès que l'optique est chiffrable, avant qu'aucun objet ne soit désigné.
   */
  readonly domaineCadrage: VerdictDomaine | null
  readonly panneauFile: PanneauFileProps | null
}

export interface EntreeChaine {
  readonly lieu: SaisieLieu
  readonly materiel: SaisieMateriel
  readonly catalogue: readonly ObjetCielProfond[]
  readonly etoiles: readonly Etoile[]
  /** §9.2 — la pose unitaire du filé, réglée dans le panneau du même nom. */
  readonly tPoseFileS: number
  /** §8.3 — les poids C-15 tels qu'ils sont réglés ; le moteur les normalise. */
  readonly poids: PoidsScoring
}

export function useChaineCalcul(entree: EntreeChaine): ChaineCalcul {
  const { lieu, materiel, catalogue, etoiles, tPoseFileS, poids } = entree

  /**
   * §4.1 — le relief relevé à la main l'emporte sur toute hypothèse. Sans relevé, le masque
   * plat [HYP] reste le repli documenté de la matrice de dégradation §12.5 : aucune source de
   * relief n'est disponible hors réseau ni au premier démarrage.
   *
   * Une saisie hors domaine ne fait pas tomber la chaîne : elle est refusée à la saisie, dans
   * le panneau, et le masque garde son état précédent.
   */
  const masque: MasqueHorizon = useMemo(() => {
    try {
      return masqueDepuisPoints(lieu.pointsMasque)
    } catch {
      return masquePlat()
    }
  }, [lieu.pointsMasque])

  const site = useMemo(
    () => ({
      latitudeDeg: Number(lieu.latitude),
      longitudeDeg: Number(lieu.longitude),
      altitudeM: Number(lieu.altitude),
    }),
    [lieu.latitude, lieu.longitude, lieu.altitude],
  )

  const ciel = useMemo(
    () => evalueCiel(site, lieu),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, lieu.bortle, lieu.sqm, lieu.dateIso],
  )

  const calcul = useMemo(
    () => evalueMateriel(materiel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      materiel.boitier,
      materiel.iso,
      materiel.focale,
      materiel.ouverture,
      materiel.capteurMode,
      materiel.suiviActif,
      materiel.qualiteMes,
      materiel.typeMonture,
    ],
  )

  const fenetreUtile = useMemo(
    () => (ciel.ok ? calculeFenetreUtile(site, ciel.nuit) : null),
    [ciel, site],
  )

  const index = useMemo(() => construitIndex(etoiles), [etoiles])

  /**
   * §3.5 — profils de cadre superposés. Le second profil matérialise l'effet du recadrage
   * de capteur, que §5.1 explique en mots : cadre plus serré, échantillonnage inchangé.
   */
  const profilsCadre = useMemo(
    () => profilsDeCadre(calcul, materiel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calcul, materiel.focale, materiel.ouverture, materiel.capteurMode, materiel.comparerRecadrage],
  )

  /**
   * §9.2 — profondeur atteinte par la pose unitaire. Assemblée ici parce que deux régions en
   * dépendent : le panneau du filé, qui la chiffre, et la scène, qui l'incruste dans le cadre.
   */
  const profondeurFile: EntreeProfondeur | null = useMemo(() => {
    if (!calcul.ok || !ciel.ok) return null
    return {
      tPoseS: tPoseFileS,
      dMm: calcul.optique.dMm.value,
      zpSys: calcul.zeroSysteme.valeur,
      eCielPxS: fluxCiel({
        sbMagArcsec2: ciel.ciel.sbCiel.value,
        zpSys: calcul.zeroSysteme.valeur,
        pitchUm: calcul.capteur.pitchUm,
        ouvertureN: calcul.ouvertureN,
        zpEstime: calcul.zeroSysteme.estime,
      }).value,
      readNoiseE: calcul.iso.readNoiseE ?? K('READ_NOISE_DEFAUT_E'),
      zpEstime: calcul.zeroSysteme.estime,
    }
  }, [calcul, ciel, tPoseFileS])

  /**
   * Ce que la scène doit savoir du filé pour l'incruster dans le cadre.
   *
   * Mémoïsée, et pas assemblée dans le JSX : l'incrustation republie ses compteurs de rendu
   * dans le magasin de séance, ce qui rend l'application. Une identité neuve à chaque rendu
   * relancerait donc l'incrustation, qui republierait, sans fin.
   */
  const materielFile = useMemo(() => {
    if (!calcul.ok || !ciel.ok || profondeurFile === null) return null
    return {
      optique: {
        focaleMm: Number(materiel.focale),
        ouvertureN: calcul.ouvertureN,
        pitchUm: calcul.capteur.pitchUm,
      },
      profondeur: profondeurFile,
      echApx: calcul.optique.echApx.value,
      sbCiel: ciel.ciel.sbCiel.value,
      tMaxSuiviS: calcul.suivi.tMaxSuiviS.value,
    }
  }, [calcul, ciel, profondeurFile, materiel.focale])

  /**
   * §8.3 — le ciel, le site et le matériel sous lesquels une cible est évaluée pour la nuit.
   *
   * Mémoïsé à part du plan parce que DEUX écrans s'en servent : le plan de séance et la liste
   * du catalogue (§6.4). Un second contexte assemblé ailleurs annoncerait tôt ou tard une
   * autre pose pour la même cible — le désaccord que T-0089 a corrigé une fois.
   */
  const contexteSession = useMemo<ContexteSession | null>(() => {
    if (!calcul.ok || !ciel.ok || fenetreUtile === null) return null
    return {
        site,
        nuit: ciel.nuit,
        fenetreUtile,
        masque,
        fovHDeg: calcul.optique.fovHDeg.value,
        echApx: calcul.optique.echApx.value,
        dMm: calcul.optique.dMm.value,
        capteurHMm: calcul.capteur.capteurHMm,
        pitchUm: calcul.capteur.pitchUm,
        ouvertureN: calcul.ouvertureN,
        zpSys: calcul.zeroSysteme.valeur,
        zpEstime: calcul.zeroSysteme.estime,
        readNoiseE: calcul.iso.readNoiseE,
        tailleRawMo: calcul.boitier.tailleRawMo,
        isoSession: calcul.iso.iso,
        sbCielNoir: ciel.ciel.sbCiel.value,
        mLimOeil: ciel.ciel.mLimOeil.value,
        tMaxS: calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value,
        snrCible: PRESET_SNR_PLAN,
        typeMonture: materiel.typeMonture,
        poids,
    }
  }, [calcul, ciel, masque, materiel.typeMonture, site, fenetreUtile, poids])

  const plan = useMemo(() => {
    if (contexteSession === null || catalogue.length === 0) return null
    return planSession(contexteSession, catalogue)
  }, [contexteSession, catalogue])

  const domaineCadrage = useMemo(
    () => (calcul.ok ? verdictDomaine(calcul.optique.fovHDeg.value, catalogue) : null),
    [calcul, catalogue],
  )

  return {
    calcul,
    ciel,
    site,
    masque,
    fenetreUtile,
    index,
    profilsCadre,
    materielFile,
    contexteSession,
    plan,
    contexteFiche:
      calcul.ok && ciel.ok ? contexteFiche(calcul, ciel, materiel, lieu) : null,
    domaineCadrage,
    panneauFile:
      calcul.ok && profondeurFile !== null
        ? panneauFile(calcul, materiel, site, profondeurFile)
        : null,
  }
}

/** §4.1 et §2.2 — ce que le lieu et la date donnent, ou la cause du refus. */
export function evalueCiel(site: Site, lieu: SaisieLieu): CalculCiel {
  try {
    // Départ à midi UTC : la recherche du coucher part de là.
    const depart = new Date(`${lieu.dateIso}T12:00:00Z`)
    const offsetFuseauH = -new Date().getTimezoneOffset() / 60
    return {
      ok: true,
      nuit: fenetreNocturne(site, depart),
      ciel: fondDeCiel({
        ...(lieu.sqm.trim() === '' ? {} : { sqmMesure: Number(lieu.sqm) }),
        ...(lieu.bortle.trim() === '' ? {} : { bortleDeclare: Number(lieu.bortle) }),
      }),
      seuils: seuilsDeclinaison(site.latitudeDeg),
      offsetMidi: offsetMidiSolaireMin(site.longitudeDeg, offsetFuseauH),
    }
  } catch (erreur) {
    return refus(erreur)
  }
}

/**
 * §5.1, §5.2 et §9.1 — ce que le matériel déclaré produit, ou la cause du refus.
 *
 * T-0149 — le lieu n'entre plus ici. Une focale effacée le temps de la retaper refusait
 * jusqu'à la nuit et au fond de ciel, et la scène disparaissait avec eux.
 */
export function evalueMateriel(materiel: SaisieMateriel): Calcul {
  try {
    const { boitier, estimations } = resoutBoitier(materiel.boitier)
    const capteur = capteurEffectif(boitier, materiel.capteurMode)
    const focaleMm = Number(materiel.focale)
    const ouvertureN = Number(materiel.ouverture)
    const isoChoisi = materiel.iso.trim() === '' ? null : valide('iso_capture', Number(materiel.iso))
    return {
      ok: true,
      optique: profilOptique({ focaleMm, ouvertureN, ...capteur }),
      suivi: profilSuivi({
        suiviActif: materiel.suiviActif,
        qualiteMes: materiel.qualiteMes,
        typeMonture: materiel.typeMonture,
        focaleMm,
      }),
      // §9.1 — la NPF reste affichée même avec suivi, à titre informatif. Déclinaison 0 :
      // c'est la zone la plus contraignante du ciel, la carte par cellule vient au lot 5.
      poseNpf: npf({ focaleMm, ouvertureN, pitchUm: capteur.pitchUm, decDeg: 0 }),
      capteur,
      ouvertureN,
      boitier,
      zeroSysteme: pointZeroSysteme(boitier),
      iso: isoRecommande(boitier, isoChoisi),
      estimations,
      ...(capteur.noteRecadrage === undefined ? {} : { noteRecadrage: capteur.noteRecadrage }),
    }
  } catch (erreur) {
    return refus(erreur)
  }
}

/** Saisie refusée ou domaine dépassé : la cause est nommée, pas avalée. */
function refus(erreur: unknown): { readonly ok: false; readonly erreur: string } {
  if (
    erreur instanceof BortleHorsTableError ||
    erreur instanceof FondDeCielIndeterminableError ||
    erreur instanceof HorsDomaineSeriesError ||
    erreur instanceof SaisieRefuseeError
  ) {
    return { ok: false, erreur: erreur.message }
  }
  throw erreur
}

function profilsDeCadre(calcul: Calcul, materiel: SaisieMateriel): readonly ProfilCadre[] {
  if (!calcul.ok) return []
  const boitier = calcul.boitier
  const focaleMm = Number(materiel.focale)
  const ouvertureN = Number(materiel.ouverture)
  const autre: CapteurMode = materiel.capteurMode === 'FULL_FRAME' ? 'APSC_CROP' : 'FULL_FRAME'
  const modes: readonly CapteurMode[] = materiel.comparerRecadrage
    ? [materiel.capteurMode, autre]
    : [materiel.capteurMode]
  const tPoseS = calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value
  return modes.map((m) => {
    const capteur = capteurEffectif(boitier, m)
    const optique = profilOptique({ focaleMm, ouvertureN, ...capteur })
    return {
      libelle: `${focaleMm} mm f/${ouvertureN} — ${m === 'FULL_FRAME' ? 'plein format' : 'recadrage APS-C'}`,
      fovLDeg: optique.fovLDeg.value,
      fovHDeg: optique.fovHDeg.value,
      echApx: optique.echApx.value,
      capteurHMm: capteur.capteurHMm,
      tPoseS,
    }
  })
}

function contexteFiche(
  calcul: Calcul & { ok: true },
  ciel: CalculCiel & { ok: true },
  materiel: SaisieMateriel,
  lieu: SaisieLieu,
): ContexteFiche {
  return {
    optique: calcul.optique,
    capteurHMm: calcul.capteur.capteurHMm,
    pitchUm: calcul.capteur.pitchUm,
    ouvertureN: calcul.ouvertureN,
    boitier: calcul.boitier,
    zeroSysteme: calcul.zeroSysteme,
    iso: calcul.iso,
    sbCiel: ciel.ciel.sbCiel.value,
    mLimOeil: ciel.ciel.mLimOeil.value,
    // Sans suivi, c'est la NPF qui plafonne la pose (§9.1) — jamais rien.
    tMaxS: calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value,
    bortle: lieu.bortle.trim() === '' ? null : Number(lieu.bortle),
    suiviActif: materiel.suiviActif,
    focaleMm: Number(materiel.focale),
  }
}

function panneauFile(
  calcul: Calcul & { ok: true },
  materiel: SaisieMateriel,
  site: Site,
  profondeur: EntreeProfondeur,
): PanneauFileProps {
  return {
    site,
    focaleMm: Number(materiel.focale),
    ouvertureN: calcul.ouvertureN,
    pitchUm: calcul.capteur.pitchUm,
    capteurLMm: calcul.capteur.capteurLMm,
    capteurHMm: calcul.capteur.capteurHMm,
    fovLDeg: calcul.optique.fovLDeg.value,
    fovHDeg: calcul.optique.fovHDeg.value,
    echApx: calcul.optique.echApx.value,
    tailleRawMo: calcul.boitier.tailleRawMo,
    profondeur,
    tMaxSuiviS: calcul.suivi.tMaxSuiviS.value,
    zeroSysteme: calcul.zeroSysteme,
    modeObjectif: modeObjectif(materiel.typeObjectif),
  }
}
