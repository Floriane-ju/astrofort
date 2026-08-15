/**
 * §3.5 — Superposition du cadre matériel.
 *
 * Le cadre est un OBJET DE LA SCÈNE, projeté par le moteur de §3.3 : à grand champ, ses
 * bords ne sont pas des droites. Un rectangle dessiné à côtés droits mentirait sur ce que
 * l'objectif capture réellement — un objectif de 10 mm couvre 130° de diagonale, et cette
 * courbure est le fait dominant du cadrage grand champ.
 *
 * Ses dimensions viennent de §5.1, donc de l'arctangente, jamais de l'approximation
 * linéaire. C'est la couture entre le planétarium et tous les moteurs.
 */

import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { matriceVue } from './projection.ts'
import {
  DEG,
  applique,
  transpose,
  versVecteur,
  type Mat3,
  type Vec3,
} from './mat3.ts'

export interface ProfilCadre {
  readonly libelle: string
  /** Champ de la grande dimension du capteur (§5.1). */
  readonly fovLDeg: number
  readonly fovHDeg: number
  readonly echApx: number
  /** Pose affichée sur le cadre : optimale avec suivi, NPF sans (§7.2, §9.1). */
  readonly tPoseS: number | null
}

export interface Cadre {
  readonly profil: ProfilCadre
  readonly azimutDeg: number
  readonly hauteurDeg: number
  readonly rotationDeg: number
}

/**
 * Contour du cadre en directions J2000, prêt pour le projecteur. Chaque bord est une
 * polyligne : c'est ce qui rend la courbure visible en projection stéréographique.
 */
export function contourCadreJ2000(cadre: Cadre, matriceCiel: Mat3): readonly Vec3[] {
  const uMax = Math.tan((cadre.profil.fovLDeg / 2) * DEG)
  const vMax = Math.tan((cadre.profil.fovHDeg / 2) * DEG)
  const pas = Math.max(1, Math.round(K('SUBDIVISION_CADRE')))

  // Repère local du cadre, roulis compris ; puis retour au repère équatorial J2000.
  const versHorizon = transpose(
    matriceVue(cadre.azimutDeg, cadre.hauteurDeg, cadre.rotationDeg),
  )
  const versJ2000 = transpose(matriceCiel)

  const coins: readonly (readonly [number, number])[] = [
    [-uMax, -vMax],
    [uMax, -vMax],
    [uMax, vMax],
    [-uMax, vMax],
  ]

  const points: Vec3[] = []
  for (let c = 0; c < coins.length; c++) {
    const [u0, v0] = coins[c]!
    const [u1, v1] = coins[(c + 1) % coins.length]!
    for (let i = 0; i < pas; i++) {
      const f = i / pas
      const u = u0 + (u1 - u0) * f
      const v = v0 + (v1 - v0) * f
      // Inverse gnomonique : le cadre est la projection physique d'un objectif rectilinéaire.
      const norme = Math.hypot(u, v, 1)
      const local: Vec3 = { x: u / norme, y: v / norme, z: 1 / norme }
      points.push(applique(versJ2000, applique(versHorizon, local)))
    }
  }
  return points
}

/** §3.5 — le refus de fabriquer un cadre en l'absence de profil déclaré. */
export const REFUS_SANS_PROFIL =
  'Aucun profil matériel n’est renseigné : l’application ne superpose pas de cadre par ' +
  'défaut. Un rectangle arbitraire donnerait un cadrage faux, et le cadrage est justement ' +
  'ce que cette couche sert à décider. Renseigner focale, ouverture et capteur (§5.1).'

export function refusAuDelaDuMaximum(nombreProfils: number): string | null {
  if (nombreProfils <= K('PROFILS_CADRE_MAX')) return null
  return (
    `Au plus ${K('PROFILS_CADRE_MAX')} profils sont comparables simultanément : au-delà, la ` +
    'superposition cesse d’être lisible et le cadre perd sa fonction.'
  )
}

// ---------------------------------------------------------------------------
// Cible dominante et rotation suggérée
// ---------------------------------------------------------------------------

