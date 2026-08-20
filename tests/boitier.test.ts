/**
 * §5.1 — le mode `custom` : un boîtier absent de la base se saisit à la main.
 *
 * Le cas limite du PRD est celui qui compte : un boîtier custom sans bruit de lecture doit
 * produire une pose calculée avec le repli du registre, affichée, et marquée [ESTIMÉ] —
 * jamais un résultat qui passe pour une mesure (§2.3, §7.1).
 */

import { describe, expect, it } from 'vitest'
import {
  BASE_BOITIERS,
  BOITIER_REFERENCE,
  ID_BOITIER_CUSTOM,
  capteurEffectif,
  isoRecommande,
  libelleZpSource,
  pointZeroSysteme,
  resoutBoitier,
  type SaisieBoitier,
} from '../src/data/equipment.ts'
import { fluxCiel, poseUnitaire } from '../src/core/exposure.ts'
import { DOMAINES, SaisieRefuseeError } from '../src/registry/domains.ts'
import { K } from '../src/registry/constants.ts'

/** Un boîtier saisi dont seules les grandeurs géométriques sont renseignées. */
function saisie(partiel: Partial<SaisieBoitier> = {}): SaisieBoitier {
  return {
    boitierId: ID_BOITIER_CUSTOM,
    capteurLMm: '23.5',
    capteurHMm: '15.6',
    pitchUm: '3.9',
    readNoiseE: '',
    seuilDoubleGainIso: '',
    fullWellE: '',
    zpSys: '',
    tailleRawMo: '',
    autonomieCipa: '',
    ...partiel,
  }
}

describe('§5.1 — le boîtier saisi à la main', () => {
  it('rend le boîtier de la base quand c’est lui qui est choisi, sans rien estimer', () => {
    const resolu = resoutBoitier(saisie({ boitierId: BOITIER_REFERENCE.id }))
    expect(resolu.boitier).toBe(BOITIER_REFERENCE)
    expect(resolu.estimations).toEqual([])
    expect(BASE_BOITIERS).toContain(resolu.boitier)
  })

  it('reprend les grandeurs saisies plutôt que celles d’un autre appareil', () => {
    const { boitier } = resoutBoitier(saisie())
    expect(boitier.id).toBe(ID_BOITIER_CUSTOM)
    expect(boitier.capteurLMm).toBeCloseTo(23.5, 6)
    expect(boitier.pitchUm).toBeCloseTo(3.9, 6)
    expect(boitier.pitchUm).not.toBe(BOITIER_REFERENCE.pitchUm)
  })

  it('refuse une grandeur manquante ou hors domaine en nommant le champ fautif', () => {
    expect(() => resoutBoitier(saisie({ pitchUm: '' }))).toThrow(SaisieRefuseeError)
    expect(() => resoutBoitier(saisie({ pitchUm: '' }))).toThrow(DOMAINES.pitch_um.champ)
    expect(() => resoutBoitier(saisie({ capteurLMm: String(DOMAINES.capteur_mm.max + 1) }))).toThrow(
      /hors de la plage/,
    )
    expect(() => resoutBoitier(saisie({ zpSys: String(DOMAINES.zp_sys.min - 1) }))).toThrow(
      DOMAINES.zp_sys.champ,
    )
  })

  it('garde le recadrage APS-C dans le boîtier : il change les dimensions, jamais le pitch', () => {
    const { boitier } = resoutBoitier(saisie({ capteurLMm: '35.9', capteurHMm: '23.9' }))
    const entier = capteurEffectif(boitier, 'FULL_FRAME')
    const recadre = capteurEffectif(boitier, 'APSC_CROP')
    expect(recadre.pitchUm).toBe(entier.pitchUm)
    expect(recadre.capteurLMm).toBeLessThan(entier.capteurLMm)
    expect(recadre.noteRecadrage).toMatch(/pas grossissement/)
  })
})

