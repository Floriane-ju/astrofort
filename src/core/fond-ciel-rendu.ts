/**
 * §3.3 — brillance du fond de ciel telle qu'elle se peint (T-0096, T-0097, T-0098, T-0100).
 *
 * §3.3 ne dit du fond de ciel qu'une chose : il « plafonne mag_limite en vue réaliste ». La
 * COULEUR du fond n'y est pas spécifiée. Ce module est donc une extension de rendu assumée,
 * déclarée comme telle au registre — pas une lecture du PRD.
 *
 * UNE SEULE RÈGLE DE COMPOSITION : les brillances s'additionnent en nanolamberts, jamais en
 * magnitudes. C'est déjà celle de ΔSB_lune (§8.1), et le module la réemploie au lieu de la
 * réécrire : `brillanceLuneNl` et `extinctionV` viennent de `moon.ts`.
 *
 *   B_total(direction) = B_site × facteurHaloHorizon(h) + B_lune(ρ, h_lune, α)
 *   Y_ecran            = K_exposition × B_total
 *
 * L'exposition est la SEULE constante libre du modèle : le rapport de luminance entre deux
 * fonds de ciel est celui de leurs brillances, il n'est pas choisi.
 *
 * ponytail: aucune valeur tracée ici. Ces fonctions sont appelées par IMAGE — une fois pour le
 * fond, une par palier de halo, une par cran du dégradé lunaire. Un `Traced` par appel
 * allouerait et gèlerait des dizaines d'objets à 30 im/s pour une valeur que rien n'affiche
 * encore. Le jour où la scène déplie son fond de ciel comme elle déplie
 * `magnitude_limite_rendue`, c'est un enrobage `trace()` à poser ici, pas un calcul à refaire.
 */

import { K } from '../registry/constants.ts'
import {
  brillanceLuneNl,
  extinctionV,
  masseAirKS,
  nanolamberts,
  type GeometrieLune,
} from './moon.ts'

const DEG = Math.PI / 180
const ANGLE_DROIT_DEG = 90

/**
 * van Rhijn (1921) — épaisseur relative de la couche émissive vue à la hauteur `h`, rapportée
 * au zénith. Vaut exactement 1 au zénith et croît jusqu'à l'horizon.
 */
export function vanRhijn(hauteurDeg: number): number {
  const rapport = K('RAYON_TERRE_KM') / (K('RAYON_TERRE_KM') + K('HAUTEUR_COUCHE_EMISSIVE_KM'))
  const cos = Math.cos(hauteurDeg * DEG)
  return 1 / Math.sqrt(1 - rapport * rapport * cos * cos)
}

/**
 * Facteur multiplicatif de la brillance du site à la hauteur `h`, zénith = 1.
 *
 * Le trajet plus long à travers la couche émissive est lui-même plus atténué : sans le terme
 * d'extinction, van Rhijn seul donnerait ×6 à l'horizon, valeur que personne n'observe.
 *
 * ponytail: le halo reste symétrique en azimut. Le dôme lumineux d'une ville est plus clair de
 * son côté, mais l'atlas qui le donnerait (VIIRS) exige le réseau et §4.1 l'écarte. Limite
 * déclarée, pas oubliée.
 */
export function facteurHaloHorizon(hauteurDeg: number): number {
  const masseAir = masseAirKS(hauteurDeg)
  return (
    (vanRhijn(hauteurDeg) * extinctionV(masseAir)) / extinctionV(masseAirKS(ANGLE_DROIT_DEG))
  )
}

/**
 * Bornes hautes des paliers du halo, du plus bas au plus haut ; la dernière est le zénith.
 *
 * Les régions « hauteur inférieure à cette borne » s'emboîtent : peintes de la plus grande à
 * la plus petite, chaque bande garde la teinte du palier qui la referme.
 */
export function bornesPaliersHalo(): readonly number[] {
  const paliers = K('PALIERS_HALO_HORIZON')
  const bornes: number[] = []
  for (let i = 1; i <= paliers; i++) bornes.push((ANGLE_DROIT_DEG * i) / paliers)
  return bornes
}

/** Hauteur représentative du palier d'index `i` : le milieu de la bande qu'il referme. */
export function hauteurRepresentative(indexPalier: number): number {
  const paliers = K('PALIERS_HALO_HORIZON')
  return (ANGLE_DROIT_DEG * (2 * indexPalier + 1)) / (2 * paliers)
}

/** Luminance d'écran, en lumière linéaire, correspondant à cette brillance de surface. */
export function luminanceEcran(sbMagArcsec2: number): number {
  return K('K_EXPOSITION_FOND_CIEL') * nanolamberts(sbMagArcsec2)
}

/** Composantes linéaires du fond : chromaticité fixe, échelonnée par la luminance. */
export function composantesFond(sbMagArcsec2: number): readonly [number, number, number] {
  const y = luminanceEcran(sbMagArcsec2)
  return [
    y * K('CHROMA_FOND_CIEL_R'),
    y * K('CHROMA_FOND_CIEL_V'),
    y * K('CHROMA_FOND_CIEL_B'),
  ]
}

/** Inverse de `nanolamberts` : d'une brillance en nanolamberts vers sa magnitude surfacique. */
export function sbDepuisNanolamberts(brillanceNl: number): number {
  return (
    (K('NANOLAMBERT_OFFSET') - Math.log(brillanceNl / K('NANOLAMBERT_ECHELLE'))) /
    K('NANOLAMBERT_PENTE')
  )
}

export interface EntreeFondRendu {
  /** Fond de ciel du site au zénith, Lune exclue (§2.2). */
  readonly sbSiteMag: number
  /** Hauteur de la direction rendue : elle décide du halo d'horizon. */
  readonly hauteurDeg: number
  /** Géométrie lunaire de cette direction. Absente : la Lune n'entre pas dans le calcul. */
  readonly lune?: GeometrieLune | undefined
}

/** Brillance totale du ciel dans cette direction, en nanolamberts. */
export function brillanceFondNl(entree: EntreeFondRendu): number {
  const bSite = nanolamberts(entree.sbSiteMag) * facteurHaloHorizon(entree.hauteurDeg)
  return bSite + (entree.lune === undefined ? 0 : brillanceLuneNl(entree.lune))
}

/**
 * Fond de ciel effectif dans cette direction, en mag/arcsec².
 *
 * Un seul moteur, deux écrans (T-0089) : le plan de séance additionne les mêmes brillances
 * avec les mêmes fonctions, donc annonce le même fond de ciel à la même minute.
 */
export function sbEffectifRendu(entree: EntreeFondRendu): number {
  return sbDepuisNanolamberts(brillanceFondNl(entree))
}
