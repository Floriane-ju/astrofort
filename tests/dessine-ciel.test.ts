/**
 * §3.3, §3.4, §3.5 — La passe de rendu elle-même.
 *
 * Le canevas est remplacé par un contexte qui enregistre les appels. Ce n'est pas un test
 * d'apparence : c'est la vérification que la passe produit bien ce qu'elle annonce — des
 * disques d'étoiles regroupés par teinte, les trois couches de tracés, le contour du cadre,
 * des labels plafonnés, et une liste de cibles cliquables cohérente avec ce qui est dessiné.
 *
 * Il couvre aussi la règle de §11.1 sur le canevas, que la feuille de style n'atteint pas :
 * en mode nuit, AUCUNE couleur peinte ne doit porter de composante verte ou bleue.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Etoile } from '../src/data/catalog.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import { decodeConstellations } from '../src/data/constellations.ts'
import {
  coucheAsterismes,
  coucheFigures,
  coucheFrontieres,
} from '../src/core/constellations.ts'
import { construitIndex } from '../src/core/index-ciel.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import { magnitudeLimite, projecteur, type Vue } from '../src/core/projection.ts'
import type { Site } from '../src/core/ephem.ts'
import { applique, versSpherique } from '../src/core/mat3.ts'
import { depuisGalactique } from '../src/core/galactique.ts'
import { altitudeCulmination } from '../src/core/site.ts'
import {
  cibleSousLeCurseur,
  dessineCiel,
  type CouchesActives,
  type EntreeDessin,
  type SurvolEcran,
} from '../src/ui/dessine-ciel.ts'
import { palette } from '../src/ui/couleurs.ts'
import { K } from '../src/registry/constants.ts'

const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const DATE = new Date('2026-08-15T22:00:00Z')
const LARGEUR = 960
const HAUTEUR = 540

const PAQUET = decodeConstellations(
  readFileSync(
    join(import.meta.dirname, '..', 'public', 'data', 'constellations-1.bin'),
  ).buffer as ArrayBuffer,
)

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
  /** Opacités effectivement utilisées pour un tracé : la bande de §3.7 s'y lit. */
  const opacites: number[] = []
  let opacite = 1
  const espion = {
    appels,
    couleurs,
    opacites,
    font: '',
    textBaseline: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    set globalAlpha(v: number) {
      opacite = v
    },
    get globalAlpha() {
      return opacite
    },
    set fillStyle(v: string) {
      couleurs.push(v)
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
    moveTo: enregistre('moveTo'),
    lineTo: enregistre('lineTo'),
    arc: enregistre('arc'),
    stroke: (...args: unknown[]) => {
      opacites.push(opacite)
      appels.push({ nom: 'stroke', args })
    },
    fill: enregistre('fill'),
    fillText: enregistre('fillText'),
    setLineDash: enregistre('setLineDash'),
  }
  return espion
}

/** Path2D n'existe pas hors navigateur : la passe n'en attend que moveTo et arc. */
class Path2DEspion {
  readonly arcs: number[] = []
  moveTo(): void {}
  arc(_x: number, _y: number, rayon: number): void {
    this.arcs.push(rayon)
  }
}
;(globalThis as unknown as { Path2D: unknown }).Path2D = Path2DEspion

const COUCHES: CouchesActives = {
  figures: true,
  frontieres: true,
  asterismes: true,
  cadre: true,
  horizon: true,
  voieLactee: true,
}

/** Quelques étoiles brillantes bien réparties, pour ne pas dépendre du paquet HYG. */
function etoilesDeTest(): Etoile[] {
  const etoiles: Etoile[] = []
  for (let ad = 0; ad < 360; ad += 3) {
    for (let dec = -80; dec <= 80; dec += 10) {
      etoiles.push({ adDeg: ad, decDeg: dec, magV: ((ad + dec) % 7) - 1, bv: ((ad % 20) / 10) - 0.4 })
    }
  }
  return etoiles
}

