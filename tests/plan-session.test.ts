/**
 * §8.3 — Plan de session ordonné, et §11.2 — export texte imprimable.
 *
 * Ce qui est vérifié ici tient en une phrase : la sortie est une CHRONOLOGIE, pas un
 * palmarès. Et tout ce qui est écarté l'est avec sa cause, à part, sans jamais remplir le
 * plan avec des cibles refusées.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fenetreNocturne } from '../src/core/night.ts'
import { fenetreUtile } from '../src/core/moon.ts'
import { masquePlat } from '../src/core/site.ts'
import { planSession, poidsParDefaut, type ContexteSession } from '../src/core/session.ts'
import { planEnTexte } from '../src/core/plan-texte.ts'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'

const SITE_REFERENCE = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const NUIT = fenetreNocturne(SITE_REFERENCE, new Date('2026-08-14T12:00:00Z'))

/** Setup ciel profond de l'Annexe A : 120 mm f/2,8 sur plein format. */
function contexte(surcharge: Partial<ContexteSession> = {}): ContexteSession {
  return {
    site: SITE_REFERENCE,
    nuit: NUIT,
    fenetreUtile: fenetreUtile(SITE_REFERENCE, NUIT),
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
    ...surcharge,
  }
}

function objet(surcharge: Partial<ObjetCielProfond>): ObjetCielProfond {
  return {
    designation: 'TEST',
    nomsCommuns: '',
    adDeg: 315,
    decDeg: 40,
    type: 'EMISSION',
    majAxArcmin: 280,
    minAxArcmin: 220,
    posAngDeg: null,
    vMag: 5,
    bMag: null,
    surfBr: null,
    ...surcharge,
  }
}

/**
 * Trois cibles cadrables par ce setup, une trop petite pour lui, une qui déborde du champ.
 * Les dimensions et magnitudes sont celles des objets réels : M31 y retrouve la brillance
 * de surface de 22,17 mag/arcsec² de l'Annexe A.
 */
const CATALOGUE: readonly ObjetCielProfond[] = [
  objet({
    designation: 'NGC7000',
    nomsCommuns: 'Amérique du Nord',
    adDeg: 314.75,
    decDeg: 44.52,
    type: 'EMISSION',
    majAxArcmin: 120,
    minAxArcmin: 100,
    vMag: 4,
  }),
  objet({
    designation: 'M31',
    nomsCommuns: 'Andromède',
    adDeg: 10.68,
    decDeg: 41.27,
    type: 'GALAXIE',
    majAxArcmin: 190,
    minAxArcmin: 60,
    vMag: 3.4,
  }),
  objet({
    designation: 'M45',
    nomsCommuns: 'Pléiades',
    adDeg: 56.75,
    decDeg: 24.12,
    type: 'AMAS_OUVERT',
    majAxArcmin: 110,
    minAxArcmin: 110,
    vMag: 1.6,
  }),
  objet({
    designation: 'M33',
    adDeg: 23.46,
    decDeg: 30.66,
    type: 'GALAXIE',
    majAxArcmin: 71,
    minAxArcmin: 42,
    vMag: 5.7,
  }),
  objet({ designation: 'IMMENSE', adDeg: 312, decDeg: 42, majAxArcmin: 1500, vMag: 3 }),
]

