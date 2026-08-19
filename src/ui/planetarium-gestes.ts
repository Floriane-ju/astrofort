/**
 * Les gestes que la scène accepte : glisser pour promener la visée, molette et pincement
 * pour le champ, défilement à deux doigts pour promener aussi.
 *
 * Le zoom est posé à la main, hors de React : `onWheel` attache un écouteur passif, où
 * `preventDefault()` reste sans effet — le navigateur zoomerait alors toute la page par-dessus
 * le champ de la scène. Safari ajoute ses `gesture*`, qui zooment la page de leur côté.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { bornesZoom } from '../core/projection.ts'
import { majLectures, majVue, type ActionsScene } from './scene-etat.ts'
import { decritCible } from './planetarium-selection.ts'
import { cibleSousLeCurseur, type CibleEcran } from './dessine-ciel.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'

/** Un cran de molette. Le pincement, lui, est continu : son amplitude se lit dans `deltaY`. */
const FACTEUR_ZOOM_MOLETTE = 1.1
/** Pincement au pavé : `deltaY` en pixels vers un facteur de champ, par l'exponentielle. */
const SENSIBILITE_PINCEMENT = 0.01
/** `WheelEvent.DOM_DELTA_PIXEL` : delta en pixels, le cas du pavé et des molettes sur macOS. */
const DOM_DELTA_PIXEL = 0
/** Un cran de molette vaut ±120 en `wheelDeltaY`, hérité de Windows et repris partout. */
const CRAN_WHEEL_DELTA = 120
/** Faute de mieux, la hauteur en pixels d'un cran de molette. À retoucher si un pavé s'y trompe. */
const SEUIL_CRAN_PX = 40
const HAUTEUR_MIN_DEG = -90
const HAUTEUR_MAX_DEG = 90

/**
 * Le facteur appliqué au champ pour un `wheel`. La molette avance par crans : facteur fixe. Le
 * pincement au pavé est continu — Chrome et Firefox le traduisent en `wheel` à `ctrlKey` — et son
 * amplitude est dans `deltaY` : l'exponentielle en fait un facteur multiplicatif continu, où deux
 * demi-gestes valent exactement le geste entier.
 */
export function facteurZoom(deltaY: number, pincement: boolean): number {
  if (pincement) return Math.exp(deltaY * SENSIBILITE_PINCEMENT)
  return deltaY > 0 ? FACTEUR_ZOOM_MOLETTE : 1 / FACTEUR_ZOOM_MOLETTE
}

/** Ce qu'un `wheel` doit déclencher sur la scène. */
export type SourceGeste = 'PINCEMENT' | 'MOLETTE' | 'DEFILEMENT'

/**
 * Un `wheel` sur macOS peut venir de trois gestes qui ne doivent pas faire la même chose : le
 * pincement zoome, le défilement à deux doigts promène la visée, la molette zoome. Aucun
 * navigateur ne dit lequel c'est ; il faut le déduire de trois signaux, du plus sûr au moins sûr.
 */
export function sourceMolette(e: {
  readonly ctrlKey: boolean
  readonly deltaMode: number
  readonly deltaX: number
  readonly deltaY: number
  readonly wheelDeltaY?: number
}): SourceGeste {
  // Le pincement au pavé, seul geste que le navigateur signale lui-même — par `ctrlKey`.
  if (e.ctrlKey) return 'PINCEMENT'
  // Un delta en lignes plutôt qu'en pixels : Firefox ne le fait que pour une vraie molette.
  if (e.deltaMode !== DOM_DELTA_PIXEL) return 'MOLETTE'
  // WebKit et Blink : un cran de molette vaut un multiple de 120 en `wheelDeltaY`. Le pavé, lui,
  // renvoie −3 × `deltaY`, qui tombe rarement juste.
  if (e.wheelDeltaY !== undefined && e.wheelDeltaY !== 0) {
    return e.wheelDeltaY % CRAN_WHEEL_DELTA === 0 ? 'MOLETTE' : 'DEFILEMENT'
  }
  // Faute de `wheelDeltaY` (Firefox en pixels) : un cran est gros, entier et strictement vertical.
  const cran = e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= SEUIL_CRAN_PX
  return cran ? 'MOLETTE' : 'DEFILEMENT'
}

/**
 * `wheelDeltaY` est déprécié et absent des types du DOM, mais reste le seul signal fiable pour
 * distinguer un cran de molette d'un défilement au pavé dans WebKit et Blink.
 */
interface EvenementMolette extends WheelEvent {
  readonly wheelDeltaY?: number
}

/**
 * Safari macOS émet ces événements non standard pour le pincement au pavé, en plus — ou à la
 * place — du `wheel` à `ctrlKey`. Ils sont absents des types du DOM : on les déclare ici.
 */
