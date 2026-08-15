/**
 * §7.4 — plan de calibration et dithering.
 *
 * Et le contrôle négatif de §2.3 et §7.1 : AUCUN écran de calibration n'existe nulle part.
 * Les poses de calibration prescrites ici sont des images prises sur le terrain ; elles
 * n'ont rien à voir avec un réglage du point zéro système, qui n'existe pas.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planCalibration, valideBibliothequeDarks } from '../src/core/calibration.ts'
import { K } from '../src/registry/constants.ts'

const SESSION = { tPoseS: 13, iso: 640, nPoses: 252, tempCapteurC: 8 }

describe('plan de calibration §7.4', () => {
  const plan = planCalibration(SESSION)

  it('prescrit 30 darks, 25 flats et 50 offsets pour la session de référence', () => {
    const nombres = Object.fromEntries(plan.lots.map((l) => [l.type, l.nombre]))
    expect(nombres).toEqual({ DARKS: 30, FLATS: 25, OFFSETS: 50 })
  })

  it('ajoute environ 7 min au budget de session pour les darks', () => {
    expect(plan.surcoutTempsMin.value).toBeCloseTo(6.5, 1)
    expect(Math.round(plan.surcoutTempsMin.value)).toBe(7)
    expect(plan.surcoutTempsMin.formula.id).toBe('TEMPS_DARKS')
  })

  it('affiche l’ordre d’importance flats, darks, offsets', () => {
    expect(plan.lots.map((l) => l.type)).toEqual(['FLATS', 'DARKS', 'OFFSETS'])
  })

  it('rappelle de ne pas toucher la mise au point avant les flats', () => {
    expect(plan.avertissements.join(' ')).toMatch(/bague de mise au point/)
  })

  it('recommande le dithering à chaque pose sans autoguidage, et dit ce qu’il supprime', () => {
    expect(plan.dithering).toMatch(/à chaque pose/)
    expect(plan.dithering).toMatch(/motif fixe/)
    expect(plan.dithering).toMatch(/ce que les darks, eux, ne suppriment pas/)
  })

  it('invalide les flats au changement de focale ou d’orientation', () => {
    const suivante = planCalibration({ ...SESSION, changementFocaleOuOrientation: true })
    expect(suivante.avertissements.join(' ')).toMatch(/flats de la cible précédente ne sont plus valides/)
  })
})

describe('bibliothèque de darks §7.4', () => {
  it('invalide une bibliothèque prise plus de 3 °C à côté', () => {
    const plan = planCalibration({
      ...SESSION,
      tempCapteurC: 5,
      biblioDarks: { iso: 640, tPoseS: 13, tempC: 20 },
    })
    expect(plan.biblioDarksValide).toBe(false)
    expect(plan.causeInvalidation).toMatch(/15 °C/)
    expect(plan.causeInvalidation).toMatch(new RegExp(`${K('ECART_TEMPERATURE_DARKS_C')} °C`))
  })

  it('accepte une bibliothèque à ISO, durée et température comparables', () => {
    const verdict = valideBibliothequeDarks(
      { iso: 640, tPoseS: 13, tempC: 6 },
      { iso: 640, tPoseS: 13, tempC: 8 },
    )
    expect(verdict.valide).toBe(true)
  })

  it('refuse une bibliothèque prise à un autre ISO ou une autre durée', () => {
    expect(valideBibliothequeDarks({ iso: 200, tPoseS: 13, tempC: 8 }, { iso: 640, tPoseS: 13, tempC: 8 }).valide).toBe(false)
    expect(valideBibliothequeDarks({ iso: 640, tPoseS: 30, tempC: 8 }, { iso: 640, tPoseS: 13, tempC: 8 }).valide).toBe(false)
  })
})

describe('aucun écran de calibration — §2.3, §7.1', () => {
  function sources(dossier: string): string[] {
    return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
      const chemin = join(dossier, entree.name)
      if (entree.isDirectory()) return sources(chemin)
      return /\.tsx?$/.test(entree.name) ? [readFileSync(chemin, 'utf8')] : []
    })
  }

  const code = sources(join(import.meta.dirname, '..', 'src')).join('\n')

  it('n’expose aucune fonction de calibration du point zéro système', () => {
    expect(code).not.toMatch(/function\s+calibre/i)
    expect(code).not.toMatch(/export function\s+\w*[Cc]alibration\w*\s*\([^)]*\)\s*:\s*void/)
    // Le point zéro se lit, il ne s'écrit pas : aucun modificateur nulle part.
    expect(code).not.toMatch(/setZpSys|ecritZpSys|majZpSys/)
  })

  it('n’ouvre aucun import de fichier RAW', () => {
    // Le seul champ fichier de l'application est l'import JSON des données utilisateur (§12.3).
    const accepts = [...code.matchAll(/accept="([^"]+)"/g)].map((m) => m[1])
    expect(accepts).toEqual(['application/json'])
  })

  it('n’offre aucun champ éditable pour le point zéro système', () => {
    expect(code).not.toMatch(/<input[^>]*zp/i)
  })
})
