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
 *      en angle horaire et projetée par le moteur de §3.3.
 *      T-0115 — sauf en stéréographique, où le cercle n'est pas un raccourci mais une
 *      IDENTITÉ : `MODE_PLANETARIUM` projette par 2/(1 + z), soit R = 2·tan(θ/2) depuis
 *      l'antipode de la visée. Cette projection est conforme et conserve les cercles, donc un
 *      cercle de déclinaison s'y projette en cercle exact du plan. La mise en garde ci-dessus
 *      porte sur la rectilinéaire (`MODE_CADRE`) et sur l'équidistante (`MODE_FISHEYE`), qui
 *      ne les conservent pas : la polyligne y reste seule.
 *   3. LA LONGUEUR. Elle varie comme cos δ d'une étoile à l'autre dans le même cadre.
 *
 * Et le point que ratent la plupart des simulateurs : une étoile qui file est MOINS BRILLANTE
 * PAR PIXEL qu'une étoile ponctuelle, puisque le même flux s'étale sur toute la trace.
 */

import { K } from '../registry/constants.ts'
import { DEG, applique, rotationAutourDe, separationDeg, type Vec3 } from './mat3.ts'
import { pointEcran, porteeUtilePx, type PointEcran, type Projecteur } from './projection.ts'
import { trace, type Traced } from './traced.ts'

const MIN_PAR_H = 60
const DEMI_TOUR = 180
const TOUR_RAD = 2 * Math.PI

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

/**
 * T-0115 — arc EXACT, en projection stéréographique seulement. Angles en radians, dans le
 * repère du canevas : `debutRad` est l'angle du départ vu du centre, `balayageRad` l'étendue
 * signée, négative quand l'arc tourne dans le sens antihoraire de l'écran.
 */
export interface ArcCercle {
  readonly xPx: number
  readonly yPx: number
  readonly rayonPx: number
  readonly debutRad: number
  readonly balayageRad: number
}

