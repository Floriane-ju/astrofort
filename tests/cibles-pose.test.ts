/**
 * §6.4 — la pose annoncée par la liste du catalogue est celle du plan de séance.
 *
 * C'est le seul point qui compte ici, et c'est une anti-régression : deux écrans qui dosent
 * la même cible avec deux conventions d'extinction annoncent deux poses différentes pour la
 * même nuit. T-0089 a corrigé ce désaccord une fois entre la fiche et le plan ; réemployer
 * `evalueCandidate` est ce qui empêche la liste de le réintroduire.
 *
 * Aucun temps n'est écrit en dur : le test compare deux sorties de moteur.
 */

import { describe, expect, it } from 'vitest'
import { posesRequises } from '../src/core/cibles-liste.ts'
import { detectabilite } from '../src/core/detectability.ts'
import { DOMAINES } from '../src/registry/domains.ts'
import { fenetreNocturne } from '../src/core/night.ts'
import { fenetreUtile } from '../src/core/moon.ts'
import { masquePlat } from '../src/core/site.ts'
import { planSession, type ContexteSession } from '../src/core/session.ts'
import { K } from '../src/registry/constants.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'

const SITE = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const NUIT = fenetreNocturne(SITE, new Date('2026-08-14T12:00:00Z'))

/** Setup ciel profond de l'Annexe A : 120 mm f/2,8 sur plein format. */
const CONTEXTE: ContexteSession = {
  site: SITE,
  nuit: NUIT,
  fenetreUtile: fenetreUtile(SITE, NUIT),
  masque: masquePlat(),
  fovHDeg: 11.38,
  echApx: 8.8,
  dMm: 42.9,
  capteurHMm: 23.9,
  pitchUm: 5.12,
  ouvertureN: 2.8,
  zpSys: 20.2,
  zpEstime: true,
  readNoiseE: 1.5,
  tailleRawMo: 33,
  isoSession: 640,
  sbCielNoir: 20.95,
  mLimOeil: 6.05,
  tMaxS: 200,
  snrCible: 10,
  typeMonture: 'TRACKER',
  niveau: 'CONFIRME',
}

function objet(surcharge: Partial<ObjetCielProfond>): ObjetCielProfond {
  return {
    designation: 'TEST',
    nomsCommuns: '',
    adDeg: 314.75,
    decDeg: 44.52,
    type: 'EMISSION',
    majAxArcmin: 120,
    minAxArcmin: 100,
    posAngDeg: null,
    vMag: 4,
    bMag: null,
    surfBr: null,
    ...surcharge,
  }
}

const CATALOGUE: readonly ObjetCielProfond[] = [
  objet({ designation: 'NGC7000', nomsCommuns: 'Amérique du Nord' }),
  objet({ designation: 'M31', adDeg: 10.68, decDeg: 41.27, type: 'GALAXIE', majAxArcmin: 190, minAxArcmin: 60, vMag: 3.4 }),
  objet({ designation: 'M27', adDeg: 299.9, decDeg: 22.72, type: 'NEB_PLANETAIRE', majAxArcmin: 8, minAxArcmin: 6, vMag: 7.4 }),
  // Déclinaison australe extrême : jamais levée depuis 46° N, donc jamais photographiable.
  objet({ designation: 'INVISIBLE', adDeg: 100, decDeg: -80, vMag: 5 }),
]

/**
 * §12.5 — un moteur qui refuse une entrée hors domaine ne fait pas tomber l'écran.
 *
 * Le cas réel : une optique de 300 mm rétrécit la fenêtre de cadrage, donc laisse entrer au
 * calcul des objets étendus et très faibles dont la brillance de surface dépasse les
 * 26 mag/as² du domaine de §7.1. `fluxObjet` refuse — c'est son rôle — et la liste doit
 * écarter la cible avec sa cause, comme le plan de séance le fait depuis toujours.
 */