function rend(
  options: {
    modeNuit?: boolean
    couches?: CouchesActives
    objets?: readonly ObjetCielProfond[]
    surLeFond?: (ctx: CanvasRenderingContext2D) => void
    sbCiel?: number
    latitudeDeg?: number
    vise?: { azimutDeg: number; hauteurDeg: number }
    survol?: SurvolEcran
  } = {},
) {
  const ctx = contexteEspion()
  const ciel = cielInstantane(SITE, DATE)
  const vue: Vue = {
    mode: 'MODE_PLANETARIUM',
    fovDeg: 60,
    largeurPx: LARGEUR,
    hauteurPx: HAUTEUR,
    azimutDeg: options.vise?.azimutDeg ?? 180,
    hauteurDeg: options.vise?.hauteurDeg ?? 45,
    rotationDeg: 0,
  }
  const entree: EntreeDessin = {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    projecteur: projecteur(vue, ciel.matrice),
    matriceCiel: ciel.matrice,
    index: construitIndex(etoilesDeTest()),
    etoiles: etoilesDeTest(),
    objets: options.objets ?? [],
    figures: coucheFigures(PAQUET.figures),
    asterismes: coucheAsterismes(PAQUET.asterismes),
    frontieres: coucheFrontieres(PAQUET),
    etoilesNommees: PAQUET.etoilesNommees,
    corps: [],
    nomsCorps: {},
    cadres: [
      {
        profil: {
          libelle: '120 mm',
          fovLDeg: 17.0,
          fovHDeg: 11.4,
          echApx: 8.8,
          capteurHMm: 24,
          tPoseS: 120,
        },
        azimutDeg: 180,
        hauteurDeg: 45,
        rotationDeg: 0,
      },
    ],
    couches: options.couches ?? COUCHES,
    magLimite: magnitudeLimite(vue.fovDeg).value,
    sbCiel: options.sbCiel ?? K('SB_VOIE_LACTEE_PLEINE_MAG'),
    latitudeDeg: options.latitudeDeg ?? SITE.latitudeDeg,
    modeNuit: options.modeNuit ?? false,
    survol: options.survol,
    surLeFond: options.surLeFond,
  }
  return { ctx, sortie: dessineCiel(entree), entree }
}

