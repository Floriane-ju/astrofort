/**
 * §1.5 critère 2, §10.2 — tout nombre affiché est dépliable jusqu'à sa formule et sa
 * constante source.
 *
 * Quand une constante consommée est un ordre de grandeur, la valeur s'accompagne de sa
 * plage : l'affichage ne présente jamais comme exacte une sortie qui ne peut pas l'être.
 */

import type { Traced } from '../core/traced.ts'
import { dependDUnOrdreDeGrandeur } from '../core/traced.ts'

interface TracedValueProps {
  readonly libelle: string
  readonly trace: Traced<number | null>
  readonly decimales?: number
  readonly unite?: string
}

function formate(valeur: number | null, decimales: number): string {
  return valeur === null ? '[DONNÉE MANQUANTE]' : valeur.toFixed(decimales)
}

export function TracedValue({ libelle, trace, decimales = 2, unite }: TracedValueProps) {
  const approximatif = dependDUnOrdreDeGrandeur(trace)
  return (
    <details className="tracee">
      <summary>
        <span className="tracee-libelle">{libelle}</span>
        <span className="tracee-valeur">
          {/* Une sortie qui dépend d'un ordre de grandeur s'affiche comme plage : la
              valeur centrale seule se lirait comme exacte (§2.1). */}
          {trace.range !== undefined
            ? `${formate(trace.range[0], decimales)} à ${formate(trace.range[1], decimales)}`
            : formate(trace.value, decimales)}
          {unite !== undefined && trace.value !== null ? ` ${unite}` : ''}
          {approximatif ? ' (ordre de grandeur)' : ''}
        </span>
      </summary>
      <div className="tracee-detail">
        <p className="tracee-formule">
          <code>{trace.formula.expression}</code>
          <span className="tracee-section"> — §{trace.formula.section}</span>
        </p>
        {trace.formula.note !== undefined && <p className="tracee-note">{trace.formula.note}</p>}
        {Object.keys(trace.inputs).length > 0 && (
          <dl className="tracee-entrees">
            {Object.entries(trace.inputs).map(([nom, valeur]) => (
              <div key={nom}>
                <dt>{nom}</dt>
                <dd>{valeur}</dd>
              </div>
            ))}
          </dl>
        )}
        {trace.constants.length > 0 && (
          <ul className="tracee-constantes">
            {trace.constants.map((c) => (
              <li key={c.id}>
                <strong>{c.ref}</strong> {c.libelle} = {c.valeur} {c.unite}
                <br />
                <span className="tracee-source">
                  source : {c.source}
                  {c.tolerance !== null ? ` · tolérance : ${c.tolerance}` : ' · valeur exacte'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {trace.flags !== undefined && (
          <p className="tracee-flags">{trace.flags.map((f) => `[${f}]`).join(' ')}</p>
        )}
        {trace.note !== undefined && <p className="tracee-note">{trace.note}</p>}
      </div>
    </details>
  )
}
