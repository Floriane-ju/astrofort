/**
 * §8.4 — Cheminement d'étoiles et carte de pointage.
 *
 * Le mode est choisi par le champ, jamais par une préférence : au-delà de 8°, le cadre
 * contient toujours plusieurs étoiles brillantes et une seule étape suffit. Et l'orientation
 * est une sortie à part entière — deux pointages à deux heures ne donnent pas le même schéma.
 */

import { describe, expect, it } from 'vitest'
import { angleOrientation, cartePointage, separationEtoilesDeg } from '../src/core/pointage.ts'
import type { Etoile } from '../src/data/catalog.ts'

const SITE_REFERENCE = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const DATE = new Date('2026-08-14T22:30:00Z')

/** Cible arbitraire du Cygne, et un semis d'étoiles autour d'elle. */
const AD_CIBLE_H = 20.75
const DEC_CIBLE_DEG = 31

function etoile(adH: number, decDeg: number, magV: number): Etoile {
  return { adDeg: adH * 15, decDeg, magV, bv: 0 }
}

/** Deneb, Sadr, Gienah et quelques étoiles faibles, positions approchées. */
const CIEL: readonly Etoile[] = [
  etoile(20.69, 45.28, 1.25),
  etoile(20.37, 40.26, 2.23),
  etoile(20.77, 33.97, 2.46),
  etoile(20.75, 30.2, 4.2),
  etoile(20.9, 31.5, 5.9),
  etoile(20.6, 29.8, 6.3),
  etoile(20.68, 32.4, 3.2),
]

const COMMUN = {
  site: SITE_REFERENCE,
  date: DATE,
  adCibleH: AD_CIBLE_H,
  decCibleDeg: DEC_CIBLE_DEG,
  mLimOeil: 6.05,
  etoiles: CIEL,
}

describe('mode de pointage §8.4', () => {
  it('retient la carte directe sur le profil de référence 17,0° × 11,4°', () => {
    const carte = cartePointage({ ...COMMUN, fovHDeg: 11.38, fovLDeg: 17.02 })
    expect(carte.mode).toBe('CARTE_DIRECTE')
    expect(carte.ancrages.length).toBeGreaterThan(0)
    expect(carte.message).toMatch(/une seule étape/)
  })

  it('liste les ancrages sous la magnitude limite du site, avec leurs décalages', () => {
    const carte = cartePointage({ ...COMMUN, fovHDeg: 11.38, fovLDeg: 17.02 })
    for (const ancrage of carte.ancrages) {
      expect(ancrage.magV).toBeLessThanOrEqual(6.05)
      expect(Math.abs(ancrage.xCadre)).toBeLessThanOrEqual(1 / 2)
      expect(Math.abs(ancrage.yCadre)).toBeLessThanOrEqual(1 / 2)
    }
    const premier = carte.ancrages[0]!
    expect(premier.deltaAdH).toBeCloseTo(AD_CIBLE_H - premier.adH, 6)
    expect(premier.deltaDecDeg).toBeCloseTo(DEC_CIBLE_DEG - premier.decDeg, 6)
    expect(premier.principal).toBe(true)
  })

  it('bascule en cheminement sous 8° de champ', () => {
    const carte = cartePointage({ ...COMMUN, fovHDeg: 2, fovLDeg: 3, fovChercheurDeg: 5 })
    expect(carte.mode).toBe('CHEMINEMENT')
  })
})

describe('ciel dégradé — Bortle 8, m_lim_oeil = 4,5 §8.4', () => {
  it('ne propose que les étoiles réellement visibles depuis ce site', () => {
    const carte = cartePointage({
      ...COMMUN,
      mLimOeil: 4.5,
      fovHDeg: 11.38,
      fovLDeg: 17.02,
    })
    for (const ancrage of carte.ancrages) expect(ancrage.magV).toBeLessThanOrEqual(4.5)
  })

  it('déclare l’absence d’ancrage au lieu de proposer une étoile invisible', () => {
    const carte = cartePointage({
      ...COMMUN,
      mLimOeil: 0.5,
      fovHDeg: 11.38,
      fovLDeg: 17.02,
    })
    expect(carte.ancrages).toStrictEqual([])
    expect(carte.cause).toMatch(/plutôt que de proposer une étoile invisible/)
    expect(carte.contraintesARelacher?.length).toBeGreaterThan(0)
  })
})

describe('cheminement §8.4', () => {
  it('trouve un itinéraire d’au plus 5 sauts depuis une étoile de magnitude ≤ 3,5', () => {
    const carte = cartePointage({ ...COMMUN, fovHDeg: 2, fovLDeg: 3, fovChercheurDeg: 6 })
    expect(carte.mode).toBe('CHEMINEMENT')
    expect(carte.sauts.length).toBeGreaterThan(0)
    expect(carte.sauts.length).toBeLessThanOrEqual(5)
    expect(carte.sauts[0]!.magV).toBeLessThanOrEqual(3.5)
    // Recouvrement garanti : chaque saut reste sous 0,7 × le champ de chercheur.
    for (const saut of carte.sauts) expect(saut.distanceDeg).toBeLessThanOrEqual(0.7 * 6)
  })

  it('propose la contrainte à relâcher plutôt qu’un itinéraire inventé', () => {
    const carte = cartePointage({
      ...COMMUN,
      fovHDeg: 2,
      fovLDeg: 3,
      // Chercheur minuscule : aucun saut n'est possible sous la contrainte déclarée.
      fovChercheurDeg: 0.2,
    })
    expect(carte.sauts).toStrictEqual([])
    expect(carte.cause).toMatch(/Aucun chemin/)
    expect(carte.contraintesARelacher?.length).toBeGreaterThan(0)
  })
})

describe('orientation du champ §8.4', () => {
  it('change entre deux heures de pointage : le schéma n’est jamais figé', () => {
    const tot = angleOrientation(SITE_REFERENCE, DATE, 2.5, 60)
    const tard = angleOrientation(
      SITE_REFERENCE,
      new Date(DATE.getTime() + 3 * 3600 * 1000),
      2.5,
      60,
    )
    expect(Math.abs(tard.value - tot.value)).toBeGreaterThan(1)
    expect(tot.formula.section).toBe('8.4')
    expect(tot.note).toMatch(/tourne au cours de la nuit/)
  })
})

describe('séparation angulaire', () => {
  it('est nulle sur soi-même et symétrique', () => {
    // L'arc-cosinus perd de la précision près de zéro : l'écart résiduel est de l'ordre de
    // la milliseconde d'arc, sans effet à l'échelle d'un cadre de pointage.
    expect(separationEtoilesDeg(5, 10, 5, 10)).toBeCloseTo(0, 5)
    expect(separationEtoilesDeg(5, 10, 6, 20)).toBeCloseTo(
      separationEtoilesDeg(6, 20, 5, 10),
      9,
    )
  })
})
