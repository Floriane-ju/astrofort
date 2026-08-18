/**
 * §11.2 — le panneau droit : la séance, puis l'intention.
 *
 * En tête, toujours visible quel que soit l'onglet, le groupe « Séance » : où, quand, sous
 * quel ciel. Ces six champs commandent tout le reste — les masquer derrière un onglet
 * obligerait à y revenir sans cesse.
 *
 * Sous eux, quatre onglets d'intention et UN SEUL jeu de réglages à l'écran à la fois. Un
 * clic sur un objet de la scène ouvre l'onglet Cible garni : c'est [[seance-etat]] qui porte
 * l'onglet actif, pas ce composant, parce que le geste part de la scène et arrive ici.
 *
 * Le plan de session échappe aux onglets : il est rendu en permanence, masqué à l'écran hors
 * de l'onglet Nuit, et reste la seule région imprimable (§11.2). Sans cela, imprimer depuis
 * un autre onglet sortirait une page blanche.
 */

import type { ReactNode } from 'react'
import type { MasqueHorizon, SeuilsSite } from '../core/site.ts'
import { SOURCE_TABLE_BORTLE } from '../registry/bortle.ts'
import { ONGLETS, choisisOnglet, useSeance, type Onglet } from './seance-etat.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette, Terme } from './Terme.tsx'

export interface PanneauSeanceProps {
  readonly latitude: string
  readonly surLatitude: (v: string) => void
  readonly longitude: string
  readonly surLongitude: (v: string) => void
  readonly altitude: string
  readonly surAltitude: (v: string) => void
  readonly dateIso: string
  readonly surDateIso: (v: string) => void
  readonly bortle: string
  readonly surBortle: (v: string) => void
  readonly sqm: string
  readonly surSqm: (v: string) => void
  readonly masque: MasqueHorizon
  /** Seuils de déclinaison du site — propriété de la latitude, absents si la saisie est refusée. */
  readonly seuils?: SeuilsSite
  /** Contenu de chaque onglet, assemblé par l'application : un seul est monté à la fois. */
  readonly contenus: Readonly<Record<Onglet, ReactNode>>
  /** Plan de session — rendu en permanence, visible sous l'onglet Nuit et à l'impression. */
  readonly plan: ReactNode
}

export function PanneauSeance(props: PanneauSeanceProps) {
  const { onglet } = useSeance()

  return (
    <>
      <section>
        <h2>Séance</h2>
        <div className="champs">
          <label>
            <Etiquette cle="latitude" />
            <input value={props.latitude} onChange={(e) => props.surLatitude(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="longitude" />
            <input value={props.longitude} onChange={(e) => props.surLongitude(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="altitude_site" />
            <input value={props.altitude} onChange={(e) => props.surAltitude(e.target.value)} />
          </label>
          <label>
            Date
            <input
              type="date"
              value={props.dateIso}
              onChange={(e) => props.surDateIso(e.target.value)}
            />
          </label>
          <label>
            <Etiquette cle="bortle" />
            <input value={props.bortle} onChange={(e) => props.surBortle(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="sqm" />
            <input
              value={props.sqm}
              placeholder="prioritaire si renseigné"
              onChange={(e) => props.surSqm(e.target.value)}
            />
          </label>
        </div>

        <Terme
          cle="masque_horizon"
          contexte={`horizon plat à 0° sur les ${props.masque.altitudesDeg.length} azimuts ${
            props.masque.estHypothese ? '— [HYP]' : ''
          }`}
        />
        {props.masque.note !== undefined && (
          <p className="cause">
            {props.masque.flags?.map((f) => `[${f}] `).join('')}
            {props.masque.note}
          </p>
        )}

        {/* Les seuils de déclinaison sont une propriété de la latitude, pas de l'optique. */}
        {props.seuils !== undefined && (
          <>
            <TracedValue
              terme="seuil_imagerie"
              trace={props.seuils.decMinImagerie}
              decimales={1}
              unite="°"
            />
            <TracedValue
              terme="seuil_visuel"
              trace={props.seuils.decMinVisuel}
              decimales={1}
              unite="°"
            />
            <TracedValue
              terme="circumpolaire"
              trace={props.seuils.decCircumpolaire}
              decimales={1}
              unite="°"
            />
          </>
        )}

        {/* La table qui traduit le Bortle saisi en fond de ciel dit sa propre limite de
            validité : elle se lit à côté du champ qui l'alimente. */}
        <p className="tracee-source">Fond de ciel : {SOURCE_TABLE_BORTLE}</p>
      </section>

      <div className="onglets" role="tablist" aria-label="Intention de séance">
        {ONGLETS.map((o) => (
          <button
            type="button"
            key={o.cle}
            role="tab"
            id={`onglet-${o.cle}`}
            aria-selected={onglet === o.cle}
            aria-controls="panneau-onglet"
            className={onglet === o.cle ? 'onglet actif' : 'onglet'}
            onClick={() => choisisOnglet(o.cle)}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <div id="panneau-onglet" role="tabpanel" aria-labelledby={`onglet-${onglet}`}>
        {props.contenus[onglet]}
      </div>

      <div className={onglet === 'NUIT' ? 'plan-session' : 'plan-session hors-onglet'}>
        {props.plan}
      </div>
    </>
  )
}