describe('§5.1 cas limite — boîtier custom sans bruit de lecture', () => {
  const { boitier, estimations } = resoutBoitier(saisie())
  const iso = isoRecommande(boitier)
  const zeroSysteme = pointZeroSysteme(boitier)

  it('applique le bruit de lecture de repli du registre, et l’affiche', () => {
    expect(iso.readNoiseE).toBeNull()
    const pose = poseUnitaire({
      eCiel: fluxCiel({
        sbMagArcsec2: 20.95,
        zpSys: zeroSysteme.valeur,
        pitchUm: boitier.pitchUm,
        ouvertureN: 2.8,
        zpEstime: zeroSysteme.estime,
      }).value,
      readNoiseE: iso.readNoiseE,
      tMaxS: null,
      zpEstime: zeroSysteme.estime,
    })
    expect(pose.readNoiseUtiliseE).toBe(K('READ_NOISE_DEFAUT_E'))
    expect(pose.readNoiseEstime).toBe(true)
    expect(pose.tOptS.flags).toContain('ESTIME')
    expect(estimations.join(' ')).toContain(String(K('READ_NOISE_DEFAUT_E')))
  })

  it('applique le point zéro générique et le dit dans zp_source (§7.1)', () => {
    expect(zeroSysteme.source).toBe('GENERIQUE')
    expect(zeroSysteme.estime).toBe(true)
    expect(zeroSysteme.valeur).toBe(K('ZP_SYS_GENERIQUE'))
    expect(libelleZpSource(zeroSysteme)).toContain('GENERIQUE')
    expect(libelleZpSource(zeroSysteme)).toContain('[ESTIMÉ]')
    // Le point zéro saisi, lui, n'est plus le générique : la mention [ESTIMÉ] disparaît.
    const declare = pointZeroSysteme(resoutBoitier(saisie({ zpSys: '20.5' })).boitier)
    expect(declare.source).toBe('BASE_MATERIEL')
    expect(libelleZpSource(declare)).not.toContain('[ESTIMÉ]')
  })

  it('remplace la taille de RAW par le générique du registre, jamais par celle d’un autre', () => {
    expect(boitier.tailleRawMo).toBe(K('TAILLE_RAW_MO_GENERIQUE'))
    expect(estimations.join(' ')).toContain(String(K('TAILLE_RAW_MO_GENERIQUE')))
    const renseigne = resoutBoitier(saisie({ tailleRawMo: '20' })).boitier
    expect(renseigne.tailleRawMo).toBe(20)
  })
})

describe('§7.2 — l’ISO retenu se voit, se justifie et se change', () => {
  it('rattache le bruit de lecture saisi au seuil de double gain déclaré', () => {
    const { boitier } = resoutBoitier(saisie({ readNoiseE: '2.4', seuilDoubleGainIso: '800' }))
    const iso = isoRecommande(boitier)
    expect(iso.iso).toBe(800)
    expect(iso.readNoiseE).toBe(2.4)
    expect(iso.message).toMatch(/double gain/)
  })

  it('n’invente aucun bruit de lecture à un ISO choisi hors de la courbe', () => {
    const iso = isoRecommande(BOITIER_REFERENCE, 200)
    expect(iso.iso).toBe(200)
    expect(iso.readNoiseE).toBeNull()
    expect(iso.choisiParUtilisateur).toBe(true)
    expect(iso.message).toContain(String(BOITIER_REFERENCE.seuilDoubleGainIso))
    expect(iso.message).toMatch(/\[ESTIMÉ\]/)
  })

  it('ne prétend à aucun palier quand le seuil de double gain n’est pas renseigné', () => {
    const { boitier } = resoutBoitier(saisie({ readNoiseE: '2.4' }))
    const iso = isoRecommande(boitier)
    expect(iso.isoRecommandeParSeuil).toBeNull()
    expect(iso.readNoiseE).toBeNull()
    expect(iso.message).toMatch(/pas renseigné/)
  })
})
