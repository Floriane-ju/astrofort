/**
 * T-0113 — la barre basse : le lieu, la date, l'heure.
 *
 * Trois entrées commandent tout ce que l'application calcule — où l'on est, quelle nuit, quel
 * instant dans cette nuit. Elles tenaient jusqu'ici deux places distinctes : le groupe
 * « Séance » en tête du panneau droit, et la section « Temps » d'un onglet parmi quatre. Rien
 * ne justifiait de les séparer sinon l'ordre dans lequel les panneaux avaient été écrits.
 *
 * La barre affiche leurs VALEURS en clair et range leurs CHAMPS dans deux tiroirs : le lieu
 * et le Bortle se lisent sans un clic, se règlent en un. Un `<details>` natif porte l'état
 * ouvert/fermé, le clavier et l'annonce — aucun état React n'est nécessaire pour un tiroir.
 */

import type { ModeTemps } from '../core/curseur-temps.ts'
import { heure } from './horaire.ts'
import { minuteAffichee, useTrancheScene, type EtatScene } from './scene-etat.ts'
import { ChampsSite, type ChampsSiteProps } from './ChampsSite.tsx'
import { ReglagesTemps } from './ReglagesTemps.tsx'

/**
 * Le mode de temps en un mot, à côté de l'heure.
 *
 * Une horloge figée et une horloge à l'heure système affichent la même chose une minute sur
 * deux : sans cette mention, rien ne distingue « il est 22 h 41 » de « on regarde 22 h 41 ».
 * Les libellés longs restent au tiroir, avec les champs qu'ils expliquent.
 */
const MODE_COURT: Readonly<Record<ModeTemps, string>> = Object.freeze({
  MAINTENANT: 'en direct',
  FIGE: 'figé',
  DEFILEMENT: 'défilement',
  PAS_ASTRONOMIQUES: 'par pas',
})

export interface BarreBasProps extends ChampsSiteProps {
  readonly dateIso: string
  readonly surDateIso: (v: string) => void
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
}

/**
 * L'horloge de la barre : l'instant que la scène a rendu, à la minute.
 *
 * S'abonner à `msAffiche` la ferait rendre deux fois par seconde — le défaut que T-0056 a
 * corrigé partout ailleurs. À la minute, elle ne rend que quand elle change de valeur.
 */
function Horloge() {
  const minute = useTrancheScene(minuteAffichee)
  const mode = useTrancheScene(modeTempsAffiche)
  return (
    <span className="barrebas-horloge">
      <span className="barrebas-heure">{heure(new Date(minute * 60_000))}</span>
      <span className="barrebas-mode">{MODE_COURT[mode]}</span>
    </span>
  )
}

/** Sélecteur d'identité stable, comme `useTrancheScene` l'exige. */
function modeTempsAffiche(etat: EtatScene): ModeTemps {
  return etat.temps.modeTemps
}

export function BarreBas(props: BarreBasProps) {
  const { dateIso, surDateIso, modeNuit, ...site } = props

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

      <label className="barrebas-date">
        Date
        <input type="date" value={dateIso} onChange={(e) => surDateIso(e.target.value)} />
      </label>

      <Horloge />

      <details className="tiroir tiroir-temps">
        <summary>⏱ Temps</summary>
        <div className="tiroir-contenu">
          <ReglagesTemps modeNuit={modeNuit} />
        </div>
      </details>
    </>
  )
}
