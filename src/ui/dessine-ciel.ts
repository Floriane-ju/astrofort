/**
 * Passe de rendu du planétarium — §3.1, §3.3, §3.4, §3.5.
 *
 * Une image = une matrice, un parcours d'index, un tracé. Le coût suit le nombre d'étoiles
 * RETENUES, jamais le nombre d'étoiles stockées : les cellules hors champ ne sont pas
 * visitées, et le parcours d'une cellule s'arrête à la magnitude limite du zoom.
 *
 * Les étoiles sont regroupées par teinte avant d'être tracées : changer `fillStyle` coûte
 * plus cher que tracer un disque, et huit changements par image valent mieux que dix mille.
 */

import { K } from '../registry/constants.ts'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { EtoileNommee } from '../data/constellations.ts'
import type { CoucheFrontieres, CoucheTraces } from '../core/constellations.ts'
import type { IndexCiel, StatistiquesSelection } from '../core/index-ciel.ts'
import { selectionne } from '../core/index-ciel.ts'
import { composeLabels, etoileLabellisable, type CandidatLabel } from '../core/labels.ts'
import { depuisGalactique } from '../core/galactique.ts'
import { applique, transpose, versVecteur, type Mat3, type Vec3 } from '../core/mat3.ts'
import { rayonEtoilePx, type Projecteur } from '../core/projection.ts'
import { contourCadreJ2000, type Cadre } from '../core/cadre.ts'
import type { PositionCorps } from '../core/ephem.ts'
import { couleurTeinte, palette, teinte, TEINTES } from './couleurs.ts'

export interface CouchesActives {
  readonly figures: boolean
  readonly frontieres: boolean
  readonly asterismes: boolean
  readonly cadre: boolean
  readonly horizon: boolean
  readonly voieLactee: boolean
}

export type TypeCible = 'ETOILE' | 'OBJET' | 'CORPS'

/** Élément dessiné, conservé pour le pointage à la souris. */
export interface CibleEcran {
  readonly type: TypeCible
  readonly xPx: number
  readonly yPx: number
  readonly nom: string
  readonly objet?: ObjetCielProfond
  readonly etoile?: Etoile
  readonly etoileNommee?: EtoileNommee
  readonly corps?: PositionCorps
}

export interface EntreeDessin {
  readonly ctx: CanvasRenderingContext2D
  readonly projecteur: Projecteur
  /** J2000 → repère horizontal du site : elle sert aux éléments définis dans ce repère. */
  readonly matriceCiel: Mat3
  readonly index: IndexCiel
  readonly etoiles: readonly Etoile[]
  readonly objets: readonly ObjetCielProfond[]
  readonly figures: readonly CoucheTraces[]
  readonly asterismes: readonly CoucheTraces[]
  readonly frontieres: CoucheFrontieres
  readonly etoilesNommees: readonly EtoileNommee[]
  readonly corps: readonly PositionCorps[]
  readonly nomsCorps: Readonly<Record<string, string>>
  readonly cadres: readonly Cadre[]
  readonly couches: CouchesActives
  readonly magLimite: number
  readonly modeNuit: boolean
  /**
   * Peint entre le fond et tout le reste. C'est là que l'aperçu incrusté se dépose : sous les
   * repères, les étoiles et les noms, jamais par-dessus.
   */
  readonly surLeFond?: ((ctx: CanvasRenderingContext2D) => void) | undefined
}

export interface SortieDessin {
  readonly stats: StatistiquesSelection
  readonly etoilesDessinees: number
  readonly cibles: readonly CibleEcran[]
  readonly labels: readonly CandidatLabel[]
}

/* T-0027 — noms des éléments trop petits à l'écran une fois le canevas 1920×1080 réduit à
   la taille d'affichage réelle (object-fit: contain). */
const HAUTEUR_LABEL_PX = 18
const LARGEUR_CARACTERE_PX = 10
const RAYON_CLIC_PX = 10
const MARQUEUR_OBJET_PX = 4
const RAYON_CORPS_PX = 5
/** Sous ce rayon, l'antialiasing efface le disque : la plus faible étoile reste un point. */
const RAYON_MIN_ETOILE_PX = 0.7

const NOM_VOIE_LACTEE = 'Voie lactée'
const PAS_LONGITUDE_GALACTIQUE_DEG = 3

/**
 * T-0033 — le plan galactique `b = 0`, échantillonné en longitude comme l'horizon l'est en
 * azimut. Il est fixe en J2000 : la polyligne se calcule une fois au chargement du module,
 * jamais par image. Seule sa projection dépend de l'instant et du zoom.
 */
