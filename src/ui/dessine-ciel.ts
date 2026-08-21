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
import {
  composeLabels,
  etoileLabellisable,
  labelSurvol,
  type BoiteLabel,
  type CandidatLabel,
} from '../core/labels.ts'
import { contrasteVoieLactee, densiteRelative, depuisGalactique } from '../core/galactique.ts'
import {
  applique,
  transpose,
  versSpherique,
  versVecteur,
  type Mat3,
  type Vec3,
} from '../core/mat3.ts'
import {
  pointEcran,
  rayonEtoilePx,
  type PointEcranMut,
  type Projecteur,
} from '../core/projection.ts'
import { contourCadreJ2000, type Cadre } from '../core/cadre.ts'
import type { PositionCorps } from '../core/ephem.ts'
import {
  altitudeCulmination,
  latitudeAccessibleDeg,
  type MasqueHorizon,
} from '../core/site.ts'
import { projecteurSansSol } from '../core/sol.ts'
import { dessineSol } from './dessine-sol.ts'
import { couleurTeinte, palette, teinte, TEINTES } from './couleurs.ts'

export interface CouchesActives {
  readonly figures: boolean
  readonly frontieres: boolean
  readonly asterismes: boolean
  readonly cadre: boolean
  readonly horizon: boolean
  readonly voieLactee: boolean
  /** §4.1 — le sol du site masque ce qui est dessous : rien n'y est tracé ni cliquable. */
  readonly sol: boolean
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

/**
 * T-0085 — l'élément sous le curseur et le libellé que le clic lui donnerait.
 *
 * Le texte est résolu par l'appelant, avec `decritCible` : la scène ne compose pas un second
 * vocabulaire, elle emprunte celui du clic. Le point est celui de l'élément, pas du curseur —
 * le nom reste collé à ce qu'il nomme.
 */
export interface SurvolEcran {
  readonly xPx: number
  readonly yPx: number
  readonly texte: string
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
  /**
   * §3.7 — fond de ciel du site : c'est lui qui module le contraste de la bande. La scène
   * montre ce que L'UTILISATEUR verra, pas une carte de référence idéale.
   */
  readonly sbCiel: number
  /** §3.7 — latitude du site : elle décide si le centre galactique est atteignable d'ici. */
  readonly latitudeDeg: number
  /** §4.1 — relief du site : il donne sa hauteur au sol de la couche `sol`, azimut par azimut. */
  readonly masque: MasqueHorizon
  readonly modeNuit: boolean
  /**
   * Peint entre le fond et tout le reste. C'est là que l'aperçu incrusté se dépose : sous les
   * repères, les étoiles et les noms, jamais par-dessus.
   */
  readonly surLeFond?: ((ctx: CanvasRenderingContext2D) => void) | undefined
  /** §3.4 / T-0085 — absent : rien n'est survolé, la scène ne révèle aucun nom. */
  readonly survol?: SurvolEcran | undefined
}

export interface SortieDessin {
  readonly stats: StatistiquesSelection
  readonly etoilesDessinees: number
  readonly cibles: readonly CibleEcran[]
  readonly labels: readonly CandidatLabel[]
  /** T-0085 — le label transitoire du survol, hors budget de §3.4. */
  readonly revele: BoiteLabel | null
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
/** Échantillonnage en azimut du cercle d'horizon. */
const PAS_AZIMUT_HORIZON_DEG = 3
const PAS_LONGITUDE_GALACTIQUE_DEG = 3
const PAS_LATITUDE_BANDE_DEG = 5

/**
 * T-0033 — le plan galactique `b = 0`, échantillonné en longitude comme l'horizon l'est en
 * azimut. Il est fixe en J2000 : la polyligne se calcule une fois au chargement du module,
 * jamais par image. Seule sa projection dépend de l'instant et du zoom.
 */
const PLAN_GALACTIQUE: readonly Vec3[] = Array.from(
  { length: 360 / PAS_LONGITUDE_GALACTIQUE_DEG + 1 },
  (_, i) => depuisGalactique(i * PAS_LONGITUDE_GALACTIQUE_DEG, 0),
)

/**
 * T-0091 — la bande, échantillonnée en tranches de latitude galactique.
 *
 * Une tranche = une polyligne à latitude constante, tracée au trait épais de la largeur de
 * la tranche. Le trait, et pas le polygone rempli : une polyligne dont une partie sort du
 * champ se rompt en segments, et un polygone rompu se referme n'importe où. Le trait, lui,
 * ne peint que ce qui reste — la bande se coupe proprement au bord du champ.
 *
 * Fixe en J2000, comme le plan : les polylignes se calculent au chargement du module.
 */
const TRANCHES_BANDE: readonly { readonly densite: number; readonly ligne: readonly Vec3[] }[] =
  Array.from(
    { length: (2 * K('LATITUDE_BANDE_GALACTIQUE_MAX_DEG')) / PAS_LATITUDE_BANDE_DEG + 1 },
    (_, i) => {
      const bDeg = -K('LATITUDE_BANDE_GALACTIQUE_MAX_DEG') + i * PAS_LATITUDE_BANDE_DEG
      return Object.freeze({
        densite: densiteRelative(bDeg).value,
        ligne: Object.freeze(
          Array.from({ length: 360 / PAS_LONGITUDE_GALACTIQUE_DEG + 1 }, (_unused, j) =>
            depuisGalactique(j * PAS_LONGITUDE_GALACTIQUE_DEG, bDeg),
          ),
        ),
      })
    },
  )

/** T-0091 — le centre galactique : l = 0°, b = 0°, soit δ ≈ −29°. Calculé, jamais recopié. */
const CENTRE_GALACTIQUE: Vec3 = depuisGalactique(0, 0)
const NOM_CENTRE_GALACTIQUE = 'Centre galactique'

/** Compose le chemin sans le peindre : au tracé du ciel de le remplir, au cadre de le découper. */
function cheminLignes(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  polylignes: readonly (readonly Vec3[])[],
): void {
  const p = pointEcran()
  ctx.beginPath()
  for (const ligne of polylignes) {
    let enchaine = false
    for (const point of ligne) {
      if (!projecteur.projetteEn(point.x, point.y, point.z, p)) {
        enchaine = false
        continue
      }
      if (enchaine) ctx.lineTo(p.xPx, p.yPx)
      else ctx.moveTo(p.xPx, p.yPx)
      enchaine = true
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
  const a = pointEcran()
  const b = pointEcran()
  ctx.beginPath()
  for (const couche of couches) {
    for (const segment of couche.segments) {
      if (!projecteur.projetteEn(segment.a.x, segment.a.y, segment.a.z, a)) continue
      if (!projecteur.projetteEn(segment.b.x, segment.b.y, segment.b.z, b)) continue
      ctx.moveTo(a.xPx, a.yPx)
      ctx.lineTo(b.xPx, b.yPx)
    }
  }
  ctx.stroke()
}

/**
 * Cercle d'horizon à 0° et points cardinaux, dans le repère du site.
 *
 * Le projecteur arrive en paramètre, et c'est le projecteur BRUT : c'est un repère de lecture,
 * pas un objet posé sur le sol. Filtré comme le reste, le cercle disparaîtrait derrière chaque
 * colline du relief (§4.1) — la crête, elle, est tracée par le sol qui la porte.
 */
function traceHorizon(entree: EntreeDessin, couleur: string, projecteur: Projecteur): void {
  const { ctx } = entree
  const versJ2000 = transpose(entree.matriceCiel)
  const points: Vec3[] = []
  for (let az = 0; az <= 360; az += PAS_AZIMUT_HORIZON_DEG) {
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
  const p = pointEcran()
  for (const [az, nom] of cardinaux) {
    const v = applique(versJ2000, versVecteur(az, 0))
    if (projecteur.projetteEn(v.x, v.y, v.z, p)) ctx.fillText(nom, p.xPx, p.yPx)
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
  const p = pointEcran()
  let meilleurX = 0
  let meilleurY = 0
  let meilleureDistance = Infinity
  for (const point of PLAN_GALACTIQUE) {
    if (!projecteur.projetteEn(point.x, point.y, point.z, p)) continue
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
    const distance = Math.hypot(p.xPx - largeur / 2, p.yPx - hauteur / 2)
    if (distance < meilleureDistance) {
      meilleureDistance = distance
      meilleurX = p.xPx
      meilleurY = p.yPx
    }
  }
  // L'ancre survit à la boucle : c'est le seul point de cette passe qui se copie.
  return meilleureDistance === Infinity ? null : { xPx: meilleurX, yPx: meilleurY }
}

/**
 * §3.7 — la bande de la Voie lactée, telle qu'elle se verra DEPUIS CE SITE.
 *
 * Deux modulations, aucune décorative : la densité par latitude galactique donne son profil
 * à la bande, le contraste tiré du fond de ciel décide si elle existe encore. À Bortle 8 le
 * contraste s'annule et la fonction ne peint rien — c'est l'information juste, pas une
 * économie de rendu.
 *
 * L'épaisseur du trait suit le zoom : une tranche de latitude couvre le même angle, donc
 * d'autant plus de pixels que le champ est serré. L'échelle est prise au centre du champ —
 * la projection l'étire vers les bords, et un repère de lecture n'en souffre pas.
 */
function traceBandeVoieLactee(entree: EntreeDessin, couleur: string): void {
  const contraste = contrasteVoieLactee(entree.sbCiel)
  if (contraste <= 0) return
  const { ctx, projecteur } = entree
  const opaciteInitiale = ctx.globalAlpha
  ctx.strokeStyle = couleur
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = (PAS_LATITUDE_BANDE_DEG * projecteur.vue.largeurPx) / projecteur.vue.fovDeg
  for (const tranche of TRANCHES_BANDE) {
    ctx.globalAlpha = contraste * tranche.densite * K('OPACITE_BANDE_GALACTIQUE')
    traceLignes(ctx, projecteur, [tranche.ligne])
  }
  ctx.globalAlpha = opaciteInitiale
  ctx.lineWidth = 1
  // Rendus à leurs valeurs par défaut : les repères tracés ensuite partagent ce contexte,
  // et un trait épais laissé arrondi arrondirait aussi les frontières et l'horizon.
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'
}

/**
 * §3.7 — le repère du centre galactique et son verdict site-dépendant.
 *
 * La hauteur COURANTE dit où le chercher maintenant ; la hauteur de CULMINATION dit si le
 * chercher a un sens depuis ce site. Les deux sont nécessaires : §8.2 a déjà calculé que le
 * centre galactique culmine à 14,6° depuis le site de référence, et ce chiffre vit dans un
 * tableau que personne n'ouvre. Sous le seuil d'imagerie, le repère porte donc la cause ET
 * la latitude qui rendrait la cible atteignable.
 *
 * Le tout dans UN label : c'est le repère qui porte la conséquence, et il s'arbitre au
 * budget de §3.4 d'un seul bloc, sans passe-droit.
 */
function repereCentreGalactique(
  entree: EntreeDessin,
  couleur: string,
  p: PointEcranMut,
): CandidatLabel | null {
  const { ctx, projecteur } = entree
  if (!projecteur.projetteEn(CENTRE_GALACTIQUE.x, CENTRE_GALACTIQUE.y, CENTRE_GALACTIQUE.z, p)) {
    return null
  }
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) return null

  ctx.strokeStyle = couleur
  ctx.beginPath()
  ctx.moveTo(p.xPx + RAYON_CORPS_PX, p.yPx)
  ctx.arc(p.xPx, p.yPx, RAYON_CORPS_PX, 0, 2 * Math.PI)
  ctx.moveTo(p.xPx - RAYON_CORPS_PX * 2, p.yPx)
  ctx.lineTo(p.xPx + RAYON_CORPS_PX * 2, p.yPx)
  ctx.moveTo(p.xPx, p.yPx - RAYON_CORPS_PX * 2)
  ctx.lineTo(p.xPx, p.yPx + RAYON_CORPS_PX * 2)
  ctx.stroke()

  const hauteurCouranteDeg = versSpherique(applique(entree.matriceCiel, CENTRE_GALACTIQUE))
    .latitudeDeg
  const decDeg = versSpherique(CENTRE_GALACTIQUE).latitudeDeg
  const culmination = altitudeCulmination(entree.latitudeDeg, decDeg).value
  const seuil = K('SEUIL_HAUTEUR_IMAGERIE_DEG')
  const texte =
    culmination <= seuil
      ? `${NOM_CENTRE_GALACTIQUE} ${hauteurCouranteDeg.toFixed(0)}° — culmine à ` +
        `${culmination.toFixed(1)}°, hors imagerie sauf sous ` +
        `${latitudeAccessibleDeg(decDeg, seuil).toFixed(1)}° N`
      : `${NOM_CENTRE_GALACTIQUE} ${hauteurCouranteDeg.toFixed(0)}°`
  return {
    texte,
    categorie: 'CONSTELLATION',
    xPx: p.xPx + RAYON_CORPS_PX * 2 + HAUTEUR_LABEL_PX / 2,
    yPx: p.yPx,
    priorite: 0,
    largeurPx: texte.length * LARGEUR_CARACTERE_PX,
    hauteurPx: HAUTEUR_LABEL_PX,
    couleur,
  }
}

export function dessineCiel(entreeBrute: EntreeDessin): SortieDessin {
  const brut = entreeBrute.projecteur
  // §4.1 — la couche Sol tient par deux gestes complémentaires. Le sol est PEINT, opaque, sur
  // ce qui a été tracé avant lui : rien d'autre ne masque la largeur d'un trait épais. Et ce
  // qui est tracé APRÈS lui hérite d'un projecteur aveugle au sol — sans quoi les étoiles se
  // reposeraient par-dessus le sol qu'on vient de peindre, et resteraient cliquables.
  const entree: EntreeDessin = entreeBrute.couches.sol
    ? {
        ...entreeBrute,
        projecteur: projecteurSansSol(brut, entreeBrute.masque, entreeBrute.matriceCiel),
      }
    : entreeBrute
  const { ctx, projecteur, index } = entree
  const teintes = palette(entree.modeNuit)
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx

  ctx.fillStyle = teintes.fond
  ctx.fillRect(0, 0, largeur, hauteur)
  // §3.7 — la bande appartient au fond : elle passe sous l'aperçu incrusté de §9.5 comme
  // sous les repères. Peinte plus tard, elle laverait la prévisualisation qu'elle recouvre.
  // Elle est tracée au projecteur BRUT, puis recouverte par le sol : filtrée, un trait de
  // cinq degrés de large s'interromprait un pas d'azimut trop tôt et laisserait une encoche
  // au-dessus de l'horizon.
  if (entree.couches.voieLactee) traceBandeVoieLactee(entreeBrute, teintes.voieLactee)
  // §4.1 — le sol, peint sur le fond et sur la bande, sous tout le reste.
  if (entree.couches.sol) {
    dessineSol(ctx, brut, entree.matriceCiel, entree.masque, teintes.sol, teintes.horizon)
  }
  // §9.5 — l'aperçu incrusté passe APRÈS le sol : le cadrage montre ce que le matériel
  // capturerait, y compris pointé bas, et un masque de terrain n'a pas à l'effacer.
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
  if (entree.couches.horizon) traceHorizon(entree, teintes.horizon, brut)
  let labelCentreGalactique: CandidatLabel | null = null
  if (entree.couches.voieLactee) {
    ctx.strokeStyle = teintes.voieLactee
    ctx.lineWidth = 1
    traceLignes(ctx, projecteur, [PLAN_GALACTIQUE])
    labelCentreGalactique = repereCentreGalactique(entree, teintes.voieLactee, pointEcran())
  }

  // --- Étoiles ------------------------------------------------------------
  const centreJ2000 = projecteur.inverse(largeur / 2, hauteur / 2)
  // Rayon du champ : la diagonale du canevas, exprimée en degrés au centre.
  const rayonChampDeg = Math.min(
    K('FOV_MAX_DEG') / 2,
    (projecteur.vue.fovDeg / 2) * Math.hypot(1, hauteur / largeur),
  )
  // Un `Path2D` par teinte, réalloué à chaque image : l'API n'offre aucun effacement, et
  // un chemin réutilisé accumulerait les disques des images précédentes. Contrainte de la
  // plateforme, pas négligence — huit objets par image, contre un par étoile évité plus bas.
  const chemins = Array.from({ length: TEINTES }, () => new Path2D())
  const cibles: CibleEcran[] = []
  const candidats: CandidatLabel[] = []
  let etoilesDessinees = 0
  const TOUR_RAD = 2 * Math.PI
  // Point de travail unique pour toute l'image : la boucle par étoile n'alloue plus rien,
  // ni en entrée — les composantes arrivent en scalaires — ni en sortie (T-0065).
  const p = pointEcran()

  const stats = selectionne(
    index,
    centreJ2000,
    rayonChampDeg,
    entree.magLimite,
    (x, y, z, magV, bv, source) => {
      if (!projecteur.projetteEn(x, y, z, p)) return
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
    const v = versVecteur(nommee.adDeg, nommee.decDeg)
    if (!projecteur.projetteEn(v.x, v.y, v.z, p)) continue
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
    const v = versVecteur(objet.adDeg, objet.decDeg)
    if (!projecteur.projetteEn(v.x, v.y, v.z, p)) continue
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
    const v = applique(versJ2000, versVecteur(corps.azimutDeg, corps.hauteurDeg))
    if (!projecteur.projetteEn(v.x, v.y, v.z, p)) continue
    // Hors canevas comme partout ailleurs : un corps derrière l'observateur reste projetable,
    // et son label part avec la priorité la plus haute de la scène. Sans ce test, une planète
    // qu'on ne voit pas prenait la place d'un nom qu'on voit (§3.4).
    if (p.xPx < 0 || p.yPx < 0 || p.xPx > largeur || p.yPx > hauteur) continue
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

  // --- Noms de la couche Voie lactée --------------------------------------
  // Posés avant les noms de constellations : à priorité égale, le tri stable de
  // `composeLabels` les laisse passer devant eux plutôt que derrière. Et le repère du
  // centre galactique passe devant le nom de la bande, pour la même raison : les deux
  // s'ancrent au même endroit quand la visée est sur le centre, et c'est le repère qui
  // porte la conséquence site-dépendante.
  if (entree.couches.voieLactee) {
    if (labelCentreGalactique !== null) candidats.push(labelCentreGalactique)
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
    if (!projecteur.projetteEn(figure.centre.x, figure.centre.y, figure.centre.z, p)) continue
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
      const c = asterisme.centre
      if (!projecteur.projetteEn(c.x, c.y, c.z, p)) continue
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
      // Projecteur BRUT : le contour dit où pointe le matériel, y compris sous l'horizon. Un
      // cadrage qui se rompt en visant bas ne dirait plus où l'on pointe (§3.5).
      cheminCadre(ctx, brut, cadre, entree.matriceCiel)
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

  // T-0085 — le nom masqué par le seuil de zoom, révélé le temps du survol. Il est peint
  // après les labels retenus et n'entre pas dans leur budget : `labelSurvol` le loge entre
  // eux ou y renonce, il n'en efface aucun.
  const revele =
    entree.survol === undefined
      ? null
      : labelSurvol(labels, {
          texte: entree.survol.texte,
          xPx: entree.survol.xPx + RAYON_CLIC_PX + HAUTEUR_LABEL_PX / 2,
          yPx: entree.survol.yPx,
          largeurPx: entree.survol.texte.length * LARGEUR_CARACTERE_PX,
          hauteurPx: HAUTEUR_LABEL_PX,
        })
  if (revele !== null) {
    ctx.fillStyle = teintes.texte
    ctx.fillText(revele.texte, revele.xPx, revele.yPx)
  }

  return { stats, etoilesDessinees, cibles, labels, revele }
}

/** Cible la plus proche du point cliqué, dans un rayon de quelques pixels. */
export function cibleSousLeCurseur(
  cibles: readonly CibleEcran[],
  xPx: number,
  yPx: number,
  /**
   * T-0069 — tolérance de désignation. Le pointeur vise au pixel, une touche non : le
   * pilotage au clavier passe donc un rayon plus large, sans changer la règle — c'est
   * toujours la cible la plus proche du point visé qui est retenue.
   */
  rayonPx: number = RAYON_CLIC_PX,
): CibleEcran | null {
  let meilleure: CibleEcran | null = null
  let meilleureDistance = rayonPx
  for (const cible of cibles) {
    const distance = Math.hypot(cible.xPx - xPx, cible.yPx - yPx)
    if (distance <= meilleureDistance) {
      meilleureDistance = distance
      meilleure = cible
    }
  }
  return meilleure
}
