/**
 * §9.2 et §9.3 incrustés dans le cadre matériel de §3.5, sur la scène.
 *
 * Le résultat se voit sur le planétarium, pas dans un second canevas ailleurs : le filé se
 * dessine À L'INTÉRIEUR du cadre, avec LE PROJECTEUR DE LA SCÈNE. Les arcs tombent donc
 * exactement sur les étoiles du ciel qui les entoure, et allonger la pose ovalise les étoiles
 * là où l'utilisateur regarde déjà.
 *
 * C'est peu de code parce que rien n'est réécrit : `dessineChamp` prend son étendue de
 * `projecteur.vue`, jamais de `ctx.canvas`, et le contour du cadre vient du `cheminCadre`
 * exporté par la passe du ciel. Aucun second code de projection n'existe (§3.3).
 *
 * Le rendu est statique — une image par changement de réglage, jamais soixante par seconde.
 * L'appelant garde l'image et la redépose à chaque image de la boucle ; il ne la recalcule
 * qu'au changement de pointage, de champ, de mode, d'instant, de matériel ou de réglage.
 */

import type { Mat3, Vec3 } from '../core/mat3.ts'
import { etendueCadre, type Cadre } from '../core/cadre.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import type { EntreeProfondeur } from '../core/galactique.ts'
import { projecteur, type ModeProjection, type Vue } from '../core/projection.ts'
import { dessineChamp, type SortieDessinChamp } from './dessine-champ.ts'
import { cheminCadre } from './dessine-ciel.ts'
import { palette } from './couleurs.ts'

/**
 * §9.2 — le vignettage se centre sur le canevas, jamais sur le cadre : incrusté, il
 * assombrirait les coins de la SCÈNE et non ceux de l'image. Il est donc éteint ici, et son
 * chiffre en diaphragmes reste lisible au panneau.
 */
export const MENTION_VIGNETTAGE_INCRUSTATION =
  'Vignettage non incrusté : il se centre sur le canevas de la scène, pas sur le cadre. ' +
  'Son atténuation en diaphragmes reste chiffrée ci-dessus.'

/** §5.1 — la projection de la scène n'est pas toujours celle que l'objectif produirait. */
export function mentionProjection(
  modeScene: ModeProjection,
  modeObjectif: ModeProjection,
): string | null {
  if (modeScene === modeObjectif) return null
  return (
    'La scène est en projection de planétarium ; l’objectif déclaré, lui, produirait une ' +
    `projection ${modeObjectif === 'MODE_FISHEYE' ? 'équidistante' : 'gnomonique'}. ` +
    'Le contenu du cadre est donc à la bonne place dans le ciel, mais déformé autrement que ' +
    'sur le capteur. « Voir comme l’objectif » recadre la scène sur le champ du cadre.'
  )
}

export interface EntreeIncrustation {
  /** Le `Vue` DE LA SCÈNE : c'est ce partage qui fait tomber les arcs sur les bonnes étoiles. */
  readonly vue: Vue
  readonly matriceCiel: Mat3
  /** Le cadre où l'image sera clippée : il borne la SÉLECTION, jamais le canevas (T-0023). */
  readonly cadre: Cadre
  readonly indexReel: IndexCiel
  readonly indexSemis: IndexCiel
  readonly magLimite: number
  readonly profondeur: EntreeProfondeur
  readonly echApx: number
  readonly suiviActif: boolean
  readonly sbCiel: number
  /** Pose unitaire en aperçu de champ, durée totale accumulée en filé. */
  readonly dureeS: number
  readonly latitudeDeg: number
  readonly axePoleNord: Vec3
  readonly voieLactee: boolean
  readonly modeNuit: boolean
}

export interface Incrustation {
  readonly image: CanvasImageSource
  readonly sortie: SortieDessinChamp
}

/** Canevas hors écran à la définition de la scène. `null` hors navigateur : rien à peindre. */
function canevasHorsEcran(largeur: number, hauteur: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(largeur, hauteur)
  if (typeof document === 'undefined') return null
  const canevas = document.createElement('canvas')
  canevas.width = largeur
  canevas.height = hauteur
  return canevas
}

export function rendIncrustation(entree: EntreeIncrustation): Incrustation | null {
  const canevas = canevasHorsEcran(entree.vue.largeurPx, entree.vue.hauteurPx)
  const ctx = canevas?.getContext('2d') ?? null
  if (canevas === null || ctx === null) return null

  const sortie = dessineChamp({
    ctx: ctx as CanvasRenderingContext2D,
    projecteur: projecteur(entree.vue, entree.matriceCiel),
    indexReel: entree.indexReel,
    indexSemis: entree.indexSemis,
    magLimite: entree.magLimite,
    profondeur: entree.profondeur,
    echApx: entree.echApx,
    suiviActif: entree.suiviActif,
    sbCiel: entree.sbCiel,
    dureeS: entree.dureeS,
    latitudeDeg: entree.latitudeDeg,
    axePoleNord: entree.axePoleNord,
    voieLactee: entree.voieLactee,
    vignettage: false,
    modeNuit: entree.modeNuit,
    // Le canevas garde la définition et le repère de la scène — c'est ce partage qui fait
    // tomber les arcs sur les bonnes étoiles. Seule la sélection se resserre sur le cadre.
    cadreSelection: etendueCadre(entree.cadre, entree.matriceCiel),
  })
  return { image: canevas as CanvasImageSource, sortie }
}

/**
 * Dépose l'image hors écran dans le cadre, puis retrace le liseré par-dessus : sans lui, le
 * bord de l'incrustation se confondrait avec un bord d'image et le cadre disparaîtrait.
 */
export function incrusteDansLeCadre(
  ctx: CanvasRenderingContext2D,
  vue: Vue,
  matriceCiel: Mat3,
  cadre: Cadre,
  image: CanvasImageSource,
  modeNuit: boolean,
): void {
  const proj = projecteur(vue, matriceCiel)
  ctx.save()
  cheminCadre(ctx, proj, cadre, matriceCiel)
  ctx.clip()
  ctx.drawImage(image, 0, 0)
  ctx.restore()

  ctx.strokeStyle = palette(modeNuit).cadre
  ctx.lineWidth = 2
  cheminCadre(ctx, proj, cadre, matriceCiel)
  ctx.stroke()
  ctx.lineWidth = 1
}