const PLAN_GALACTIQUE: readonly Vec3[] = Array.from(
  { length: 360 / PAS_LONGITUDE_GALACTIQUE_DEG + 1 },
  (_, i) => depuisGalactique(i * PAS_LONGITUDE_GALACTIQUE_DEG, 0),
)

/** Compose le chemin sans le peindre : au tracé du ciel de le remplir, au cadre de le découper. */
function cheminLignes(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  polylignes: readonly (readonly Vec3[])[],
): void {
  ctx.beginPath()
  for (const ligne of polylignes) {
    let precedent: { xPx: number; yPx: number } | null = null
    for (const point of ligne) {
      const p = projecteur.projette(point)
      if (p === null) {
        precedent = null
        continue
      }
      if (precedent === null) ctx.moveTo(p.xPx, p.yPx)
      else ctx.lineTo(p.xPx, p.yPx)
      precedent = p
    }
  }
}

function traceLignes(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  polylignes: readonly (readonly Vec3[])[],
): void {
  cheminLignes(ctx, projecteur, polylignes)
  ctx.stroke()
}

/**
 * §3.5 — chemin fermé du contour du cadre matériel, composé mais NON peint.
 *
 * Exporté pour l'incrustation du filé (§9.3) : elle découpe le canevas sur ce chemin avant
 * d'y déposer son rendu. Le contour est calculé une seule fois, ici, avec le projecteur de la
 * scène — §3.3 interdit qu'un second code de projection existe quelque part.
 */
export function cheminCadre(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  cadre: Cadre,
  matriceCiel: Mat3,
): void {
  const contour = contourCadreJ2000(cadre, matriceCiel)
  cheminLignes(ctx, projecteur, [[...contour, contour[0]!]])
}

function traceSegments(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  couches: readonly CoucheTraces[],
): void {
  ctx.beginPath()
  for (const couche of couches) {
    for (const segment of couche.segments) {
      const a = projecteur.projette(segment.a)
      const b = projecteur.projette(segment.b)
      if (a === null || b === null) continue
      ctx.moveTo(a.xPx, a.yPx)
      ctx.lineTo(b.xPx, b.yPx)
    }
  }
  ctx.stroke()
}

/** Cercle d'horizon et points cardinaux, dans le repère du site. */
function traceHorizon(entree: EntreeDessin, couleur: string): void {
  const { ctx, projecteur } = entree
  const versJ2000 = transpose(entree.matriceCiel)
  const PAS_AZIMUT_DEG = 3
  const points: Vec3[] = []
  for (let az = 0; az <= 360; az += PAS_AZIMUT_DEG) {
    points.push(applique(versJ2000, versVecteur(az, 0)))
  }
  ctx.strokeStyle = couleur
  ctx.lineWidth = 1
  traceLignes(ctx, projecteur, [points])

  ctx.fillStyle = couleur
  const cardinaux: readonly (readonly [number, string])[] = [
    [0, 'N'],
    [90, 'E'],
    [180, 'S'],
    [270, 'O'],
  ]
  for (const [az, nom] of cardinaux) {
    const p = projecteur.projette(applique(versJ2000, versVecteur(az, 0)))
    if (p !== null) ctx.fillText(nom, p.xPx, p.yPx)
  }
}

/**
 * T-0034 — ancre du label : le point de la ligne visible le plus proche du centre du canevas,
 * pour que le nom se pose sur la bande et non collé à un bord. `null` si la ligne ne traverse
 * pas le champ affiché — le label est alors absent, pas déporté.
 */
function ancreVoieLactee(
  projecteur: Projecteur,
  largeur: number,
  hauteur: number,
): { xPx: number; yPx: number } | null {
  let meilleure: { xPx: number; yPx: number } | null = null
  let meilleureDistance = Infinity
  for (const point of PLAN_GALACTIQUE) {
    const p = projecteur.projette(point)
    if (p === null) continue
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
    const distance = Math.hypot(p.xPx - largeur / 2, p.yPx - hauteur / 2)
    if (distance < meilleureDistance) {
      meilleureDistance = distance
      meilleure = p
    }
  }
  return meilleure
}

