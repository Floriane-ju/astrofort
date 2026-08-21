/**
 * T-0089 — la fiche cible compte la Lune comme le plan de séance (§8.1, §6.3, §7.5).
 *
 * Ce que ce fichier interdit de régresser : deux écrans qui évaluent la même cible la même
 * nuit ne doivent pas annoncer deux poses. La fiche appelait `detectabilite()` sans la Lune,
 * sur le fond de ciel noir du site — elle dosait donc une nuit sans Lune, quelle que soit la
 * nuit. Le test compare les deux chemins sur la même entrée et échoue s'ils divergent.
 *
 * Aucune éphéméride n'est écrite ici : la nuit de Lune est CHERCHÉE à l'exécution, et les
 * valeurs attendues sont celles que le moteur du plan produit sur la même entrée.
 */

import { describe, expect, it } from 'vitest'
import { integrationRequiseS } from '../src/core/exposure.ts'
import { fenetreNocturne } from '../src/core/night.ts'
import { etatLune, fenetreUtile } from '../src/core/moon.ts'
import { masquePlat } from '../src/core/site.ts'
import { instantLune } from '../src/core/session-candidates.ts'
import { planSession, type ContexteSession, type EtapePlan } from '../src/core/session.ts'
import { profilOptique } from '../src/core/optics.ts'
import {
  BOITIER_REFERENCE,
  capteurEffectif,
  isoRecommande,
  pointZeroSysteme,
} from '../src/data/equipment.ts'
import type { ObjetCielProfond, TypeObjet } from '../src/data/deepsky.ts'
import type { Site } from '../src/core/ephem.ts'
import {
  conseilsCible,
  evalue,
  type ContexteFiche,
  type LuneFiche,
  type SaisieCible,
} from '../src/ui/fiche-cible-calcul.ts'
import { lunePourCible } from '../src/ui/fiche-cible-lune.ts'

/** Annexe A : site de référence, et le setup grand champ 120 mm f/2,8 sur plein format. */
const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const CAPTEUR = capteurEffectif(BOITIER_REFERENCE, 'FULL_FRAME')
const OPTIQUE = profilOptique({ focaleMm: 120, ouvertureN: 2.8, ...CAPTEUR })
const ZERO = pointZeroSysteme(BOITIER_REFERENCE)
const ISO = isoRecommande(BOITIER_REFERENCE)
const SB_CIEL_NOIR = 20.95
const M_LIM_OEIL = 6.05
const T_MAX_S = 200
/** L'objectif de qualité du plan de la nuit : la fiche doit être interrogée sur le même. */
const SNR_PLAN = 10

const NGC7000: ObjetCielProfond = {
  designation: 'NGC7000',
  nomsCommuns: 'Amérique du Nord',
  adDeg: 314.75,
  decDeg: 44.52,
  type: 'EMISSION',
  majAxArcmin: 120,
  minAxArcmin: 100,
  posAngDeg: null,
  vMag: 4,
  bMag: null,
  surfBr: null,
}

const CATALOGUE: readonly ObjetCielProfond[] = [NGC7000]

function contexteSession(dateIso: string): ContexteSession {
  const nuit = fenetreNocturne(SITE, new Date(`${dateIso}T12:00:00Z`))
  return {
    site: SITE,
    nuit,
    fenetreUtile: fenetreUtile(SITE, nuit),
    masque: masquePlat(),
    fovHDeg: OPTIQUE.fovHDeg.value,
    echApx: OPTIQUE.echApx.value,
    dMm: OPTIQUE.dMm.value,
    capteurHMm: CAPTEUR.capteurHMm,
    pitchUm: CAPTEUR.pitchUm,
    ouvertureN: 2.8,
    zpSys: ZERO.valeur,
    zpEstime: ZERO.estime,
    readNoiseE: ISO.readNoiseE,
    tailleRawMo: BOITIER_REFERENCE.tailleRawMo,
    isoSession: ISO.iso,
    sbCielNoir: SB_CIEL_NOIR,
    mLimOeil: M_LIM_OEIL,
    tMaxS: T_MAX_S,
    snrCible: SNR_PLAN,
    typeMonture: 'TRACKER',
    niveau: 'CONFIRME',
  }
}

/**
 * Le fond de ciel que le plan emploie avant la Lune : le ciel noir du site, moins la
 * pénalité de crépuscule de la nuit (§2.2). La fiche est interrogée sur celui-là, pour que
 * la seule différence testée soit la Lune.
 */
function sbCielBase(contexte: ContexteSession): number {
  return contexte.sbCielNoir - contexte.nuit.penaliteSbMag
}

function contexteFiche(sbCiel: number): ContexteFiche {
  return {
    optique: OPTIQUE,
    capteurHMm: CAPTEUR.capteurHMm,
    pitchUm: CAPTEUR.pitchUm,
    ouvertureN: 2.8,
    boitier: BOITIER_REFERENCE,
    zeroSysteme: ZERO,
    iso: ISO,
    sbCiel,
    mLimOeil: M_LIM_OEIL,
    tMaxS: T_MAX_S,
    catalogue: CATALOGUE,
    // Bortle 4 : sous le seuil C-22 du conseil filtre. Ce qui déclenche le conseil dans ce
    // fichier ne peut donc être que la Lune.
    bortle: 4,
    suiviActif: true,
    focaleMm: 120,
  }
}

