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
 * T-0153 — la phrase qui date l'image occupe le centre. Elle était rangée dans le tiroir des
 * lectures, avec le diagnostic de rendu ; c'est la seule qu'on consulte en visant, et elle
 * complète les deux autres repères de la barre : le lieu à gauche, l'instant à droite.
 *
 * Le lieu, lui, affiche ses VALEURS en clair et range ses CHAMPS dans un tiroir : il se lit
 * sans un clic, se règle en un. Un `<details>` natif porte l'état ouvert/fermé, le clavier et
 * l'annonce — aucun état React n'est nécessaire pour un tiroir.
 */

import { useMemo } from 'react'
import type { Site } from '../core/ephem.ts'
import { cielInstantane } from '../core/horloges.ts'
import { BarreTemps } from './BarreTemps.tsx'
import { ChampsSite, type ChampsSiteProps } from './ChampsSite.tsx'
import { useScene } from './scene-etat.ts'
import { ligneVisee } from './scene-lecture.ts'

export interface BarreBasProps extends ChampsSiteProps {
  /** La nuit du plan de séance suit l'instant choisi dans le transport. */
  readonly surDateIso: (v: string) => void
  /** §3.3 — le site oriente le ciel : sans lui, la visée n'a pas de coordonnées J2000. */
  readonly site: Site
}

/**
 * T-0153 — un composant à part, et non une ligne de plus dans la barre : le magasin de scène
 * republie son instant deux fois par seconde, et s'y abonner depuis `BarreBas` ferait rendre
 * le tiroir du lieu et le transport au même rythme (T-0056). Ici l'abonnement ne coûte que
 * cette phrase.
 */
function Visee(props: { readonly site: Site }) {
  const { vue, msAffiche } = useScene()
  const date = useMemo(() => new Date(msAffiche), [msAffiche])
  const ciel = useMemo(() => cielInstantane(props.site, date), [props.site, date])
  return <p className="etat barrebas-visee">{ligneVisee(vue, ciel.matrice, date)}</p>
}

export function BarreBas(props: BarreBasProps) {
  const { surDateIso, site: siteCalcul, ...site } = props

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

      <Visee site={siteCalcul} />

      <BarreTemps surDateIso={surDateIso} />
    </>
  )
}