export function dessineCiel(entree: EntreeDessin): SortieDessin {
  const { ctx, projecteur, index } = entree
  const teintes = palette(entree.modeNuit)
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx

  ctx.fillStyle = teintes.fond
  ctx.fillRect(0, 0, largeur, hauteur)
  entree.surLeFond?.(ctx)
  ctx.font = `${HAUTEUR_LABEL_PX}px system-ui, sans-serif`
  ctx.textBaseline = 'middle'

  if (entree.couches.frontieres) {
    ctx.strokeStyle = teintes.frontieres
    ctx.lineWidth = 1
    traceLignes(ctx, projecteur, entree.frontieres.polylignes)
  }
  if (entree.couches.figures) {
    ctx.strokeStyle = teintes.figures
    ctx.lineWidth = 1
    traceSegments(ctx, projecteur, entree.figures)
  }
  if (entree.couches.asterismes) {
    // Couche distincte des figures IAU par la teinte et l'épaisseur, pas par des tirets :
    // le motif de tirets se rend plein sur un segment plus court que sa période, et un
    // astérisme mélange des branches longues et des chaînes de segments courts. La même
    // couche paraîtrait alors tracée de deux façons.
    ctx.strokeStyle = teintes.asterismes
    ctx.lineWidth = 2
    traceSegments(ctx, projecteur, entree.asterismes)
    ctx.lineWidth = 1
  }
  if (entree.couches.horizon) traceHorizon(entree, teintes.horizon)
  if (entree.couches.voieLactee) {
    ctx.strokeStyle = teintes.voieLactee
    ctx.lineWidth = 1
    traceLignes(ctx, projecteur, [PLAN_GALACTIQUE])
  }

  // --- Étoiles ------------------------------------------------------------
  const centreJ2000 = projecteur.inverse(largeur / 2, hauteur / 2)
  // Rayon du champ : la diagonale du canevas, exprimée en degrés au centre.
  const rayonChampDeg = Math.min(
    K('FOV_MAX_DEG') / 2,
    (projecteur.vue.fovDeg / 2) * Math.hypot(1, hauteur / largeur),
  )
  const chemins = Array.from({ length: TEINTES }, () => new Path2D())
  const cibles: CibleEcran[] = []
  const candidats: CandidatLabel[] = []
  let etoilesDessinees = 0
  const TOUR_RAD = 2 * Math.PI

  const stats = selectionne(
    index,
    centreJ2000,
    rayonChampDeg,
    entree.magLimite,
    (x, y, z, magV, bv, source) => {
      const p = projecteur.projette({ x, y, z })
      if (p === null) return
      if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) return
      const rayon = Math.max(RAYON_MIN_ETOILE_PX, rayonEtoilePx(magV))
      const chemin = chemins[teinte(bv)]!
      chemin.moveTo(p.xPx + rayon, p.yPx)
      chemin.arc(p.xPx, p.yPx, rayon, 0, TOUR_RAD)
      etoilesDessinees++
      const etoile = entree.etoiles[source]
      if (etoile !== undefined && magV <= K('MAG_LABEL_BAYER_MAX')) {
        cibles.push({ type: 'ETOILE', xPx: p.xPx, yPx: p.yPx, nom: '', etoile })
      }
    },
  )
  for (let t = 0; t < TEINTES; t++) {
    ctx.fillStyle = couleurTeinte(t, entree.modeNuit)
    ctx.fill(chemins[t]!)
  }

  // --- Étoiles nommées : labels et identification au clic -----------------
  for (const nommee of entree.etoilesNommees) {
    if (!etoileLabellisable(nommee.magV)) continue
    const p = projecteur.projette(versVecteur(nommee.adDeg, nommee.decDeg))
    if (p === null) continue
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
    const texte = nommee.nomPropre === '' ? nommee.designation : nommee.nomPropre
    cibles.push({
      type: 'ETOILE',
      xPx: p.xPx,
      yPx: p.yPx,
      nom: texte,
      etoileNommee: nommee,
    })
    candidats.push({
      texte,
      categorie: 'ETOILE',
      xPx: p.xPx + HAUTEUR_LABEL_PX / 2,
      yPx: p.yPx - HAUTEUR_LABEL_PX / 2,
      priorite: nommee.magV,
      largeurPx: texte.length * LARGEUR_CARACTERE_PX,
      hauteurPx: HAUTEUR_LABEL_PX,
    })
  }

  // --- Objets du ciel profond ---------------------------------------------
  ctx.strokeStyle = teintes.objets
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const objet of entree.objets) {
    if (objet.vMag === null || objet.vMag > entree.magLimite) continue
    const p = projecteur.projette(versVecteur(objet.adDeg, objet.decDeg))
    if (p === null) continue
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
    ctx.moveTo(p.xPx - MARQUEUR_OBJET_PX, p.yPx - MARQUEUR_OBJET_PX)
    ctx.lineTo(p.xPx + MARQUEUR_OBJET_PX, p.yPx + MARQUEUR_OBJET_PX)
    ctx.moveTo(p.xPx + MARQUEUR_OBJET_PX, p.yPx - MARQUEUR_OBJET_PX)
    ctx.lineTo(p.xPx - MARQUEUR_OBJET_PX, p.yPx + MARQUEUR_OBJET_PX)
    cibles.push({ type: 'OBJET', xPx: p.xPx, yPx: p.yPx, nom: objet.designation, objet })
    candidats.push({
      texte: objet.designation,
      categorie: 'OBJET',
      xPx: p.xPx + MARQUEUR_OBJET_PX + HAUTEUR_LABEL_PX / 2,
      yPx: p.yPx,
      priorite: objet.vMag,
      largeurPx: objet.designation.length * LARGEUR_CARACTERE_PX,
      hauteurPx: HAUTEUR_LABEL_PX,
    })
  }
  ctx.stroke()

  // --- Corps mobiles -------------------------------------------------------
  const versJ2000 = transpose(entree.matriceCiel)
  ctx.fillStyle = teintes.corps
  for (const corps of entree.corps) {
    const p = projecteur.projette(
      applique(versJ2000, versVecteur(corps.azimutDeg, corps.hauteurDeg)),
    )
    if (p === null) continue
    ctx.beginPath()
    ctx.arc(p.xPx, p.yPx, RAYON_CORPS_PX, 0, TOUR_RAD)
    ctx.fill()
    const nom = entree.nomsCorps[corps.corps] ?? String(corps.corps)
    cibles.push({ type: 'CORPS', xPx: p.xPx, yPx: p.yPx, nom, corps })
    candidats.push({
      texte: nom,
      categorie: 'CONSTELLATION',
      xPx: p.xPx + RAYON_CORPS_PX + HAUTEUR_LABEL_PX / 2,
      yPx: p.yPx,
      priorite: -Infinity,
      largeurPx: nom.length * LARGEUR_CARACTERE_PX,
      hauteurPx: HAUTEUR_LABEL_PX,
    })
  }

  // --- Nom de la Voie lactée ----------------------------------------------
  // Posé avant les noms de constellations : à priorité égale, le tri stable de
  // `composeLabels` le laisse passer devant eux plutôt que derrière.
  if (entree.couches.voieLactee) {
    const ancre = ancreVoieLactee(projecteur, largeur, hauteur)
    if (ancre !== null) {
      candidats.push({
        texte: NOM_VOIE_LACTEE,
        categorie: 'CONSTELLATION',
        xPx: ancre.xPx,
        yPx: ancre.yPx,
        priorite: 0,
        largeurPx: NOM_VOIE_LACTEE.length * LARGEUR_CARACTERE_PX,
        hauteurPx: HAUTEUR_LABEL_PX,
        couleur: teintes.voieLactee,
      })
    }
  }

  // --- Noms de constellations ---------------------------------------------
  for (const figure of entree.figures) {
    if (figure.centre === null) continue
    const p = projecteur.projette(figure.centre)
    if (p === null) continue
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
    candidats.push({
      texte: figure.nom,
      categorie: 'CONSTELLATION',
      xPx: p.xPx,
      yPx: p.yPx,
      priorite: 0,
      largeurPx: figure.nom.length * LARGEUR_CARACTERE_PX,
      hauteurPx: HAUTEUR_LABEL_PX,
    })
  }
  if (entree.couches.asterismes) {
    for (const asterisme of entree.asterismes) {
      if (asterisme.centre === null) continue
      const p = projecteur.projette(asterisme.centre)
      if (p === null) continue
      if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
      candidats.push({
        texte: asterisme.nom,
        categorie: 'CONSTELLATION',
        xPx: p.xPx,
        yPx: p.yPx,
        priorite: 1,
        largeurPx: asterisme.nom.length * LARGEUR_CARACTERE_PX,
        hauteurPx: HAUTEUR_LABEL_PX,
      })
    }
  }

  // --- Cadre matériel §3.5 -------------------------------------------------
  if (entree.couches.cadre) {
    ctx.strokeStyle = teintes.cadre
    ctx.lineWidth = 2
    for (const cadre of entree.cadres) {
      cheminCadre(ctx, projecteur, cadre, entree.matriceCiel)
      ctx.stroke()
    }
    ctx.lineWidth = 1
  }

  // --- Labels --------------------------------------------------------------
  const labels = composeLabels(candidats, projecteur.vue.fovDeg)
  for (const label of labels) {
    ctx.fillStyle = label.couleur ?? teintes.texte
    ctx.fillText(label.texte, label.xPx, label.yPx)
  }

  return { stats, etoilesDessinees, cibles, labels }
}

/** Cible la plus proche du point cliqué, dans un rayon de quelques pixels. */
export function cibleSousLeCurseur(
  cibles: readonly CibleEcran[],
  xPx: number,
  yPx: number,
): CibleEcran | null {
  let meilleure: CibleEcran | null = null
  let meilleureDistance = RAYON_CLIC_PX
  for (const cible of cibles) {
    const distance = Math.hypot(cible.xPx - xPx, cible.yPx - yPx)
    if (distance <= meilleureDistance) {
      meilleureDistance = distance
      meilleure = cible
    }
  }
  return meilleure
}
