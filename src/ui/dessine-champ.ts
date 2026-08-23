/**
 * §9.2 et §9.3 — passe de rendu de la prévisualisation de champ et du filé.
 *
 * DEUX COUCHES, un seul moteur de projection : celui de §3.3. La couche 1 vient du catalogue
 * réel, la couche 2 du semis génératif au-delà du seuil catalographié.
 *
 * Une seule primitive dessine les étoiles, ponctuelles ou filées : l'arc de §9.3, balayé
 * pendant la durée d'accumulation demandée. Une pose unitaire trop longue produit donc
 * naturellement une étoile ovalisée — c'est le même code que le filé de quatre heures, à la
 * durée près.
 *
 * T-0116 — la passe ne peint plus ni fond ni bande galactique, et ne se resserre plus sur le
 * cadre : elle se dessine À MÊME le canevas de la scène, sur toute sa surface, entre le sol et
 * les repères. Le planétarium a déjà peint le vrai fond de ciel du site (§3.7, halo d'horizon,
 * halo lunaire, crépuscule) et sa propre Voie lactée (§3.6) ; les repeindre ici les
 * effacerait, ou en superposerait une seconde version de teinte différente. Ce qui reste
 * propre à cette passe est donc uniquement ce que la pose ajoute : les traces, et le centre
 * de rotation qu'elles décrivent.
 */

import { K } from '../registry/constants.ts'
import { arcEtoile, poseParPixelS, positionPole, type PositionPole } from '../core/file-etoiles.ts'
import {
  magnitudeLimitePrevisu,
  opaciteEtoile,
  type EntreeProfondeur,
} from '../core/galactique.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import { selectionne } from '../core/index-ciel.ts'
import { rayonEtoilePx, type Projecteur } from '../core/projection.ts'
import type { Vec3 } from '../core/mat3.ts'
import { couleurTeinte, paletteScene, teinte } from './couleurs.ts'

const S_PAR_MIN = 60
/** Sous ce rayon, l'antialiasing efface le disque : la plus faible étoile reste un point. */
const RAYON_MIN_ETOILE_PX = 0.7
const TOUR_RAD = 2 * Math.PI
const MARQUEUR_POLE_PX = 14
/**
 * Sous cette opacité, l'étoile est trop loin sous le seuil d'enregistrement pour laisser une
 * trace : elle n'est pas tracée du tout. Sans ce plancher, des milliers de traces
 * sous-liminaires s'additionnent et blanchissent une image qui, en vrai, resterait noire.
 */
const OPACITE_MIN = 0.2
const DEMI_TOUR = 180

/**
 * Ce que la passe tient du matériel et des réglages de §9 — tout ce qui NE dépend PAS de
 * l'image en cours. C'est cette part que React calcule et publie ; la vue, le projecteur et
 * l'axe du pôle, eux, appartiennent à l'image que la boucle est en train de peindre (T-0116).
 */
export interface ParametresFile {
  /** Catalogue réel : couche 1, positions exactes jusqu'au seuil catalographié. */
  readonly indexReel: IndexCiel
  /** Semis génératif : couche 2, au-delà du seuil. */
  readonly indexSemis: IndexCiel
  /** Profondeur atteinte par la pose unitaire (§9.2) : borne de sélection du catalogue. */
  readonly magLimite: number
  /** Entrées de profondeur, réévaluées par étoile avec sa pose par pixel réelle (§9.3). */
  readonly profondeur: EntreeProfondeur
  /** Échantillonnage du capteur, en secondes d'arc par pixel : il fixe la pose par pixel. */
  readonly echApx: number
  /** Suivi actif (§5.2) : les étoiles restent ponctuelles et le pixel reçoit toute la pose. */
  readonly suiviActif: boolean
  /** Durée d'accumulation dessinée : pose unitaire en prévisualisation, durée totale en filé. */
  readonly dureeS: number
}

export interface EntreeDessinChamp extends ParametresFile {
  readonly ctx: CanvasRenderingContext2D
  readonly projecteur: Projecteur
  /** Direction J2000 du pôle céleste nord de l'époque : centre exact des arcs (§9.3). */
  readonly axePoleNord: Vec3
  readonly latitudeDeg: number
  /**
   * Fond de ciel de la scène. Il ne sert plus qu'à la palette du marqueur de pôle : le fond
   * lui-même appartient au planétarium depuis T-0116.
   */
  readonly sbCiel: number
  readonly vueRealiste: boolean
  readonly modeNuit: boolean
}

export interface SortieDessinChamp {
  readonly etoilesReelles: number
  readonly etoilesGenerees: number
  readonly arcsTronques: number
  /**
   * Étoiles lues par la sélection, tracées ou non. C'est ce compteur, et pas le nombre
   * d'étoiles dessinées, qui dit ce que la passe a coûté : sans lui, un gain de sélection se
   * raconte au lieu de se chiffrer (T-0021).
   */
  readonly etoilesVisitees: number
  readonly pole: PositionPole
}

interface Compteur {
  dessinees: number
  tronques: number
  /** Étoiles lues par `selectionne`, avant tout tri : le coût de la passe se lit ici. */
  visitees: number
}

