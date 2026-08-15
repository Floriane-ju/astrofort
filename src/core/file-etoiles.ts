/**
 * §9.3 — Prévisualisation du filé d'étoiles.
 *
 * Trois choses doivent être EXACTES, et c'est là-dessus que la plupart des simulateurs
 * trichent :
 *
 *   1. LE PÔLE. Il est très souvent hors du cadre, et une prévisualisation qui le force dans
 *      l'image est fausse : elle induit un cadrage raté sur le terrain. L'application donne sa
 *      position réelle, hors bornes du canevas s'il le faut, et sa direction depuis la visée.
 *   2. LA GÉOMÉTRIE. En projection rectilinéaire, un cercle de déclinaison ne se projette pas
 *      en cercle : c'est une conique. Tracer des cercles concentriques est le raccourci
 *      classique, et il est faux à 130° de champ. Ici, chaque arc est la même étoile balayée
 *      en angle horaire et projetée par le moteur de §3.3 — aucune primitive de cercle.
 *   3. LA LONGUEUR. Elle varie comme cos δ d'une étoile à l'autre dans le même cadre.
 *
 * Et le point que ratent la plupart des simulateurs : une étoile qui file est MOINS BRILLANTE
 * PAR PIXEL qu'une étoile ponctuelle, puisque le même flux s'étale sur toute la trace.
 */

import { K } from '../registry/constants.ts'
import { DEG, applique, rotationAutourDe, separationDeg, type Vec3 } from './mat3.ts'
import type { PointEcran, Projecteur } from './projection.ts'
import { trace, type Traced } from './traced.ts'

const MIN_PAR_H = 60
const DEMI_TOUR = 180

export interface PositionPole {
  /** **Doit piloter l'affichage** : hors cadre, les arcs restent centrés hors du canevas. */
  readonly dansCadre: boolean
  /** Position dans le canevas. Peut être hors bornes, et le reste : rien n'est recentré. */
  readonly xPx: number | null
  readonly yPx: number | null
  readonly altitudeDeg: number
  readonly azimutDeg: number
  readonly distanceCentreDeg: number
  /** Direction dans l'image, en degrés depuis le haut du cadre, sens horaire. */
  readonly directionDeg: number | null
  readonly message: string
}

function angleImageDeg(dxPx: number, dyPx: number): number {
  const brut = Math.atan2(dxPx, -dyPx) / DEG
  return ((brut % 360) + 360) % 360
}

/**
 * §9.3 — position du centre de rotation. Le pôle céleste est fixe dans le référentiel local :
 * son altitude vaut la latitude du site, son azimut le nord vrai dans l'hémisphère nord.
 */
export function positionPole(
  projecteur: Projecteur,
  latitudeDeg: number,
  axePoleNord: Vec3,
): PositionPole {
  const nord = latitudeDeg >= 0
  const pole: Vec3 = nord
    ? axePoleNord
    : { x: -axePoleNord.x, y: -axePoleNord.y, z: -axePoleNord.z }
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const centreX = largeur / 2
  const centreY = hauteur / 2
  const point = projecteur.projette(pole)
  const dansCadre =
    point !== null &&
    point.xPx >= 0 &&
    point.yPx >= 0 &&
    point.xPx <= largeur &&
    point.yPx <= hauteur

  const visee = projecteur.inverse(centreX, centreY)
  const distanceCentreDeg = separationDeg(visee, pole)

  // Direction du pôle dans l'image, prise sur un point intermédiaire : elle reste définie
  // même quand le pôle lui-même n'est pas projetable.
  let directionDeg: number | null = null
  if (distanceCentreDeg > 0) {
    const fraction = Math.min(1, K('PAS_ANGLE_HORAIRE_FILE_DEG') / distanceCentreDeg)
    const melange: Vec3 = {
      x: visee.x + (pole.x - visee.x) * fraction,
      y: visee.y + (pole.y - visee.y) * fraction,
      z: visee.z + (pole.z - visee.z) * fraction,
    }
    const voisin = projecteur.projette(melange)
    if (voisin !== null) directionDeg = angleImageDeg(voisin.xPx - centreX, voisin.yPx - centreY)
  }

  const altitudeDeg = Math.abs(latitudeDeg)
  const azimutDeg = nord ? 0 : DEMI_TOUR
  const message = dansCadre
    ? `Centre de rotation dans le cadre, à ${altitudeDeg.toFixed(1)}° de hauteur, azimut ` +
      `${azimutDeg}° — les arcs sont concentriques autour de ce point et s’allongent avec la ` +
      'distance au pôle.'
    : `Pôle hors du cadre : il est à ${distanceCentreDeg.toFixed(1)}° du centre de visée` +
      `${directionDeg === null ? '' : `, direction ${directionDeg.toFixed(0)}° depuis le haut de l’image`}. ` +
      'Les arcs restent concentriques autour de ce point situé hors du canevas : l’application ' +
      'ne le recentre pas, sans quoi le cadrage préparé ici ne serait pas celui obtenu.'

  return {
    dansCadre,
    xPx: point?.xPx ?? null,
    yPx: point?.yPx ?? null,
    altitudeDeg,
    azimutDeg,
    distanceCentreDeg,
    directionDeg,
    message,
  }
}