export interface ArcFile {
  /** Polylignes en pixels — plusieurs dès que l'étoile sort du cadre puis y revient. */
  readonly segments: readonly (readonly PointEcran[])[]
  /**
   * Arc de cercle exact quand la projection en conserve un (T-0115). `segments` ne porte
   * alors que la position de départ : le tracé passe par `ctx.arc`, pas par la polyligne.
   */
  readonly cercle: ArcCercle | null
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
/**
 * T-0024 — longueur projetée d'un segment de polyligne, en pixels.
 *
 * Une flèche de polyligne vaut c²/8R pour une corde c sur un rayon projeté R : à 4 px de
 * corde, l'écart à la conique reste sous le pixel dès que le rayon dépasse 2 px, donc pour
 * tout arc visible. C'est la fidélité que §9.3 demande, tenue là où elle se juge.
 */
const PAS_ARC_PX = 4
/** Segments du pré-échantillonnage qui estime la longueur projetée avant de la parcourir. */
const PRE_ECHANTILLONS = 4

/**
 * Longueur projetée approchée de l'arc, ou `null` si l'étoile n'est pas projetable partout.
 *
 * T-0111 — les longueurs se somment en `sqrt` et non en `Math.hypot` : la mise à l'échelle
 * anti-dépassement de `hypot` n'a rien à protéger sur une différence de deux abscisses de
 * canevas, et elle se payait à chaque pas de chaque arc.
 */
function longueurApprocheePx(
  projecteur: Projecteur,
  etoile: Vec3,
  balayageDeg: number,
  axePoleNord: Vec3,
): number | null {
  const rotation = rotationAutourDe(axePoleNord, -balayageDeg / PRE_ECHANTILLONS)
  let position = etoile
  let precedent = projecteur.projette(position)
  if (precedent === null) return null
  let longueur = 0
  for (let i = 0; i < PRE_ECHANTILLONS; i++) {
    position = applique(rotation, position)
    const point = projecteur.projette(position)
    if (point === null) return null
    const dx = point.xPx - precedent.xPx
    const dy = point.yPx - precedent.yPx
    longueur += Math.sqrt(dx * dx + dy * dy)
    precedent = point
  }
  return longueur
}

/**
 * T-0115 — positions projetées qui suffisent à un arc stéréographique : début, quarts,
 * milieu, fin. Trois d'entre elles déterminent le cercle, les cinq donnent le balayage.
 */
const ECHANTILLONS_CERCLE = 5
/**
 * Tampons de passe, hissés hors de la fonction pour le motif de `pointEcran` (T-0065) :
 * cinq positions et quatre écarts par étoile, des milliers d'étoiles par image — autant de
 * tableaux morts qui rendraient l'addition en saccades pendant un panoramique.
 */
const xsCercle = new Float64Array(ECHANTILLONS_CERCLE)
const ysCercle = new Float64Array(ECHANTILLONS_CERCLE)
const ecartsCercle = new Float64Array(ECHANTILLONS_CERCLE - 1)

/** Cet angle est-il traversé par le balayage ? Sert à borner l'arc, pas le cercle entier. */
function dansBalayage(angleRad: number, debutRad: number, balayageRad: number): boolean {
  const sens = balayageRad < 0 ? -1 : 1
  const depuisDebut = ((((angleRad - debutRad) * sens) % TOUR_RAD) + TOUR_RAD) % TOUR_RAD
  return depuisDebut <= Math.abs(balayageRad)
}

/**
 * T-0115 — arc exact en projection stéréographique, ou `null` s'il faut la polyligne.
 *
 * `MODE_PLANETARIUM` projette par 2/(1 + z) : c'est la stéréographique depuis l'antipode de
 * la visée, elle est conforme et elle conserve les cercles. Le cercle de déclinaison balayé
 * par l'étoile s'y projette donc en cercle EXACT — cinq projections remplacent les centaines
 * de la polyligne sans rien approcher. La géométrie de §9.3 n'est pas relâchée, elle est
 * résolue en fermé.
 *
 * Deux replis, et ils portent le même défaut : un cercle de déclinaison qui frôle l'antipode
 * de la visée s'y projette en DROITE, rayon infini. La polyligne reprend alors la main.
 */
function arcStereographique(
  projecteur: Projecteur,
  etoile: Vec3,
  balayageDeg: number,
  axePoleNord: Vec3,
): ArcFile | null {
  const [r11, r12, r13, r21, r22, r23, r31, r32, r33] = rotationAutourDe(
    axePoleNord,
    -balayageDeg / (ECHANTILLONS_CERCLE - 1),
  )
  const out = pointEcran()
  let px = etoile.x
  let py = etoile.y
  let pz = etoile.z
  for (let i = 0; i < ECHANTILLONS_CERCLE; i++) {
    if (i > 0) {
      const x = r11 * px + r12 * py + r13 * pz
      const y = r21 * px + r22 * py + r23 * pz
      const z = r31 * px + r32 * py + r33 * pz
      px = x
      py = y
      pz = z
    }
    // Premier repli : une seule position non projetable, et l'arc passe au voisinage de la
    // singularité. La polyligne l'y coupe, un cercle ajusté sur les autres ne le ferait pas.
    if (!projecteur.projetteEn(px, py, pz, out)) return null
    xsCercle[i] = out.xPx
    ysCercle[i] = out.yPx
  }

  // Cercle circonscrit au départ, au milieu et à la fin. Trois points d'un cercle le
  // déterminent : rien n'est ajusté au sens des moindres carrés, il n'y a pas de résidu.
  const ax = xsCercle[0]!
  const ay = ysCercle[0]!
  const bx = xsCercle[2]!
  const by = ysCercle[2]!
  const cx = xsCercle[4]!
  const cy = ysCercle[4]!
  const det = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  // Positions confondues (durée nulle) ou alignées : il n'y a pas de cercle à tracer.
  if (det === 0) return null
  const a2 = ax * ax + ay * ay
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const centreX = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / det
  const centreY = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / det
  const rayonPx = Math.sqrt((ax - centreX) ** 2 + (ay - centreY) ** 2)
  // Second repli : au-delà de la portée utile, le rayon diverge et le cercle n'est plus une
  // position mais le voisinage de la singularité (§3.3). Le seuil existe déjà pour ce motif,
  // aucune constante nouvelle. `!(… <= …)` attrape aussi un rayon non fini.
  if (!(rayonPx <= porteeUtilePx(projecteur.vue))) return null

  const debutRad = Math.atan2(ay - centreY, ax - centreX)
  let angleAvant = debutRad
  let vote = 0
  for (let i = 1; i < ECHANTILLONS_CERCLE; i++) {
    const angle = Math.atan2(ysCercle[i]! - centreY, xsCercle[i]! - centreX)
    let ecart = angle - angleAvant
    if (ecart > Math.PI) ecart -= TOUR_RAD
    else if (ecart < -Math.PI) ecart += TOUR_RAD
    ecartsCercle[i - 1] = ecart
    vote += ecart > 0 ? 1 : ecart < 0 ? -1 : 0
    angleAvant = angle
  }
  // Le balayage écran peut dépasser le demi-tour : un écart de plus de 180° se replie alors
  // du mauvais côté et retirerait un tour entier. Le sens vient donc d'un VOTE — le balayage
  // total restant sous le tour complet, un seul des quatre écarts peut dépasser 180°, et les
  // trois autres tranchent. Chaque écart est ensuite ramené dans ce sens.
  const sens = vote >= 0 ? 1 : -1
  let balayageRad = 0
  for (let i = 0; i < ECHANTILLONS_CERCLE - 1; i++) {
    const ecart = ecartsCercle[i]!
    balayageRad += ecart * sens < 0 ? ecart + sens * TOUR_RAD : ecart
  }

  // Boîte englobante EXACTE de l'arc : ses deux extrémités, plus ceux des quatre extrêmes du
  // cercle que le balayage traverse réellement. C'est elle qui dit si la trace sort du cadre.
  let minX = Math.min(ax, cx)
  let maxX = Math.max(ax, cx)
  let minY = Math.min(ay, cy)
  let maxY = Math.max(ay, cy)
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2
    if (!dansBalayage(angle, debutRad, balayageRad)) continue
    const x = centreX + rayonPx * Math.cos(angle)
    const y = centreY + rayonPx * Math.sin(angle)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  return {
    segments: [[{ xPx: ax, yPx: ay }]],
    cercle: { xPx: centreX, yPx: centreY, rayonPx, debutRad, balayageRad },
    // Longueur d'arc, pas somme de cordes : c'est elle qui décide disque contre trait.
    longueurPx: rayonPx * Math.abs(balayageRad),
    tronque:
      minX < 0 || minY < 0 || maxX > projecteur.vue.largeurPx || maxY > projecteur.vue.hauteurPx,
  }
}

export function arcEtoile(
  projecteur: Projecteur,
  etoile: Vec3,
  dureeMin: number,
  axePoleNord: Vec3,
): ArcFile {
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const balayageDeg = K('ROTATION_CIEL_DEG_H') * (dureeMin / MIN_PAR_H)
  if (projecteur.vue.mode === 'MODE_PLANETARIUM') {
    const exact = arcStereographique(projecteur, etoile, balayageDeg, axePoleNord)
    if (exact !== null) return exact
  }
  const pasDeg = K('PAS_ANGLE_HORAIRE_FILE_DEG')
  // Pas de référence de §9.3 : 0,25° d'angle horaire, soit 481 positions à 480 min. Il reste
  // le pas LE PLUS FIN — rien ne gagne à subdiviser plus loin.
  const pasFin = Math.max(1, Math.ceil(balayageDeg / pasDeg))
  // T-0024 — une étoile à un degré du pôle décrit une trace de quelques pixels : elle payait
  // les mêmes 481 pas qu'une étoile de l'équateur céleste traversant tout le cadre. Le
  // comptage suit désormais la longueur PROJETÉE, là où se juge la fidélité à la conique.
  // Estimation impossible (étoile non projetable sur tout le balayage) : on garde le pas fin.
  const estimation = longueurApprocheePx(projecteur, etoile, balayageDeg, axePoleNord)
  const pas =
    estimation === null
      ? pasFin
      : Math.max(1, Math.min(pasFin, Math.ceil(estimation / PAS_ARC_PX)))
  // Rotation élémentaire autour du pôle céleste de l'époque, appliquée de proche en proche :
  // l'angle horaire croît, donc l'ascension droite apparente décroît d'autant.
  // T-0111 — la matrice est déstructurée ici et le produit écrit à la main dans la boucle :
  // `applique` alloue un vecteur par pas, soit un objet mort par position de chaque étoile,
  // et cette seule allocation pesait un quart de la passe. L'ordre des opérations est celui
  // de `applique`, au terme près : la trajectoire reste bit à bit la même.
  const [r11, r12, r13, r21, r22, r23, r31, r32, r33] = rotationAutourDe(
    axePoleNord,
    -balayageDeg / pas,
  )

  const segments: PointEcran[][] = []
  let courant: PointEcran[] = []
  let longueurPx = 0
  let tronque = false
  let precedentX = 0
  let precedentY = 0
  let precedent = false
  let px = etoile.x
  let py = etoile.y
  let pz = etoile.z
  // Point de travail unique : seules les positions RETENUES deviennent un objet. Les autres
  // — non projetables — n'en coûtaient un que pour être aussitôt jetées.
  const out = pointEcran()

  for (let i = 0; i <= pas; i++) {
    if (i > 0) {
      const x = r11 * px + r12 * py + r13 * pz
      const y = r21 * px + r22 * py + r23 * pz
      const z = r31 * px + r32 * py + r33 * pz
      px = x
      py = y
      pz = z
    }
    const projetable = projecteur.projetteEn(px, py, pz, out)
    const xPx = out.xPx
    const yPx = out.yPx
    const dedans = projetable && xPx >= 0 && yPx >= 0 && xPx <= largeur && yPx <= hauteur
    if (projetable) {
      // Le point qui sort est conservé : sans lui, la trace s'arrêterait avant le bord.
      courant.push({ xPx, yPx })
      if (precedent) {
        const dx = xPx - precedentX
        const dy = yPx - precedentY
        longueurPx += Math.sqrt(dx * dx + dy * dy)
      }
    }
    if (!dedans) {
      tronque = true
      if (courant.length > 0) segments.push(courant)
      courant = []
      precedent = false
    } else {
      precedentX = xPx
      precedentY = yPx
      precedent = true
    }
  }
  if (courant.length > 0) segments.push(courant)

  return { segments, cercle: null, longueurPx, tronque }
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
  const mode = entree.projecteur.vue.mode
  messages.push(
    mode === 'MODE_FISHEYE'
      ? 'Objectif fisheye : la projection équidistante est utilisée et les arcs restent quasi ' +
          'circulaires autour du pôle, contrairement au rendu rectilinéaire.'
      : mode === 'MODE_PLANETARIUM'
        ? 'Projection stéréographique : elle est conforme et conserve les cercles, donc chaque ' +
          'arc est un cercle EXACT du plan — non concentriques entre eux, chacun centré à sa ' +
          'place. Ce n’est pas un raccourci de tracé, c’est la géométrie de cette projection.'
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
