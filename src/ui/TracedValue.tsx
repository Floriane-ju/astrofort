/**
 * §1.5 critère 2, §10.2 — tout nombre affiché est dépliable jusqu'à sa formule et sa
 * constante source, et §10.1 — le libellé porte sa définition au contact.
 *
 * Quand une constante consommée est un ordre de grandeur, la valeur s'accompagne de sa
 * plage : l'affichage ne présente jamais comme exacte une sortie qui ne peut pas l'être.
 */

import type { Traced } from '../core/traced.ts'
import { dependDUnOrdreDeGrandeur } from '../core/traced.ts'
import type { TermeGlossaire } from '../registry/glossaire.ts'
import { Etiquette, Glose } from './Terme.tsx'

interface TracedValueProps {
  /** Clé de glossaire : un libellé sans définition ne compile pas (§10.1). */
  readonly terme: TermeGlossaire
  readonly trace: Traced<number | null>
  readonly decimales?: number
  readonly unite?: string
  /** Précision non technique quand un même terme sert deux fois (largeur / hauteur). */
  readonly suffixe?: string
}

function formate(valeur: number | null, decimales: number, unite?: string): string | null {
  if (valeur === null) return null
  return `${valeur.toFixed(decimales)}${unite === undefined ? '' : ` ${unite}`}`
}

export function TracedValue({ terme, trace, decimales = 2, unite, suffixe }: TracedValueProps) {
  const approximatif = dependDUnOrdreDeGrandeur(trace)
  const valeur = formate(trace.value, decimales, unite)
  // La plage encadre la valeur au lieu de la remplacer : la sortie reste lisible sans
  // jamais se présenter comme exacte (§2.1).
  const plage =
    trace.range === undefined
      ? null
      : `${trace.range[0].toFixed(decimales)} à ${formate(trace.range[1], decimales, unite) ?? ''}`

  return (
    <details className="tracee">
      <summary>
        <span>
          <Etiquette cle={terme} />
          {suffixe !== undefined && <span className="tracee-suffixe"> — {suffixe}</span>}
        </span>
        <span className="tracee-valeur">
          {valeur ?? '[DONNÉE MANQUANTE]'}
          {plage !== null && <span className="tracee-plage"> (ordre de grandeur : {plage})</span>}
          {plage === null && approximatif ? ' (ordre de grandeur)' : ''}
        </span>
      </summary>
      <div className="tracee-detail">
        <Glose cle={terme} contexte={valeur ?? undefined} />
        <p className="tracee-formule">
          <code>{trace.formula.expression}</code>
          <span className="tracee-section"> — §{trace.formula.section}</span>
        </p>
        {trace.formula.note !== undefined && <p className="tracee-note">{trace.formula.note}</p>}
        {Object.keys(trace.inputs).length > 0 && (
          <dl className="tracee-entrees">
            {Object.entries(trace.inputs).map(([nom, valeurEntree]) => (
              <div key={nom}>
                <dt>{nom}</dt>
                <dd>{valeurEntree}</dd>
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