/** §9.3 — longueur d'arc, variable d'une étoile à l'autre dans le même cadre. */
export function longueurArcDeg(dureeMin: number, decDeg: number): Traced<number> {
  return trace({
    value: K('ROTATION_CIEL_DEG_H') * (dureeMin / MIN_PAR_H) * Math.cos(decDeg * DEG),
    formula: 'ARC_FILE',
    inputs: { duree_min: dureeMin, dec_deg: decDeg },
    constants: ['ROTATION_CIEL_DEG_H'],
  })
}

export interface ArcFile {
  /** Polylignes en pixels — plusieurs dès que l'étoile sort du cadre puis y revient. */
  readonly segments: readonly (readonly PointEcran[])[]
  readonly longueurPx: number
  /** Vrai quand l'étoile entre ou sort du champ pendant la séquence. */
  readonly tronque: boolean
}

/**
 * Arc décrit par une étoile pendant la durée d'accumulation.
 *
 * L'appareil est fixe au sol : c'est le ciel qui tourne. Balayer l'angle horaire revient donc
 * à faire tourner l'étoile autour du pôle céleste dans le repère équatorial, la matrice de
 * l'image restant celle de l'instant de départ. Le code de projection est celui de §3.3, sans
 * une ligne de géométrie propre au filé.
 */
export function arcEtoile(
  projecteur: Projecteur,
  etoile: Vec3,
  dureeMin: number,
  axePoleNord: Vec3,
): ArcFile {
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const balayageDeg = K('ROTATION_CIEL_DEG_H') * (dureeMin / MIN_PAR_H)
  const pasDeg = K('PAS_ANGLE_HORAIRE_FILE_DEG')
  const pas = Math.max(1, Math.ceil(balayageDeg / pasDeg))
  // Rotation élémentaire autour du pôle céleste de l'époque, appliquée de proche en proche :
  // l'angle horaire croît, donc l'ascension droite apparente décroît d'autant.
  const rotation = rotationAutourDe(axePoleNord, -balayageDeg / pas)

  const segments: PointEcran[][] = []
  let courant: PointEcran[] = []
  let longueurPx = 0
  let tronque = false
  let precedent: PointEcran | null = null
  let position = etoile

  for (let i = 0; i <= pas; i++) {
    if (i > 0) position = applique(rotation, position)
    const point = projecteur.projette(position)
    const dedans =
      point !== null && point.xPx >= 0 && point.yPx >= 0 && point.xPx <= largeur && point.yPx <= hauteur
    if (point !== null) {
      // Le point qui sort est conservé : sans lui, la trace s'arrêterait avant le bord.
      courant.push(point)
      if (precedent !== null) longueurPx += Math.hypot(point.xPx - precedent.xPx, point.yPx - precedent.yPx)
    }
    if (!dedans) {
      tronque = true
      if (courant.length > 0) segments.push(courant)
      courant = []
      precedent = null
    } else {
      precedent = point
    }
  }
  if (courant.length > 0) segments.push(courant)

  return { segments, longueurPx, tronque }
}

/**
 * §9.3 — temps que l'étoile passe sur UN pixel pendant la séquence.
 *
 * C'est le point que ratent la plupart des simulateurs : une étoile qui file est moins
 * brillante par pixel qu'une étoile ponctuelle, puisque le même flux s'étale sur toute la
 * trace. La pose vue par un pixel n'est pas la durée de la séquence, mais cette durée divisée
 * par la longueur de la trace — et c'est elle qui décide si la trace ressort du fond de ciel.
 */
