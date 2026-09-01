/**
 * T-0169 — la loi du rail : conversion course ↔ valeur, crantage, accroche.
 *
 * Rien d'astronomique ici, et c'est voulu : le rail est de la géométrie d'écran. Ce que
 * l'accroche vaut — la pose maximale à étoiles ponctuelles — reste vérifié par
 * `grand-champ.test.ts`, qui la calcule.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Curseur } from '../src/ui/Curseur.tsx'
import {
  accrocheDansLaCourse,
  fractionDuRail,
  valeurDuRail,
  valeurQuantifiee,
  type Rail,
} from '../src/ui/curseur-glisse.ts'

/** Le rail de la pose unitaire : 1 s à 240 s au pas de la seconde. */
const POSE: Rail = { min: 1, max: 240, pas: 1 }
const LARGEUR_PX = 240

describe('crantage', () => {
  it('aligne sur le pas depuis le minimum', () => {
    expect(valeurQuantifiee(24.4, POSE)).toBe(24)
    expect(valeurQuantifiee(24.6, POSE)).toBe(25)
  })

  it('borne aux extrémités de la course', () => {
    expect(valeurQuantifiee(-50, POSE)).toBe(POSE.min)
    expect(valeurQuantifiee(1e6, POSE)).toBe(POSE.max)
  })

  it('ne laisse pas de poussière flottante sur un pas décimal', () => {
    const poids: Rail = { min: 0, max: 1, pas: 0.01 }
    expect(valeurQuantifiee(0.3, poids)).toBe(0.3)
    expect(valeurQuantifiee(0.07000000001, poids)).toBe(0.07)
  })

  it('part du minimum, pas de zéro', () => {
    const magnitude: Rail = { min: -2, max: 20, pas: 0.5 }
    expect(valeurQuantifiee(-1.7, magnitude)).toBe(-1.5)
  })
})

describe('position sur la course', () => {
  it('rend la fraction occupée, bornée à [0, 1]', () => {
    expect(fractionDuRail(POSE.min, POSE)).toBe(0)
    expect(fractionDuRail(POSE.max, POSE)).toBe(1)
    expect(fractionDuRail(POSE.max * 2, POSE)).toBe(1)
  })

  it('rend 0 sur une course nulle plutôt qu’une division par zéro', () => {
    expect(fractionDuRail(5, { min: 5, max: 5, pas: 1 })).toBe(0)
  })
})

describe('accroche', () => {
  const rail: Rail = { ...POSE, accroche: 25 }
  /** Fraction de course que désigne une valeur, pour attaquer le rail par le geste. */
  function fraction(valeur: number): number {
    return (valeur - rail.min) / (rail.max - rail.min)
  }

  it('aimante le geste qui passe dans la détente', () => {
    // 2 px de rail à côté du repère : sous la demi-largeur de la détente.
    expect(valeurDuRail(fraction(25) + 2 / LARGEUR_PX, rail, LARGEUR_PX)).toBe(25)
    expect(valeurDuRail(fraction(25) - 2 / LARGEUR_PX, rail, LARGEUR_PX)).toBe(25)
  })

  it('laisse passer au-delà de la détente', () => {
    // 20 px plus loin : la valeur voisine reste atteignable, sinon le repère serait un mur.
    expect(valeurDuRail(fraction(25) + 20 / LARGEUR_PX, rail, LARGEUR_PX)).toBe(45)
  })

  it('ignore une accroche hors course plutôt que de la coller à la borne', () => {
    expect(accrocheDansLaCourse({ ...POSE, accroche: 300 })).toBeNull()
    expect(accrocheDansLaCourse({ ...POSE, accroche: 0 })).toBeNull()
    expect(accrocheDansLaCourse({ ...POSE, accroche: Number.NaN })).toBeNull()
    expect(accrocheDansLaCourse(POSE)).toBeNull()
    expect(accrocheDansLaCourse(rail)).toBe(25)
  })

  it('n’aimante rien quand le rail n’a pas de largeur mesurée', () => {
    expect(valeurDuRail(fraction(26), rail, 0)).toBe(26)
  })
})

describe('le rail rendu', () => {
  const LEGENDE = 'max étoile comme des points'

  function html(accroche: number | null): string {
    const repere = accroche === null ? {} : { accroche: { valeur: accroche, libelle: LEGENDE } }
    return renderToStaticMarkup(
      <Curseur
        libelle="Pose unitaire"
        valeur={30}
        min={POSE.min}
        max={POSE.max}
        pas={POSE.pas}
        texte="30 s"
        {...repere}
        sur={() => undefined}
      />,
    )
  }

  it('porte le rôle et la valeur, comme le faisait le rail natif', () => {
    const rendu = html(null)
    expect(rendu).toContain('role="slider"')
    expect(rendu).toContain('aria-valuenow="30"')
    expect(rendu).toContain('aria-valuetext="30 s"')
    expect(rendu).toContain(`aria-valuemax="${POSE.max}"`)
  })

  it('peint le repère et sa légende quand l’accroche tombe dans la course', () => {
    expect(html(25)).toContain('curseur-accroche')
    expect(html(25)).toContain(LEGENDE)
  })

  it('donne l’abscisse du repère à la feuille de style plutôt qu’un décalage figé', () => {
    // La légende occupe toute la largeur du rail : c'est ce qui lui permet de s'arrêter au
    // bord de la colonne de texte au lieu de déborder.
    expect(html(25)).toContain('curseur-legendes')
    expect(html(25)).toMatch(/--curseur-x:\s*10\.04%/)
  })

  it('ne peint aucun repère sans accroche, ou hors course', () => {
    expect(html(null)).not.toContain('curseur-accroche')
    // Pose max au-delà du plafond de pose, ou en deçà de la première seconde : le repère
    // collé à la borne dirait un seuil qui n'est pas là.
    expect(html(POSE.max + 1)).not.toContain('curseur-accroche')
    expect(html(0)).not.toContain('curseur-accroche')
  })
})
