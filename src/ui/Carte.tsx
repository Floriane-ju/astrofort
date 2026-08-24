/**
 * T-0113 — une carte posée sur la scène : un en-tête qui la nomme, un corps qui se replie.
 *
 * Trois raisons de poser les réglages SUR le ciel plutôt qu'à côté :
 *
 *   1. la scène récupère toute la largeur — un cadre de 0,8° dans une colonne de 900 px se
 *      lisait mal, il se lit ici ;
 *   2. une carte se replie à son en-tête, donc ce qui ne sert pas à cet instant ne prend que
 *      la hauteur de son titre ;
 *   3. une carte se déplace, donc elle cesse de cacher ce qu'on regarde. C'est le seul geste
 *      qu'un panneau à position fixe ne peut pas offrir, et c'est exactement le geste dont on
 *      a besoin quand la cible tombe derrière le panneau.
 *
 * L'en-tête est un vrai `<button aria-expanded>` : le repli reste au clavier et l'état reste
 * annoncé. Le déplacement, lui, est au pointeur seulement.
 * ponytail: pas de déplacement au clavier. Une carte a une place par défaut d'où tout se lit
 * et rien ne se cache ; bouger n'ouvre l'accès à aucune fonction. Si un jour une carte peut
 * masquer une commande qu'elle seule porte, il faudra des flèches.
 */

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  basculeCarte,
  borne,
  bornesDeplacement,
  deplaceCarte,
  useCoque,
  type CleCarte,
  type Decalage,
} from './coque-etat.ts'

/**
 * Au-delà, le geste est un déplacement et non un clic.
 *
 * Sans ce seuil, replier une carte deviendrait impossible à la souris : le moindre tremblement
 * entre l'appui et le relâchement compterait comme un déplacement et mangerait le clic.
 */
const SEUIL_GLISSE_PX = 3

/** Le jour entre une carte et le bord de la coque, pour qu'elle ne colle jamais un filet. */
const MARGE_COQUE_PX = 10

export interface CarteProps {
  readonly cle: CleCarte
  readonly titre: string
  /** Repère de couleur : la cible est la seule carte qui porte l'accent de visée. */
  readonly accent?: 'cible'
  readonly children: ReactNode
}

/** Le rectangle d'un élément, ou `null` s'il n'est pas dans le document. */
function rect(element: Element | null | undefined): DOMRect | null {
  return element?.getBoundingClientRect() ?? null
}

/**
 * Ce que la coque réserve sur ses bords, MESURÉ plutôt que recopié.
 *
 * Les hauteurs des deux barres et la largeur du panneau sont écrites dans la feuille de
 * style. Les redéclarer ici en ferait une seconde source de vérité qui divergerait au premier
 * ajustement de gouttière ; les lire à l'instant du geste ne coûte que trois mesures.
 */
function margesCoque(coque: Element): { haut: number; bas: number; droite: number } {
  return {
    haut: rect(coque.querySelector('.coque-topbar'))?.height ?? 0,
    bas: rect(coque.querySelector('.coque-barrebas'))?.height ?? 0,
    droite: rect(coque.querySelector('.coque-lateral'))?.width ?? 0,
  }
}

export function Carte(props: CarteProps) {
  const { cartes } = useCoque()
  const etat = cartes[props.cle]
  const glisse = useRef(false)

  function surPointerDown(evenement: ReactPointerEvent<HTMLElement>): void {
    // Seul le bouton principal déplace : le menu contextuel et les gestes secondaires passent.
    if (evenement.button !== 0) return
    const entete = evenement.currentTarget
    const carte = entete.closest('.carte')
    const coque = carte?.closest('.coque') ?? null
    const boiteCarte = rect(carte)
    const boiteCoque = rect(coque)
    if (coque === null || boiteCarte === null || boiteCoque === null) return

    const bornes = bornesDeplacement(
      boiteCarte,
      boiteCoque,
      margesCoque(coque),
      MARGE_COQUE_PX,
    )
    const depart = { x: evenement.clientX, y: evenement.clientY }
    const base: Decalage = etat.decalage
    glisse.current = false
    entete.setPointerCapture(evenement.pointerId)

    const bouge = (e: PointerEvent): void => {
      const dx = e.clientX - depart.x
      const dy = e.clientY - depart.y
      if (Math.abs(dx) > SEUIL_GLISSE_PX || Math.abs(dy) > SEUIL_GLISSE_PX) glisse.current = true
      if (!glisse.current) return
      deplaceCarte(props.cle, {
        x: base.x + borne(dx, bornes.x),
        y: base.y + borne(dy, bornes.y),
      })
    }
    const relache = (): void => {
      entete.removeEventListener('pointermove', bouge)
      entete.removeEventListener('pointerup', relache)
      entete.removeEventListener('pointercancel', relache)
    }
    entete.addEventListener('pointermove', bouge)
    entete.addEventListener('pointerup', relache)
    entete.addEventListener('pointercancel', relache)
  }

  function surClic(): void {
    // Un déplacement se termine par un `click` que le navigateur envoie quand même : sans
    // cette garde, relâcher une carte qu'on vient de traîner la replierait.
    if (glisse.current) {
      glisse.current = false
      return
    }
    basculeCarte(props.cle)
  }

  const style =
    etat.decalage.x === 0 && etat.decalage.y === 0
      ? undefined
      : { transform: `translate(${etat.decalage.x}px, ${etat.decalage.y}px)` }

  return (
    <section
      className={`carte carte-${props.cle.toLowerCase()}`}
      data-ouverte={etat.ouverte}
      {...(props.accent === undefined ? {} : { 'data-accent': props.accent })}
      {...(style === undefined ? {} : { style })}
    >
      <button
        type="button"
        className="carte-entete"
        aria-expanded={etat.ouverte}
        onPointerDown={surPointerDown}
        onClick={surClic}
      >
        <span className="carte-titre">{props.titre}</span>
        {/* Le signe dit l'action à venir, pas l'état courant : replier, ou déplier. */}
        <span className="carte-marque" aria-hidden="true">
          {etat.ouverte ? '—' : '+'}
        </span>
      </button>
      {etat.ouverte && <div className="carte-corps">{props.children}</div>}
    </section>
  )
}
