/**
 * §9.3 — Prévisualisation du filé d'étoiles.
 *
 * Ce que ce test vérifie est exactement ce que le PRD dit être raté ailleurs : le pôle est à
 * sa place même hors du cadre, les arcs ne sont pas des cercles concentriques en projection
 * rectilinéaire, leur longueur varie avec la déclinaison, et une étoile qui file est moins
 * brillante par pixel qu'une étoile ponctuelle.
 */

import { describe, expect, it } from 'vitest'
import {
  arcEtoile,
  diagnosticFile,
  poseParPixelS,
  longueurArcDeg,
  positionPole,
} from '../src/core/file-etoiles.ts'
import { axePoleDeDate, cielInstantane, epoqueAnnee } from '../src/core/horloges.ts'
import type { Site } from '../src/core/ephem.ts'
import { versVecteur } from '../src/core/mat3.ts'
import { projecteur, type ModeProjection, type Vue } from '../src/core/projection.ts'
import { K } from '../src/registry/constants.ts'

const SITE: Site = { latitudeDeg: 46.4, longitudeDeg: 6.697, altitudeM: 500 }
const DATE = new Date('2026-08-15T22:00:00Z')
const LARGEUR = 1200
const HAUTEUR = 800

function vue(options: {
  mode?: ModeProjection
  azimutDeg: number
  hauteurDeg: number
  fovDeg?: number
}): Vue {
  return {
    mode: options.mode ?? 'MODE_CADRE',
    fovDeg: options.fovDeg ?? 100,
    largeurPx: LARGEUR,
    hauteurPx: HAUTEUR,
    azimutDeg: options.azimutDeg,
    hauteurDeg: options.hauteurDeg,
    rotationDeg: 0,
  }
}

function proj(options: Parameters<typeof vue>[0]) {
  return projecteur(vue(options), cielInstantane(SITE, DATE).matrice)
}

/** Le ciel tourne autour du pôle DE L'ÉPOQUE, à un demi-degré du pôle J2000 en 2026. */
const AXE_POLE = axePoleDeDate(epoqueAnnee(DATE))

describe('§9.3 — centre de rotation', () => {
  it('rend le pôle dans le cadre à la hauteur de la latitude, azimut nord vrai', () => {
    // Cadre centré sur le pôle nord céleste : azimut 0, hauteur = latitude.
    const pole = positionPole(
      proj({ azimutDeg: 0, hauteurDeg: SITE.latitudeDeg }),
      SITE.latitudeDeg,
      AXE_POLE,
    )
    expect(pole.dansCadre).toBe(true)
    expect(pole.altitudeDeg).toBeCloseTo(46.4, 6)
    expect(pole.azimutDeg).toBe(0)
    expect(pole.xPx).toBeCloseTo(LARGEUR / 2, 0)
    expect(pole.yPx).toBeCloseTo(HAUTEUR / 2, 0)
    expect(pole.distanceCentreDeg).toBeCloseTo(0, 1)
  })

  it('ne recentre pas le pôle quand il est hors du cadre, et dit où il est', () => {
    const pole = positionPole(proj({ azimutDeg: 180, hauteurDeg: 30 }), SITE.latitudeDeg, AXE_POLE)
    expect(pole.dansCadre).toBe(false)
    expect(pole.distanceCentreDeg).toBeGreaterThan(90)
    expect(pole.directionDeg).not.toBeNull()
    expect(pole.message).toMatch(/hors du cadre/)
    expect(pole.message).toMatch(/ne le recentre pas/)
  })

  it('place le pôle sud sous l’horizon austral pour un site de l’hémisphère sud', () => {
    const pole = positionPole(proj({ azimutDeg: 180, hauteurDeg: 30 }), -33.9, AXE_POLE)
    expect(pole.azimutDeg).toBe(180)
    expect(pole.altitudeDeg).toBeCloseTo(33.9, 6)
  })
})

describe('§9.3 — longueur des arcs', () => {
  it('donne 5,01° en 20 min et 15,04° en 1 h à l’équateur céleste', () => {
    expect(longueurArcDeg(20, 0).value).toBeCloseTo(5.01, 2)
    expect(longueurArcDeg(60, 0).value).toBeCloseTo(15.04, 2)
    expect(longueurArcDeg(120, 0).value).toBeCloseTo(30.08, 2)
  })

  it('varie avec la déclinaison dans un même cadre', () => {
    expect(longueurArcDeg(60, -25).value).toBeCloseTo(13.63, 2)
    expect(longueurArcDeg(60, 60).value).toBeCloseTo(7.52, 2)
  })

  it('annonce qu’un filé lisible demande au moins une heure', () => {
    const diagnostic = diagnosticFile({
      projecteur: proj({ azimutDeg: 180, hauteurDeg: 30 }),
      latitudeDeg: SITE.latitudeDeg,
      axePoleNord: AXE_POLE,
      dureeMin: 20,
      decMinAbsDeg: 0,
      decMaxAbsDeg: 60,
      hauteurCadreDeg: 100.2,
      arcsTronques: 0,
    })
    expect(diagnostic.longueurArcMaxDeg.value).toBeCloseTo(5.01, 2)
    // 5 % de la hauteur du cadre : des étoiles étirées, pas un filé.
    expect(diagnostic.fractionHauteurCadre).toBeCloseTo(0.05, 2)
    expect(diagnostic.messages.join(' ')).toMatch(
      new RegExp(`au moins ${K('DUREE_FILE_LISIBLE_MIN')} min`),
    )
  })
})

