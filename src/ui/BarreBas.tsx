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
 * T-0153 — la phrase qui dit où pointe la scène occupe le centre. Elle était rangée dans le
 * tiroir des lectures, avec le diagnostic de rendu ; c'est la seule qu'on consulte en visant,
 * et elle complète les deux autres repères de la barre : le lieu à gauche, l'instant à droite.
 *
 * T-0163 — elle ne date plus l'image : le transport porte le même instant à sa droite, et il
 * est réglable. La phrase ne garde que ce qui lui appartient — la visée, le cap, le champ —
 * et ses cinq nombres se tirent à l'horizontale.
 *
 * Le lieu, lui, affiche ses VALEURS en clair et range ses CHAMPS dans un tiroir : il se lit
 * sans un clic, se règle en un. Un `<details>` natif porte l'état ouvert/fermé, le clavier et
 * l'annonce — aucun état React n'est nécessaire pour un tiroir.
 */

import { Fragment, useMemo } from 'react'
import type { Site } from '../core/ephem.ts'
import { cielInstantane } from '../core/horloges.ts'
import { bornesZoom } from '../core/projection.ts'
import { BarreTemps } from './BarreTemps.tsx'
import { ChampsSite, type ChampsSiteProps } from './ChampsSite.tsx'
import { Compteur } from './Compteur.tsx'
import { HAUTEUR_MAX_DEG, HAUTEUR_MIN_DEG, tourBorne } from './planetarium-gestes.ts'
import { majVue, useScene } from './scene-etat.ts'
import {
  segmentsVisee,
  viseeVersVue,
  type ChampVisee,
  type SegmentVisee,
} from './scene-lecture.ts'

export interface BarreBasProps extends ChampsSiteProps {
  /** La nuit du plan de séance suit l'instant choisi dans le transport. */
  readonly surDateIso: (v: string) => void
  /** §3.3 — le site oriente le ciel : sans lui, la visée n'a pas de coordonnées J2000. */
  readonly site: Site
  /** §3.3 — le paquet Gaia décide jusqu'où le champ peut se refermer sans vider le ciel. */
  readonly gaiaCharge: boolean
}

/**
 * T-0163 — ce qu'un cran de glisser ajoute à chaque lecture. C'est le pas du GESTE, pas celui
 * du modèle : une visée se pointe au dixième de degré, un cap se prend au degré. Les deux
 * angles de visée gardent le pas le plus fin — ce sont eux qu'on règle sur une cible.
 */
const PAS_VISEE: Readonly<Record<ChampVisee, number>> = Object.freeze({
  AD: 0.1,
  DEC: 0.1,
  AZIMUT: 1,
  HAUTEUR: 0.5,
  FOV: 0.5,
})

/**
 * T-0153 — un composant à part, et non une ligne de plus dans la barre : le magasin de scène
 * republie son instant deux fois par seconde, et s'y abonner depuis `BarreBas` ferait rendre
 * le tiroir du lieu et le transport au même rythme (T-0056). Ici l'abonnement ne coûte que
 * cette phrase.
 */
function Visee(props: { readonly site: Site; readonly gaiaCharge: boolean }) {
  const { vue, msAffiche } = useScene()
  const date = useMemo(() => new Date(msAffiche), [msAffiche])
  const ciel = useMemo(() => cielInstantane(props.site, date), [props.site, date])
  const segments = segmentsVisee(vue, ciel.matrice)
  const bornes = bornesZoom(props.gaiaCharge, vue.mode)

  /**
   * Les cinq nombres de la phrase sont des ENTRÉES de la scène. Trois le sont directement ;
   * l'AD et la δ passent par la réciproque de la visée, qui rend le pointage horizontal de la
   * direction équatoriale demandée à l'instant affiché.
   */
  function regle(champ: ChampVisee, valeur: number): void {
    const [ad, dec] = [segments[0]!.valeurDeg, segments[1]!.valeurDeg]
    if (champ === 'AD') return majVue(viseeVersVue(valeur, dec, ciel.matrice))
    if (champ === 'DEC') return majVue(viseeVersVue(ad, valeur, ciel.matrice))
    if (champ === 'AZIMUT') return majVue({ azimutDeg: tourBorne(valeur) })
    if (champ === 'HAUTEUR') return majVue({ hauteurDeg: valeur })
    // Le plafond est reposé par le magasin ; le plancher, lui, dépend du paquet chargé.
    majVue({ fovDeg: valeur })
  }

  /** L'azimut et l'AD se referment sur eux-mêmes : les borner arrêterait le geste au nord. */
  function encadrement(champ: ChampVisee): { readonly min?: number; readonly max?: number } {
    if (champ === 'DEC' || champ === 'HAUTEUR') {
      return { min: HAUTEUR_MIN_DEG, max: HAUTEUR_MAX_DEG }
    }
    if (champ === 'FOV') return { min: bornes.fovMinDeg, max: bornes.fovMaxDeg }
    return {}
  }

  const compteur = (segment: SegmentVisee) => (
    <Fragment key={segment.champ}>
      {segment.avant}
      <Compteur
        libelle={segment.libelle}
        valeur={segment.valeurDeg}
        texte={segment.texte}
        pas={PAS_VISEE[segment.champ]}
        {...encadrement(segment.champ)}
        sur={(valeur) => regle(segment.champ, valeur)}
      />
    </Fragment>
  )

  // T-0163 — la phrase ne date plus l'image : le transport porte le même instant à deux
  // centimètres de là, et deux horloges côte à côte se contredisent à la seconde près.
  return <p className="etat barrebas-visee">{segments.map(compteur)}</p>
}

export function BarreBas(props: BarreBasProps) {
  // `gaiaCharge` sort du lot : il borne le champ de la visée, il n'est pas un champ du lieu.
  const { surDateIso, site: siteCalcul, gaiaCharge, ...site } = props

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

      <Visee site={siteCalcul} gaiaCharge={gaiaCharge} />

      <BarreTemps surDateIso={surDateIso} />
    </>
  )
}