/** Les champs de la fiche, garnis depuis le catalogue comme `fiche-cible-saisie` le fait. */
function saisieDe(objet: ObjetCielProfond, typeObjet: TypeObjet = objet.type): SaisieCible {
  return {
    typeObjet,
    mInt: String(objet.vMag),
    aArcmin: String(objet.majAxArcmin),
    bArcmin: String(objet.minAxArcmin),
    posAngDeg: '',
  }
}

/**
 * Première nuit, à partir du 1er août 2026, où le plan retient la cible sous une Lune qui
 * dégrade réellement le fond de ciel. Cherchée plutôt qu'écrite : une date recopiée serait
 * une éphéméride en dur, et le test la vérifierait contre elle-même.
 */
function nuitAvecLune(): { readonly contexte: ContexteSession; readonly etape: EtapePlan } {
  for (let jour = 1; jour <= 30; jour += 1) {
    const contexte = contexteSession(`2026-08-${String(jour).padStart(2, '0')}`)
    const etape = planSession(contexte, CATALOGUE).etapes[0]
    if (etape !== undefined && etape.deltaSbLuneMag.value > 0) return { contexte, etape }
  }
  throw new Error('Aucune nuit de Lune trouvée sur le mois : le moteur lunaire ne répond plus.')
}

describe('T-0089 — la fiche et le plan dosent la même nuit', () => {
  const { contexte, etape } = nuitAvecLune()
  const instant = instantLune(etape.creneau, etape.creneauAlloue.debut)
  const sbBase = sbCielBase(contexte)
  const lune = lunePourCible({ site: SITE, instant, objet: etape.objet, sbCielNoirMag: sbBase })
  const fiche = evalue(contexteFiche(sbBase), saisieDe(etape.objet), SNR_PLAN, ISO, lune)

  it('emploie le même deltaSbLune que le plan, au même instant et sur la même cible', () => {
    expect(lune.evaluee).toBe(true)
    expect(lune.evaluee && lune.ciel.delta.value).toBeCloseTo(etape.deltaSbLuneMag.value, 12)
    expect(fiche.sbCielEffectif).toBeCloseTo(etape.sbCielEffectif, 12)
  })

  it('annonce la même pose unitaire que le plan : le fond de ciel est le même', () => {
    // La pose ne dépend que du flux de fond de ciel : c'est la garantie de T-0089, et §7.6
    // ne la touche pas — l'extinction porte sur l'objet, jamais sur le ciel.
    expect(fiche.pose?.tRecommandeS.value).toBeCloseTo(etape.pose.tRecommandeS.value, 12)
  })

  /**
   * T-0090 — les deux écrans n'éteignent PAS la cible à la même hauteur, et c'est voulu : la
   * fiche n'a pas de créneau, elle chiffre la culmination ; le plan en a un, et chiffre la
   * masse d'air moyenne de la capture. La fiche annonce donc un plancher.
   *
   * Ce test garde fermé le défaut réel : que les deux divergent pour une AUTRE raison que la
   * masse d'air. Il rejoue l'intégration du plan avec la masse d'air de la fiche et exige
   * l'égalité exacte.
   */
  it('ne diverge du plan que par la masse d’air, et jamais dans le mauvais sens', () => {
    const extinctionPlan = etape.extinction
    const extinctionFiche = fiche.extinction
    expect(extinctionFiche).not.toBeNull()

    const masseAirPlan = extinctionPlan.masseAir.value!
    const masseAirFiche = extinctionFiche!.masseAir.value!
    // La moyenne du créneau n'est jamais sous la masse d'air de la culmination.
    expect(masseAirPlan).toBeGreaterThanOrEqual(masseAirFiche)
    expect(fiche.integration!.tRequisS.value).toBeLessThanOrEqual(etape.integration.tRequisS.value)

    const inputsPlan = etape.integration.tRequisS.inputs
    const eObjSansExtinction = extinctionPlan.eObjReel.value! / extinctionPlan.attenuation.value!
    const rejoue = integrationRequiseS(
      {
        eObj: eObjSansExtinction * extinctionFiche!.attenuation.value!,
        eCiel: inputsPlan.e_ciel!,
        tPoseS: inputsPlan.t_pose_s!,
        readNoiseE: inputsPlan.read_noise_e!,
        snrCible: SNR_PLAN,
        tailleRawMo: BOITIER_REFERENCE.tailleRawMo,
      },
      SNR_PLAN,
    )
    expect(fiche.integration!.tRequisS.value).toBeCloseTo(rejoue, 9)
  })

  it('divergerait si la fiche ignorait la Lune — c’est le défaut que ce test garde fermé', () => {
    const ignoree: LuneFiche = { evaluee: false, cause: 'Lune ignorée, comme avant T-0089.' }
    const sansLune = evalue(contexteFiche(sbBase), saisieDe(etape.objet), SNR_PLAN, ISO, ignoree)
    expect(sansLune.integration?.tRequisS.value).not.toBeCloseTo(
      etape.integration.tRequisS.value,
      6,
    )
  })

  it('nomme l’instant auquel la Lune a été évaluée : la fiche n’a pas de créneau', () => {
    expect(lune.evaluee && lune.instant.getTime()).toBe(instant.getTime())
  })
})

