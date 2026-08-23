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
  densiteRelative,
  latitudeGalactiqueDeg,
  magnitudeLimitePrevisu,
  magnitudePlafondSemis,
  magnitudeSemis,
  opaciteEtoile,
  vignettageDiaph,
  type EntreeProfondeur,
} from '../src/core/galactique.ts'
import { construitIndex } from '../src/core/index-ciel.ts'
import { axePoleDeDate, cielInstantane, epoqueAnnee } from '../src/core/horloges.ts'
import type { Site } from '../src/core/ephem.ts'
import { DEG, versVecteur } from '../src/core/mat3.ts'
import { arcEtoile, arcInvisible, arcsVisibles } from '../src/core/file-etoiles.ts'
import { projecteur, type Vue } from '../src/core/projection.ts'
import { dessineChamp, type EntreeDessinChamp } from '../src/ui/dessine-champ.ts'
import { pointZeroSysteme } from '../src/data/equipment.ts'
import { PanneauFile, type PanneauFileProps } from '../src/ui/PanneauFile.tsx'
import { MENTION_PLAFOND_FILE } from '../src/ui/scene-overlay.ts'
import { majFile, reinitialiseSeance } from '../src/ui/seance-etat.ts'
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

/** Le setup grand angle de référence de §9.3, en props du panneau. */
const PROPS_PANNEAU: PanneauFileProps = {
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
  zeroSysteme: pointZeroSysteme(null),
  modeObjectif: 'MODE_CADRE',
}

const CIEL = cielInstantane(SITE, DATE)
/** T-0115 — le cercle exact n'existe qu'en stéréographique : c'est là que le rejet s'applique. */
const VUE_PLANETARIUM: Vue = { ...VUE, mode: 'MODE_PLANETARIUM', fovDeg: 180 }
const PROJECTEUR = projecteur(VUE, CIEL.matrice)
const PROJECTEUR_PLANETARIUM = projecteur(VUE_PLANETARIUM, CIEL.matrice)

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
    vueRealiste: false,
    sbCiel: 21.0,
    dureeS: 1,
    budgetEtoiles: null,
    latitudeDeg: SITE.latitudeDeg,
    axePoleNord: AXE_POLE,
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
    const { ctx, sortie } = rend()
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
    const ponctuel = rend({ dureeS: 1 })
    const file = rend({ dureeS: 600 })
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
    const html = renderToStaticMarkup(createElement(PanneauFile, PROPS_PANNEAU))
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