describe('passe de rendu §3.3', () => {
  it('peint le fond, les étoiles par teinte et les tracés', () => {
    const { ctx, sortie } = rend()
    expect(ctx.appels.filter((a) => a.nom === 'fillRect')).toHaveLength(1)
    expect(sortie.etoilesDessinees).toBeGreaterThan(0)
    expect(sortie.stats.etoilesExaminees).toBeGreaterThanOrEqual(sortie.etoilesDessinees)
    // Un remplissage par teinte, pas un par étoile : c'est ce qui tient la fréquence.
    const remplissages = ctx.appels.filter((a) => a.nom === 'fill').length
    expect(remplissages).toBeLessThan(20)
    expect(ctx.appels.some((a) => a.nom === 'stroke')).toBe(true)
  })

  /**
   * T-0042 — l'aperçu incrusté se dépose par ce crochet. S'il partait après la passe, il
   * recouvrirait les repères ; s'il partait avant le fond, le fond l'effacerait.
   */
  it('appelle surLeFond après le fond et avant le premier tracé', () => {
    let rang = -1
    const { ctx } = rend({
      // Couche Voie lactée éteinte : sa bande fait partie du fond (§3.7) et s'intercale
      // légitimement entre le remplissage et l'aperçu. Le voisinage exact se lit sans elle.
      couches: { ...COUCHES, voieLactee: false },
      surLeFond: (c) => {
        rang = (c as unknown as ReturnType<typeof contexteEspion>).appels.length
      },
    })
    const fonds = ctx.appels.filter((a) => a.nom === 'fillRect')
    expect(fonds).toHaveLength(1)
    expect(rang).toBe(ctx.appels.indexOf(fonds[0]!) + 1)
    const premierTrace = ctx.appels.findIndex(
      (a) => a.nom === 'stroke' || a.nom === 'fill' || a.nom === 'fillText',
    )
    expect(premierTrace).toBeGreaterThan(-1)
    expect(rang).toBeLessThanOrEqual(premierTrace)
  })

  it('ne trace une couche que si elle est active', () => {
    const sans = rend({
      couches: {
        figures: false,
        frontieres: false,
        asterismes: false,
        cadre: false,
        horizon: false,
        voieLactee: false,
      },
    })
    const avec = rend()
    const lignes = (r: ReturnType<typeof rend>) =>
      r.ctx.appels.filter((a) => a.nom === 'lineTo').length
    expect(lignes(sans)).toBeLessThan(lignes(avec))
  })

  it('trace les astérismes dans une teinte distincte des figures IAU', () => {
    const sansAsterismes = rend({ couches: { ...COUCHES, asterismes: false } })
    const avec = rend()
    const nouvelles = avec.ctx.couleurs.filter((c) => !sansAsterismes.ctx.couleurs.includes(c))
    expect(nouvelles.length).toBeGreaterThan(0)
    // Une couche, un tracé : pas de motif dépendant de la longueur du segment, qui
    // rendrait plein un segment court et pointillé un segment long.
    expect(avec.ctx.appels.some((a) => a.nom === 'setLineDash')).toBe(false)
  })

  it('trace le plan galactique et le nomme, seulement quand la couche est active', () => {
    const avec = rend()
    const sans = rend({ couches: { ...COUCHES, voieLactee: false } })
    const nomme = (r: ReturnType<typeof rend>) =>
      r.sortie.labels.some((l) => l.texte === 'Voie lactée')
    expect(nomme(avec)).toBe(true)
    expect(nomme(sans)).toBe(false)
    // La ligne elle-même : la couche décochée retire des segments, elle n'en ajoute pas.
    const lignes = (r: ReturnType<typeof rend>) =>
      r.ctx.appels.filter((a) => a.nom === 'lineTo').length
    expect(lignes(sans)).toBeLessThan(lignes(avec))
  })

  it('pose le label de la Voie lactée sur la ligne, dans sa teinte', () => {
    const { sortie } = rend()
    const label = sortie.labels.find((l) => l.texte === 'Voie lactée')!
    expect(label.couleur).toBe(palette(false).voieLactee)
    // Sur la ligne veut dire : à un point du plan galactique effectivement projeté, donc
    // jamais figé dans un coin du canevas.
    expect(label.xPx).toBeGreaterThan(0)
    expect(label.xPx).toBeLessThan(LARGEUR)
    expect(label.yPx).toBeGreaterThan(0)
    expect(label.yPx).toBeLessThan(HAUTEUR)
  })

  /**
   * §3.7 — la bande dit ce que l'utilisateur verra depuis SON ciel. Le discriminant n'est pas
   * le nombre de traits mais leur opacité : la bande est la seule chose peinte en translucide.
   */
  const tracesDeBande = (r: ReturnType<typeof rend>) =>
    r.ctx.opacites.filter((o) => o > 0 && o < 1).length

  it('module la bande par le fond de ciel : atténuée à Bortle 4, effacée à Bortle 8', () => {
    const bonCiel = rend({ sbCiel: K('SB_VOIE_LACTEE_PLEINE_MAG') })
    const cielMoyen = rend({ sbCiel: (K('SB_VOIE_LACTEE_PLEINE_MAG') + K('SB_VOIE_LACTEE_EFFACEE_MAG')) / 2 })
    const cielPerdu = rend({ sbCiel: K('SB_VOIE_LACTEE_EFFACEE_MAG') })

    expect(tracesDeBande(bonCiel)).toBeGreaterThan(0)
    expect(tracesDeBande(cielPerdu)).toBe(0)
    // Atténuée, pas absente : le même nombre de tranches, à une opacité plus faible.
    expect(tracesDeBande(cielMoyen)).toBe(tracesDeBande(bonCiel))
    expect(Math.max(...cielMoyen.ctx.opacites.filter((o) => o < 1))).toBeLessThan(
      Math.max(...bonCiel.ctx.opacites.filter((o) => o < 1)),
    )
    // La ligne du plan, elle, est tracée dans les deux cas.
    expect(cielPerdu.sortie.labels.some((l) => l.texte === 'Voie lactée')).toBe(true)
  })

  it('jamais opaque : les repères restent lisibles au travers de la bande', () => {
    const { ctx } = rend({ sbCiel: K('SB_VOIE_LACTEE_PLEINE_MAG') })
    const bande = ctx.opacites.filter((o) => o < 1)
    // Plein contraste : la tranche du plan galactique atteint le plafond d'opacité, pas 1.
    expect(Math.max(...bande)).toBeCloseTo(K('OPACITE_BANDE_GALACTIQUE'), 6)
    // Et les repères, eux, restent peints à pleine opacité par-dessus.
    expect(ctx.opacites.some((o) => o === 1)).toBe(true)
  })

  it('peint la bande avec le fond, avant l’aperçu incrusté de §9.5', () => {
    let rang = -1
    const { ctx } = rend({
      surLeFond: (c) => {
        rang = (c as unknown as ReturnType<typeof contexteEspion>).appels.length
      },
    })
    const fond = ctx.appels.findIndex((a) => a.nom === 'fillRect')
    const premierTrace = ctx.appels.findIndex((a) => a.nom === 'stroke')
    expect(premierTrace).toBeGreaterThan(fond)
    // La bande est passée entre le fond et l'aperçu : elle ne lave pas la prévisualisation.
    expect(rang).toBeGreaterThan(premierTrace)
  })

  /** Repère du centre galactique : la vue est amenée dessus pour qu'il soit dans le champ. */
  function viseCentreGalactique() {
    const ciel = cielInstantane(SITE, DATE)
    const horizontal = versSpherique(applique(ciel.matrice, depuisGalactique(0, 0)))
    return {
      vise: { azimutDeg: horizontal.longitudeDeg, hauteurDeg: horizontal.latitudeDeg },
      hauteurDeg: horizontal.latitudeDeg,
    }
  }

  it('repère et nomme le centre galactique, avec sa hauteur courante', () => {
    const { vise, hauteurDeg } = viseCentreGalactique()
    const { sortie } = rend({ vise })
    const label = sortie.labels.find((l) => l.texte.startsWith('Centre galactique'))
    expect(label, JSON.stringify(sortie.labels.map((l) => l.texte))).toBeDefined()
    expect(label!.texte).toContain(`${hauteurDeg.toFixed(0)}°`)
    expect(label!.couleur).toBe(palette(false).voieLactee)
  })

  it('porte la cause et la latitude quand le centre galactique reste hors d’atteinte', () => {
    const { vise } = viseCentreGalactique()
    const decDeg = versSpherique(depuisGalactique(0, 0)).latitudeDeg
    const culmination = altitudeCulmination(SITE.latitudeDeg, decDeg).value
    expect(culmination).toBeLessThan(K('SEUIL_HAUTEUR_IMAGERIE_DEG'))

    const { sortie } = rend({ vise })
    const texte = sortie.labels.find((l) => l.texte.startsWith('Centre galactique'))!.texte
    expect(texte).toContain(culmination.toFixed(1))
    // La latitude qui le rendrait accessible : δ + (90° − seuil), soit environ 31° N.
    expect(texte).toContain((decDeg + 90 - K('SEUIL_HAUTEUR_IMAGERIE_DEG')).toFixed(1))
  })

  it('n’annonce aucune cause depuis une latitude où le centre galactique passe haut', () => {
    const { vise } = viseCentreGalactique()
    const decDeg = versSpherique(depuisGalactique(0, 0)).latitudeDeg
    const { sortie } = rend({ vise, latitudeDeg: decDeg })
    const texte = sortie.labels.find((l) => l.texte.startsWith('Centre galactique'))!.texte
    expect(texte).not.toContain('culmine')
  })

  it('soumet le repère du centre galactique au budget de labels, sans passe-droit', () => {
    const { vise } = viseCentreGalactique()
    const { sortie } = rend({ vise })
    expect(sortie.labels.length).toBeLessThanOrEqual(K('LABELS_MAX'))
  })

  it('éteint bande et repère avec la seule bascule de la couche Voie lactée', () => {
    const { vise } = viseCentreGalactique()
    const sans = rend({ vise, couches: { ...COUCHES, voieLactee: false } })
    expect(tracesDeBande(sans)).toBe(0)
    expect(sans.sortie.labels.some((l) => l.texte.startsWith('Centre galactique'))).toBe(false)
    expect(sans.sortie.labels.some((l) => l.texte === 'Voie lactée')).toBe(false)
  })

  it('plafonne les labels et les empêche de se chevaucher', () => {
    const { sortie } = rend()
    expect(sortie.labels.length).toBeLessThanOrEqual(K('LABELS_MAX'))
    for (let i = 0; i < sortie.labels.length; i++) {
      for (let j = i + 1; j < sortie.labels.length; j++) {
        const a = sortie.labels[i]!
        const b = sortie.labels[j]!
        const chevauche =
          Math.abs(a.xPx - b.xPx) * 2 < a.largeurPx + b.largeurPx &&
          Math.abs(a.yPx - b.yPx) * 2 < a.hauteurPx + b.hauteurPx
        expect(chevauche, `${a.texte} / ${b.texte}`).toBe(false)
      }
    }
  })

  it('n’écrit aucune composante verte ou bleue en mode nuit', () => {
    const { ctx } = rend({ modeNuit: true })
    expect(ctx.couleurs.length).toBeGreaterThan(0)
    for (const couleur of ctx.couleurs) {
      const rgb = couleur.match(/rgb\((\d+) (\d+) (\d+)\)/)
      if (rgb !== null) {
        expect(Number(rgb[2]), couleur).toBe(0)
        expect(Number(rgb[3]), couleur).toBe(0)
        continue
      }
      // Seule couleur hexadécimale admise : le noir du fond.
      expect(couleur, couleur).toBe('#000000')
    }
  })
})

