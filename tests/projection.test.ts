/**
 * §3.3 — Moteur de rendu unifié.
 *
 * Le critère central du PRD n'est pas une image mais une propriété d'architecture : le même
 * pointage doit coïncider en MODE_PLANETARIUM et en MODE_CADRE, sans divergence
 * systématique. Une seule implémentation de la projection le garantit ; deux bases de code
 * le trahiraient, et le défaut serait invisible en développement.
 */

import { describe, expect, it } from 'vitest'
import {
  bornesZoom,
  echelleProjection,
  etatProfondeur,
  magnitudeLimite,
  magnitudeRendue,
  matriceVue,
  pointEcran,
  porteeUtilePx,
  projecteur,
  rayonEtoilePx,
  type Vue,
} from '../src/core/projection.ts'
import { IDENTITE, separationDeg, versVecteur } from '../src/core/mat3.ts'
import { K } from '../src/registry/constants.ts'

const LARGEUR = 1920
const HAUTEUR = 1080

function vue(mode: Vue['mode'], fovDeg: number): Vue {
  return {
    mode,
    fovDeg,
    largeurPx: LARGEUR,
    hauteurPx: HAUTEUR,
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }
}

/**
 * Vue centrée sur l'axe x : le centre de visée est alors (1, 0, 0), et une direction à
 * l'angle θ du centre et à l'angle de position φ s'écrit sans passer par la machinerie
 * testée — le test ne se valide pas lui-même.
 */
function vueCentree(mode: Vue['mode'], fovDeg: number): Vue {
  return { ...vue(mode, fovDeg), azimutDeg: 0, hauteurDeg: 0, rotationDeg: 0 }
}

function directionA(thetaDeg: number, phiDeg: number) {
  const t = (thetaDeg * Math.PI) / 180
  const p = (phiDeg * Math.PI) / 180
  return { x: Math.cos(t), y: Math.sin(t) * Math.cos(p), z: Math.sin(t) * Math.sin(p) }
}

