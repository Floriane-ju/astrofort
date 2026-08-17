/**
 * §9.2 — Prévisualisation de champ à étoiles fixes.
 *
 * Ce qui est vérifié ici est ce qui distingue une prévisualisation d'une carte : les étoiles
 * brillantes sont aux positions réelles du catalogue, le fond au-delà du seuil est généré et
 * déclaré comme tel, sa densité suit la latitude galactique, la bande de la Voie lactée
 * s'efface avec le fond de ciel du site, et le même cadre régénéré deux fois donne exactement
 * le même rendu.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Etoile } from '../src/data/catalog.ts'
import { MENTION_SEMIS, semisGeneratif } from '../src/data/semis.ts'
import {
  contrasteVoieLactee,
  densiteRelative,
  latitudeGalactiqueDeg,
  magnitudeLimitePrevisu,
  opaciteEtoile,
  vignettageDiaph,
  type EntreeProfondeur,
} from '../src/core/galactique.ts'
import { construitIndex } from '../src/core/index-ciel.ts'
import { axePoleDeDate, cielInstantane, epoqueAnnee } from '../src/core/horloges.ts'
import type { Site } from '../src/core/ephem.ts'
import { versVecteur } from '../src/core/mat3.ts'
import { projecteur, type Vue } from '../src/core/projection.ts'
import { dessineChamp, type EntreeDessinChamp } from '../src/ui/dessine-champ.ts'
import { PanneauFile } from '../src/ui/PanneauFile.tsx'
import { K } from '../src/registry/constants.ts'

const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const DATE = new Date('2026-08-15T22:00:00Z')
const LARGEUR = 800
const HAUTEUR = 600
const AXE_POLE = axePoleDeDate(epoqueAnnee(DATE))
/** Le semis complet est produit une fois pour tout le fichier : il ne dépend d'aucun réglage. */
const SEMIS = semisGeneratif()
const INDEX_SEMIS = construitIndex(SEMIS)

interface Appel {
  readonly nom: string
  readonly args: readonly unknown[]
}

/** Contexte 2D instrumenté : il enregistre, il ne peint pas. */
function contexteEspion() {
  const appels: Appel[] = []
  const enregistre =
    (nom: string) =>
    (...args: unknown[]) => {
      appels.push({ nom, args })
    }
  const couleurs: string[] = []
  const alphas: number[] = []
  let alpha = 1
  return {
    appels,
    couleurs,
    /** Opacités successivement appliquées : c'est la brillance de rendu de chaque étoile. */
    alphas,
    set globalAlpha(v: number) {
      alpha = v
      alphas.push(v)
    },
    get globalAlpha() {
      return alpha
    },
    lineWidth: 1,
    lineCap: 'butt',
    set fillStyle(v: unknown) {
      couleurs.push(String(v))
    },
    get fillStyle() {
      return couleurs[couleurs.length - 1] ?? ''
    },
    set strokeStyle(v: string) {
      couleurs.push(v)
    },
    get strokeStyle() {
      return couleurs[couleurs.length - 1] ?? ''
    },
    fillRect: enregistre('fillRect'),
    beginPath: enregistre('beginPath'),
    closePath: enregistre('closePath'),
    moveTo: enregistre('moveTo'),
    lineTo: enregistre('lineTo'),
    arc: enregistre('arc'),
    stroke: enregistre('stroke'),
    fill: enregistre('fill'),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  }
}

const VUE: Vue = {
  mode: 'MODE_CADRE',
  fovDeg: 100,
  largeurPx: LARGEUR,
  hauteurPx: HAUTEUR,
  azimutDeg: 180,
  hauteurDeg: 40,
  rotationDeg: 0,
}

/** Setup grand angle de référence : 10 mm f/2,8 sous un ciel Bortle 4,5. */
const PROFONDEUR: EntreeProfondeur = {
  tPoseS: 25,
  dMm: 10 / 2.8,
  zpSys: K('ZP_SYS_GENERIQUE'),
  eCielPxS: 1.68,
  readNoiseE: 1.5,
}

const CIEL = cielInstantane(SITE, DATE)
const PROJECTEUR = projecteur(VUE, CIEL.matrice)

/** Étoile placée exactement au centre du cadre, pour vérifier la position rendue. */
function etoileAuCentre(magV = 2): Etoile {
  const centre = PROJECTEUR.inverse(LARGEUR / 2, HAUTEUR / 2)
  const lon = (Math.atan2(centre.y, centre.x) * 180) / Math.PI
  const lat = (Math.asin(centre.z) * 180) / Math.PI
  return { adDeg: lon, decDeg: lat, magV, bv: 0.5 }
}

