/**
 * T-0113 — le panneau latéral : ce qui se lit en longueur, à côté de la scène.
 *
 * T-0181 — il n'est plus un tiroir qu'on ouvre, c'est une colonne à demeure : le mode décide
 * de ce qu'elle porte, et il n'y a donc plus de choix à faire ni d'état fermé. En Ciel profond
 * on choisit une cible, en Panorama on règle un panorama — un seul contenu est monté à la
 * fois, comme au temps des onglets (§11.2), mais la condition est désormais le mode.
 *
 * Le plan de session reste ici, monté et masqué : il est la seule région imprimable, et un
 * plan démonté sortirait une page blanche. Il en sortira pour devenir une carte (T-0183).
 */

import type { ReactNode } from 'react'
import type { ModeInterface } from './seance-etat.ts'

/** Le titre nomme ce qu'on lit — pas le mode, dont la barre haute dit déjà le nom. */
export const TITRES_LATERAL: Readonly<Record<ModeInterface, string>> = Object.freeze({
  CIEL_PROFOND: 'Toutes les cibles',
  PANORAMA: 'Panorama',
})

export interface PanneauLateralProps {
  readonly mode: ModeInterface
  /** Contenu de chaque mode, assemblé par l'application : un seul est monté à la fois. */
  readonly contenus: Readonly<Record<ModeInterface, ReactNode>>
  /** Plan de session — rendu en permanence, pour l'impression et pour elle seule. */
  readonly plan: ReactNode
}

export function PanneauLateral(props: PanneauLateralProps) {
  const { mode } = props

  return (
    <aside className="coque-lateral" id="panneau-lateral" aria-label="Panneau de séance">
      <div className="lateral-entete">
        <h2>{TITRES_LATERAL[mode]}</h2>
      </div>
      <div className="lateral-corps">{props.contenus[mode]}</div>
      <div className="plan-session hors-onglet">{props.plan}</div>
    </aside>
  )
}
