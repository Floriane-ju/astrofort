/**
 * §9.2 — Ce qui distingue une prévisualisation d'une carte.
 *
 * Trois choses sont calculées ici, et aucune n'est décorative :
 *
 *   1. LA LATITUDE GALACTIQUE, parce que la densité d'étoiles du fond génératif en dépend.
 *      Sans cette modulation, la bande de la Voie lactée n'apparaît pas et la prévisualisation
 *      devient inutile pour le cas d'usage principal du grand champ.
 *   2. LE CONTRASTE DE LA VOIE LACTÉE, modulé par le fond de ciel du site : l'application
 *      montre ce que L'UTILISATEUR verra, pas une carte de référence idéale.
 *   3. LA PROFONDEUR RÉELLEMENT ATTEINTE par la capture, qui pilote le nombre d'étoiles
 *      affichées. Le PRD la marque `[À CALCULER]` : elle est dérivée ici du point zéro
 *      système, seule voie qui la fasse dépendre de la pose, de l'ouverture et du ciel.
 */

import { K } from '../registry/constants.ts'
import {
  DEG,
  applique,
  multiplie,
  rotationY,
  rotationZ,
  transpose,
  versVecteur,
  type Mat3,
  type Vec3,
} from './mat3.ts'
import { trace, type Traced } from './traced.ts'

const DEMI_TOUR = 180
const QUART_TOUR = 90
const UM_PAR_MM = 1000

/**
 * Rotation J2000 → galactique. Trois rotations, dans cet ordre : amener le pôle galactique
 * sur le méridien origine, le basculer sur l'axe z, puis caler la longitude sur le centre
 * galactique — ce dernier calage se lit sur la longitude galactique du pôle céleste.
 */
export const MATRICE_GALACTIQUE: Mat3 = multiplie(
  rotationZ(K('LONGITUDE_GALACTIQUE_POLE_CELESTE_DEG') - DEMI_TOUR),
  multiplie(
    rotationY(QUART_TOUR - K('POLE_GALACTIQUE_DEC_DEG')),
    rotationZ(-K('POLE_GALACTIQUE_AD_DEG')),
  ),
)

const MATRICE_DEPUIS_GALACTIQUE = transpose(MATRICE_GALACTIQUE)

/** Latitude galactique d'une direction J2000, en degrés. */
export function latitudeGalactiqueDeg(v: Vec3): number {
  const g = applique(MATRICE_GALACTIQUE, v)
  return Math.asin(Math.max(-1, Math.min(1, g.z))) / DEG
}

/** Direction J2000 d'une position galactique — support du tracé de la bande. */
export function depuisGalactique(lDeg: number, bDeg: number): Vec3 {
  return applique(MATRICE_DEPUIS_GALACTIQUE, versVecteur(lDeg, bDeg))
}

/** §9.2 — densité relative du semis génératif : 1 dans le plan galactique, décroissante hors. */
export function densiteRelative(bDeg: number): Traced<number> {
  return trace({
    value: Math.exp(-Math.abs(bDeg) / K('ECHELLE_LATITUDE_GALACTIQUE_DEG')),
    formula: 'DENSITE_GALACTIQUE',
    inputs: { b_deg: bDeg },
    constants: ['ECHELLE_LATITUDE_GALACTIQUE_DEG'],
  })
}

/** §9.2 — assombrissement des coins, en diaphragmes, pour un rayon relatif au coin du cadre. */
export function vignettageDiaph(rayonRelatif: number): Traced<number> {
  const borne = Math.max(0, Math.min(1, rayonRelatif))
  return trace({
    value: K('VIGNETTAGE_COINS_DIAPH') * borne * borne,
    formula: 'VIGNETTAGE',
    inputs: { rayon_relatif: borne },
    constants: ['VIGNETTAGE_COINS_DIAPH'],
  })
}

/**
 * §9.2 — opacité de rendu d'une étoile.
 *
 * Le rapport signal sur bruit de l'étoile se déduit de sa magnitude et de la profondeur
 * atteinte : au seuil, il vaut celui de la détection ; deux magnitudes plus brillante, dix
 * fois plus. L'affichage l'étire ensuite en racine carrée, comme toute image astronomique —
 * une échelle linéaire écraserait tout le ciel dans le premier pour cent de la dynamique.
 *
 * C'est ce qui fait qu'un filé de deux heures ne montre que les étoiles brillantes, alors
 * que la même durée en poses fixes empilées en montrerait des milliers.
 */
export function opaciteEtoile(magV: number, magLimite: number): number {
  const snr = K('SNR_DETECTION_PREVISU') * K('BASE_MAGNITUDE') ** (-(magV - magLimite) / K('POGSON'))
  return Math.min(1, Math.sqrt(snr / K('SNR_RENDU_SATURATION')))
}

export interface EntreeProfondeur {
  readonly tPoseS: number
  /** Diamètre de pupille, en millimètres : c'est lui qui fixe le flux d'une source ponctuelle. */
  readonly dMm: number
  readonly zpSys: number
  /** Flux du fond de ciel, e⁻/s/px (§7.1). */
  readonly eCielPxS: number
  readonly readNoiseE: number
  readonly zpEstime?: boolean
}

/**
 * Profondeur atteinte par une pose unitaire, en magnitude.
 *
 * Une source ponctuelle de magnitude m produit le même flux qu'une arcseconde carrée de
 * brillance m : le point zéro système suffit donc à la chiffrer, et la dépendance au seul
 * diamètre de pupille tombe de l'algèbre, elle n'est pas posée.
 */
export function magnitudeLimitePrevisu(entree: EntreeProfondeur): Traced<number> {
  const snr = K('SNR_DETECTION_PREVISU')
  const nPx = K('PIXELS_PSF_ETOILE')
  const bruit = nPx * (entree.eCielPxS * entree.tPoseS + entree.readNoiseE ** 2)
  // Solution positive de x² − S² x − S² × bruit = 0, avec x le nombre d'électrons collectés.
  const demi = snr ** 2 / 2
  const electrons = demi + Math.sqrt(demi ** 2 + snr ** 2 * bruit)
  const fluxSeuil = electrons / entree.tPoseS
  const conversion = K('RADIAN_EN_ARCSEC') / (UM_PAR_MM * entree.dMm)
  return trace({
    value: entree.zpSys - K('POGSON') * Math.log10(fluxSeuil * conversion ** 2),
    formula: 'MAGNITUDE_LIMITE_PREVISU',
    inputs: {
      t_pose_s: entree.tPoseS,
      d_mm: entree.dMm,
      zp_sys: entree.zpSys,
      e_ciel_px_s: entree.eCielPxS,
      read_noise_e: entree.readNoiseE,
    },
    constants: ['SNR_DETECTION_PREVISU', 'PIXELS_PSF_ETOILE', 'POGSON', 'RADIAN_EN_ARCSEC'],
    flags: entree.zpEstime === true ? ['ESTIME'] : [],
    note:
      'Profondeur de la pose unitaire, pas de l’empilement : elle dit combien d’étoiles la ' +
      'prévisualisation affiche, et le PRD la marque encore [À CALCULER].',
  })
}