interface EvenementGeste extends Event {
  readonly scale: number
}

function azimutBorne(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function hauteurBornee(deg: number): number {
  return Math.max(HAUTEUR_MIN_DEG, Math.min(HAUTEUR_MAX_DEG, deg))
}

/** Le glisser à la souris : promener la visée, et un clic sans déplacement désigne une cible. */
export function usePointageSouris(entree: {
  readonly largeurPx: number
  readonly fovDeg: number
  readonly actions: ActionsScene
  readonly cibles: RefObject<readonly CibleEcran[]>
  readonly surSelectionObjet: (objet: ObjetCielProfond) => void
}) {
  const glisse = useRef<{ x: number; y: number } | null>(null)
  const { largeurPx, fovDeg, actions, cibles, surSelectionObjet } = entree

  return {
    onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
      glisse.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    },

    onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
      const depart = glisse.current
      if (depart === null) return
      const rect = e.currentTarget.getBoundingClientRect()
      const echelle = largeurPx / rect.width
      const dx = (e.clientX - depart.x) * echelle
      const dy = (e.clientY - depart.y) * echelle
      const degresParPixel = fovDeg / largeurPx
      actions.majVue((v) => ({
        azimutDeg: azimutBorne(v.azimutDeg - dx * degresParPixel),
        hauteurDeg: hauteurBornee(v.hauteurDeg + dy * degresParPixel),
      }))
      glisse.current = { x: e.clientX, y: e.clientY }
    },

    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
      const depart = glisse.current
      glisse.current = null
      if (depart === null) return
      if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const echelle = largeurPx / rect.width
      const cible = cibleSousLeCurseur(
        cibles.current,
        (e.clientX - rect.left) * echelle,
        (e.clientY - rect.top) * echelle,
      )
      const decrite = cible === null ? null : decritCible(cible)
      majLectures({ selection: decrite })
      // §3.4 — un objet du ciel profond ouvre sa fiche : le geste ne s'arrête pas sur un nom.
      if (decrite?.objet != null) surSelectionObjet(decrite.objet)
    },
  }
}

/** Molette, pincement et défilement à deux doigts, posés hors de React sur le canevas. */
export function useGestesZoom(
  canevas: RefObject<HTMLCanvasElement | null>,
  gaiaCharge: boolean,
): void {
  useEffect(() => {
    const brut = canevas.current
    if (brut === null) return
    const cible: HTMLCanvasElement = brut
    const bornes = bornesZoom(gaiaCharge)
    const borne = (fov: number): number =>
      Math.max(bornes.fovMinDeg, Math.min(bornes.fovMaxDeg, fov))

    function surMolette(e: WheelEvent): void {
      e.preventDefault()
      const source = sourceMolette(e as EvenementMolette)
      if (source === 'DEFILEMENT') {
        // Deux doigts sur le pavé promènent le ciel comme le ferait un glisser : le ciel suit les
        // doigts, donc le signe des deltas s'inverse. Le champ est lu dans l'état, pas capturé.
        const largeurCss = cible.getBoundingClientRect().width
        majVue((v) => {
          const degresParPixel = v.fovDeg / largeurCss
          return {
            azimutDeg: azimutBorne(v.azimutDeg + e.deltaX * degresParPixel),
            hauteurDeg: hauteurBornee(v.hauteurDeg - e.deltaY * degresParPixel),
          }
        })
        return
      }
      majVue((v) => ({ fovDeg: borne(v.fovDeg * facteurZoom(e.deltaY, source === 'PINCEMENT')) }))
    }

    // Safari : `scale` est cumulée depuis le début du geste, on n'en garde que la variation.
    let echelleGeste = 1
    function surGesteDebut(e: Event): void {
      e.preventDefault()
      echelleGeste = 1
    }
    function surGesteChange(e: Event): void {
      e.preventDefault()
      const echelle = (e as EvenementGeste).scale
      if (!Number.isFinite(echelle) || echelle <= 0) return
      const facteur = echelleGeste / echelle
      echelleGeste = echelle
      majVue((v) => ({ fovDeg: borne(v.fovDeg * facteur) }))
    }
    function surGesteFin(e: Event): void {
      e.preventDefault()
    }

    cible.addEventListener('wheel', surMolette, { passive: false })
    cible.addEventListener('gesturestart', surGesteDebut)
    cible.addEventListener('gesturechange', surGesteChange)
    cible.addEventListener('gestureend', surGesteFin)
    return () => {
      cible.removeEventListener('wheel', surMolette)
      cible.removeEventListener('gesturestart', surGesteDebut)
      cible.removeEventListener('gesturechange', surGesteChange)
      cible.removeEventListener('gestureend', surGesteFin)
    }
  }, [canevas, gaiaCharge])
}
