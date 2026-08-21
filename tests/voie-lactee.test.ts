/**
 * §3.7 — la Voie lactée composée comme une brillance (T-0101, T-0102).
 *
 * Ce que ces tests protègent n'est pas un aspect mais une PROPRIÉTÉ : la bande s'atténue vers
 * les pôles galactiques et s'efface sur un ciel pollué parce que la physique le dit, sans
 * qu'aucun seuil, aucune opacité de convention ni aucune latitude de coupure n'intervienne.
 * C'est ce qui distingue ce rendu du calque teinté qu'il remplace.
 */

import { describe, expect, it } from 'vitest'
import { brillanceVoieLacteeNl, sbDepuisNanolamberts } from '../src/core/fond-ciel-rendu.ts'
import { nanolamberts } from '../src/core/moon.ts'
import { bandeRealiste, fondRealiste, luminanceRelative, palette } from '../src/ui/couleurs.ts'
import { SB_PLAFOND_TABLE, SB_PLANCHER_NATUREL } from '../src/registry/bortle.ts'
import { K } from '../src/registry/constants.ts'

const octets = (css: string): readonly number[] => css.slice(4, -1).split(' ').map(Number)

/** Élévation du fond de ciel, en magnitudes, apportée par la bande à cette latitude. */
const elevationMag = (sbCiel: number, bDeg: number): number =>
  sbCiel - sbDepuisNanolamberts(nanolamberts(sbCiel) + brillanceVoieLacteeNl(bDeg))

describe('brillance de la bande', () => {
  it('vaut la brillance du plan à b = 0 et décroît strictement avec la latitude', () => {
    expect(brillanceVoieLacteeNl(0)).toBeCloseTo(nanolamberts(K('SB_VOIE_LACTEE_PLAN_MAG')), 9)
    let precedente = brillanceVoieLacteeNl(0)
    for (let b = 2; b <= 90; b += 2) {
      const courante = brillanceVoieLacteeNl(b)
      expect(courante).toBeLessThan(precedente)
      precedente = courante
    }
  })

  it('est symétrique : les deux hémisphères galactiques rendent la même brillance', () => {
    for (const b of [5, 17, 43]) {
      expect(brillanceVoieLacteeNl(-b)).toBeCloseTo(brillanceVoieLacteeNl(b), 12)
    }
  })
})

describe('composition sur le fond de ciel', () => {
  it('à brillance égale, la bande et le fond rendent la même luminance', () => {
    // C'est le test de la normalisation de la chromaticité : sans elle, la teinte choisie pour
    // la bande déciderait de son contraste, et l'exposition du fond cesserait de valoir pour
    // les deux contributeurs.
    for (const sb of [SB_PLANCHER_NATUREL, 20.5, SB_PLAFOND_TABLE]) {
      const seuleBande = luminanceRelative(
        octets(bandeRealiste(0, nanolamberts(sb), false).couleur).map((o) => o / 255) as unknown as
          readonly [number, number, number],
      )
      const seulFond = luminanceRelative(
        octets(fondRealiste(sb)).map((o) => o / 255) as unknown as
          readonly [number, number, number],
      )
      // Comparaison en valeurs encodées : l'égalité porte sur ce qui est peint, à l'arrondi
      // d'un canal près.
      expect(seuleBande).toBeCloseTo(seulFond, 2)
    }
  })

  it('la bande est blanc-chaud, jamais rose : R ≥ V ≥ B, et le fond est bleu', () => {
    const [rBande, vBande, bBande] = octets(
      bandeRealiste(0, nanolamberts(SB_PLANCHER_NATUREL), false).couleur,
    )
    expect(rBande!).toBeGreaterThanOrEqual(vBande!)
    expect(vBande!).toBeGreaterThanOrEqual(bBande!)
    // Le fond, lui, penche vers le bleu : c'est le contraste de teinte qui fait lire la bande
    // comme de la lumière d'étoiles et non comme un ciel plus clair.
    const [rFond, , bFond] = octets(fondRealiste(SB_PLANCHER_NATUREL))
    expect(bFond!).toBeGreaterThan(rFond!)
    // Et surtout : plus jamais la teinte d'interface, qui est du magenta. Elle ne sert plus
    // qu'au réticule du centre galactique et aux labels (T-0101, décision 2).
    expect(bandeRealiste(nanolamberts(20.5), brillanceVoieLacteeNl(0), false).couleur).not.toBe(
      palette(false).voieLactee,
    )
  })

  it('s’efface en ville et s’impose sur un ciel noir, sans aucun seuil', () => {
    // Bortle 9 : la bande ne déplace le fond nulle part de plus de 0,15 mag. Invisible PAR LE
    // MODÈLE — il n'y a pas de branche qui l'éteigne.
    for (let b = 0; b <= 90; b += 2) {
      expect(elevationMag(SB_PLAFOND_TABLE, b)).toBeLessThan(0.15)
    }
    // Le ciel le plus noir de la table : plus d'une magnitude dans le plan galactique.
    expect(elevationMag(SB_PLANCHER_NATUREL, 0)).toBeGreaterThan(1)
  })

  it('la part décroît avec la latitude et avec la pollution', () => {
    const part = (sb: number, b: number) =>
      bandeRealiste(nanolamberts(sb), brillanceVoieLacteeNl(b), false).part
    expect(part(SB_PLANCHER_NATUREL, 0)).toBeGreaterThan(part(SB_PLANCHER_NATUREL, 20))
    expect(part(SB_PLANCHER_NATUREL, 20)).toBeGreaterThan(part(SB_PLANCHER_NATUREL, 60))
    expect(part(SB_PLANCHER_NATUREL, 0)).toBeGreaterThan(part(SB_PLAFOND_TABLE, 0))
  })

  it('mode nuit : la bande ne rend que du rouge', () => {
    const [, v, b] = octets(
      bandeRealiste(nanolamberts(SB_PLANCHER_NATUREL), brillanceVoieLacteeNl(0), true).couleur,
    )
    expect(v).toBe(0)
    expect(b).toBe(0)
  })
})
