/**
 * §3.4 — la phrase qui date l'image : où pointe la scène, sur quel champ, à quel instant.
 *
 * T-0068 — le canevas doit dire à une technologie d'assistance ce qu'il montre en ce moment,
 * et le menu d'information affiche déjà exactement cela. Composée deux fois, la phrase
 * dériverait — un `toFixed` retouché d'un côté, et le nom accessible ne décrit plus la même
 * vue que la lecture affichée. Elle se compose donc ici, une fois, pour les deux.
 *
 * T-0163 — la barre basse ne lit plus cette phrase, elle la RÈGLE : chacun de ses cinq
 * nombres est un compteur glissant. La phrase se décrit donc en segments — le littéral qui
 * précède, la valeur, ce qu'elle règle — et `ligneVisee` n'en est plus que la concaténation.
 * C'est la seule façon de garder « une phrase, deux endroits » quand l'un des deux endroits
 * l'entrecoupe de balises.
 */

import type { Mat3 } from '../core/mat3.ts'
import { applique, versSpherique, versVecteur } from '../core/mat3.ts'
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

/**
 * La réciproque : où pointer la vue pour viser cette direction J2000, à cet instant.
 *
 * `matriceCiel` va de J2000 au repère horizontal du site, et le vecteur central de la matrice
 * de vue Y VAUT exactement `versVecteur(azimut, hauteur)` — la sphérique de la direction
 * tournée EST donc le pointage, sans passer par la projection ni par l'écran.
 */
export function viseeVersVue(
  longitudeDeg: number,
  latitudeDeg: number,
  matriceCiel: Mat3,
): { readonly azimutDeg: number; readonly hauteurDeg: number } {
  const horizontal = versSpherique(
    applique(matriceCiel, versVecteur(longitudeDeg, latitudeDeg)),
  )
  return { azimutDeg: horizontal.longitudeDeg, hauteurDeg: horizontal.latitudeDeg }
}

/** Ce que règle un segment de la phrase — l'ordre des cinq est celui de la lecture. */
export type ChampVisee = 'AD' | 'DEC' | 'AZIMUT' | 'HAUTEUR' | 'FOV'

export interface SegmentVisee {
  readonly champ: ChampVisee
  /** Nom accessible du compteur : la phrase le porte en clair, le compteur seul non. */
  readonly libelle: string
  readonly valeurDeg: number
  /** La valeur telle qu'elle s'écrit, unité comprise. */
  readonly texte: string
  /** Le littéral qui la précède dans la phrase, ponctuation et espaces compris. */
  readonly avant: string
}

/** Décimales de chaque lecture : une visée se pointe au centième, un champ au dixième. */
const DECIMALES_VISEE = 2
const DECIMALES_CHAMP = 1
const DECIMALES_POINTAGE = 0

export function segmentsVisee(vue: VueScene, matriceCiel: Mat3): readonly SegmentVisee[] {
  const visee = viseeJ2000(vue, matriceCiel)
  return [
    {
      champ: 'AD',
      libelle: 'Ascension droite visée',
      valeurDeg: visee.longitudeDeg,
      texte: `${visee.longitudeDeg.toFixed(DECIMALES_VISEE)}° AD`,
      avant: 'visée ',
    },
    {
      champ: 'DEC',
      libelle: 'Déclinaison visée',
      valeurDeg: visee.latitudeDeg,
      texte: `${visee.latitudeDeg.toFixed(DECIMALES_VISEE)}° δ`,
      avant: ' / ',
    },
    {
      champ: 'AZIMUT',
      libelle: 'Azimut',
      valeurDeg: vue.azimutDeg,
      texte: `${vue.azimutDeg.toFixed(DECIMALES_POINTAGE)}°`,
      avant: ' · azimut ',
    },
    {
      champ: 'HAUTEUR',
      libelle: 'Hauteur',
      valeurDeg: vue.hauteurDeg,
      texte: `${vue.hauteurDeg.toFixed(DECIMALES_POINTAGE)}°`,
      avant: ', hauteur ',
    },
    {
      champ: 'FOV',
      libelle: 'Champ de vision',
      valeurDeg: vue.fovDeg,
      texte: `${vue.fovDeg.toFixed(DECIMALES_CHAMP)}°`,
      avant: ' · champ ',
    },
  ]
}

/**
 * Le séparateur appartient à l'ENCHAÎNEMENT, pas au premier segment : la barre basse n'affiche
 * plus l'instant — le transport le porte à deux centimètres de là — et la suite des segments
 * doit pouvoir s'y lire seule, sans un « · » orphelin en tête.
 */
const SEPARATEUR = ' · '

export function ligneVisee(vue: VueScene, matriceCiel: Mat3, date: Date): string {
  return segmentsVisee(vue, matriceCiel).reduce(
    (phrase, s) => phrase + s.avant + s.texte,
    date.toLocaleString('fr-FR') + SEPARATEUR,
  )
}
