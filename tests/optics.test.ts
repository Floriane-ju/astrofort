/**
 * §5.1 — profil optique et capteur.
 *
 * Valeurs de référence : Annexe A du PRD. Deux pièges y sont vérifiés explicitement —
 * l'arctangente employée partout, et le recadrage qui ne change pas l'échantillonnage.
 */

import { describe, expect, it } from 'vitest'
import { profilOptique } from '../src/core/optics.ts'
import { npf } from '../src/core/tracking.ts'
import { SaisieRefuseeError } from '../src/registry/domains.ts'
import { BOITIER_REFERENCE, capteurEffectif } from '../src/data/equipment.ts'

/** Annexe A — configuration ciel profond : 120 mm f/2,8 sur le plein format de référence. */
const REFERENCE = {
  focaleMm: 120,
  ouvertureN: 2.8,
  ...capteurEffectif(BOITIER_REFERENCE, 'FULL_FRAME'),
}

describe('champ §5.1', () => {
  it('retrouve le champ du profil de référence par l’arctangente', () => {
    const profil = profilOptique(REFERENCE)
    expect(profil.fovLDeg.value).toBeCloseTo(17.0, 1)
    expect(profil.fovHDeg.value).toBeCloseTo(11.4, 1)
  })

  it('reste physiquement possible à 10 mm, là où l’approximation linéaire échoue', () => {
    // L'approximation 57,3 × d / f donnerait 205,7°, valeur impossible (§5.1, Annexe C).
    const grandAngle = profilOptique({ ...REFERENCE, focaleMm: 10 })
    expect(grandAngle.fovLDeg.value).toBeCloseTo(121.8, 0)
    expect(grandAngle.fovHDeg.value).toBeCloseTo(100.2, 0)
    expect(grandAngle.fovLDeg.value).toBeLessThan(180)
  })

  it('cite la formule de champ et sa mise en garde', () => {
    expect(profilOptique(REFERENCE).fovLDeg.formula.id).toBe('FOV')
    expect(profilOptique(REFERENCE).fovLDeg.formula.note).toMatch(/arctangente/)
  })
})

describe('grandeurs dérivées §5.1', () => {
  const profil = profilOptique(REFERENCE)

  it('retrouve échantillonnage, pupille et pouvoir séparateur de l’Annexe A', () => {
    expect(profil.echApx.value).toBeCloseTo(8.8, 2)
    expect(profil.dMm.value).toBeCloseTo(42.9, 1)
    expect(profil.dawesAs.value).toBeCloseTo(2.7, 1)
  })

  it('diagnostique un grand champ assumé, sans alerte anxiogène', () => {
    // Exigence produit §5.1 : à 8,80 "/px l'app ne doit afficher aucun avertissement.
    expect(profil.diagEch).toBe('GRAND_CHAMP_ASSUME')
    expect(profil.alerte).toBe(false)
  })

  it('signale le sur-échantillonnage sous 1 "/px', () => {
    // 206 265 × 5,12 / 1760 ≈ 0,60 "/px.
    const surEchantillonne = profilOptique({ ...REFERENCE, focaleMm: 1760 })
    expect(surEchantillonne.echApx.value).toBeCloseTo(0.6, 1)
    expect(surEchantillonne.diagEch).toBe('SUR_ECHANTILLONNE')
    expect(surEchantillonne.alerte).toBe(true)
    expect(surEchantillonne.messageDiag).toMatch(/focale/)
  })

  it('reconnaît le régime nominal de longue pose entre 1 et 2 "/px', () => {
    const nominal = profilOptique({ ...REFERENCE, focaleMm: 700 })
    expect(nominal.echApx.value).toBeGreaterThan(1)
    expect(nominal.echApx.value).toBeLessThan(2)
    expect(nominal.diagEch).toBe('NOMINAL')
  })
})

describe('recadrage capteur §5.1', () => {
  const pleinFormat = profilOptique(REFERENCE)
  const recadre = profilOptique({
    ...REFERENCE,
    ...capteurEffectif(BOITIER_REFERENCE, 'APSC_CROP'),
  })

  it('réduit le champ d’un facteur voisin de 1,5 sur chaque dimension', () => {
    expect(recadre.fovLDeg.value).toBeCloseTo(11.18, 1)
    expect(recadre.fovHDeg.value).toBeCloseTo(7.44, 1)
    const facteur = pleinFormat.fovLDeg.value / recadre.fovLDeg.value
    expect(facteur).toBeGreaterThan(1.4)
    expect(facteur).toBeLessThan(1.6)
  })

  it('ne change ni l’échantillonnage, ni la NPF : le recadrage ne grossit rien', () => {
    expect(recadre.echApx.value).toBe(pleinFormat.echApx.value)
    expect(recadre.dawesAs.value).toBe(pleinFormat.dawesAs.value)
    const poseNpf = (mode: 'FULL_FRAME' | 'APSC_CROP') =>
      npf({
        focaleMm: REFERENCE.focaleMm,
        ouvertureN: REFERENCE.ouvertureN,
        pitchUm: capteurEffectif(BOITIER_REFERENCE, mode).pitchUm,
        decDeg: 0,
      }).value
    expect(poseNpf('APSC_CROP')).toBe(poseNpf('FULL_FRAME'))
  })

  it('dit explicitement que le recadrage n’est pas un grossissement', () => {
    expect(capteurEffectif(BOITIER_REFERENCE, 'APSC_CROP').noteRecadrage).toMatch(
      /recadrage.*pas grossissement/i,
    )
    expect(capteurEffectif(BOITIER_REFERENCE, 'FULL_FRAME').noteRecadrage).toBeUndefined()
  })
})

describe('validation de saisie §5.1', () => {
  it('refuse une focale nulle en nommant le champ fautif', () => {
    expect(() => profilOptique({ ...REFERENCE, focaleMm: 0 })).toThrow(SaisieRefuseeError)
    expect(() => profilOptique({ ...REFERENCE, focaleMm: 0 })).toThrow(/focale/i)
  })

  it('refuse une ouverture nulle en nommant le champ fautif', () => {
    expect(() => profilOptique({ ...REFERENCE, ouvertureN: 0 })).toThrow(/ouverture/i)
  })

  it('refuse une saisie non numérique plutôt que de produire NaN', () => {
    expect(() => profilOptique({ ...REFERENCE, pitchUm: Number.NaN })).toThrow(SaisieRefuseeError)
  })
})

describe('base matériel §2.3', () => {
  it('livre le boîtier de référence de l’Annexe A', () => {
    expect(BOITIER_REFERENCE.capteurLMm).toBeCloseTo(35.9, 2)
    expect(BOITIER_REFERENCE.capteurHMm).toBeCloseTo(23.9, 2)
    expect(BOITIER_REFERENCE.pitchUm).toBeCloseTo(5.12, 2)
  })

  it('conserve le pitch au recadrage, seules les dimensions changent', () => {
    const recadre = capteurEffectif(BOITIER_REFERENCE, 'APSC_CROP')
    expect(recadre.pitchUm).toBe(BOITIER_REFERENCE.pitchUm)
    expect(recadre.capteurLMm).toBeCloseTo(23.5, 2)
    expect(recadre.capteurHMm).toBeCloseTo(15.6, 2)
  })
})
