/**
 * T-0030 — le pincement au pavé zoome en continu, la molette garde son cran.
 *
 * Le branchement DOM (écouteur `wheel` non passif, `gesture*` de Safari) ne se teste pas hors
 * navigateur ; ce qui se teste ici, c'est la seule règle de calcul : d'où vient le facteur
 * appliqué au champ, et pourquoi il ne peut pas être le même pour un cran et pour un geste.
 */

import { describe, expect, it } from 'vitest'
import { facteurZoom, roulisApresGlisser, sourceMolette } from '../src/ui/Planetarium.tsx'

describe('facteur de zoom — un cran de molette, un geste continu', () => {
  it('garde le cran fixe de la molette, dans les deux sens', () => {
    const avant = facteurZoom(-120, false)
    const arriere = facteurZoom(120, false)
    expect(arriere).toBeGreaterThan(1)
    expect(avant).toBeLessThan(1)
    // Un cran dans un sens annule un cran dans l'autre : le champ revient où il était.
    expect(avant * arriere).toBeCloseTo(1, 12)
    // Le cran ne dépend pas de l'amplitude : c'est ce qui le distingue du pincement.
    expect(facteurZoom(4, false)).toBe(arriere)
  })

  it('rend le pincement proportionnel à son amplitude', () => {
    const petit = facteurZoom(5, true)
    const grand = facteurZoom(40, true)
    expect(grand).toBeGreaterThan(petit)
    expect(petit).toBeGreaterThan(1)
    // Un geste lent ne saute pas : la variation de champ reste sous le pour-cent.
    expect(petit).toBeLessThan(1.06)
    // Deux moitiés de geste valent le geste entier — pas de dérive selon la cadence des événements.
    expect(facteurZoom(20, true) * facteurZoom(20, true)).toBeCloseTo(facteurZoom(40, true), 12)
  })

  it('ne bouge pas le champ à delta nul', () => {
    expect(facteurZoom(0, true)).toBe(1)
  })
})

describe('source d’un `wheel` — pincement, molette, défilement', () => {
  const moletteChrome = { ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 100, wheelDeltaY: -120 }
  const paveDefile = { ctrlKey: false, deltaMode: 0, deltaX: -2, deltaY: 7.5, wheelDeltaY: -22.5 }
  const pavePince = { ctrlKey: true, deltaMode: 0, deltaX: 0, deltaY: 3, wheelDeltaY: -9 }

  it('lit le pincement au `ctrlKey`, quoi que disent les autres signaux', () => {
    expect(sourceMolette(pavePince)).toBe('PINCEMENT')
    expect(sourceMolette({ ...moletteChrome, ctrlKey: true })).toBe('PINCEMENT')
  })

  it('reconnaît un cran de molette à son multiple de 120', () => {
    expect(sourceMolette(moletteChrome)).toBe('MOLETTE')
    expect(sourceMolette({ ...moletteChrome, deltaY: -100, wheelDeltaY: 120 })).toBe('MOLETTE')
    // Firefox : la molette compte en lignes, jamais le pavé.
    expect(sourceMolette({ ctrlKey: false, deltaMode: 1, deltaX: 0, deltaY: 3 })).toBe('MOLETTE')
  })

  it('range le défilement à deux doigts à part, pour qu’il promène la visée', () => {
    expect(sourceMolette(paveDefile)).toBe('DEFILEMENT')
    // Un défilement franchement vertical reste un défilement s’il n’a pas la taille d’un cran.
    expect(sourceMolette({ ...paveDefile, deltaX: 0 })).toBe('DEFILEMENT')
    // Firefox en pixels, sans `wheelDeltaY` : petit et fractionnaire, donc pavé.
    expect(sourceMolette({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 6.25 })).toBe(
      'DEFILEMENT',
    )
    expect(sourceMolette({ ctrlKey: false, deltaMode: 0, deltaX: 0, deltaY: 120 })).toBe('MOLETTE')
  })
})

/**
 * T-0084 — la rotation du cadre est un geste continu sur la scène, Maj enfoncée. Le
 * branchement DOM ne se teste pas hors navigateur ; la règle de calcul, si.
 */
describe('rotation du cadre au glisser §3.5', () => {
  const BOITE = { top: 0, left: 0, width: 800, height: 600 }
  // Trois points sur le cercle centré, à 0°, 90° et 180° d'angle écran.
  const droite = { x: 700, y: 300 }
  const bas = { x: 400, y: 500 }
  const gauche = { x: 100, y: 300 }

  it('suit le doigt : un glisser horaire à l’écran tourne le cadre du même angle', () => {
    // De la droite vers le bas : quart de tour horaire à l'écran, donc −90° de roulis.
    expect(roulisApresGlisser(180, BOITE, droite, bas)).toBeCloseTo(90, 9)
    // Et le retour rend exactement le roulis de départ : le geste est réversible.
    expect(roulisApresGlisser(90, BOITE, bas, droite)).toBeCloseTo(180, 9)
  })

  it('reste continu : deux demi-gestes valent le geste entier', () => {
    const entier = roulisApresGlisser(200, BOITE, droite, gauche)
    const enDeux = roulisApresGlisser(roulisApresGlisser(200, BOITE, droite, bas), BOITE, bas, gauche)
    expect(enDeux).toBeCloseTo(entier, 9)
  })

  it('borne le roulis à 0–360°, sans plafond sur le geste', () => {
    // Le franchissement de zéro ne bloque pas le geste : il repasse par 360°.
    const franchi = roulisApresGlisser(10, BOITE, droite, bas)
    expect(franchi).toBeGreaterThanOrEqual(0)
    expect(franchi).toBeLessThan(360)
    expect(franchi).toBeCloseTo(280, 9)
  })

  it('ne bouge pas le cadre sans déplacement du pointeur', () => {
    expect(roulisApresGlisser(42, BOITE, droite, droite)).toBeCloseTo(42, 9)
  })
})
