/**
 * T-0065 — allocations d'une image du planétarium, chiffrées.
 *
 * L'audit annonce « de l'ordre de 10⁵ objets par seconde ». Un ordre de grandeur ne dit pas
 * si une optimisation a servi : ce script rejoue `dessineCiel` hors navigateur, sur la scène
 * de référence, et compte ce qui est alloué par image.
 *
 * Deux mesures, complémentaires :
 *
 *   - le COMPTE, par la projection. Chaque appel à `projette` alloue exactement deux objets
 *     — le littéral d'entrée chez l'appelant, le `PointEcran` en sortie ; chaque appel à
 *     `projetteEn` n'en alloue aucun. Les `Path2D` sont comptés à la construction.
 *   - le RAMASSE-MIETTES, toutes causes confondues. `perf_hooks` observe les GC réellement
 *     déclenchés pendant la série, sous les heuristiques par défaut du moteur. C'est le
 *     symptôme que l'audit décrit — des saccades, pas un FPS moyen plus bas — et il porte
 *     sur toutes les allocations, y compris celles que le compte ne voit pas.
 *
 * Une mesure d'octets alloués a été essayée et abandonnée : la croissance du tas dépend
 * plus des heuristiques de dimensionnement de la jeune génération que du code mesuré, et
 * deux passes consécutives donnaient 195 ko et 225 ko par image. Un chiffre instable ne
 * décide de rien.
 *
 * `--empreinte` remplace la mesure par le condensé des ordres de peinture : c'est lui qui
 * dit qu'une optimisation n'a PAS changé l'image (§critère « identique au pixel près »).
 *
 * Usage : `pnpm bench:ciel [--empreinte]`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PerformanceObserver } from 'node:perf_hooks'
import { decodeEtoiles, type Etoile } from '../src/data/catalog.ts'
import { decodeObjets } from '../src/data/deepsky.ts'
import { decodeConstellations } from '../src/data/constellations.ts'
import { coucheAsterismes, coucheFigures, coucheFrontieres } from '../src/core/constellations.ts'
import { construitIndex } from '../src/core/index-ciel.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import { magnitudeRendue, projecteur, type Projecteur, type Vue } from '../src/core/projection.ts'
import type { Site } from '../src/core/ephem.ts'
import { dessineCiel, type CouchesActives } from '../src/ui/dessine-ciel.ts'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const DATE = new Date('2026-08-15T22:00:00Z')
const LARGEUR = 1920
const HAUTEUR = 1080
const IMAGES = 200
const EMPREINTE = process.argv.includes('--empreinte')

/** Scène de référence : plein champ, toutes les couches, le ciel d'un site réel. */
const VUE: Vue = {
  mode: 'MODE_PLANETARIUM',
  fovDeg: 30,
  largeurPx: LARGEUR,
  hauteurPx: HAUTEUR,
  azimutDeg: 180,
  hauteurDeg: 40,
  rotationDeg: 0,
}
const COUCHES: CouchesActives = {
  figures: true,
  frontieres: true,
  asterismes: true,
  cadre: false,
  horizon: true,
  voieLactee: true,
}

let path2dConstruits = 0

/** Node n'a pas de `Path2D` : ce substitut absorbe les ordres et se laisse compter. */
class Path2DMuet {
  constructor() {
    path2dConstruits++
  }
  moveTo(): void {}
  arc(): void {}
  lineTo(): void {}
  closePath(): void {}
}
;(globalThis as unknown as { Path2D: unknown }).Path2D = Path2DMuet