describe('pointage à la souris §3.4', () => {
  it('rend un objet du ciel profond cliquable vers les moteurs du Lot 2', () => {
    const ciel = cielInstantane(SITE, DATE)
    const vue: Vue = {
      mode: 'MODE_PLANETARIUM',
      fovDeg: 60,
      largeurPx: LARGEUR,
      hauteurPx: HAUTEUR,
      azimutDeg: 180,
      hauteurDeg: 45,
      rotationDeg: 0,
    }
    const centre = versSpherique(projecteur(vue, ciel.matrice).inverse(LARGEUR / 2, HAUTEUR / 2))
    const m33: ObjetCielProfond = {
      designation: 'M33',
      nomsCommuns: 'Triangulum Galaxy',
      adDeg: centre.longitudeDeg,
      decDeg: centre.latitudeDeg,
      type: 'GALAXIE',
      majAxArcmin: 71,
      minAxArcmin: 42,
      posAngDeg: 23,
      vMag: 5.7,
      bMag: null,
      surfBr: null,
    }

    const { sortie } = rend({ objets: [m33] })
    const cible = cibleSousLeCurseur(sortie.cibles, LARGEUR / 2, HAUTEUR / 2)
    expect(cible).not.toBeNull()
    expect(cible!.type).toBe('OBJET')
    expect(cible!.objet?.designation).toBe('M33')
  })

  it('ne retient rien loin de tout élément dessiné', () => {
    const { sortie } = rend()
    expect(cibleSousLeCurseur(sortie.cibles, -500, -500)).toBeNull()
  })
})

