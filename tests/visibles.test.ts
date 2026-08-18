/**
 * T-0044 — la liste des cibles visibles : au-dessus de l'horizon, et un verdict calculable.
 *
 * Le catalogue est forgé ici plutôt que décodé : ce qui est vérifié est la règle de tri et
 * les deux motifs d'exclusion, pas le contenu d'OpenNGC. Les positions sont choisies à
 * partir du site de l'Annexe A et d'un instant fixe, puis relues par la même conversion que
 * celle du module — le test constate un signe de hauteur, pas une éphéméride.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ciblesVisibles, parType, typesPresents } from '../src/core/visibles.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import { applique, versSpherique, versVecteur } from '../src/core/mat3.ts'
import type { Site } from '../src/core/ephem.ts'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'

/** Annexe A : Bordeaux, 45° N. */
const SITE: Site = { latitudeDeg: 44.84, longitudeDeg: -0.58, altitudeM: 20 }
const INSTANT = new Date('2026-08-18T22:00:00Z')
const MATRICE = cielInstantane(SITE, INSTANT).matrice

const SETUP = { sbCiel: 21.0, mLimOeil: 6.1, dMm: 42.86 }

function hauteurDe(adDeg: number, decDeg: number): number {
  return versSpherique(applique(MATRICE, versVecteur(adDeg, decDeg))).latitudeDeg
}

function objet(partiel: Partial<ObjetCielProfond> & { designation: string }): ObjetCielProfond {
  return {
    nomsCommuns: '',
    adDeg: 0,
    decDeg: 0,
    type: 'GALAXIE',
    majAxArcmin: 10,
    minAxArcmin: 6,
    posAngDeg: null,
    vMag: 8,
    bMag: null,
    surfBr: null,
    ...partiel,
  }
}

// Le pôle nord céleste ne se couche jamais depuis 44,84° N ; le pôle sud ne se lève jamais.
const CIRCUMPOLAIRE = { adDeg: 0, decDeg: 85 }
const JAMAIS_LEVE = { adDeg: 0, decDeg: -85 }

describe('ciblesVisibles — ce que le ciel offre à cet instant, pour ce setup', () => {
  it('écarte un objet sous l’horizon à l’instant donné', () => {
    expect(hauteurDe(JAMAIS_LEVE.adDeg, JAMAIS_LEVE.decDeg)).toBeLessThan(0)

    const liste = ciblesVisibles({
      catalogue: [
        objet({ designation: 'HAUT', ...CIRCUMPOLAIRE }),
        objet({ designation: 'BAS', ...JAMAIS_LEVE }),
      ],
      matriceCiel: MATRICE,
      ...SETUP,
    })

    expect(liste.map((c) => c.objet.designation)).toEqual(['HAUT'])
    expect(liste[0]!.hauteurDeg).toBeGreaterThan(0)
  })

  it('écarte un objet sans magnitude, et un objet sans dimensions', () => {
    const liste = ciblesVisibles({
      catalogue: [
        objet({ designation: 'SANS_MAG', ...CIRCUMPOLAIRE, vMag: null }),
        objet({ designation: 'SANS_DIM', ...CIRCUMPOLAIRE, majAxArcmin: null }),
        objet({ designation: 'COMPLET', ...CIRCUMPOLAIRE }),
      ],
      matriceCiel: MATRICE,
      ...SETUP,
    })

    expect(liste.map((c) => c.objet.designation)).toEqual(['COMPLET'])
  })

  it('garde un objet dont le verdict est PHOTO_SEULE : ce n’est pas un refus', () => {
    // Grande et faible : sa brillance de surface passe sous le fond de ciel.
    const liste = ciblesVisibles({
      catalogue: [
        objet({ designation: 'DIFFUSE', ...CIRCUMPOLAIRE, vMag: 13, majAxArcmin: 90, minAxArcmin: 60 }),
      ],
      matriceCiel: MATRICE,
      ...SETUP,
    })

    expect(liste).toHaveLength(1)
    expect(liste[0]!.verdict).toBe('PHOTO_SEULE')
  })

  it('garde un objet hors cadrage : le cadrage n’entre pas dans le filtre', () => {
    // 300’ de grand axe déborde tout capteur du setup de référence, 0,2’ y est un point.
    const liste = ciblesVisibles({
      catalogue: [
        objet({ designation: 'ENORME', ...CIRCUMPOLAIRE, majAxArcmin: 300, minAxArcmin: 300, vMag: 4 }),
        objet({ designation: 'MINUSCULE', ...CIRCUMPOLAIRE, majAxArcmin: 0.2, minAxArcmin: 0.2, vMag: 11 }),
      ],
      matriceCiel: MATRICE,
      ...SETUP,
    })

    expect(liste.map((c) => c.objet.designation)).toEqual(['ENORME', 'MINUSCULE'])
  })

  it('trie du plus brillant au plus faible', () => {
    const liste = ciblesVisibles({
      catalogue: [
        objet({ designation: 'FAIBLE', ...CIRCUMPOLAIRE, vMag: 11 }),
        objet({ designation: 'BRILLANT', ...CIRCUMPOLAIRE, vMag: 3 }),
        objet({ designation: 'MOYEN', ...CIRCUMPOLAIRE, vMag: 7 }),
      ],
      matriceCiel: MATRICE,
      ...SETUP,
    })

    expect(liste.map((c) => c.objet.designation)).toEqual(['BRILLANT', 'MOYEN', 'FAIBLE'])
  })
})


