/**
 * §4.1 — l'édition manuelle du masque d'horizon, sous le groupe « Séance ».
 *
 * Le modèle numérique de terrain de §4.1 demande le réseau et un cache par site ; le relevé
 * à la main, lui, est hors ligne et suffit à rendre les créneaux justes. On saisit quelques
 * crêtes — azimut, hauteur d'obstruction — et [[masqueDepuisPoints]] interpole le reste.
 *
 * Le refus est montré à la saisie, jamais après coup : une altitude hors domaine nomme son
 * champ et n'entre pas dans la liste, plutôt que de faire tomber la chaîne de calcul.
 */

import { useState } from 'react'
import { masqueDepuisPoints, type MasqueHorizon, type PointMasque } from '../core/site.ts'
import { SaisieRefuseeError } from '../registry/domains.ts'
import { Terme } from './Terme.tsx'

export interface MasqueHorizonProps {
  readonly points: readonly PointMasque[]
  readonly surPoints: (v: readonly PointMasque[]) => void
  /** Le masque effectivement en vigueur : relevés interpolés, ou repli plat [HYP]. */
  readonly masque: MasqueHorizon
}

/** L'azimut est compté depuis le nord, dans le sens des aiguilles d'une montre. */
const CARDINAUX = ['N', 'E', 'S', 'O'] as const

/** Point cardinal le plus proche d'un azimut, pour se repérer sans convertir de tête. */
export function repereCardinal(azimutDeg: number): string {
  const quart = Math.round(azimutDeg / 90) % CARDINAUX.length
  return CARDINAUX[(quart + CARDINAUX.length) % CARDINAUX.length] ?? CARDINAUX[0]
}

export function MasqueHorizonSaisie(props: MasqueHorizonProps) {
  const [azimut, surAzimut] = useState('')
  const [altitude, surAltitude] = useState('')
  const [refus, surRefus] = useState<string | null>(null)

  function ajoute() {
    const point = { azimutDeg: Number(azimut), altitudeDeg: Number(altitude) }
    try {
      // Le constructeur du masque porte les bornes du registre : on l'appelle pour valider,
      // plutôt que de recopier ici un min et un max qui divergeraient.
      masqueDepuisPoints([...props.points, point])
      props.surPoints([...props.points, point])
      surAzimut('')
      surAltitude('')
      surRefus(null)
    } catch (erreur) {
      surRefus(
        erreur instanceof SaisieRefuseeError || erreur instanceof Error
          ? erreur.message
          : 'Saisie refusée : relevé inexploitable.',
      )
    }
  }

  return (
    <div className="masque-horizon">
      <Terme
        cle="masque_horizon"
        contexte={
          props.masque.estHypothese
            ? `horizon plat à 0° sur les ${props.masque.altitudesDeg.length} azimuts — [HYP]`
            : `${props.points.length} relevé${props.points.length > 1 ? 's' : ''} interpolé${
                props.points.length > 1 ? 's' : ''
              } sur les ${props.masque.altitudesDeg.length} azimuts`
        }
      />
      {/* L'hypothèse plate est une alerte — le relevé saisi, lui, n'est qu'une lecture. */}
      {props.masque.note !== undefined && (
        <p className={props.masque.estHypothese ? 'cause' : 'tracee-source'}>
          {props.masque.flags?.map((f) => `[${f}] `).join('')}
          {props.masque.note}
        </p>
      )}

      {props.points.length > 0 && (
        <ul className="masque-releves">
          {props.points.map((p, rang) => (
            <li key={`${p.azimutDeg}-${p.altitudeDeg}-${rang}`}>
              <span>
                azimut {p.azimutDeg}° ({repereCardinal(p.azimutDeg)}) → {p.altitudeDeg}°
              </span>
              <button
                type="button"
                aria-label={`Effacer le relevé de l’azimut ${p.azimutDeg}°`}
                onClick={() => props.surPoints(props.points.filter((_, i) => i !== rang))}
              >
                Effacer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="champs">
        <label>
          Azimut du relevé
          <input
            value={azimut}
            inputMode="decimal"
            placeholder="0 = nord, 90 = est"
            onChange={(e) => surAzimut(e.target.value)}
          />
        </label>
        <label>
          Hauteur d’obstruction
          <input
            value={altitude}
            inputMode="decimal"
            placeholder="crête, arbre, bâtiment"
            onChange={(e) => surAltitude(e.target.value)}
          />
        </label>
        <button type="button" onClick={ajoute}>
          Relever
        </button>
        {props.points.length > 0 && (
          <button type="button" onClick={() => props.surPoints([])}>
            Tout effacer
          </button>
        )}
      </div>

      {refus !== null && <p className="cause">{refus}</p>}
    </div>
  )
}