describe('§9.3 — géométrie des arcs', () => {
  const etoile = versVecteur(60, 20)

  it('trace une polyligne échantillonnée au pas d’angle horaire du registre', () => {
    const arc = arcEtoile(proj({ azimutDeg: 90, hauteurDeg: 40 }), etoile, 60, AXE_POLE)
    const points = arc.segments.flat().length
    const attendu = Math.ceil(
      (K('ROTATION_CIEL_DEG_H') * 1) / K('PAS_ANGLE_HORAIRE_FILE_DEG'),
    )
    expect(points).toBeGreaterThan(attendu / 2)
    expect(arc.longueurPx).toBeGreaterThan(0)
  })

  it('n’est PAS un cercle concentrique dès que le pôle sort du centre de l’image', () => {
    const dispersion = (mode: ModeProjection, azimutDeg: number, hauteurDeg: number): number => {
      const projecteurVue = proj({ mode, azimutDeg, hauteurDeg, fovDeg: 120 })
      const pole = positionPole(projecteurVue, SITE.latitudeDeg, AXE_POLE)
      const arc = arcEtoile(projecteurVue, versVecteur(0, 60), 240, AXE_POLE)
      const rayons = arc.segments
        .flat()
        .map((p) => Math.hypot(p.xPx - pole.xPx!, p.yPx - pole.yPx!))
      const moyenne = rayons.reduce((s, v) => s + v, 0) / rayons.length
      return Math.max(...rayons.map((v) => Math.abs(v - moyenne))) / moyenne
    }

    // Vue centrée SUR le pôle : la projection étant radiale, l'arc y est exactement un cercle.
    expect(dispersion('MODE_FISHEYE', 0, SITE.latitudeDeg)).toBeLessThan(0.001)
    expect(dispersion('MODE_CADRE', 0, SITE.latitudeDeg)).toBeLessThan(0.001)

    // Pôle décentré, cadrage réel : le cercle de déclinaison devient une conique, et le
    // rayon apparent varie de plusieurs pour cent. Tracer des cercles concentriques serait faux.
    expect(dispersion('MODE_CADRE', 20, 55)).toBeGreaterThan(0.02)
  })

  it('tronque les arcs au bord du cadre et le signale', () => {
    // Quatre heures : l'étoile traverse le champ et en sort.
    const arc = arcEtoile(proj({ azimutDeg: 180, hauteurDeg: 30, fovDeg: 40 }), etoile, 240, AXE_POLE)
    expect(arc.tronque).toBe(true)
    const diagnostic = diagnosticFile({
      projecteur: proj({ azimutDeg: 180, hauteurDeg: 30, fovDeg: 40 }),
      latitudeDeg: SITE.latitudeDeg,
      axePoleNord: AXE_POLE,
      dureeMin: 240,
      decMinAbsDeg: 0,
      decMaxAbsDeg: 40,
      hauteurCadreDeg: 30,
      arcsTronques: 12,
    })
    expect(diagnostic.messages.join(' ')).toMatch(/entrent et sortent du champ/)
  })

  it('suit le sens de rotation du ciel : les étoiles dérivent vers l’ouest', () => {
    // Cadre au sud : le ciel passe de l'est vers l'ouest, donc de la gauche vers la droite.
    const projecteurVue = proj({ azimutDeg: 180, hauteurDeg: 40, fovDeg: 60 })
    const centre = projecteurVue.inverse(LARGEUR / 2, HAUTEUR / 2)
    const arc = arcEtoile(projecteurVue, centre, 60, AXE_POLE)
    const points = arc.segments.flat()
    expect(points[points.length - 1]!.xPx).toBeGreaterThan(points[0]!.xPx)
  })
})

describe('§9.3 — brillance de la trace', () => {
  // Échantillonnages du setup grand angle (10 mm) et du téléobjectif (120 mm) de l'Annexe A.
  const ECH_10MM = 105.6
  const ECH_120MM = 8.8

  it('compte la pose vue par un pixel du capteur, pas par un pixel d’écran', () => {
    // 105,6 "/px traversées à 15,041 "/s : sept secondes par pixel, à l'équateur céleste.
    expect(poseParPixelS(7200, ECH_10MM, 0)).toBeCloseTo(ECH_10MM / 15.041, 3)
    // Elle NE dépend PAS de la durée du filé : allonger la séquence allonge la trace,
    // il ne l'éclaircit pas.
    expect(poseParPixelS(28800, ECH_10MM, 0)).toBeCloseTo(poseParPixelS(7200, ECH_10MM, 0), 6)
    // Une focale plus longue étale le même flux sur plus de pixels : la trace pâlit.
    expect(poseParPixelS(7200, ECH_120MM, 0)).toBeLessThan(poseParPixelS(7200, ECH_10MM, 0))
    // Près du pôle, l'étoile traîne moins vite et le pixel reçoit plus longtemps.
    expect(poseParPixelS(7200, ECH_10MM, 60)).toBeCloseTo(poseParPixelS(7200, ECH_10MM, 0) * 2, 3)
  })

  it('ne dépasse jamais la durée réellement posée', () => {
    // Pose d'une seconde : le pixel n'a pas vu l'étoile plus longtemps que ça.
    expect(poseParPixelS(1, ECH_10MM, 0)).toBe(1)
  })
})
