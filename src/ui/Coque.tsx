/**
 * §11.2 — la coque : la scène au centre, les réglages sur les côtés.
 *
 * L'application est un planétarium ; elle doit se lire comme un planétarium. La pile de
 * sections dans une colonne de 70 rem obligeait à faire défiler trois mille pixels pour voir
 * l'effet d'un changement de focale sur un cadre. Ici le matériel est à gauche, l'intention à
 * droite, et la scène occupe le centre sans jamais bouger.
 *
 * La coque ne connaît aucun contenu : elle reçoit quatre régions et les place. C'est ce qui
 * permet aux panneaux d'être remplis, vidés et redécoupés sans toucher à la mise en page.
 *
 * Les deux panneaux sont des `<details>` ouverts : au-dessus de 1100 px leur `summary` est
 * masqué et ils restent dépliés en permanence ; en dessous, la grille passe à une colonne et
 * ils redeviennent des accordéons repliables sous la scène. Aucun JavaScript de media query
 * n'est nécessaire — l'élément natif porte déjà l'état.
 */

import type { ReactNode } from 'react'

export interface CoqueProps {
  /** Barre haute : identité, réglages globaux, bascules. */
  readonly topbar: ReactNode
  /** Panneau gauche : le matériel et ce qu'il donne. */
  readonly materiel: ReactNode
  /** Colonne centrale : la scène. Elle ne défile pas. */
  readonly scene: ReactNode
  /** Panneau droit : la séance et l'intention. */
  readonly seance: ReactNode
}

export function Coque(props: CoqueProps) {
  return (
    <div className="coque">
      <header className="coque-topbar">{props.topbar}</header>

      <details className="coque-panneau coque-materiel" open>
        <summary>Matériel</summary>
        {props.materiel}
      </details>

      <main className="coque-scene">{props.scene}</main>

      <details className="coque-panneau coque-seance" open>
        <summary>Séance</summary>
        {props.seance}
      </details>
    </div>
  )
}
