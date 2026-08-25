/**
 * §3.2 / T-0137 — le temps se pilote comme un lecteur : reculer, avancer, pause, lecture.
 *
 * Le curseur temporel était un formulaire — un mode à choisir dans une liste, un facteur à
 * pousser sur un rail, le tout replié dans un tiroir. Quatre gestes pour accélérer le ciel.
 * Un transport en demande un : le chevron porte à la fois le sens, la vitesse et l'ordre de
 * partir. Les deux vitesses sont nommées (§3.2) et restent écrêtées par la lisibilité : ce
 * n'est pas la commande qui décide du plafond, c'est le zoom.
 *
 * Aucun `useScene()` ici. Le magasin publie l'instant rendu deux fois par seconde ; s'y
 * abonner en entier ferait rendre la barre au même rythme (T-0056). Chaque abonnement porte
 * donc sur une tranche d'identité stable, et l'horloge sur la SECONDE — pas sur les
 * millisecondes qu'elle affiche.
 */

import { useState } from 'react'
import { facteurDefilement, reglageVitesse } from '../core/curseur-temps.ts'
import { heureSeconde, jourLocalIso, jourLong, pourChampDateHeure } from './horaire.ts'
import { Icone } from './Icone.tsx'
import {
  majTemps,
  reprend,
  secondeAffichee,
  useTrancheScene,
  vaA,
  type EtatScene,
} from './scene-etat.ts'

/** Sélecteurs définis au niveau du module — `useTrancheScene` exige une identité stable. */
function tempsScene(etat: EtatScene): EtatScene['temps'] {
  return etat.temps
}
/** Deux nombres plutôt que l'objet `vue` : promener la visée ne redessine pas la barre. */
function largeurScene(etat: EtatScene): number {
  return etat.vue.largeurPx
}
function fovScene(etat: EtatScene): number {
  return etat.vue.fovDeg
}

interface Cran {
  readonly sens: -1 | 1
  readonly rapide: boolean
  readonly icone: string
  readonly libelle: string
}

/** Les quatre chevrons, dans l'ordre où ils se lisent : les reculs à gauche du cadran. */
const CRANS: readonly Cran[] = Object.freeze([
  { sens: -1, rapide: true, icone: 'keyboard_double_arrow_left', libelle: 'Reculer vite' },
  { sens: -1, rapide: false, icone: 'chevron_left', libelle: 'Reculer' },
  { sens: 1, rapide: false, icone: 'chevron_right', libelle: 'Avancer' },
  { sens: 1, rapide: true, icone: 'keyboard_double_arrow_right', libelle: 'Avancer vite' },
] as const)

export interface BarreTempsProps {
  /** La nuit sur laquelle porte le plan suit l'instant choisi : une seule date à l'écran. */
  readonly surDateIso: (v: string) => void
}

export function BarreTemps(props: BarreTempsProps) {
  const temps = useTrancheScene(tempsScene)
  const reglage = reglageVitesse(
    temps.facteur,
    useTrancheScene(largeurScene),
    useTrancheScene(fovScene),
  )
  const defile = temps.modeTemps === 'DEFILEMENT'
  const enPause = temps.modeTemps === 'FIGE'

  /** Les reculs encadrent le cadran à gauche, les avances à droite : le sens se lit. */
  const chevron = (cran: Cran) => {
    const facteur = cran.sens * facteurDefilement(cran.rapide)
    return (
      <button
        key={cran.libelle}
        type="button"
        className="barretemps-cran"
        aria-label={cran.libelle}
        aria-pressed={defile && temps.facteur === facteur}
        onClick={() => majTemps({ modeTemps: 'DEFILEMENT', facteur })}
      >
        <Icone nom={cran.icone} />
      </button>
    )
  }

  return (
    <div className="barretemps">
      {reglage.ajuste && defile && <p className="cause barretemps-message">{reglage.message}</p>}
      {CRANS.filter((c) => c.sens < 0).map(chevron)}
      <Horloge surDateIso={props.surDateIso} />
      {CRANS.filter((c) => c.sens > 0).map(chevron)}
      {/* Le facteur RÉELLEMENT appliqué, pas celui demandé : sous 20° de champ, la vitesse
          rapide est écrêtée, et l'afficher est la moitié de la promesse — l'autre moitié est
          le message au-dessus de la barre. */}
      {defile && (
        <span className="barretemps-facteur">×{Math.abs(reglage.facteur).toFixed(0)}</span>
      )}
      <button
        type="button"
        className="barretemps-lecture"
        aria-label={enPause ? 'Reprendre l’écoulement du temps' : 'Mettre le temps en pause'}
        aria-pressed={!enPause}
        onClick={() => (enPause ? reprend() : majTemps({ modeTemps: 'FIGE' }))}
      >
        <Icone nom={enPause ? 'play_arrow' : 'pause'} />
      </button>
    </div>
  )
}

/**
 * Le cadran : l'instant rendu, à la seconde, et le champ qui l'édite.
 *
 * Un `<input type="datetime-local">` natif plutôt qu'un calendrier maison — il apporte le
 * clavier, l'annonce et le sélecteur du système. Il ne remplace le texte qu'une fois ouvert :
 * un champ de saisie posé en permanence dans la barre se lirait moins bien qu'une date.
 */
function Horloge(props: BarreTempsProps) {
  const seconde = useTrancheScene(secondeAffichee)
  const [edition, setEdition] = useState(false)
  const date = new Date(seconde * 1000)

  if (edition) {
    return (
      <input
        className="barretemps-instant"
        type="datetime-local"
        step={1}
        autoFocus
        aria-label="Aller à une date et une heure"
        defaultValue={pourChampDateHeure(date)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEdition(false)
        }}
        onBlur={() => setEdition(false)}
        onChange={(e) => {
          // Le champ notifie à chaque frappe : une saisie incomplète ne date rien.
          const choisi = new Date(e.target.value)
          if (Number.isNaN(choisi.getTime())) return
          vaA(choisi.getTime())
          props.surDateIso(jourLocalIso(choisi))
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="barretemps-instant"
      aria-label="Changer la date et l’heure"
      onClick={() => setEdition(true)}
    >
      <span className="barretemps-jour">{jourLong(date)}</span>
      <span className="barretemps-heure">{heureSeconde(date)}</span>
    </button>
  )
}
