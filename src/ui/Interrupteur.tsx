/**
 * T-0215 — une case à cocher et la phrase qui dit ce qu'elle fait.
 *
 * Le motif était écrit sept fois à l'identique, dans cinq fichiers : `<label className=
 * "interrupteur">`, un `<input type="checkbox">`, un libellé. Sept écritures du même
 * contrôle, donc sept occasions de diverger — c'est le raisonnement de T-0209 pour
 * `ChampDomaine`, appliqué au seul autre contrôle que l'application répète.
 *
 * Le libellé est un `ReactNode` et non une chaîne : deux des sept sites y posent une
 * `<Etiquette>` du glossaire suivie d'une phrase, et forcer la chaîne les aurait laissés
 * dehors — un composant qu'un cas sur trois ne peut pas employer ne factorise rien.
 *
 * Aucune variante, aucune prop d'apparence : la forme vit dans `.interrupteur`
 * (`styles.css`), qui est l'unique endroit à toucher pour les faire toutes changer.
 */

import type { ReactNode } from 'react'

export interface InterrupteurProps {
  readonly actif: boolean
  readonly surChangement: (actif: boolean) => void
  /** La phrase qui dit ce que l'interrupteur fait, pas le nom d'un champ. */
  readonly children: ReactNode
}

export function Interrupteur({ actif, surChangement, children }: InterrupteurProps) {
  return (
    <label className="interrupteur">
      <input
        type="checkbox"
        checked={actif}
        onChange={(e) => surChangement(e.target.checked)}
      />
      {children}
    </label>
  )
}