function lit(nom: string): ArrayBuffer {
  const buffer = readFileSync(join(RACINE, 'public/data', nom))
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

function empreinteur(): { ctx: CanvasRenderingContext2D; valeur: () => string } {
  let h = 0x811c9dc5
  const avale = (texte: string): void => {
    for (let i = 0; i < texte.length; i++) {
      h ^= texte.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
  }
  const ordre =
    (nom: string) =>
    (...args: unknown[]): void => {
      avale(
        `${nom}(${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : String(a))).join(',')})`,
      )
    }
  const ctx = {
    set globalAlpha(v: number) {
      avale(`alpha=${v.toFixed(4)}`)
    },
    get globalAlpha() {
      return 1
    },
    set fillStyle(v: unknown) {
      avale(`fill=${String(v)}`)
    },
    get fillStyle() {
      return ''
    },
    set strokeStyle(v: unknown) {
      avale(`stroke=${String(v)}`)
    },
    get strokeStyle() {
      return ''
    },
    set lineWidth(v: number) {
      avale(`lw=${v.toFixed(3)}`)
    },
    get lineWidth() {
      return 1
    },
    set font(v: string) {
      avale(`font=${v}`)
    },
    get font() {
      return ''
    },
    set textBaseline(v: string) {
      avale(`baseline=${v}`)
    },
    get textBaseline() {
      return ''
    },
    lineCap: 'butt',
    filter: 'none',
    fillRect: ordre('fillRect'),
    fillText: ordre('fillText'),
    beginPath: ordre('beginPath'),
    closePath: ordre('closePath'),
    moveTo: ordre('moveTo'),
    lineTo: ordre('lineTo'),
    arc: ordre('arc'),
    stroke: ordre('stroke'),
    fill: ordre('fill'),
    createRadialGradient: () => ({ addColorStop: (): void => undefined }),
  } as unknown as CanvasRenderingContext2D
  return { ctx, valeur: () => h.toString(16).padStart(8, '0') }
}

/** Contexte 2D muet : il absorbe les ordres de peinture, il n'en exécute aucun. */
function contexteMuet(): CanvasRenderingContext2D {
  const rien = (): void => undefined
  return {
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    filter: 'none',
    font: '',
    textBaseline: 'middle',
    fillStyle: '',
    strokeStyle: '',
    fillRect: rien,
    fillText: rien,
    beginPath: rien,
    closePath: rien,
    moveTo: rien,
    lineTo: rien,
    arc: rien,
    stroke: rien,
    fill: rien,
    createRadialGradient: () => ({ addColorStop: rien }),
  } as unknown as CanvasRenderingContext2D
}

interface Comptes {
  readonly projette: () => number
  readonly projetteEn: () => number
}

/**
 * Projecteur instrumenté. `projette` alloue deux objets par appel — l'entrée et la sortie ;
 * `projetteEn` n'en alloue aucun. Compter les appels, c'est compter les objets.
 */
function projecteurCompte(base: Projecteur): { proj: Projecteur; comptes: Comptes } {
  let nProjette = 0
  let nProjetteEn = 0
  const proj: Projecteur = {
    vue: base.vue,
    matrice: base.matrice,
    echelle: base.echelle,
    projette: (v) => {
      nProjette++
      return base.projette(v)
    },
    projetteEn: (x, y, z, out) => {
      nProjetteEn++
      return base.projetteEn(x, y, z, out)
    },
    inverse: (x, y) => base.inverse(x, y),
  }
  return { proj, comptes: { projette: () => nProjette, projetteEn: () => nProjetteEn } }
}

const etoiles: readonly Etoile[] = decodeEtoiles(lit('hyg-1.bin'))
const objets = decodeObjets({
  enregistrements: lit('openngc-1.bin'),
  chaines: lit('openngc-noms-1.bin'),
})
const constellations = decodeConstellations(lit('constellations-1.bin'))
const index = construitIndex(etoiles)
const figures = coucheFigures(constellations.figures)
const asterismes = coucheAsterismes(constellations.asterismes)
const frontieres = coucheFrontieres(constellations)
const ciel = cielInstantane(SITE, DATE)
const magLimite = magnitudeRendue(VUE.fovDeg, null, false).value

function image(ctx: CanvasRenderingContext2D): { comptes: Comptes; dessinees: number } {
  const { proj, comptes } = projecteurCompte(projecteur(VUE, ciel.matrice))
  const sortie = dessineCiel({
    ctx,
    projecteur: proj,
    matriceCiel: ciel.matrice,
    index,
    etoiles,
    objets,
    figures,
    asterismes,
    frontieres,
    etoilesNommees: constellations.etoilesNommees,
    corps: [],
    nomsCorps: {},
    cadres: [],
    couches: COUCHES,
    magLimite,
    modeNuit: false,
  })
  return { comptes, dessinees: sortie.etoilesDessinees }
}

if (EMPREINTE) {
  const { ctx, valeur } = empreinteur()
  const { dessinees } = image(ctx)
  console.log(
    `empreinte ${valeur()}  ${dessinees.toLocaleString('fr-FR')} étoiles dessinées  ` +
      `mag ${magLimite.toFixed(1)}`,
  )
} else {
  let gcs = 0
  let gcMs = 0
  const observateur = new PerformanceObserver((liste) => {
    for (const e of liste.getEntries()) {
      gcs++
      gcMs += e.duration
    }
  })
  observateur.observe({ entryTypes: ['gc'] })

  // Chauffe : le JIT compile, et la jeune génération grandit jusqu'à sa taille de croisière —
  // `--max-semi-space-size` est un plafond, pas une taille de départ.
  for (let i = 0; i < 200; i++) image(contexteMuet())
  // L'observateur de GC livre ses entrées sur un tour de boucle ultérieur : rendre la main
  // ici vide la file de la chauffe, pour que le compteur ne parle que de la mesure.
  await new Promise((resoud) => setTimeout(resoud, 50))
  gcs = 0
  gcMs = 0
  path2dConstruits = 0
  const debut = performance.now()
  let comptes: Comptes | null = null
  let dessinees = 0
  for (let i = 0; i < IMAGES; i++) {
    const r = image(contexteMuet())
    comptes = r.comptes
    dessinees = r.dessinees
  }
  const ms = (performance.now() - debut) / IMAGES
  await new Promise((resoud) => setTimeout(resoud, 50))
  observateur.disconnect()

  const objetsParImage = comptes!.projette() * 2 + path2dConstruits / IMAGES
  console.log(
    `scène de référence — ${VUE.fovDeg}° de champ, ${index.nombreEtoiles.toLocaleString('fr-FR')} ` +
      `étoiles au catalogue, ${dessinees.toLocaleString('fr-FR')} dessinées`,
  )
  console.log(
    `${objetsParImage.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(9)} objets/image  ` +
      `(${comptes!.projette().toLocaleString('fr-FR')} projette ×2, ` +
      `${comptes!.projetteEn().toLocaleString('fr-FR')} projetteEn ×0, ` +
      `${(path2dConstruits / IMAGES).toFixed(0)} Path2D)`,
  )
  console.log(
    `${ms.toFixed(2).padStart(9)} ms/image   ` +
      `${gcs} GC sur ${IMAGES} images, ${gcMs.toFixed(1)} ms cumulés`,
  )
}
