/**
 * T-0113 — le panneau latéral : ce qui se lit en longueur, à côté de la scène.
 *
 * Deux contenus seulement y passent — le plan de nuit et le filé. Ce ne sont pas des
 * réglages qu'on ajuste en regardant le ciel bouger : ce sont des listes et des séquences
 * qu'on lit de haut en bas. Le reste — matériel, vue, cible — est en carte sur la scène,
 * parce qu'on le règle EN regardant.
 *
 * La coque monte la coquille en permanence et ne monte QUE le contenu choisi : §11.2 tient
 * toujours, un seul jeu de réglages est vivant à la fois. La coquille reste dans le document
 * même fermée pour une seule raison — le plan de session est la seule région imprimable, et
 * un plan démonté sortirait une page blanche depuis un panneau fermé.
 */

import type { ReactNode } from 'react'
import { fermePanneau, type PanneauLateral as ClePanneau } from './coque-etat.ts'

/** Le titre de chaque panneau : il nomme ce qu'on lit, pas l'onglet d'où l'on vient. */
export const TITRES_PANNEAU: Readonly<Record<ClePanneau, string>> = Object.freeze({
  NUIT: 'Plan de nuit',
  FILE: 'Filé',
})

export interface PanneauLateralProps {
  /** Le panneau ouvert, ou `null` : la coquille reste montée, son contenu non. */
  readonly panneau: ClePanneau | null
  /** Contenu de chaque panneau, assemblé par l'application : un seul est monté à la fois. */
  readonly contenus: Readonly<Record<ClePanneau, ReactNode>>
  /** Plan de session — rendu en permanence, visible sous « Plan de nuit » et à l'impression. */
  readonly plan: ReactNode
}

export function PanneauLateral(props: PanneauLateralProps) {
  const { panneau } = props

  return (
    <aside
      className="coque-lateral"
      id="panneau-lateral"
      hidden={panneau === null}
      aria-label="Panneau de séance"
    >
      {panneau !== null && (
        <>
          <div className="lateral-entete">
            <h2>{TITRES_PANNEAU[panneau]}</h2>
            <button
              type="button"
              className="lateral-fermer"
              onClick={fermePanneau}
              aria-label={`Fermer le panneau ${TITRES_PANNEAU[panneau].toLowerCase()}`}
            >
              ✕
            </button>
          </div>
          <div className="lateral-corps">{props.contenus[panneau]}</div>
        </>
      )}
      <div className={panneau === 'NUIT' ? 'plan-session' : 'plan-session hors-onglet'}>
        {props.plan}
      </div>
    </aside>
  )
}