export interface CibleDansCadre {
  readonly objet: ObjetCielProfond
  /** Taille angulaire du grand axe, en degrés. */
  readonly tailleDeg: number
}

const ARCMIN_PAR_DEG = 60

/**
 * Objet dominant du cadre : le plus étendu parmi ceux qui y tombent. C'est lui qui porte
 * le taux de remplissage et la rotation suggérée (§6.2).
 */
export function cibleDominante(
  objets: readonly ObjetCielProfond[],
  cadre: Cadre,
  matriceCiel: Mat3,
): CibleDansCadre | null {
  const versCadre = matriceVue(cadre.azimutDeg, cadre.hauteurDeg, cadre.rotationDeg)
  const uMax = Math.tan((cadre.profil.fovLDeg / 2) * DEG)
  const vMax = Math.tan((cadre.profil.fovHDeg / 2) * DEG)

  let meilleure: CibleDansCadre | null = null
  for (const objet of objets) {
    if (objet.majAxArcmin === null) continue
    const local = applique(versCadre, applique(matriceCiel, versVecteur(objet.adDeg, objet.decDeg)))
    if (local.z <= 0) continue
    if (Math.abs(local.x / local.z) > uMax || Math.abs(local.y / local.z) > vMax) continue
    const tailleDeg = objet.majAxArcmin / ARCMIN_PAR_DEG
    if (meilleure === null || tailleDeg > meilleure.tailleDeg) {
      meilleure = { objet, tailleDeg }
    }
  }
  return meilleure
}

export interface RotationSuggeree {
  readonly angleDeg: number
  readonly message: string
}

/**
 * §3.5 et §6.2 — angle alignant le grand axe de la cible sur la grande dimension du capteur.
 * L'angle de position du catalogue est équatorial ; le cadre, lui, vit dans le repère de
 * l'observateur : la conversion passe par les vecteurs tangents, jamais par une soustraction
 * d'angles qui ignorerait la rotation de champ.
 */
export function rotationSuggeree(
  cible: CibleDansCadre,
  cadre: Cadre,
  matriceCiel: Mat3,
): RotationSuggeree | null {
  const posAng = cible.objet.posAngDeg
  if (posAng === null) return null

  const ad = cible.objet.adDeg * DEG
  const dec = cible.objet.decDeg * DEG
  // Vecteurs tangents nord et est à la position de l'objet, en J2000.
  const nord: Vec3 = {
    x: -Math.sin(dec) * Math.cos(ad),
    y: -Math.sin(dec) * Math.sin(ad),
    z: Math.cos(dec),
  }
  const est: Vec3 = { x: -Math.sin(ad), y: Math.cos(ad), z: 0 }
  const pa = posAng * DEG
  const axe: Vec3 = {
    x: Math.cos(pa) * nord.x + Math.sin(pa) * est.x,
    y: Math.cos(pa) * nord.y + Math.sin(pa) * est.y,
    z: Math.cos(pa) * nord.z + Math.sin(pa) * est.z,
  }

  // Sans roulis : on cherche l'angle du grand axe dans le plan tangent du cadre.
  const versCadre = matriceVue(cadre.azimutDeg, cadre.hauteurDeg, 0)
  const local = applique(versCadre, applique(matriceCiel, axe))
  const DEG_PAR_RADIAN = 180 / Math.PI
  const angleAxe = Math.atan2(local.y, local.x) * DEG_PAR_RADIAN

  const paysage = cadre.profil.fovLDeg >= cadre.profil.fovHDeg
  const brut = paysage ? angleAxe : angleAxe - 90
  const angleDeg = ((brut % 180) + 180) % 180

  return {
    angleDeg,
    message:
      `Rotation de ${angleDeg.toFixed(0)}° : le grand axe de ` +
      `${cible.objet.designation} s’aligne sur la grande dimension du capteur, tenue ` +
      `${paysage ? 'à l’horizontale' : 'à la verticale'} par ce profil. L’angle tient compte ` +
      'de la rotation de champ à cet instant : il ne vaut pas pour toute la nuit.',
  }
}