/** Une étoile : un arc balayé pendant la durée d'accumulation, ponctuel quand elle est brève. */
function dessineCouche(
  entree: EntreeDessinChamp,
  index: IndexCiel,
  magMin: number,
  magMax: number,
  compteur: Compteur,
): void {
  const { ctx, projecteur } = entree
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const centreJ2000 = projecteur.inverse(largeur / 2, hauteur / 2)
  // T-0116 — la sélection couvre tout le champ de la scène : les traces s'y voient partout,
  // le cadre ne les borne plus, il dit seulement lesquelles le capteur enregistrerait.
  const rayonChampDeg = Math.min(
    K('FOV_MAX_DEG') / 2,
    (projecteur.vue.fovDeg / 2) * Math.hypot(1, hauteur / largeur),
  )
  // Avec suivi, l'étoile ne se déplace pas sur le capteur : ni trace, ni étalement du flux.
  const dureeMin = entree.suiviActif ? 0 : entree.dureeS / S_PAR_MIN

  const stats = selectionne(index, centreJ2000, rayonChampDeg, magMax, (x, y, z, magV, bv) => {
    if (magV < magMin) return
    const rayon = Math.max(RAYON_MIN_ETOILE_PX, rayonEtoilePx(magV))

    // La brillance d'une trace se juge sur la pose vue PAR PIXEL, pas sur la durée totale :
    // c'est pour cela qu'un filé de deux heures ne montre que les étoiles brillantes, là où
    // la même durée en poses fixes empilées en montrerait des milliers.
    //
    // Ce tri passe AVANT l'arc (T-0022) : il ne dépend que de la déclinaison, lue dans `z`,
    // et l'arc est le calcul le plus cher de la passe. Une étoile écartée ici ne doit pas
    // l'avoir payé.
    const profondeurTrace = magnitudeLimitePrevisu({
      ...entree.profondeur,
      tPoseS: entree.suiviActif
        ? entree.dureeS
        : poseParPixelS(
            entree.dureeS,
            entree.echApx,
            (Math.asin(Math.max(-1, Math.min(1, z))) * DEMI_TOUR) / Math.PI,
          ),
    }).value
    const opacite = opaciteEtoile(magV, profondeurTrace)
    if (opacite < OPACITE_MIN) return

    const arc = arcEtoile(projecteur, { x, y, z }, dureeMin, entree.axePoleNord)
    if (arc.segments.length === 0) return
    const couleur = couleurTeinte(teinte(bv), entree.modeNuit)
    ctx.globalAlpha = opacite

    if (arc.longueurPx <= rayon) {
      // Trace plus courte que l'étoile elle-même : elle reste un disque.
      const point = arc.segments[0]![0]!
      ctx.fillStyle = couleur
      ctx.beginPath()
      ctx.arc(point.xPx, point.yPx, rayon, 0, TOUR_RAD)
      ctx.fill()
    } else {
      ctx.strokeStyle = couleur
      ctx.lineWidth = rayon * 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (arc.cercle !== null) {
        // T-0115 — en stéréographique l'arc EST un cercle : la primitive du canevas le trace
        // exactement, là où la polyligne l'approchait en centaines de cordes.
        const c = arc.cercle
        ctx.arc(
          c.xPx,
          c.yPx,
          c.rayonPx,
          c.debutRad,
          c.debutRad + c.balayageRad,
          c.balayageRad < 0,
        )
      } else {
        for (const segment of arc.segments) {
          segment.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.xPx, p.yPx)
            else ctx.lineTo(p.xPx, p.yPx)
          })
        }
      }
      ctx.stroke()
    }
    compteur.dessinees++
    if (arc.tronque) compteur.tronques++
  })
  compteur.visitees += stats.etoilesExaminees
  ctx.globalAlpha = 1
  // Rendus à leurs valeurs par défaut, comme la passe du ciel le fait de la bande : le
  // marqueur du pôle est tracé après, et un bout de trait laissé arrondi lui arrondissait
  // aussi les branches.
  ctx.lineWidth = 1
  ctx.lineCap = 'butt'
}

export function dessineChamp(entree: EntreeDessinChamp): SortieDessinChamp {
  const { ctx, projecteur } = entree
  const teintes = paletteScene(entree.modeNuit, entree.vueRealiste, entree.sbCiel)

  const seuilReel = K('SEUIL_MAG_ETOILES_REELLES')
  const reelles: Compteur = { dessinees: 0, tronques: 0, visitees: 0 }
  const generees: Compteur = { dessinees: 0, tronques: 0, visitees: 0 }
  dessineCouche(entree, entree.indexReel, -Infinity, Math.min(entree.magLimite, seuilReel), reelles)
  if (entree.magLimite > seuilReel) {
    dessineCouche(entree, entree.indexSemis, seuilReel, entree.magLimite, generees)
  }

  // Centre de rotation : marqué s'il tombe dans le champ, jamais ramené dedans s'il n'y est pas.
  const pole = positionPole(projecteur, entree.latitudeDeg, entree.axePoleNord)
  if (pole.dansCadre && pole.xPx !== null && pole.yPx !== null) {
    ctx.strokeStyle = teintes.cadre
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pole.xPx - MARQUEUR_POLE_PX, pole.yPx)
    ctx.lineTo(pole.xPx + MARQUEUR_POLE_PX, pole.yPx)
    ctx.moveTo(pole.xPx, pole.yPx - MARQUEUR_POLE_PX)
    ctx.lineTo(pole.xPx, pole.yPx + MARQUEUR_POLE_PX)
    ctx.stroke()
  }

  return {
    etoilesReelles: reelles.dessinees,
    etoilesGenerees: generees.dessinees,
    arcsTronques: reelles.tronques + generees.tronques,
    etoilesVisitees: reelles.visitees + generees.visitees,
    pole,
  }
}
