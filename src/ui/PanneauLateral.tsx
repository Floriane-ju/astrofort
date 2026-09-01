/**
 * T-0113 — le panneau latéral : ce qui se lit en longueur, à côté de la scène.
 *
 * T-0181 — il n'est plus un tiroir qu'on ouvre, c'est une colonne à demeure : le mode décide
 * de ce qu'elle porte, et il n'y a donc plus de choix à faire ni d'état fermé.
 *
 * T-0182 — en Ciel profond elle porte deux lectures successives, la liste puis la fiche, et
 * l'en-tête suit : il nomme ce qu'on lit, porte le retour quand il y a d'où revenir, et le
 * rappel de facilité de la cible ouverte. Le retour N'EXISTE PAS sur la liste — un bouton
 * inerte resterait dans l'ordre de tabulation et annoncerait une issue qui n'en est pas une.
 *
 * T-0183 — le plan de session n'est plus ici : il se consulte pendant qu'on regarde le ciel,
 * pas en le parcourant pour choisir, et c'est ce qui en fait une carte.
 */

import type { ReactNode } from 'react'
import { Icone } from './Icone.tsx'
import type { ModeInterface } from './seance-etat.ts'

/** Ce que la colonne porte dans chaque mode, quand aucune fiche n'a pris sa place. */
export const TITRES_LATERAL: Readonly<Record<ModeInterface, string>> = Object.freeze({
  CIEL_PROFOND: 'Toutes les cibles',
  PANORAMA: 'Panorama',
})

export interface PanneauLateralProps {
  /** Ce qu'on lit, pas le mode d'où l'on vient : la barre haute dit déjà le nom du mode. */
  readonly titre: string
  /** Le retour vers la liste, ou `null` quand il n'y a rien derrière. */
  readonly retour: (() => void) | null
  /** §6.4 — la note de facilité de la cible ouverte, annoncée avec son libellé. */
  readonly rappel: ReactNode
  readonly children: ReactNode
}

export function PanneauLateral(props: PanneauLateralProps) {
  return (
    <aside className="coque-lateral" id="panneau-lateral" aria-label="Panneau de séance">
      <div className="lateral-entete">
        {props.retour !== null && (
          <button
            type="button"
            className="lateral-retour"
            aria-label="Revenir à la liste des cibles"
            onClick={props.retour}
          >
            <Icone nom="arrow_back" />
          </button>
        )}
        <h2>{props.titre}</h2>
        {props.rappel}
      </div>
      <div className="lateral-corps">{props.children}</div>
    </aside>
  )
}
