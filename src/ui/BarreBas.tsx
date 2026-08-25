/**
 * T-0113 — la barre basse : le lieu, l'instant.
 *
 * Deux entrées commandent tout ce que l'application calcule — où l'on est, et quand. Elles
 * tenaient jusqu'ici trois places distinctes : le groupe « Séance » en tête du panneau droit,
 * un champ de date au milieu de la barre, et la section « Temps » d'un onglet parmi quatre.
 * Rien ne justifiait de les séparer sinon l'ordre dans lequel les panneaux avaient été écrits.
 *
 * T-0137 — le temps n'est plus un tiroir de réglages mais un transport (`BarreTemps`), et la
 * date a rejoint l'heure : une seule date à l'écran, donc plus de nuit planifiée qui diffère
 * du ciel regardé.
 *
 * Le lieu, lui, affiche ses VALEURS en clair et range ses CHAMPS dans un tiroir : il se lit
 * sans un clic, se règle en un. Un `<details>` natif porte l'état ouvert/fermé, le clavier et
 * l'annonce — aucun état React n'est nécessaire pour un tiroir.
 */

import { BarreTemps } from './BarreTemps.tsx'
import { ChampsSite, type ChampsSiteProps } from './ChampsSite.tsx'

export interface BarreBasProps extends ChampsSiteProps {
  /** La nuit du plan de séance suit l'instant choisi dans le transport. */
  readonly surDateIso: (v: string) => void
}

export function BarreBas(props: BarreBasProps) {
  const { surDateIso, ...site } = props

  return (
    <>
      {/* Le lieu se LIT sur la pastille et se RÈGLE dans le tiroir : ce qui comptait n'était
          pas que les six champs soient dépliés, c'était que leurs valeurs soient visibles. */}
      <details className="tiroir tiroir-site">
        <summary>
          <span className="barrebas-lieu">
            {site.latitude}° / {site.longitude}° · Bortle {site.bortle}
          </span>
        </summary>
        <div className="tiroir-contenu">
          <ChampsSite {...site} />
        </div>
      </details>

      <BarreTemps surDateIso={surDateIso} />
    </>
  )
}
