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

import { useRef, useState } from 'react'
import { facteurDefilement, reglageVitesse } from '../core/curseur-temps.ts'
import {
  dateAvec,
  jourLocalIso,
  partiesHeure,
  partiesJour,
  pourChampDateHeure,
  type ChampInstant,
} from './horaire.ts'
import { Bulle } from './Bulle.tsx'
import { Compteur } from './Compteur.tsx'
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
      <Bulle key={cran.libelle} texte={cran.libelle} nomme>
        <button
          type="button"
          className="barretemps-cran"
          aria-pressed={defile && temps.facteur === facteur}
          onClick={() => majTemps({ modeTemps: 'DEFILEMENT', facteur })}
        >
          <Icone nom={cran.icone} />
        </button>
      </Bulle>
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
      <Bulle
        texte={enPause ? 'Reprendre l’écoulement du temps' : 'Mettre le temps en pause'}
        nomme
      >
        <button
          type="button"
          className="barretemps-lecture"
          aria-pressed={!enPause}
          onClick={() => (enPause ? reprend() : majTemps({ modeTemps: 'FIGE' }))}
        >
          <Icone nom={enPause ? 'play_arrow' : 'pause'} />
        </button>
      </Bulle>
    </div>
  )
}

/** Un cran de glisser vaut une unité du champ : un jour, un mois, une seconde. */
const PAS_INSTANT = 1

/** T-0162 — les morceaux de l'instant que le glisser règle, et le nom qu'ils annoncent. */
const CHAMPS_INSTANT: Partial<
  Record<Intl.DateTimeFormatPartTypes, { readonly champ: ChampInstant; readonly libelle: string }>
> = {
  day: { champ: 'jour', libelle: 'Jour' },
  month: { champ: 'mois', libelle: 'Mois' },
  year: { champ: 'annee', libelle: 'Année' },
  hour: { champ: 'heure', libelle: 'Heure' },
  minute: { champ: 'minute', libelle: 'Minute' },
  second: { champ: 'seconde', libelle: 'Seconde' },
}

/** Le mois est rendu humain — 1 à 12 — parce que c'est ce que le compteur annonce. */
function valeurChamp(date: Date, champ: ChampInstant): number {
  if (champ === 'annee') return date.getFullYear()
  if (champ === 'mois') return date.getMonth() + 1
  if (champ === 'jour') return date.getDate()
  if (champ === 'heure') return date.getHours()
  if (champ === 'minute') return date.getMinutes()
  return date.getSeconds()
}

/**
 * Le cadran : l'instant rendu, à la seconde, et les six compteurs qui le règlent.
 *
 * T-0162 — chaque morceau se tire à l'horizontale (§11.2) : avancer d'un jour ne demande plus
 * d'ouvrir un champ, de viser son sous-champ et de le refermer. Le champ natif reste, sous le
 * clic sans glisser : lui seul apporte le sélecteur du système et la frappe d'une date lointaine.
 *
 * `depart` gèle l'instant AU DÉBUT du geste. Sans lui, tirer les mois depuis un 31 relirait à
 * chaque mouvement une date déjà déplacée, et le jour dériverait avec elle.
 */
function Horloge(props: BarreTempsProps) {
  const seconde = useTrancheScene(secondeAffichee)
  const [edition, setEdition] = useState(false)
  const depart = useRef<Date | null>(null)
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

  function va(champ: ChampInstant, valeur: number): void {
    const choisi = dateAvec(depart.current ?? date, champ, valeur)
    vaA(choisi.getTime())
    props.surDateIso(jourLocalIso(choisi))
  }

  /** Les littéraux de la locale restent du texte : seuls les nombres deviennent des compteurs. */
  function compteurs(parties: readonly Intl.DateTimeFormatPart[]) {
    return parties.map((partie, rang) => {
      const reglage = CHAMPS_INSTANT[partie.type]
      if (reglage === undefined) return partie.value
      const champ = reglage.champ
      return (
        <Compteur
          key={rang}
          libelle={reglage.libelle}
          valeur={valeurChamp(date, champ)}
          texte={partie.value}
          pas={PAS_INSTANT}
          sur={(valeur) => va(champ, valeur)}
          surDebut={() => {
            depart.current = date
          }}
          surClic={() => setEdition(true)}
        />
      )
    })
  }

  return (
    <span className="barretemps-instant">
      <span className="barretemps-jour">{compteurs(partiesJour(date))}</span>
      <span className="barretemps-heure">{compteurs(partiesHeure(date))}</span>
    </span>
  )
}