describe('posesRequises — un refus de domaine écarte la cible, il ne casse pas l’écran', () => {
  // 300 mm sur le même plein format : la fenêtre de cadrage descend, et des objets que le
  // grand champ écartait sur leur taille arrivent jusqu'aux moteurs de flux.
  const LONGUE_FOCALE: ContexteSession = { ...CONTEXTE, fovHDeg: 4.56, echApx: 3.5 }

  /** Étendue et très faible : sa brillance de surface sort du domaine par construction. */
  const DIFFUSE = objet({
    designation: 'DIFFUSE_HORS_DOMAINE',
    adDeg: 314.75,
    decDeg: 44.52,
    type: 'NEB_OBSCURE',
    majAxArcmin: 100,
    minAxArcmin: 100,
    vMag: 14,
  })

  it('forge bien une cible hors du domaine de brillance de surface', () => {
    // La prémisse du test se calcule, elle ne se recopie pas : sans elle, le test passerait
    // encore le jour où la cible cesserait d'être hors domaine.
    const sbObj = detectabilite({
      mInt: DIFFUSE.vMag,
      aArcmin: DIFFUSE.majAxArcmin,
      bArcmin: DIFFUSE.minAxArcmin,
      typeObjet: DIFFUSE.type,
      sbCiel: LONGUE_FOCALE.sbCielNoir,
      mLimOeil: LONGUE_FOCALE.mLimOeil,
      dMm: LONGUE_FOCALE.dMm,
    }).sbObj.value

    expect(sbObj).not.toBeNull()
    expect(sbObj!).toBeGreaterThan(DOMAINES.sb_obj.max)
  })

  it('n’annonce aucune pose pour elle, sans lever d’erreur', () => {
    expect(() => posesRequises(LONGUE_FOCALE, [...CATALOGUE, DIFFUSE])).not.toThrow()
    expect(posesRequises(LONGUE_FOCALE, [...CATALOGUE, DIFFUSE]).has(DIFFUSE.designation)).toBe(
      false,
    )
  })

  it('ne prive pas les autres cibles de leur pose : le refus est individuel', () => {
    const poses = posesRequises(LONGUE_FOCALE, [...CATALOGUE, DIFFUSE])
    expect(poses.size).toBeGreaterThan(0)
  })

  it('la range parmi les écartées du plan, avec sa cause', () => {
    const plan = planSession(LONGUE_FOCALE, [...CATALOGUE, DIFFUSE])
    const ecartee = plan.ciblesEcartees.find((c) => c.designation === DIFFUSE.designation)
    expect(ecartee).toBeDefined()
    expect(ecartee!.cause).toMatch(/brillance de surface/)
  })
})

describe('posesRequises — la liste et le plan annoncent la même pose', () => {
  const POSES = posesRequises(CONTEXTE, CATALOGUE)
  const PLAN = planSession(CONTEXTE, CATALOGUE)

  it('rend une pose pour chaque cible que le plan a retenue', () => {
    expect(PLAN.etapes.length).toBeGreaterThan(0)
    for (const etape of PLAN.etapes) {
      expect(POSES.has(etape.objet.designation), etape.objet.designation).toBe(true)
    }
  })

  it('annonce exactement l’intégration requise de l’étape du plan', () => {
    for (const etape of PLAN.etapes) {
      const pose = POSES.get(etape.objet.designation)!
      expect(pose.tRequisS, etape.objet.designation).toBeCloseTo(
        etape.integration.tRequisS.value,
        9,
      )
      expect(pose.nPoses).toBe(etape.integration.nPoses.value)
      expect(pose.dureeCreneauMin).toBeCloseTo(etape.creneau.dureeTotaleMin.value, 9)
    }
  })

  it('n’annonce aucune pose pour une cible qui ne se lève jamais depuis ce site', () => {
    expect(POSES.has('INVISIBLE')).toBe(false)
  })

  it('n’évalue jamais plus de cibles que son propre plafond, celui de §6.4', () => {
    expect(POSES.size).toBeLessThanOrEqual(K('CIBLES_EVALUEES_MAX'))
  })

  it('ne rend rien quand la nuit n’a pas de fenêtre de référence', () => {
    const sansNuit: ContexteSession = {
      ...CONTEXTE,
      nuit: { ...NUIT, debutReference: null, finReference: null },
    }
    expect(posesRequises(sansNuit, CATALOGUE).size).toBe(0)
  })
})
