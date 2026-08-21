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
import { cibleSousLeCurseur, type CibleEcran, type SurvolEcran } from './dessine-ciel.ts'
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
const TOUR_DEG = 360
const DEG_PAR_RADIAN = 180 / Math.PI

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

/** Un tour complet ramené dans 0–360°, la plage de §3.5 comme celle de l'azimut. */
function tourBorne(deg: number): number {
  return ((deg % TOUR_DEG) + TOUR_DEG) % TOUR_DEG
}

function hauteurBornee(deg: number): number {
  return Math.max(HAUTEUR_MIN_DEG, Math.min(HAUTEUR_MAX_DEG, deg))
}

/** La boîte du canevas, réduite à ce dont la rotation a besoin — testable sans DOM. */
export interface BoiteCanevas {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

function angleAutourDuCentre(boite: BoiteCanevas, clientX: number, clientY: number): number {
  return (
    Math.atan2(
      clientY - (boite.top + boite.height / 2),
      clientX - (boite.left + boite.width / 2),
    ) * DEG_PAR_RADIAN
  )
}

/**
 * §3.5 — le roulis du boîtier après un glisser autour du centre du canevas, borné à 0–360°.
 *
 * L'écart d'angle du pointeur se RETRANCHE du roulis : l'axe des ordonnées de l'écran descend
 * là où celui de la vue monte, si bien qu'un roulis croissant fait tourner le cadre dans le
 * sens antihoraire à l'écran. Sans ce signe, le cadre partirait à l'envers du geste.
 *
 * Le geste est continu et sans plafond : deux demi-gestes valent le geste entier, et un tour
 * complet ramène le cadre où il était.
 */
export function roulisApresGlisser(
  roulisDeg: number,
  boite: BoiteCanevas,
  depart: { readonly x: number; readonly y: number },
  arrivee: { readonly x: number; readonly y: number },
): number {
  const ecart =
    angleAutourDuCentre(boite, arrivee.x, arrivee.y) -
    angleAutourDuCentre(boite, depart.x, depart.y)
  return tourBorne(roulisDeg - ecart)
}

/**
 * Le glisser à la souris : promener la visée, tourner le cadre avec Maj, et un clic sans
 * déplacement désigne une cible.
 */
export function usePointageSouris(entree: {
  readonly largeurPx: number
  readonly fovDeg: number
  readonly actions: ActionsScene
  readonly cibles: RefObject<readonly CibleEcran[]>
  /**
   * T-0085 — ce que le curseur désigne, écrit hors de React : la boucle de rendu le lit par
   * image. Passer par un état réactif rendrait React à chaque mouvement de souris.
   */
  readonly survol: RefObject<SurvolEcran | null>
  readonly surSelectionObjet: (objet: ObjetCielProfond) => void
}) {
  const glisse = useRef<{ x: number; y: number } | null>(null)
  const { largeurPx, fovDeg, actions, cibles, survol, surSelectionObjet } = entree

  /** Coordonnées du pointeur dans la définition de rendu, où vivent les cibles. */
  function pointCanevas(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    const echelle = largeurPx / rect.width
    return { x: (e.clientX - rect.left) * echelle, y: (e.clientY - rect.top) * echelle }
  }

  return {
    onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
      glisse.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    },

    onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
      const depart = glisse.current
      if (depart === null) {
        // T-0085 — hors glisser, le curseur révèle le nom que le seuil de zoom a masqué. Le
        // libellé est celui du clic : `decritCible` reste la seule source, et le survol ne
        // touche ni à l'onglet ni à l'état de la scène.
        const point = pointCanevas(e)
        const cible = cibleSousLeCurseur(cibles.current, point.x, point.y)
        survol.current =
          cible === null
            ? null
            : { xPx: cible.xPx, yPx: cible.yPx, texte: decritCible(cible).titre }
        return
      }
      survol.current = null
      const rect = e.currentTarget.getBoundingClientRect()

      // §3.5 — Maj enfoncée, le geste tourne le BOÎTIER, pas la visée : un geste continu, dans
      // les bornes 0–360°. Le pointage reste le glisser nu, qui est le geste de tous les jours.
      if (e.shiftKey) {
        const arrivee = { x: e.clientX, y: e.clientY }
        actions.majVue((v) => ({
          rotationCadreDeg: roulisApresGlisser(v.rotationCadreDeg, rect, depart, arrivee),
        }))
        glisse.current = arrivee
        return
      }

      const echelle = largeurPx / rect.width
      const dx = (e.clientX - depart.x) * echelle
      const dy = (e.clientY - depart.y) * echelle
      const degresParPixel = fovDeg / largeurPx
      actions.majVue((v) => ({
        azimutDeg: tourBorne(v.azimutDeg - dx * degresParPixel),
        hauteurDeg: hauteurBornee(v.hauteurDeg + dy * degresParPixel),
      }))
      glisse.current = { x: e.clientX, y: e.clientY }
    },

    onPointerLeave(): void {
      survol.current = null
    },

    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
      const depart = glisse.current
      glisse.current = null
      if (depart === null) return
      if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 0) return
      const point = pointCanevas(e)
      const cible = cibleSousLeCurseur(cibles.current, point.x, point.y)
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
            azimutDeg: tourBorne(v.azimutDeg + e.deltaX * degresParPixel),
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
