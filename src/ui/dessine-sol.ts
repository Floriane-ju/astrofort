/**
 * §4.1 — le sol du site, peint.
 *
 * Écarter les sommets sous l'horizon ne suffit pas : la bande de la Voie lactée est un TRAIT
 * ÉPAIS de la largeur d'une tranche de latitude, et sa largeur débordait sous l'horizon là où
 * ses sommets étaient déjà écartés. Un masque qui laisse passer la moitié d'un trait n'est pas
 * un masque. Le sol se peint donc, opaque, avant les repères.
 *
 * LA FRONTIÈRE SE CHERCHE EN ESPACE ÉCRAN, jamais dans le ciel. Mailler la demi-sphère sous
 * l'horizon paraît plus naturel, et c'est un piège : l'antipode de la visée est sous l'horizon
 * dès qu'on regarde au-dessus, donc DANS le maillage, et la projection l'y envoie à l'infini.
 * Deux sommets voisins tombent alors de part et d'autre du canevas, et la corde qui les relie
 * balaie l'image — le sol recouvre le ciel et efface la bande peinte avant lui. Aucun plafond
 * de distance ne clôt ce cas : il suffit que l'antipode tombe entre deux mailles, et le défaut
 * réapparaît, à certaines hauteurs de visée seulement.
 *
 * Ici, la scène est balayée en rayons partant du centre du canevas. Sur chaque rayon, la
 * frontière du sol est trouvée par dichotomie sur `Projecteur.inverse` et le prédicat de
 * `sousLeSol` : la question posée est « ce pixel est-il sous le sol ? », qui n'a ni singularité
 * ni approximation. Un rayon traverse la frontière au plus une fois — un grand cercle ne coupe
 * un plan qu'une fois par demi-tour — et le sol est donc soit le dedans de la courbe obtenue,
 * soit son dehors, selon ce qu'est le centre du canevas.
 *
 * Échantillonner en angle ÉCRAN et non en azimut est ce qui rend le bord exact : le polygone
 * est inscrit sur la courbe telle qu'elle se voit, et son écart n'est plus la corde d'un grand
 * cercle mais celle de la courbe elle-même sur un degré d'écran — de l'ordre du centième de
 * pixel.
 */

import type { Mat3 } from '../core/mat3.ts'
import type { Projecteur } from '../core/projection.ts'
import type { MasqueHorizon } from '../core/site.ts'
import { sousLeSol } from '../core/sol.ts'

/** Rayons du balayage. À 240, le polygone s'écarte de la courbe de moins d'un centième de pixel. */
const NB_RAYONS = 240
/** La portée du balayage dépasse le coin du canevas : le sol ne doit pas s'arrêter dans l'image. */
const MARGE_RAYON = 1.02
/** Dichotomies par rayon : douze passes placent la frontière au tiers de pixel près. */
const NB_DICHOTOMIES = 12
const TOUR_RAD = 2 * Math.PI

/**
 * Peint le sol et souligne sa crête.
 *
 * La crête tracée est la frontière du remplissage elle-même, et non une seconde polyligne
 * calculée à part : le trait ne peut donc pas se décoller du bord qu'il souligne.
 */
export function dessineSol(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  matriceCiel: Mat3,
  masque: MasqueHorizon,
  couleurSol: string,
  couleurCrete: string,
): void {
  const enterre = sousLeSol(masque, matriceCiel)
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const centreX = largeur / 2
  const centreY = hauteur / 2
  const rayonMax = (Math.hypot(largeur, hauteur) / 2) * MARGE_RAYON

  const estSol = (xPx: number, yPx: number): boolean => {
    const v = projecteur.inverse(xPx, yPx)
    return enterre(v.x, v.y, v.z)
  }
  const centreEstSol = estSol(centreX, centreY)

  // Frontière par rayon, en pixels depuis le centre. `rayonMax` quand il n'y en a pas : le
  // rayon est tout entier du même côté, et le polygone se referme alors hors du canevas.
  const bords = new Float64Array(NB_RAYONS + 1)
  const trouvees = new Uint8Array(NB_RAYONS + 1)
  for (let i = 0; i <= NB_RAYONS; i++) {
    const angle = (i * TOUR_RAD) / NB_RAYONS
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    if (estSol(centreX + rayonMax * dx, centreY + rayonMax * dy) === centreEstSol) {
      bords[i] = rayonMax
      continue
    }
    let commeLeCentre = 0
    let autre = rayonMax
    for (let pas = 0; pas < NB_DICHOTOMIES; pas++) {
      const milieu = (commeLeCentre + autre) / 2
      if (estSol(centreX + milieu * dx, centreY + milieu * dy) === centreEstSol) {
        commeLeCentre = milieu
      } else {
        autre = milieu
      }
    }
    bords[i] = (commeLeCentre + autre) / 2
    trouvees[i] = 1
  }

  const xDe = (i: number): number => centreX + bords[i]! * Math.cos((i * TOUR_RAD) / NB_RAYONS)
  const yDe = (i: number): number => centreY + bords[i]! * Math.sin((i * TOUR_RAD) / NB_RAYONS)

  ctx.fillStyle = couleurSol
  ctx.beginPath()
  if (!centreEstSol) {
    // Le sol est le DEHORS de la courbe : le canevas entier, percé de cette courbe. Le trou est
    // découpé à la règle `evenodd`, qui ne dépend pas du sens de parcours des deux contours —
    // avec `nonzero`, un sens inversé remplirait tout ou rien selon la visée.
    ctx.moveTo(0, 0)
    ctx.lineTo(largeur, 0)
    ctx.lineTo(largeur, hauteur)
    ctx.lineTo(0, hauteur)
    ctx.closePath()
  }
  ctx.moveTo(xDe(0), yDe(0))
  for (let i = 1; i <= NB_RAYONS; i++) ctx.lineTo(xDe(i), yDe(i))
  ctx.closePath()
  ctx.fill('evenodd')

  // La crête : sans elle, le sol et le fond de ciel se touchent sans se séparer, et l'horizon
  // n'est plus qu'une absence d'étoiles. Seuls les arcs où une frontière a été trouvée sont
  // tracés — ailleurs, la courbe ne longe rien, elle referme le polygone hors du canevas.
  ctx.strokeStyle = couleurCrete
  ctx.lineWidth = 1
  ctx.beginPath()
  let enchaine = false
  for (let i = 0; i <= NB_RAYONS; i++) {
    if (trouvees[i] === 0) {
      enchaine = false
      continue
    }
    if (enchaine) ctx.lineTo(xDe(i), yDe(i))
    else ctx.moveTo(xDe(i), yDe(i))
    enchaine = true
  }
  ctx.stroke()
}