describe('ciblesVisibles — sur le catalogue embarqué, au site de l’Annexe A', () => {
  function openngc(): readonly ObjetCielProfond[] {
    const racine = join(import.meta.dirname, '..', 'public', 'data')
    const lit = (nom: string): ArrayBuffer => {
      const octets = readFileSync(join(racine, nom))
      return octets.buffer.slice(
        octets.byteOffset,
        octets.byteOffset + octets.byteLength,
      ) as ArrayBuffer
    }
    return decodeObjets({
      enregistrements: lit('openngc-1.bin'),
      chaines: lit('openngc-noms-1.bin'),
    })
  }

  const CATALOGUE = openngc()
  const LISTE = ciblesVisibles({ catalogue: CATALOGUE, matriceCiel: MATRICE, ...SETUP })

  it('rend une liste ni vide ni égale au catalogue : un hémisphère est sous l’horizon', () => {
    expect(LISTE.length).toBeGreaterThan(0)
    expect(LISTE.length).toBeLessThan(CATALOGUE.length / 2)
  })

  it('ne rend que des hauteurs positives', () => {
    expect(LISTE.every((c) => c.hauteurDeg > 0)).toBe(true)
  })

  it('rend des azimuts dans [0 ; 360[', () => {
    expect(LISTE.every((c) => c.azimutDeg >= 0 && c.azimutDeg < 360)).toBe(true)
  })

  it('rend une liste triée du plus brillant au plus faible', () => {
    const magnitudes = LISTE.map((c) => c.objet.vMag ?? Number.NaN)
    expect(magnitudes.every((m, i) => i === 0 || magnitudes[i - 1]! <= m)).toBe(true)
  })
})


// --- T-0050 — restreindre la liste des visibles à un type d'objet ------------------------

describe('T-0050 — la liste des visibles se restreint à un type d’objet', () => {
  const CIEL = ciblesVisibles({
    catalogue: [
      objet({ designation: 'GAL', ...CIRCUMPOLAIRE, type: 'GALAXIE' }),
      objet({ designation: 'GLOB', ...CIRCUMPOLAIRE, type: 'AMAS_GLOB', vMag: 9 }),
      objet({ designation: 'OBSCURE_SOUS_HORIZON', ...JAMAIS_LEVE, type: 'NEB_OBSCURE' }),
    ],
    matriceCiel: MATRICE,
    ...SETUP,
  })

  it('ne propose que les types réellement levés, dans l’ordre du catalogue', () => {
    expect(typesPresents(CIEL)).toEqual(['GALAXIE', 'AMAS_GLOB'])
  })

  it('ne retire rien tant qu’aucun type n’est retenu', () => {
    expect(parType(CIEL, null)).toEqual(CIEL)
  })

  it('ne garde que les objets du type retenu', () => {
    expect(parType(CIEL, 'AMAS_GLOB').map((c) => c.objet.designation)).toEqual(['GLOB'])
  })

  it('remonte un objet que le plafond de la liste écartait', () => {
    // 250 galaxies plus brillantes qu'un amas globulaire : filtrer avant de plafonner le
    // fait apparaître, filtrer après ne le montrerait jamais.
    const foule = [
      ...Array.from({ length: 250 }, (_, i) =>
        objet({ designation: `GAL${i}`, ...CIRCUMPOLAIRE, vMag: 4 + i / 100 }),
      ),
      objet({ designation: 'GLOB_FAIBLE', ...CIRCUMPOLAIRE, type: 'AMAS_GLOB', vMag: 10 }),
    ]
    const ciel = ciblesVisibles({ catalogue: foule, matriceCiel: MATRICE, ...SETUP })

    expect(ciel.slice(0, 200).some((c) => c.objet.designation === 'GLOB_FAIBLE')).toBe(false)
    expect(parType(ciel, 'AMAS_GLOB').slice(0, 200).map((c) => c.objet.designation)).toEqual([
      'GLOB_FAIBLE',
    ])
  })
})