describe('§6.3 — une Lune sous l’horizon ne dégrade rien, et la fiche le dit', () => {
  /** Premier instant de la nuit où la Lune est couchée, cherché heure par heure. */
  function instantSansLune(): Date {
    const nuit = fenetreNocturne(SITE, new Date('2026-08-01T12:00:00Z'))
    const depart = nuit.debutReference ?? new Date('2026-08-01T22:00:00Z')
    for (let heures = 0; heures < 24; heures += 1) {
      const essai = new Date(depart.getTime() + heures * 3600_000)
      if (etatLune(SITE, essai).sousHorizon) return essai
    }
    throw new Error('Lune levée 24 h d’affilée : impossible à cette latitude.')
  }

  const instant = instantSansLune()
  const lune = lunePourCible({
    site: SITE,
    instant,
    objet: NGC7000,
    sbCielNoirMag: SB_CIEL_NOIR,
  })
  const fiche = evalue(contexteFiche(SB_CIEL_NOIR), saisieDe(NGC7000), SNR_PLAN, ISO, lune)

  it('laisse le fond de ciel intact, quelle que soit la phase', () => {
    expect(lune.evaluee && lune.ciel.delta.value).toBe(0)
    expect(fiche.sbCielEffectif).toBe(SB_CIEL_NOIR)
  })

  it('l’annonce explicitement plutôt que de pénaliser la cible', () => {
    expect(fiche.detect.noteLune).toMatch(/sous l’horizon/)
    expect(fiche.detect.noteLune).toMatch(/n’est pénalisée d’aucune façon/)
  })
})

describe('§6.3 et §7.5 — la même Lune ne pénalise pas tous les types de la même façon', () => {
  const { contexte, etape } = nuitAvecLune()
  const sbBase = sbCielBase(contexte)
  const lune = lunePourCible({
    site: SITE,
    instant: instantLune(etape.creneau, etape.creneauAlloue.debut),
    objet: etape.objet,
    sbCielNoirMag: sbBase,
  })

  function conseilPour(typeObjet: TypeObjet) {
    const ctx = contexteFiche(sbBase)
    const saisie = saisieDe(etape.objet, typeObjet)
    const r = evalue(ctx, saisie, SNR_PLAN, ISO, lune)
    return {
      r,
      conseils: conseilsCible(ctx, r, {
        typeObjet,
        snrCible: SNR_PLAN,
        filtreDualBand: false,
        explicationDepliee: true,
      }),
    }
  }

  const emission = conseilPour('EMISSION')
  const galaxie = conseilPour('GALAXIE')

  it('porte la tolérance lunaire du type d’objet dans la fiche', () => {
    expect(emission.r.detect.toleranceLune).toBe('FORTE')
    expect(galaxie.r.detect.toleranceLune).toBe('FAIBLE')
    expect(emission.r.detect.noteLune).toMatch(/FORTE/)
    expect(galaxie.r.detect.noteLune).toMatch(/FAIBLE/)
  })

  it('déclenche le conseil bi-bande sur la nébuleuse en émission, par la Lune et non par le Bortle', () => {
    expect(lune.evaluee && lune.ciel.delta.value).toBeGreaterThan(0)
    expect(emission.conseils?.filtre.declenche).toBe(true)
    expect(emission.conseils?.filtre.message).toMatch(/reste planifiable sans filtre/)
  })

  it('n’émet aucun conseil filtre sur la galaxie : aucun filtre n’aide un spectre continu', () => {
    expect(galaxie.conseils?.filtre.declenche).toBe(false)
    expect(galaxie.conseils?.filtre.message).toMatch(/spectre continu/)
  })
})

describe('T-0089 — une cible sans coordonnées ne se voit pas inventer une Lune', () => {
  const lune = lunePourCible({
    site: SITE,
    instant: new Date('2026-08-01T22:00:00Z'),
    objet: null,
    sbCielNoirMag: SB_CIEL_NOIR,
  })
  const fiche = evalue(contexteFiche(SB_CIEL_NOIR), saisieDe(NGC7000), SNR_PLAN, ISO, lune)

  it('garde le fond de ciel du site et nomme la cause plutôt que de deviner', () => {
    expect(lune.evaluee).toBe(false)
    expect(!lune.evaluee && lune.cause).toMatch(/sans coordonnées/)
    expect(fiche.sbCielEffectif).toBe(SB_CIEL_NOIR)
  })

  it('ne produit alors aucune note lunaire : rien n’a été évalué', () => {
    expect(fiche.detect.noteLune).toBeUndefined()
  })
})
