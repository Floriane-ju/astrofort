/**
 * T-0203 — la base `boitiers.md` est éditée à la main : ce test est son garde-fou.
 *
 * Une ligne mal remplie doit échouer ici, en nommant le champ fautif, plutôt qu'à l'exécution
 * chez quelqu'un qui vient d'ajouter son boîtier. Aucune valeur n'est recopiée depuis le
 * fichier : ce qui est vérifié, ce sont les invariants et les formules, jamais un chiffre.
 */

import { describe, expect, it } from 'vitest'
import { BASE_BOITIERS, boitierDeBase, ligneBoitier } from '../src/data/boitiers.ts'
import { DOMAINES } from '../src/registry/domains.ts'
import {
  TABLE_FORMATS_CAPTEUR,
  ligneFormatCapteur,
  pitchDepuisFormat,
  type FormatCapteur,
} from '../src/registry/capteur-formats.ts'
import { isoRecommande } from '../src/data/equipment.ts'

const FORMATS = new Set(TABLE_FORMATS_CAPTEUR.map((f) => f.format))

describe('base boîtiers', () => {
  it('porte des lignes, et chacune un identifiant unique', () => {
    expect(BASE_BOITIERS.length).toBeGreaterThan(0)
    const ids = BASE_BOITIERS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ne cite que des formats de capteur du registre', () => {
    for (const b of BASE_BOITIERS) {
      expect(FORMATS.has(b.saisie.formatCapteur as FormatCapteur), b.id).toBe(true)
    }
  })

  it('nomme sa source sur chaque ligne — §2.1 : aucune valeur sans provenance', () => {
    for (const b of BASE_BOITIERS) {
      expect(b.source.trim(), b.id).not.toBe('')
      expect(b.libelle.trim(), b.id).not.toBe('')
    }
  })

  it('se résout comme une saisie : le refus d’une ligne nomme son champ', () => {
    for (const b of BASE_BOITIERS) {
      expect(() => boitierDeBase(b), b.id).not.toThrow()
    }
  })

  it('dérive le pitch de la formule, jamais d’une valeur écrite dans la base', () => {
    for (const b of BASE_BOITIERS) {
      const format = ligneFormatCapteur(b.saisie.formatCapteur as FormatCapteur)
      const attendu = pitchDepuisFormat(format, Number(b.saisie.resolutionMpx))
      expect(boitierDeBase(b).pitchUm, b.id).toBeCloseTo(attendu, 10)
    }
  })

  it('tient le pitch dérivé dans la plage habituelle : format et résolution sont cohérents', () => {
    const d = DOMAINES.pitch_um
    for (const b of BASE_BOITIERS) {
      const pitch = boitierDeBase(b).pitchUm
      expect(pitch, b.id).toBeGreaterThanOrEqual(d.min)
      expect(pitch, b.id).toBeLessThanOrEqual(d.max)
    }
  })

  it('rattache le seuil de double gain à un point mesuré de la courbe', () => {
    for (const b of BASE_BOITIERS) {
      const seuil = boitierDeBase(b).seuilDoubleGainIso
      if (seuil === undefined) continue
      expect(Object.keys(b.readNoiseE).map(Number), b.id).toContain(seuil)
    }
  })

  it('recommande l’ISO du seuil quand il est connu, et n’en recommande aucun sinon', () => {
    for (const b of BASE_BOITIERS) {
      const boitier = boitierDeBase(b)
      const iso = isoRecommande(boitier)
      if (boitier.seuilDoubleGainIso === undefined) {
        expect(iso.isoRecommandeParSeuil, b.id).toBeNull()
      } else {
        expect(iso.isoRecommandeParSeuil, b.id).toBe(boitier.seuilDoubleGainIso)
        // La recommandation vaut par le bruit de lecture qu'elle apporte, pas par son affichage.
        expect(iso.readNoiseE, b.id).not.toBeNull()
      }
    }
  })

  it('garde le bruit de lecture d’un ISO forcé hors du palier : pas de repli inutile', () => {
    const avecCourbe = BASE_BOITIERS.filter((b) => Object.keys(b.readNoiseE).length > 1)
    expect(avecCourbe.length).toBeGreaterThan(0)
    for (const b of avecCourbe) {
      const isos = Object.keys(b.readNoiseE).map(Number).sort((x, y) => x - y)
      expect(isoRecommande(boitierDeBase(b), isos[0]!).readNoiseE, b.id).not.toBeNull()
    }
  })

  it('se retrouve par son identifiant, et rend null pour un inconnu', () => {
    const premier = BASE_BOITIERS[0]!
    expect(ligneBoitier(premier.id)?.libelle).toBe(premier.libelle)
    expect(ligneBoitier('boitier-qui-n-existe-pas')).toBeNull()
  })
})

describe('T-0204 — un boîtier de la base vaut mieux qu’une saisie vide', () => {
  it('apporte ce que la saisie manuelle ne donne pas : une courbe, pas un point', () => {
    const avecCourbe = BASE_BOITIERS.filter((b) => Object.keys(b.readNoiseE).length > 1)
    for (const b of avecCourbe) {
      // Le repli du registre ne s'applique à aucun ISO que la base couvre : c'est tout
      // l'intérêt de la liste, et l'écart va jusqu'à un facteur trois sur la pose.
      for (const iso of Object.keys(b.readNoiseE).map(Number)) {
        expect(isoRecommande(boitierDeBase(b), iso).readNoiseE, `${b.id} @ ${iso}`).not.toBeNull()
      }
    }
  })

  it('laisse une saisie repartir de ses valeurs quand on quitte la liste', () => {
    for (const b of BASE_BOITIERS) {
      // La saisie recopiée doit se résoudre seule : sinon, quitter la liste casserait l'écran.
      expect(() => boitierDeBase({ ...b, readNoiseE: {} }), b.id).not.toThrow()
    }
  })
})
