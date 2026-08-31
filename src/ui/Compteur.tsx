/**
 * T-0162 — un nombre qui se règle en le tirant, sans quitter des yeux ce qu'il commande.
 *
 * Un `<input type="number">` ou un rail `range` demandent une place que la barre basse n'a
 * pas, et sortent la valeur de la phrase qui la porte. Ici la valeur RESTE le texte affiché :
 * c'est lui qu'on attrape. Le rôle `spinbutton` est ce que la chose est réellement — une
 * valeur numérique sans course bornée — et il apporte les flèches du clavier, donc le même
 * réglage sans souris (§11.2).
 *
 * Le pointeur est capturé au `pointerdown` : le geste continue quand le curseur sort du mot,
 * ce qui est la règle du glisser, et il n'y a rien à écouter sur `window`.
 *
 * Le composant ne connaît ni la nature de la valeur ni son format : il reçoit ce qui s'écrit
 * (`texte`) et rend ce qui se règle (`valeur`). C'est ce qui lui permet de porter aussi bien
 * un mois en toutes lettres qu'un champ en degrés.
 */

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { cransGlisse } from './compteur-glisse.ts'

export interface CompteurProps {
  /** Nom accessible : le compteur affiche une valeur, jamais ce qu'elle désigne. */
  readonly libelle: string
  readonly valeur: number
  /** La valeur telle qu'elle s'écrit — un mois en toutes lettres, un angle arrondi. */
  readonly texte: string
  /** Ce qu'un cran ajoute. Le pas de lecture, pas celui du modèle : c'est le geste. */
  readonly pas: number
  readonly min?: number
  readonly max?: number
  readonly classe?: string
  readonly sur: (valeur: number) => void
  /** Appelé au début du geste : le glisser est absolu, l'appelant peut geler sa référence. */
  readonly surDebut?: () => void
  /** Un clic qui n'a pas glissé — la saisie exacte, quand elle existe. */
  readonly surClic?: () => void
}

interface Depart {
  readonly xPx: number
  readonly valeur: number
  /** Un geste qui a bougé n'est plus un clic : c'est ce qui distingue les deux intentions. */
  bouge: boolean
}

export function Compteur(props: CompteurProps) {
  const depart = useRef<Depart | null>(null)

  function borne(valeur: number): number {
    return Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, valeur))
  }

  function surPointerDown(e: PointerEvent<HTMLSpanElement>): void {
    // Le bouton secondaire ouvre le menu contextuel : le capturer priverait d'un clic droit.
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    depart.current = { xPx: e.clientX, valeur: props.valeur, bouge: false }
    props.surDebut?.()
  }

  function surPointerMove(e: PointerEvent<HTMLSpanElement>): void {
    const d = depart.current
    if (d === null) return
    const crans = cransGlisse(e.clientX - d.xPx)
    // Le premier cran fait la différence entre un clic et un glisser : tant qu'il n'est pas
    // franchi, rien ne bouge et le clic reste possible.
    if (crans === 0 && !d.bouge) return
    d.bouge = true
    props.sur(borne(d.valeur + crans * props.pas))
  }

  function surPointerUp(e: PointerEvent<HTMLSpanElement>): void {
    const d = depart.current
    depart.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (d !== null && !d.bouge) props.surClic?.()
  }

  function surClavier(e: KeyboardEvent<HTMLSpanElement>): void {
    const sens = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0
    const recule = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (sens + recule === 0) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        props.surClic?.()
      }
      return
    }
    e.preventDefault()
    props.sur(borne(props.valeur + (sens + recule) * props.pas))
  }

  return (
    <span
      role="spinbutton"
      tabIndex={0}
      aria-label={props.libelle}
      aria-valuenow={props.valeur}
      aria-valuetext={props.texte}
      {...(props.min === undefined ? {} : { 'aria-valuemin': props.min })}
      {...(props.max === undefined ? {} : { 'aria-valuemax': props.max })}
      className={props.classe === undefined ? 'compteur' : `compteur ${props.classe}`}
      onPointerDown={surPointerDown}
      onPointerMove={surPointerMove}
      onPointerUp={surPointerUp}
      onPointerCancel={surPointerUp}
      onKeyDown={surClavier}
    >
      {props.texte}
    </span>
  )
}