describe('§9.3 — T-0118, le filé plafonne le nombre d’étoiles', () => {
  /** Étoiles du semis présentes dans un champ de ce rayon, sous cette magnitude. */
  const semisDansChamp = (rayonDeg: number, magPlafond: number): number => {
    const fractionCiel = (1 - Math.cos(rayonDeg * DEG)) / 2
    const seuil = K('SEUIL_MAG_ETOILES_REELLES')
    const pente = K('PENTE_COMPTAGE_ETOILES')
    // Inverse de la loi de tirage : fraction du semis sous `magPlafond`.
    const fractionSemis =
      (10 ** (pente * (magPlafond - seuil)) - 1) / (10 ** (pente * (K('SEMIS_MAG_MAX') - seuil)) - 1)
    return K('SEMIS_ETOILES_TOTAL') * fractionCiel * fractionSemis
  }

  it('partage la loi de comptage avec le tirage du semis', () => {
    // Les deux bornes du tirage : rien sous le seuil catalographié, rien au-delà du semis.
    expect(magnitudeSemis(0)).toBeCloseTo(K('SEUIL_MAG_ETOILES_REELLES'), 9)
    expect(magnitudeSemis(1)).toBeCloseTo(K('SEMIS_MAG_MAX'), 9)
  })

  it('convertit un budget d’étoiles en magnitude, et le tient à tout rayon de champ', () => {
    const budget = K('BUDGET_ETOILES_FILE')
    // Rayons où le semis présent dans le champ dépasse le budget : c'est là que le plafond
    // mord, et le comptage doit alors tomber exactement sur lui, quel que soit le champ.
    for (const rayonDeg of [20, 34, 60, 90]) {
      expect(semisDansChamp(rayonDeg, magnitudePlafondSemis(budget, rayonDeg))).toBeCloseTo(
        budget,
        6,
      )
    }
  })

  it('descend plus profond dans un champ étroit que sur tout le ciel', () => {
    // C'est ce qui distingue un budget d'étoiles d'un plafond de magnitude : à magnitude
    // fixe, le nombre d'étoiles suivrait l'angle solide du champ.
    const budget = K('BUDGET_ETOILES_FILE')
    expect(magnitudePlafondSemis(budget, 10)).toBeGreaterThan(magnitudePlafondSemis(budget, 90))
  })

  it('ne plafonne rien quand le budget dépasse le semis présent dans le champ', () => {
    expect(magnitudePlafondSemis(K('SEMIS_ETOILES_TOTAL'), 90)).toBeCloseTo(K('SEMIS_MAG_MAX'), 9)
  })

  it('lit moins d’étoiles avec un budget qu’à profondeur pleine', () => {
    // C'est `etoilesVisitees` que le plafond vise : ce qui est LU, donc ce qui est payé.
    const sansPlafond = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: null })
    const plafonne = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: 500 })
    expect(plafonne.sortie.etoilesVisitees).toBeLessThan(sansPlafond.sortie.etoilesVisitees)
  })

  it('ne touche pas au catalogue réel : le ciel reconnaissable reste entier', () => {
    const sansPlafond = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: null })
    // Budget quasi nul : il ne reste presque plus rien du semis, et pourtant le catalogue
    // réel est tracé à l'identique — le plafond ne porte que sur la couche générative.
    const plafonne = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: 1 })
    expect(plafonne.sortie.etoilesReelles).toBe(sansPlafond.sortie.etoilesReelles)
    expect(plafonne.sortie.etoilesVisitees).toBeLessThan(sansPlafond.sortie.etoilesVisitees)
  })

  it('laisse l’aperçu de champ intact — même image sans budget', () => {
    const premier = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: null }).ctx.appels
    const second = rend({ magLimite: K('SEMIS_MAG_MAX'), budgetEtoiles: null }).ctx.appels
    expect(JSON.stringify(second)).toBe(JSON.stringify(premier))
  })

  it('déclare le plafond tant que le filé est actif, et se taît sinon', () => {
    const html = () => renderToStaticMarkup(createElement(PanneauFile, PROPS_PANNEAU))
    try {
      majFile({ apercu: 'CHAMP' })
      expect(html()).not.toContain(MENTION_PLAFOND_FILE)
      majFile({ apercu: 'FILE' })
      expect(html()).toContain(MENTION_PLAFOND_FILE)
    } finally {
      reinitialiseSeance()
    }
  })
})

