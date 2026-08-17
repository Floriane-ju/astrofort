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
  filtreArcCadre,
  poseParPixelS,
  longueurArcDeg,
  positionPole,
} from '../src/core/file-etoiles.ts'
import { axePoleDeDate, cielInstantane, epoqueAnnee } from '../src/core/horloges.ts'
import type { Site } from '../src/core/ephem.ts'
import {
  applique,
  rotationAutourDe,
  separationDeg,
  versVecteur,
  type Vec3,
} from '../src/core/mat3.ts'
import {
  projecteur,
  type ModeProjection,
  type PointEcran,
  type Vue,
} from '../src/core/projection.ts'
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

/** Position exacte de l'étoile après `angleDeg` d'angle horaire écoulé. */
function apres(etoile: Vec3, angleDeg: number): Vec3 {
  return applique(rotationAutourDe(AXE_POLE, -angleDeg), etoile)
}

/** Distance d'un point au segment [a, b], en pixels. */
function distanceAuSegment(p: PointEcran, a: PointEcran, b: PointEcran): number {
  const dx = b.xPx - a.xPx
  const dy = b.yPx - a.yPx
  const carre = dx * dx + dy * dy
  if (carre === 0) return Math.hypot(p.xPx - a.xPx, p.yPx - a.yPx)
  const t = Math.max(0, Math.min(1, ((p.xPx - a.xPx) * dx + (p.yPx - a.yPx) * dy) / carre))
  return Math.hypot(p.xPx - (a.xPx + t * dx), p.yPx - (a.yPx + t * dy))
}

describe('T-0024 — pas d’échantillonnage dérivé de la longueur projetée', () => {
  const projecteurVue = proj({ azimutDeg: 0, hauteurDeg: SITE.latitudeDeg, fovDeg: 120 })
  const BALAYAGE_480_MIN_DEG = K('ROTATION_CIEL_DEG_H') * 8
  const PAS_FIN = Math.ceil(BALAYAGE_480_MIN_DEG / K('PAS_ANGLE_HORAIRE_FILE_DEG'))

  /** Écart maximal entre la polyligne rendue et l'arc exact, en pixels. */
  function ecartMaxPx(etoile: Vec3, dureeMin: number): number {
    const arc = arcEtoile(projecteurVue, etoile, dureeMin, AXE_POLE)
    const balayageDeg = K('ROTATION_CIEL_DEG_H') * (dureeMin / 60)
    let pire = 0
    // L'arc exact est échantillonné dix fois plus finement que le pas de référence de §9.3 :
    // c'est lui la vérité contre laquelle la polyligne est jugée.
    const references = Math.ceil(balayageDeg / (K('PAS_ANGLE_HORAIRE_FILE_DEG') / 10))
    for (let i = 0; i <= references; i++) {
      const point = projecteurVue.projette(apres(etoile, (balayageDeg * i) / references))
      if (point === null) continue
      if (point.xPx < 0 || point.yPx < 0 || point.xPx > LARGEUR || point.yPx > HAUTEUR) continue
      let distance = Infinity
      for (const segment of arc.segments) {
        for (let j = 1; j < segment.length; j++) {
          distance = Math.min(distance, distanceAuSegment(point, segment[j - 1]!, segment[j]!))
        }
      }
      if (distance !== Infinity && distance > pire) pire = distance
    }
    return pire
  }

  it('reste sous le pixel pour l’arc le plus long du cadre', () => {
    // Équateur céleste : la trace la plus longue possible, huit heures durant.
    expect(ecartMaxPx(versVecteur(0, 0), 480)).toBeLessThan(1)
    expect(ecartMaxPx(versVecteur(120, 20), 480)).toBeLessThan(1)
  })

  it('ne fait plus payer 481 pas à une étoile proche du pôle', () => {
    const polaire = arcEtoile(projecteurVue, versVecteur(0, 89.5), 480, AXE_POLE)
    const points = polaire.segments.flat().length
    expect(points).toBeLessThan(PAS_FIN / 4)
    // La trace reste fidèle malgré le pas élargi : c'est la longueur en pixels qui décide.
    expect(ecartMaxPx(versVecteur(0, 89.5), 480)).toBeLessThan(1)
  })

  it('garde le pas de §9.3 comme pas le plus fin : jamais de subdivision au-delà', () => {
    const equatoriale = arcEtoile(projecteurVue, versVecteur(0, 0), 480, AXE_POLE)
    expect(equatoriale.segments.flat().length).toBeLessThanOrEqual(PAS_FIN + 1)
  })
})

describe('T-0023 — écarter une étoile dont l’arc ne peut pas toucher le cadre', () => {
  const CENTRE = versVecteur(90, 20)
  const RAYON_DEG = 12

  /** Vérité de référence : l'arc entre-t-il réellement dans la calotte du cadre ? */
  function toucheVraiment(etoile: Vec3, balayageDeg: number): boolean {
    const pas = 720
    for (let i = 0; i <= pas; i++) {
      if (separationDeg(apres(etoile, (balayageDeg * i) / pas), CENTRE) <= RAYON_DEG) return true
    }
    return false
  }

  it('n’écarte jamais une étoile dont la trace entre dans le cadre', () => {
    for (const balayageDeg of [0, 30, 120]) {
      const filtre = filtreArcCadre(CENTRE, RAYON_DEG, AXE_POLE, balayageDeg)
      let retenues = 0
      let total = 0
      // Semis régulier de toute la sphère : le filtre est jugé sur le ciel entier, pas sur
      // quelques cas choisis.
      for (let ad = 0; ad < 360; ad += 3) {
        for (let dec = -87; dec <= 87; dec += 3) {
          const etoile = versVecteur(ad, dec)
          total++
          const garde = filtre(etoile.x, etoile.y, etoile.z)
          if (garde) retenues++
          // Aucun faux négatif : c'est cette propriété qui garantit l'image inchangée.
          if (toucheVraiment(etoile, balayageDeg)) expect(garde).toBe(true)
        }
      }
      // Et il trie vraiment : sans cela, le filtre ne servirait à rien.
      expect(retenues).toBeLessThan(total / 2)
    }
  })

  it('ne retient que la bande de déclinaison du cadre quand rien ne balaie', () => {
    const filtre = filtreArcCadre(CENTRE, RAYON_DEG, AXE_POLE, 0)
    expect(filtre(CENTRE.x, CENTRE.y, CENTRE.z)).toBe(true)
    // Même angle horaire, déclinaison très différente : le cercle passe loin du cadre.
    const loin = versVecteur(90, -60)
    expect(filtre(loin.x, loin.y, loin.z)).toBe(false)
  })
})