describe('plan de session §8.3', () => {
  const plan = planSession(contexte(), CATALOGUE)

  it('produit une chronologie ordonnée dans le temps, pas un palmarès', () => {
    expect(plan.etapes.length).toBeGreaterThan(0)
    const debuts = plan.etapes.map((e) => e.creneauAlloue.debut.getTime())
    expect(debuts).toStrictEqual([...debuts].sort((a, b) => a - b))
  })

  it('n’alloue jamais deux fois le même morceau de nuit', () => {
    for (let i = 1; i < plan.etapes.length; i++) {
      const precedente = plan.etapes[i - 1]!
      const courante = plan.etapes[i]!
      expect(courante.creneauAlloue.debut.getTime()).toBeGreaterThanOrEqual(
        precedente.creneauAlloue.fin.getTime(),
      )
    }
  })

  it('expose la décomposition du score de chaque cible', () => {
    for (const etape of plan.etapes) {
      const d = etape.detailScore
      expect(d.cadrage).toBeGreaterThanOrEqual(0)
      expect(d.hauteur).toBeLessThanOrEqual(1)
      expect(etape.score.formula.section).toBe('8.3')
      expect(etape.score.constants.map((c) => c.ref)).toContain('C-15')
    }
  })

  it('tient le budget de nuit, calibration et pointage inclus', () => {
    expect(plan.budget.tient).toBe(true)
    expect(plan.budget.miseEnStationMin).toBeGreaterThan(0)
    expect(plan.budget.pointageMin).toBeGreaterThan(0)
    expect(plan.budget.totalMin.value).toBeLessThanOrEqual(plan.budget.disponibleMin)
  })

  it('écarte les cibles non cadrables avec leur cause, hors de la chronologie', () => {
    const designations = plan.etapes.map((e) => e.objet.designation)
    expect(designations).not.toContain('M33')
    expect(designations).not.toContain('IMMENSE')
    const ecartees = plan.ciblesEcartees.map((c) => c.designation)
    expect(ecartees).toContain('M33')
    expect(ecartees).toContain('IMMENSE')
    for (const ecartee of plan.ciblesEcartees) expect(ecartee.cause).not.toBe('')
  })

  it('donne à chaque étape sa consigne de terrain', () => {
    for (const etape of plan.etapes) expect(etape.consigne).not.toBe('')
  })

  it('rappelle qu’aucun filtre météo n’est appliqué', () => {
    expect(plan.avertissementMeteo).toMatch(/météo/)
    expect(plan.avertissementMeteo).toMatch(/nuages/)
  })

  it('expose les poids de scoring, réglables et non appris', () => {
    expect(plan.poids).toStrictEqual(poidsParDefaut())
    const somme = Object.values(plan.poids).reduce((a, b) => a + b, 0)
    expect(somme).toBeCloseTo(1, 6)
  })
})

describe('cas limite : aucune cible compatible §8.3', () => {
  const plan = planSession(contexte(), [
    objet({ designation: 'TROP_AU_SUD', adDeg: 266, decDeg: -29, majAxArcmin: 280 }),
  ])

  it('annonce l’absence de cible et nomme la contrainte dominante', () => {
    expect(plan.etapes).toStrictEqual([])
    expect(plan.contrainteDominante).toMatch(/HAUTEUR/)
  })

  it('propose une alternative sans remplir la liste avec les cibles écartées', () => {
    expect(plan.alternative).toMatch(/grand champ|filé/)
    expect(plan.ciblesEcartees.length).toBe(1)
  })
})

describe('export imprimable §11.2', () => {
  it('contient cibles, créneaux, poses, nombres d’images et calibration', () => {
    const plan = planSession(contexte(), CATALOGUE)
    const texte = planEnTexte(plan, {
      dateIso: '2026-08-14',
      lieu: '46,391° N / 6,697° E — Bortle 4,5',
      materiel: '120 mm f/2,8, plein format',
    })
    expect(texte).toContain('PLAN DE SESSION')
    expect(texte).toContain('CHRONOLOGIE')
    expect(texte).toContain('CALIBRATION')
    expect(texte).toMatch(/Pose unitaire\s+: \d+ s/)
    expect(texte).toMatch(/Nombre de poses\s+: \d+ poses/)
    expect(texte).toMatch(/FLATS/)
    expect(texte).toMatch(/météo|nuages/i)
  })

  it('porte une unité sur chaque valeur affichée', () => {
    const plan = planSession(contexte(), CATALOGUE)
    const texte = planEnTexte(plan, { dateIso: '2026-08-14', lieu: 'site', materiel: 'setup' })
    // Aucune ligne « libellé : nombre » sans unité derrière le nombre.
    const sansUnite = texte
      .split('\n')
      .filter((ligne) => /:\s+-?\d+(?:[.,]\d+)?\s*$/.test(ligne))
    expect(sansUnite).toStrictEqual([])
  })
})

