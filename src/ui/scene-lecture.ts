/**
 * §3.4 — la phrase qui date l'image : où pointe la scène, sur quel champ, à quel instant.
 *
 * T-0068 — le canevas doit dire à une technologie d'assistance ce qu'il montre en ce moment,
 * et le menu d'information affiche déjà exactement cela. Composée deux fois, la phrase
 * dériverait — un `toFixed` retouché d'un côté, et le nom accessible ne décrit plus la même
 * vue que la lecture affichée. Elle se compose donc ici, une fois, pour les deux.
 */

import type { Mat3 } from '../core/mat3.ts'
import { versSpherique } from '../core/mat3.ts'
import { projecteur } from '../core/projection.ts'
import { vuePlanetarium, type VueScene } from './scene-etat.ts'

/** §3.3 — la direction visée, ramenée en J2000 : le centre du canevas, projeté à l'envers. */
export function viseeJ2000(
  vue: VueScene,
  matriceCiel: Mat3,
): { readonly longitudeDeg: number; readonly latitudeDeg: number } {
  return versSpherique(
    projecteur(vuePlanetarium(vue), matriceCiel).inverse(vue.largeurPx / 2, vue.hauteurPx / 2),
  )
}

export function ligneVisee(vue: VueScene, matriceCiel: Mat3, date: Date): string {
  const visee = viseeJ2000(vue, matriceCiel)
  return (
    `${date.toLocaleString('fr-FR')} · visée ${visee.longitudeDeg.toFixed(2)}° AD / ` +
    `${visee.latitudeDeg.toFixed(2)}° δ · azimut ${vue.azimutDeg.toFixed(0)}°, hauteur ` +
    `${vue.hauteurDeg.toFixed(0)}° · champ ${vue.fovDeg.toFixed(1)}°`
  )
}