/** Distance de corde : `acos` perd la moitié de ses chiffres près de zéro. */
function corde(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

describe('projection unifiée §3.3', () => {
  it('projette le centre de visée au centre du canevas, quel que soit le mode', () => {
    for (const mode of ['MODE_PLANETARIUM', 'MODE_CADRE', 'MODE_FISHEYE'] as const) {
      const p = projecteur(vue(mode, 60), IDENTITE).projette(versVecteur(180, 40))
      expect(p, mode).not.toBeNull()
      expect(p!.xPx, mode).toBeCloseTo(LARGEUR / 2, 6)
      expect(p!.yPx, mode).toBeCloseTo(HAUTEUR / 2, 6)
    }
  })

  /**
   * T-0065 — `projetteEn` existe pour que les boucles chaudes n'allouent rien ; `projette`
   * n'en est que l'emballage. Ce test est la garantie que §3.3 tient encore : deux formes
   * de la même projection, un seul résultat, y compris hors du domaine projetable et au
   * point singulier du fisheye.
   */
  it('donne le même résultat en place et en allouant, dans les trois modes', () => {
    const out = pointEcran()
    for (const mode of ['MODE_PLANETARIUM', 'MODE_CADRE', 'MODE_FISHEYE'] as const) {
      const p = projecteur(vue(mode, 60), IDENTITE)
      for (let lon = 0; lon < 360; lon += 11) {
        for (let lat = -80; lat <= 80; lat += 13) {
          const v = versVecteur(lon, lat)
          const attendu = p.projette(v)
          const projete = p.projetteEn(v.x, v.y, v.z, out)
          expect(projete, `${mode} ${lon}/${lat}`).toBe(attendu !== null)
          if (attendu === null) continue
          expect(out.xPx, `${mode} ${lon}/${lat}`).toBe(attendu.xPx)
          expect(out.yPx, `${mode} ${lon}/${lat}`).toBe(attendu.yPx)
          expect(out.thetaDeg, `${mode} ${lon}/${lat}`).toBe(attendu.thetaDeg)
        }
      }
      // Le centre de visée : c'est là que le fisheye prend sa branche singulière.
      const centre = versVecteur(180, 40)
      const attendu = p.projette(centre)!
      p.projetteEn(centre.x, centre.y, centre.z, out)
      expect(out.xPx, mode).toBe(attendu.xPx)
      expect(out.yPx, mode).toBe(attendu.yPx)
      expect(out.thetaDeg, mode).toBe(attendu.thetaDeg)
    }
  })

  it('fait coïncider planétarium et cadre sans divergence systématique', () => {
    const planetarium = projecteur(vueCentree('MODE_PLANETARIUM', 30), IDENTITE)
    const cadre = projecteur(vueCentree('MODE_CADRE', 30), IDENTITE)

    for (const thetaDeg of [1, 3, 7, 12, 15]) {
      const rapports: number[] = []
      for (let phi = 0; phi < 360; phi += 15) {
        const point = directionA(thetaDeg, phi)
        const a = planetarium.projette(point)
        const b = cadre.projette(point)
        expect(a).not.toBeNull()
        expect(b).not.toBeNull()

        // Même rayon depuis le centre du canevas : la direction est identique, seule la
        // distance radiale diffère — c'est la déformation de projection, pas un décalage.
        const angleA = Math.atan2(a!.yPx - HAUTEUR / 2, a!.xPx - LARGEUR / 2)
        const angleB = Math.atan2(b!.yPx - HAUTEUR / 2, b!.xPx - LARGEUR / 2)
        expect(angleA).toBeCloseTo(angleB, 9)
        expect(a!.thetaDeg).toBeCloseTo(thetaDeg, 9)
        expect(b!.thetaDeg).toBeCloseTo(thetaDeg, 9)

        rapports.push(
          Math.hypot(a!.xPx - LARGEUR / 2, a!.yPx - HAUTEUR / 2) /
            Math.hypot(b!.xPx - LARGEUR / 2, b!.yPx - HAUTEUR / 2),
        )
      }
      // Le rapport ne dépend que de θ, jamais de l'azimut : aucune divergence privilégiant
      // une direction du champ.
      for (const rapport of rapports) expect(rapport).toBeCloseTo(rapports[0]!, 9)
      // Les deux modes cadrent le même champ : ils coïncident exactement au bord, et
      // s'écartent de moins de 2 % au centre. C'est la déformation de projection, admise
      // par le PRD, et elle ne dépend que de θ.
      if (thetaDeg === 15) expect(rapports[0]!).toBeCloseTo(1, 9)
      else expect(Math.abs(rapports[0]! - 1)).toBeLessThan(0.02)
    }
  })

  it('ne projette rien à l’infini à 180° de champ en stéréographique', () => {
    const p = projecteur(vue('MODE_PLANETARIUM', K('FOV_MAX_DEG')), IDENTITE)
    for (let lon = 0; lon < 360; lon += 5) {
      for (let lat = -90; lat <= 90; lat += 5) {
        const point = p.projette(versVecteur(lon, lat))
        if (point === null) continue
        expect(Number.isFinite(point.xPx), `${lon}/${lat}`).toBe(true)
        expect(Number.isFinite(point.yPx), `${lon}/${lat}`).toBe(true)
      }
    }
    // Le point diamétralement opposé au centre n'est pas projetable : il est écarté, pas
    // renvoyé à l'infini.
    expect(p.projette(versVecteur(0, -40))).toBeNull()
  })

  it('écarte ce qui passe derrière le plan tangent en mode cadre', () => {
    const p = projecteur(vue('MODE_CADRE', 60), IDENTITE)
    expect(p.projette(versVecteur(0, -40))).toBeNull()
    expect(p.projette(versVecteur(90, 0))).toBeNull()
  })

  it('remplit exactement la largeur avec le champ demandé', () => {
    for (const mode of ['MODE_PLANETARIUM', 'MODE_CADRE', 'MODE_FISHEYE'] as const) {
      const v = vue(mode, 40)
      const p = projecteur(v, IDENTITE)
      const bord = p.inverse(LARGEUR, HAUTEUR / 2)
      expect(separationDeg(bord, versVecteur(180, 40)), mode).toBeCloseTo(20, 6)
      expect(echelleProjection(v), mode).toBeGreaterThan(0)
    }
  })

  it('retrouve la direction sous un point de l’écran', () => {
    for (const mode of ['MODE_PLANETARIUM', 'MODE_CADRE', 'MODE_FISHEYE'] as const) {
      const p = projecteur(vue(mode, 60), IDENTITE)
      const origine = versVecteur(190, 47)
      const ecran = p.projette(origine)
      expect(ecran).not.toBeNull()
      const retour = p.inverse(ecran!.xPx, ecran!.yPx)
      expect(corde(origine, retour), mode).toBeLessThan(1e-12)
    }
  })

  it('n’a pas de singularité au zénith : l’azimut y tient lieu de roulis', () => {
    const m = matriceVue(0, 90, 0)
    expect(m.every((c) => Number.isFinite(c))).toBe(true)
  })
})

describe('profondeur asservie au zoom §3.3', () => {
  it('donne la magnitude de base au champ de référence', () => {
    expect(magnitudeLimite(K('FOV_REFERENCE_RENDU_DEG')).value).toBeCloseTo(
      K('MAG_BASE_RENDU'),
      9,
    )
  })

  it('descend d’environ 5,4 magnitudes en passant de 60° à 5°', () => {
    expect(magnitudeLimite(5).value).toBeCloseTo(6.5 + 5 * Math.log10(12), 6)
  })

  it('plafonne la profondeur par le fond de ciel en vue réaliste', () => {
    const bortle8 = 5.0
    expect(magnitudeRendue(60, bortle8, true).value).toBeCloseTo(bortle8, 9)
    expect(magnitudeRendue(60, bortle8, false).value).toBeCloseTo(K('MAG_BASE_RENDU'), 9)
    expect(magnitudeRendue(60, bortle8, true).note).toMatch(/plafonnée par le fond de ciel/)
  })

  it('déclare le catalogue épuisé sous la borne du paquet chargé', () => {
    const profondeurHyg = 9
    const large = etatProfondeur(60, profondeurHyg, null, false)
    expect(large.catalogueEpuise).toBe(false)
    const serre = etatProfondeur(5, profondeurHyg, null, false)
    expect(serre.catalogueEpuise).toBe(true)
    expect(serre.cause).toMatch(/Gaia/)
    expect(serre.cause).toMatch(/ne sont pas générées/)
  })

  it('plafonne le zoom à 15° sans le paquet Gaia, et le déclare', () => {
    const sans = bornesZoom(false)
    expect(sans.fovMinDeg).toBe(K('FOV_MIN_SANS_GAIA_DEG'))
    expect(sans.cause).toMatch(/12 Mo/)
    const avec = bornesZoom(true)
    expect(avec.fovMinDeg).toBe(K('FOV_MIN_AVEC_GAIA_DEG'))
    expect(avec.cause).toBeUndefined()
  })

  it('refuse un point projeté hors de portée, singularité comprise', () => {
    // Près de l'antipode de la visée, le facteur radial diverge : le point est « projetable »
    // au sens de la formule, mais à des dizaines de milliers de pixels. Deux voisins d'une
    // polyligne y tombent de part et d'autre du canevas, et la corde traverse l'image.
    const vue: Vue = {
      mode: 'MODE_PLANETARIUM',
      fovDeg: 60,
      largeurPx: 960,
      hauteurPx: 540,
      azimutDeg: 0,
      hauteurDeg: 0,
      rotationDeg: 0,
    }
    const proj = projecteur(vue, IDENTITE)
    const portee = porteeUtilePx(vue)
    expect(portee).toBeGreaterThan(Math.hypot(vue.largeurPx, vue.hauteurPx))

    const dansLeChamp = proj.projette(versVecteur(0, 0))
    expect(dansLeChamp).not.toBeNull()

    // Juste hors du champ affiché : toujours projeté, c'est ce qui permet aux polylignes de
    // sortir proprement de l'image.
    const horsChamp = proj.projette(versVecteur(vue.fovDeg, 0))
    expect(horsChamp).not.toBeNull()
    expect(Math.hypot(horsChamp!.xPx - vue.largeurPx / 2, horsChamp!.yPx - vue.hauteurPx / 2))
      .toBeGreaterThan(vue.largeurPx / 2)

    // À un degré de l'antipode : refusé.
    expect(proj.projette(versVecteur(179, 0))).toBeNull()
  })

  it('fait décroître le rayon d’une étoile avec sa magnitude', () => {
    expect(rayonEtoilePx(0)).toBeCloseTo(K('RAYON_ETOILE_R0_PX'), 9)
    expect(rayonEtoilePx(5) / rayonEtoilePx(0)).toBeCloseTo(10 ** (-0.15 * 5), 9)
    expect(rayonEtoilePx(6)).toBeLessThan(rayonEtoilePx(1))
  })
})