describe('sur le catalogue OpenNGC embarqué', () => {
  const dossier = join(import.meta.dirname, '..', 'public', 'data')
  const lit = (nom: string): ArrayBuffer => {
    const octets = readFileSync(join(dossier, nom))
    return octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength)
  }
  const catalogue = decodeObjets({
    enregistrements: lit('openngc-1.bin'),
    chaines: lit('openngc-noms-1.bin'),
  })

  it('produit un plan sur les 12 458 objets réels, sans lever d’erreur', () => {
    expect(catalogue.length).toBeGreaterThan(10000)
    const depart = Date.now()
    const plan = planSession(contexte(), catalogue)
    const duree = Date.now() - depart

    expect(plan.etapes.length).toBeGreaterThan(0)
    expect(plan.budget.tient).toBe(true)
    // Le pré-filtrage dur borne le coût : le calcul d'éphéméride ne porte que sur les
    // candidates retenues, pas sur le catalogue entier.
    expect(duree).toBeLessThan(5000)
  })

  it('dit ce que le catalogue ne porte pas, au lieu d’inventer une magnitude', () => {
    const plan = planSession(contexte(), catalogue)
    expect(plan.comptesEcartees.DONNEE_MANQUANTE).toBeGreaterThan(0)
    expect(plan.noteCouvertureCatalogue).toMatch(/faute de magnitude/)
    expect(plan.noteCouvertureCatalogue).toMatch(/Aucune valeur n’est inventée/)
  })

  it('nomme la cause de chaque cible écartée, sans jamais en laisser une muette', () => {
    const plan = planSession(contexte(), catalogue)
    for (const ecartee of plan.ciblesEcartees) {
      expect(ecartee.cause.length, ecartee.designation).toBeGreaterThan(20)
    }
  })
})

/**
 * T-0079 — le noyau promis au débutant grand champ, vérifié bout en bout.
 *
 * Les trois enfants de l'épique livrés, il reste à voir ce que l'utilisateur obtient : un plan
 * produit depuis le site de référence, sur le CATALOGUE RÉEL, doit citer une cible du domaine
 * grand champ que ni NGC ni IC ne portent. Sans ce test, Sharpless et Barnard peuvent être
 * dans le paquet sans jamais ressortir du scoring, et l'épique se solderait sur une promesse.
 */
describe('grand champ bout en bout §6.1 (T-0079)', () => {
  function catalogueReel(): readonly ObjetCielProfond[] {
    const lit = (nom: string): ArrayBuffer => {
      const octets = readFileSync(join(import.meta.dirname, '..', 'public', 'data', nom))
      return octets.buffer.slice(
        octets.byteOffset,
        octets.byteOffset + octets.byteLength,
      ) as ArrayBuffer
    }
    return [
      ...decodeObjets({
        enregistrements: lit('openngc-1.bin'),
        chaines: lit('openngc-noms-1.bin'),
      }),
      ...decodeObjets({
        enregistrements: lit('deepsky-1.bin'),
        chaines: lit('deepsky-noms-1.bin'),
      }),
    ]
  }

  it('cite une cible Sharpless ou Barnard dans un plan de grand champ', () => {
    const plan = planSession(contexte(), catalogueReel())
    expect(plan.etapes.length).toBeGreaterThan(0)
    const complement = plan.etapes.filter((e) => /^(Sh2-|B)\d+$/.test(e.objet.designation))
    expect(complement.length, plan.etapes.map((e) => e.objet.designation).join(', ')).toBeGreaterThan(0)
  })
})