describe('§9.3 — un arc hors du canevas n’est pas peint', () => {
  /** Balayage échantillonné très finement : aucun point ne doit tomber dans le canevas. */
  const aucunPointVisible = (
    cercle: { xPx: number; yPx: number; rayonPx: number; debutRad: number; balayageRad: number },
    margePx: number,
  ): boolean => {
    const pas = 4000
    for (let i = 0; i <= pas; i++) {
      const a = cercle.debutRad + (cercle.balayageRad * i) / pas
      const x = cercle.xPx + cercle.rayonPx * Math.cos(a)
      const y = cercle.yPx + cercle.rayonPx * Math.sin(a)
      if (
        x >= -margePx &&
        y >= -margePx &&
        x <= VUE_PLANETARIUM.largeurPx + margePx &&
        y <= VUE_PLANETARIUM.hauteurPx + margePx
      ) {
        return false
      }
    }
    return true
  }

  it('ne rejette que des arcs dont aucun point ne touche le canevas', () => {
    // Le rejet se fonde sur la boîte englobante, donc sur une PREUVE ; ce test le confronte à
    // un échantillonnage dense du balayage. Un seul point visible dans un arc rejeté serait
    // une trace effacée à l'écran.
    let rejetes = 0
    let gardes = 0
    for (const etoile of SEMIS.slice(0, 4000)) {
      const v = versVecteur(etoile.adDeg, etoile.decDeg)
      const arc = arcEtoile(PROJECTEUR_PLANETARIUM, v, 480, AXE_POLE)
      if (arc.cercle === null) continue
      const marge = 2
      if (arcInvisible(arc, VUE_PLANETARIUM, marge)) {
        rejetes++
        expect(aucunPointVisible(arc.cercle, marge)).toBe(true)
      } else {
        gardes++
      }
    }
    // Le test ne vaut que s'il a effectivement rejeté et gardé des arcs.
    expect(rejetes).toBeGreaterThan(0)
    expect(gardes).toBeGreaterThan(0)
  })

  it('ne rejette jamais une polyligne : elle se borne déjà elle-même', () => {
    // En projection rectilinéaire l'arc n'est pas un cercle : il rompt son tracé au bord du
    // canevas, et n'a donc pas de boîte à tester.
    const arc = arcEtoile(PROJECTEUR, versVecteur(0, 80), 480, AXE_POLE)
    expect(arc.cercle).toBeNull()
    expect(arc.boite).toBeNull()
    expect(arcInvisible(arc, VUE, 1)).toBe(false)
  })
})