/**
 * T-0085 — le nom que le seuil de zoom a masqué, révélé le temps du survol. Le libellé vient
 * de l'appelant (`decritCible`) : la passe ne compose pas un second vocabulaire, elle place.
 */
describe('label du survol T-0085', () => {
  const SURVOL: SurvolEcran = { xPx: 480, yPx: 270, texte: 'M31 — Galaxie d’Andromède' }

  it('révèle le nom survolé sans entrer dans le budget de §3.4', () => {
    const sans = rend()
    const avec = rend({ survol: SURVOL })
    expect(sans.sortie.revele).toBeNull()
    expect(avec.sortie.revele).not.toBeNull()
    // Hors budget : le nom révélé ne chasse aucun label retenu et n'en ajoute aucun.
    expect(avec.sortie.labels.map((l) => l.texte)).toEqual(sans.sortie.labels.map((l) => l.texte))
    expect(
      avec.ctx.appels.some((a) => a.nom === 'fillText' && a.args[0] === SURVOL.texte),
    ).toBe(true)
  })

  it('ne recouvre aucun label retenu', () => {
    const { sortie } = rend({ survol: SURVOL })
    const revele = sortie.revele!
    for (const label of sortie.labels) {
      const chevauche =
        Math.abs(label.xPx - revele.xPx) * 2 < label.largeurPx + revele.largeurPx &&
        Math.abs(label.yPx - revele.yPx) * 2 < label.hauteurPx + revele.hauteurPx
      expect(chevauche, `${label.texte} recouvert par ${revele.texte}`).toBe(false)
    }
  })

  it('ne double pas un nom que la scène affiche déjà', () => {
    const premier = rend().sortie.labels[0]!
    const { sortie } = rend({
      survol: { xPx: premier.xPx, yPx: premier.yPx, texte: `${premier.texte} — au complet` },
    })
    expect(sortie.revele).toBeNull()
  })
})