export function poseParPixelS(dureeS: number, echApx: number, decDeg: number): number {
  // Un degré par heure vaut une arcseconde par seconde : le temps de traversée d'un pixel se
  // lit directement dans l'échantillonnage. Il ne dépend PAS de la durée de la séquence —
  // allonger le filé allonge la trace, il ne l'éclaircit pas.
  const traverseeS = echApx / (K('ROTATION_CIEL_DEG_H') * Math.max(Math.cos(decDeg * DEG), Number.EPSILON))
  return Math.min(dureeS, traverseeS)
}

export interface EntreeDiagnosticFile {
  readonly projecteur: Projecteur
  readonly latitudeDeg: number
  /** Direction J2000 du pôle céleste nord de l'époque affichée (§3.1). */
  readonly axePoleNord: Vec3
  readonly dureeMin: number
  /** Déclinaisons extrêmes présentes dans le cadre (§9.1). */
  readonly decMinAbsDeg: number
  readonly decMaxAbsDeg: number
  /** Hauteur du champ couvert par le cadre, en degrés. */
  readonly hauteurCadreDeg: number
  readonly arcsTronques: number
}

export interface DiagnosticFile {
  readonly pole: PositionPole
  /** Arc le plus long du cadre : celui de la déclinaison la plus faible en valeur absolue. */
  readonly longueurArcMaxDeg: Traced<number>
  readonly longueurArcMinDeg: Traced<number>
  /** Part de la hauteur du cadre couverte par l'arc le plus long. */
  readonly fractionHauteurCadre: number
  readonly messages: readonly string[]
}

export function diagnosticFile(entree: EntreeDiagnosticFile): DiagnosticFile {
  const pole = positionPole(entree.projecteur, entree.latitudeDeg, entree.axePoleNord)
  const longueurArcMaxDeg = longueurArcDeg(entree.dureeMin, entree.decMinAbsDeg)
  const longueurArcMinDeg = longueurArcDeg(entree.dureeMin, entree.decMaxAbsDeg)
  const fractionHauteurCadre = longueurArcMaxDeg.value / entree.hauteurCadreDeg

  const messages: string[] = [pole.message]
  const pourcent = (fractionHauteurCadre * 100).toFixed(0)
  if (entree.dureeMin < K('DUREE_FILE_LISIBLE_MIN')) {
    messages.push(
      `L’arc le plus long fait ${longueurArcMaxDeg.value.toFixed(2)}°, soit environ ${pourcent} % ` +
        'de la hauteur du cadre : le résultat ressemblera à des étoiles légèrement étirées, pas ' +
        `à un filé. Un filé lisible demande typiquement au moins ${K('DUREE_FILE_LISIBLE_MIN')} min, ` +
        `et devient spectaculaire à partir de ${K('DUREE_FILE_SPECTACULAIRE_MIN')} min.`,
    )
  } else {
    messages.push(
      `L’arc le plus long fait ${longueurArcMaxDeg.value.toFixed(2)}° et le plus court ` +
        `${longueurArcMinDeg.value.toFixed(2)}°, soit ${pourcent} % de la hauteur du cadre pour le ` +
        'premier. Cette différence de longueur dans un même cadre est l’effet le plus ' +
        'caractéristique du filé.',
    )
  }
  messages.push(
    entree.projecteur.vue.mode === 'MODE_FISHEYE'
      ? 'Objectif fisheye : la projection équidistante est utilisée et les arcs restent quasi ' +
          'circulaires autour du pôle, contrairement au rendu rectilinéaire.'
      : 'Projection rectilinéaire : un cercle de déclinaison s’y projette en conique, et les ' +
          'arcs proches du bord ne sont visiblement pas circulaires. Les tracer en cercles ' +
          'concentriques serait faux à grand champ.',
  )
  if (entree.arcsTronques > 0) {
    messages.push(
      `${entree.arcsTronques} étoiles entrent et sortent du champ pendant la séquence : leurs ` +
        'arcs sont tronqués au bord du cadre, ils ne s’arrêtent pas là dans la réalité.',
    )
  }

  return { pole, longueurArcMaxDeg, longueurArcMinDeg, fractionHauteurCadre, messages }
}