describe('§9.3 — le balayage est découpé sur le bord du canevas', () => {
  const MARGE = 2
  const dedans = (x: number, y: number, marge: number): boolean =>
    x >= -marge &&
    y >= -marge &&
    x <= VUE_PLANETARIUM.largeurPx + marge &&
    y <= VUE_PLANETARIUM.hauteurPx + marge

  /** Tous les cercles exacts d'un échantillon d'étoiles, en projection stéréographique. */
  const cercles = () => {
    const sortie = []
    for (const etoile of SEMIS.slice(0, 800)) {
      const arc = arcEtoile(
        PROJECTEUR_PLANETARIUM,
        versVecteur(etoile.adDeg, etoile.decDeg),
        480,
        AXE_POLE,
      )
      if (arc.cercle !== null) sortie.push(arc.cercle)
    }
    return sortie
  }

  it('garde tout ce qui est visible : aucune trace n’est effacée', () => {
    // Le sens du test : pour chaque point du balayage qui tombe DANS le canevas, une portion
    // gardée doit le couvrir. Un point visible non couvert serait une trace disparue.
    // Le comptage est cumulé et vérifié une fois : un `expect` par échantillon coûterait des
    // millions d'appels et ferait expirer le test au lieu de le faire échouer.
    const pas = 600
    let visibles = 0
    let manques = 0
    for (const c of cercles()) {
      const portions = arcsVisibles(c, VUE_PLANETARIUM, MARGE)
      for (let i = 0; i <= pas; i++) {
        const t = (c.balayageRad * i) / pas
        const a = c.debutRad + t
        if (!dedans(c.xPx + c.rayonPx * Math.cos(a), c.yPx + c.rayonPx * Math.sin(a), 0)) continue
        visibles++
        const avancee = Math.abs(t)
        const couvert = portions.some((p) => {
          const debut = Math.abs(p.debutRad - c.debutRad)
          return avancee >= debut - 1e-9 && avancee <= debut + Math.abs(p.balayageRad) + 1e-9
        })
        if (!couvert) manques++
      }
    }
    expect(visibles).toBeGreaterThan(0)
    expect(manques).toBe(0)
  })

  it('ne garde rien d’invisible : la marge du demi-trait est la seule tolérance', () => {
    const pas = 200
    let verifies = 0
    let fautifs = 0
    for (const c of cercles()) {
      for (const p of arcsVisibles(c, VUE_PLANETARIUM, MARGE)) {
        for (let i = 1; i < pas; i++) {
          const a = p.debutRad + (p.balayageRad * i) / pas
          const x = c.xPx + c.rayonPx * Math.cos(a)
          const y = c.yPx + c.rayonPx * Math.sin(a)
          // Le découpage est exact aux franchissements ; entre eux, un point gardé est dedans.
          if (!dedans(x, y, MARGE)) fautifs++
          verifies++
        }
      }
    }
    expect(verifies).toBeGreaterThan(0)
    expect(fautifs).toBe(0)
  })

  it('ne sort jamais du balayage demandé, et ne se chevauche pas', () => {
    for (const c of cercles()) {
      const portions = arcsVisibles(c, VUE_PLANETARIUM, MARGE)
      let avanceePrecedente = -1
      for (const p of portions) {
        const debut = (p.debutRad - c.debutRad) / (c.balayageRad < 0 ? -1 : 1)
        expect(debut).toBeGreaterThanOrEqual(-1e-9)
        expect(debut + Math.abs(p.balayageRad)).toBeLessThanOrEqual(Math.abs(c.balayageRad) + 1e-9)
        // Même sens de rotation que le balayage : une portion inversée tracerait à l'envers.
        expect(Math.sign(p.balayageRad)).toBe(Math.sign(c.balayageRad))
        expect(debut).toBeGreaterThan(avanceePrecedente)
        avanceePrecedente = debut
      }
    }
  })

  it('rend le balayage entier, en un seul ordre, quand le cercle tient dans le canevas', () => {
    // Un petit cercle au centre du canevas : rien à découper.
    const c = {
      xPx: VUE_PLANETARIUM.largeurPx / 2,
      yPx: VUE_PLANETARIUM.hauteurPx / 2,
      rayonPx: 40,
      debutRad: 0.3,
      balayageRad: 2,
    }
    const portions = arcsVisibles(c, VUE_PLANETARIUM, MARGE)
    expect(portions).toHaveLength(1)
    expect(portions[0]!.debutRad).toBeCloseTo(c.debutRad, 9)
    expect(portions[0]!.balayageRad).toBeCloseTo(c.balayageRad, 9)
  })

  it('ne rend rien quand le cercle est tout entier hors du canevas', () => {
    const c = { xPx: -9000, yPx: -9000, rayonPx: 40, debutRad: 0, balayageRad: 2 }
    expect(arcsVisibles(c, VUE_PLANETARIUM, MARGE)).toHaveLength(0)
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

/**
 * T-0116 — la passe ne peint plus son propre fond. Le planétarium a déjà peint le vrai fond de
 * ciel du site — pollution lumineuse, halo d'horizon, halo lunaire, crépuscule (§3.7) — et un
 * aplat par-dessus l'effacerait. Ce que la passe ajoute, ce sont les traces, rien d'autre.
 */
describe('T-0116 — la passe de filé n’a pas de fond à elle', () => {
  it('ne remplit aucune surface pleine, vue réaliste comprise', () => {
    for (const vueRealiste of [false, true]) {
      const { ctx } = rend({ vueRealiste, sbCiel: 19.4 })
      expect(ctx.appels.some((a) => a.nom === 'fillRect')).toBe(false)
    }
  })

  it('ne peint aucune bande galactique : celle du planétarium reste la seule', () => {
    // La bande se peignait en polygones translucides — des surfaces remplies dont la couleur
    // porte une part d'opacité. Plus aucune couleur de cette forme ne sort de la passe.
    const { ctx } = rend({ sbCiel: 21.5 })
    expect(ctx.couleurs.filter((c) => /^rgb\([\d ]+ \/ [\d.]+\)$/.test(c))).toHaveLength(0)
  })
})