function rend(options: Partial<EntreeDessinChamp> = {}) {
  const ctx = contexteEspion()
  const sortie = dessineChamp({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    projecteur: PROJECTEUR,
    indexReel: construitIndex([etoileAuCentre()]),
    indexSemis: INDEX_SEMIS,
    magLimite: 10,
    profondeur: PROFONDEUR,
    echApx: 105.6,
    suiviActif: false,
    sbCiel: 21.0,
    dureeS: 1,
    latitudeDeg: SITE.latitudeDeg,
    axePoleNord: AXE_POLE,
    voieLactee: true,
    vignettage: true,
    modeNuit: false,
    ...options,
  })
  return { ctx, sortie }
}

describe('§9.2 — coordonnées galactiques', () => {
  it('place le centre galactique et le pôle nord galactique où ils sont', () => {
    // Sagittarius A*, J2000 : 266,405° / −28,936°.
    expect(latitudeGalactiqueDeg(versVecteur(266.405, -28.936))).toBeCloseTo(0, 1)
    expect(
      latitudeGalactiqueDeg(
        versVecteur(K('POLE_GALACTIQUE_AD_DEG'), K('POLE_GALACTIQUE_DEC_DEG')),
      ),
    ).toBeCloseTo(90, 6)
  })

  it('module la densité par la latitude galactique', () => {
    expect(densiteRelative(0).value).toBeCloseTo(1, 6)
    // À une échelle de décroissance, il ne reste que 1/e de la densité du plan.
    expect(densiteRelative(K('ECHELLE_LATITUDE_GALACTIQUE_DEG')).value).toBeCloseTo(1 / Math.E, 6)
    expect(densiteRelative(-60).value).toBeLessThan(densiteRelative(-10).value)
  })
})

describe('§9.2 — semis génératif', () => {
  const semis = SEMIS

  it('concentre les étoiles générées dans le plan galactique', () => {
    const proche = semis.filter(
      (e) => Math.abs(latitudeGalactiqueDeg(versVecteur(e.adDeg, e.decDeg))) < 10,
    ).length
    const loin = semis.filter(
      (e) => Math.abs(latitudeGalactiqueDeg(versVecteur(e.adDeg, e.decDeg))) > 40,
    ).length
    // Sans cette modulation, la bande de la Voie lactée n'apparaîtrait pas.
    expect(proche).toBeGreaterThan(loin)
  })

  it('ne génère aucune étoile plus brillante que le seuil catalographié', () => {
    const seuil = K('SEUIL_MAG_ETOILES_REELLES')
    const magnitudes = semis.map((e) => e.magV)
    expect(magnitudes.reduce((a, b) => Math.min(a, b))).toBeGreaterThanOrEqual(seuil)
    expect(magnitudes.reduce((a, b) => Math.max(a, b))).toBeLessThanOrEqual(K('SEMIS_MAG_MAX'))
  })

  it('déclare que ces étoiles sont générées, et le plafond appliqué', () => {
    expect(MENTION_SEMIS).toMatch(/GÉNÉRÉES/)
    expect(MENTION_SEMIS).toMatch(new RegExp(String(K('SEMIS_ETOILES_TOTAL'))))
  })

  it('rend deux fois le même cadre à l’identique — graine déterministe', () => {
    const premier = rend().ctx.appels
    const second = rend().ctx.appels
    expect(second.length).toBe(premier.length)
    expect(JSON.stringify(second)).toBe(JSON.stringify(premier))
  })
})

describe('§9.2 — les trois couches', () => {
  it('trace l’étoile réelle à la position exacte du catalogue', () => {
    const { ctx, sortie } = rend({ voieLactee: false, vignettage: false })
    expect(sortie.etoilesReelles).toBe(1)
    const arcs = ctx.appels.filter((a) => a.nom === 'arc')
    const centre = arcs.find(
      (a) =>
        Math.abs((a.args[0] as number) - LARGEUR / 2) < 1 &&
        Math.abs((a.args[1] as number) - HAUTEUR / 2) < 1,
    )
    expect(centre).toBeDefined()
  })

  it('compose les couches 2 et 3 même quand aucune étoile réelle n’est dans le champ', () => {
    const { sortie } = rend({ indexReel: construitIndex([]) })
    expect(sortie.etoilesReelles).toBe(0)
    expect(sortie.etoilesGenerees).toBeGreaterThan(0)
  })

  it('s’arrête au catalogue réel tant que la pose ne descend pas sous le seuil', () => {
    const { sortie } = rend({ magLimite: K('SEUIL_MAG_ETOILES_REELLES') })
    expect(sortie.etoilesGenerees).toBe(0)
  })

  it('efface la Voie lactée quand le fond de ciel est celui d’une ville', () => {
    expect(contrasteVoieLactee(21.5)).toBeCloseTo(1, 6)
    expect(contrasteVoieLactee(18.4)).toBe(0)
    const { ctx } = rend({ sbCiel: 18.4, vignettage: false })
    // Aucune surface de bande n'est peinte : seul le fond du canevas l'est.
    expect(ctx.appels.filter((a) => a.nom === 'closePath').length).toBe(0)
  })
})

