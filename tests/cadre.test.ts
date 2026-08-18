/**
 * §3.5 — Superposition du cadre matériel.
 *
 * Le critère qui compte est géométrique : à grand champ, les bords du cadre ne sont PAS des
 * droites dans le planétarium. Un rectangle à côtés droits mentirait sur ce que l'objectif
 * capture, et le cadrage est justement ce que cette couche sert à décider.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  REFUS_SANS_PROFIL,
  cibleDominante,
  contourCadreJ2000,
  refusAuDelaDuMaximum,
  rotationSuggeree,
  type Cadre,
  type ProfilCadre,
} from '../src/core/cadre.ts'
import { fovDeg } from '../src/core/optics.ts'
import { BOITIER_REFERENCE, capteurEffectif } from '../src/data/equipment.ts'
import { IDENTITE, separationDeg, versSpherique, versVecteur } from '../src/core/mat3.ts'
import { projecteur, type Vue } from '../src/core/projection.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import { K } from '../src/registry/constants.ts'
import { MenuInfos } from '../src/ui/MenuInfos.tsx'
import { construitIndex } from '../src/core/index-ciel.ts'

const FOCALE_REFERENCE_MM = 120

function profil(mode: 'FULL_FRAME' | 'APSC_CROP'): ProfilCadre {
  const capteur = capteurEffectif(BOITIER_REFERENCE, mode)
  return {
    libelle: mode,
    fovLDeg: fovDeg(capteur.capteurLMm, FOCALE_REFERENCE_MM).value,
    fovHDeg: fovDeg(capteur.capteurHMm, FOCALE_REFERENCE_MM).value,
    echApx: (K('RADIAN_EN_ARCSEC') * capteur.pitchUm) / (FOCALE_REFERENCE_MM * 1000),
    tPoseS: 120,
  }
}

const CADRE: Cadre = {
  profil: profil('FULL_FRAME'),
  azimutDeg: 180,
  hauteurDeg: 40,
  rotationDeg: 0,
}

function vue(mode: Vue['mode'], fov: number): Vue {
  return {
    mode,
    fovDeg: fov,
    largeurPx: 1920,
    hauteurPx: 1080,
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }
}

describe('cadre projeté §3.5', () => {
  it('donne 17,0° × 11,4° pour le profil de référence 120 mm plein format', () => {
    const reference = profil('FULL_FRAME')
    expect(reference.fovLDeg).toBeCloseTo(17.0, 1)
    expect(reference.fovHDeg).toBeCloseTo(11.4, 1)
  })

  it('rend le cadre APS-C environ 1,5 fois plus petit, à échantillonnage identique', () => {
    const plein = profil('FULL_FRAME')
    const apsc = profil('APSC_CROP')
    expect(plein.fovLDeg / apsc.fovLDeg).toBeCloseTo(1.5, 1)
    expect(plein.fovHDeg / apsc.fovHDeg).toBeCloseTo(1.5, 1)
    // Le recadrage ne change ni le pitch ni la focale : la résolution est la même (§5.1).
    expect(apsc.echApx).toBeCloseTo(plein.echApx, 9)
  })

  it('place le contour aux dimensions angulaires annoncées', () => {
    const contour = contourCadreJ2000(CADRE, IDENTITE)
    const pas = K('SUBDIVISION_CADRE')
    const centre = versVecteur(CADRE.azimutDeg, CADRE.hauteurDeg)

    // Les bords sont parcourus dans l'ordre bas, droite, haut, gauche : le milieu de
    // chacun est à la demi-dimension du champ, exactement.
    expect(separationDeg(contour[pas / 2]!, centre)).toBeCloseTo(CADRE.profil.fovHDeg / 2, 6)
    expect(separationDeg(contour[pas + pas / 2]!, centre)).toBeCloseTo(
      CADRE.profil.fovLDeg / 2,
      6,
    )
    expect(separationDeg(contour[2 * pas + pas / 2]!, centre)).toBeCloseTo(
      CADRE.profil.fovHDeg / 2,
      6,
    )

    // Les coins sont plus loin que les milieux de bord : le cadre n'est pas un disque, et
    // sa diagonale n'est pas la somme des demi-côtés.
    const diagonale = separationDeg(contour[0]!, centre)
    expect(diagonale).toBeGreaterThan(CADRE.profil.fovLDeg / 2)
    expect(diagonale).toBeLessThan(
      Math.hypot(CADRE.profil.fovLDeg, CADRE.profil.fovHDeg) / 2 + 0.1,
    )
  })

  it('courbe les bords d’un cadre de 130° de diagonale en vue stéréographique', () => {
    // Objectif de 10 mm sur plein format : c'est le cas limite du PRD.
    const grandAngle: Cadre = {
      ...CADRE,
      profil: {
        ...profil('FULL_FRAME'),
        fovLDeg: fovDeg(BOITIER_REFERENCE.capteurLMm, 10).value,
        fovHDeg: fovDeg(BOITIER_REFERENCE.capteurHMm, 10).value,
      },
    }
    const diagonale = Math.hypot(grandAngle.profil.fovLDeg, grandAngle.profil.fovHDeg)
    expect(diagonale).toBeGreaterThan(120)

    const proj = projecteur(vue('MODE_PLANETARIUM', 180), IDENTITE)
    const contour = contourCadreJ2000(grandAngle, IDENTITE)
      .map((v) => proj.projette(v))
      .filter((p) => p !== null)
    expect(contour.length).toBeGreaterThan(K('SUBDIVISION_CADRE'))

    // Un bord est une polyligne : son point médian s'écarte nettement de la corde qui
    // joindrait ses extrémités. Ce serait zéro si le bord était une droite.
    const pas = K('SUBDIVISION_CADRE')
    const debut = contour[0]!
    const fin = contour[pas]!
    const milieu = contour[Math.floor(pas / 2)]!
    const ecart = Math.hypot(
      milieu.xPx - (debut.xPx + fin.xPx) / 2,
      milieu.yPx - (debut.yPx + fin.yPx) / 2,
    )
    expect(ecart).toBeGreaterThan(10)
  })

  it('trace un bord quasi droit à petit champ : la courbure suit la projection', () => {
    const proj = projecteur(vue('MODE_PLANETARIUM', 30), IDENTITE)
    const contour = contourCadreJ2000(CADRE, IDENTITE)
      .map((v) => proj.projette(v))
      .filter((p) => p !== null)
    const pas = K('SUBDIVISION_CADRE')
    const debut = contour[0]!
    const fin = contour[pas]!
    const milieu = contour[Math.floor(pas / 2)]!
    const ecart = Math.hypot(
      milieu.xPx - (debut.xPx + fin.xPx) / 2,
      milieu.yPx - (debut.yPx + fin.yPx) / 2,
    )
    expect(ecart).toBeLessThan(20)
  })
})

describe('cible dans le cadre §3.5, §6.2', () => {
  const centre = versSpherique(
    projecteur(vue('MODE_CADRE', 17), IDENTITE).inverse(1920 / 2, 1080 / 2),
  )

  function objet(nom: string, dLonDeg: number, majAxArcmin: number, posAngDeg: number | null): ObjetCielProfond {
    return {
      designation: nom,
      nomsCommuns: '',
      adDeg: centre.longitudeDeg + dLonDeg,
      decDeg: centre.latitudeDeg,
      type: 'GALAXIE',
      majAxArcmin,
      minAxArcmin: majAxArcmin / 3,
      posAngDeg,
      vMag: 8,
      bMag: null,
      surfBr: null,
    }
  }

  it('retient l’objet le plus étendu du cadre, et ignore ce qui en sort', () => {
    const objets = [objet('petite', 0.5, 20, 30), objet('grande', -0.5, 90, 30), objet('dehors', 40, 200, 30)]
    const dominante = cibleDominante(objets, CADRE, IDENTITE)
    expect(dominante).not.toBeNull()
    expect(dominante!.objet.designation).toBe('grande')
    expect(dominante!.tailleDeg).toBeCloseTo(90 / 60, 6)
  })

  it('ne suggère aucun angle quand le catalogue ne donne pas l’angle de position', () => {
    const dominante = cibleDominante([objet('sans angle', 0, 60, null)], CADRE, IDENTITE)
    expect(dominante).not.toBeNull()
    expect(rotationSuggeree(dominante!, CADRE, IDENTITE)).toBeNull()
  })

  it('propose un angle borné à un demi-tour, appliqué d’un clic', () => {
    const dominante = cibleDominante([objet('allongée', 0, 60, 23)], CADRE, IDENTITE)
    const suggestion = rotationSuggeree(dominante!, CADRE, IDENTITE)
    expect(suggestion).not.toBeNull()
    expect(suggestion!.angleDeg).toBeGreaterThanOrEqual(0)
    expect(suggestion!.angleDeg).toBeLessThan(180)
    expect(suggestion!.message).toMatch(/grande dimension du capteur/)
    expect(suggestion!.message).toMatch(/rotation de champ/)
  })
})

describe('garde-fous du cadre §3.5', () => {
  it('refuse d’inventer un cadre sans profil déclaré', () => {
    expect(REFUS_SANS_PROFIL).toMatch(/ne superpose pas de cadre par défaut/)
    // T-0038 — le refus se lit dans le menu d'information, plus sous le canevas.
    const html = renderToStaticMarkup(
      createElement(MenuInfos, {
        site: { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 },
        index: construitIndex([]),
        objets: [],
        profils: [],
        mLimOeil: 6.05,
      }),
    )
    expect(html).toContain('ne superpose pas de cadre par défaut')
    // T-0041 — et il se signale sur le bouton du menu, fermé.
    expect(html).toContain('data-alerte="true"')
    expect(html).toMatch(/1 message à lire/)
  })

  it('borne la comparaison à trois profils simultanés', () => {
    expect(refusAuDelaDuMaximum(K('PROFILS_CADRE_MAX'))).toBeNull()
    expect(refusAuDelaDuMaximum(K('PROFILS_CADRE_MAX') + 1)).toMatch(/lisible/)
  })
})