describe('§9.2 — modulation par les paramètres de capture', () => {
  const profondeur = (tPoseS: number, sbCiel: number, dMm: number) =>
    magnitudeLimitePrevisu({
      tPoseS,
      dMm,
      zpSys: K('ZP_SYS_GENERIQUE'),
      // Flux de fond de ciel approché par la même loi que §7.1, à pitch et ouverture fixés.
      eCielPxS: K('BASE_MAGNITUDE') ** (-(sbCiel - K('ZP_SYS_GENERIQUE')) / K('POGSON')) * (5.12 / 2.8) ** 2,
      readNoiseE: 1.5,
    }).value

  it('descend plus profond avec une pose plus longue', () => {
    expect(profondeur(60, 21, 3.57)).toBeGreaterThan(profondeur(15, 21, 3.57))
  })

  it('descend moins profond sous un ciel pollué', () => {
    expect(profondeur(25, 18.5, 3.57)).toBeLessThan(profondeur(25, 21.5, 3.57))
  })

  it('descend plus profond avec une pupille plus grande', () => {
    expect(profondeur(25, 21, 20)).toBeGreaterThan(profondeur(25, 21, 3.57))
  })

  it('ovalise les étoiles quand la pose est longue : la trace devient une polyligne', () => {
    const ponctuel = rend({ dureeS: 1, voieLactee: false, vignettage: false })
    const file = rend({ dureeS: 600, voieLactee: false, vignettage: false })
    expect(ponctuel.ctx.appels.filter((a) => a.nom === 'arc').length).toBeGreaterThan(0)
    expect(file.ctx.appels.filter((a) => a.nom === 'lineTo').length).toBeGreaterThan(0)
    expect(file.ctx.appels.filter((a) => a.nom === 'stroke').length).toBeGreaterThan(0)
  })

  it('assombrit les coins et laisse le centre intact', () => {
    expect(vignettageDiaph(0).value).toBe(0)
    expect(vignettageDiaph(1).value).toBeCloseTo(K('VIGNETTAGE_COINS_DIAPH'), 6)
    // Loi en carré du rayon relatif : à mi-champ, le quart de l'atténuation des coins.
    expect(vignettageDiaph(0.5).value).toBeCloseTo(K('VIGNETTAGE_COINS_DIAPH') / 4, 6)
  })
})

describe('§9 — le panneau du filé', () => {
  it('compose les quatre features sur un seul pointage', () => {
    const html = renderToStaticMarkup(
      createElement(PanneauFile, {
        site: SITE,
        focaleMm: 10,
        ouvertureN: 2.8,
        pitchUm: 5.12,
        capteurLMm: 35.9,
        capteurHMm: 23.9,
        fovLDeg: 121.7,
        fovHDeg: 100.2,
        echApx: 105.6,
        tailleRawMo: 33,
        profondeur: { ...PROFONDEUR, zpEstime: true },
        tMaxSuiviS: null,
        autonomieCipa: null,
        modeObjectif: 'MODE_CADRE',
      }),
    )
    expect(html).toContain('Pose maximale par déclinaison')
    expect(html).toContain('Prévisualisation de champ')
    expect(html).toContain('Filé d’étoiles')
    expect(html).toContain('Séquence de filé')
    // La règle des 500 est affichée, et la carte de pose porte une valeur par cellule.
    expect(html).toContain('Règle des 500')
    expect(html).toContain('carte-pose')
    // Sans autonomie constructeur, aucun nombre de batteries n'est inventé.
    expect(html).toContain('[DONNÉE MANQUANTE]')
  })
})

describe('§9.3 — une trace est moins brillante qu’un point', () => {
  it('pâlit la trace d’une même étoile quand la focale étale son flux sur plus de pixels', () => {
    // Une seule étoile de magnitude 7, deux heures de filé, même ciel : au grand angle chaque
    // pixel la voit sept secondes, au téléobjectif moins d'une seconde.
    const seule = (echApx: number) =>
      rend({
        dureeS: 7200,
        echApx,
        indexReel: construitIndex([etoileAuCentre(7)]),
        indexSemis: construitIndex([]),
        voieLactee: false,
        vignettage: false,
      }).ctx.alphas

    const grandAngle = seule(105.6)
    const teleobjectif = seule(8.8)
    expect(grandAngle.length).toBeGreaterThan(0)
    expect(teleobjectif[0]!).toBeLessThan(grandAngle[0]!)
  })

  it('étire l’affichage en racine du rapport signal sur bruit, saturation comprise', () => {
    // Une étoile très au-dessus du seuil sature le rendu.
    expect(opaciteEtoile(2, 10)).toBe(1)
    // Au seuil de détection, la trace est visible mais faible.
    expect(opaciteEtoile(10, 10)).toBeCloseTo(
      Math.sqrt(K('SNR_DETECTION_PREVISU') / K('SNR_RENDU_SATURATION')),
      6,
    )
    // Une magnitude sous le seuil : deux fois et demie plus pâle encore.
    expect(opaciteEtoile(11, 10)).toBeLessThan(opaciteEtoile(10, 10))
  })
})
