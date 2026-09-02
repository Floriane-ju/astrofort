/**
 * §2.2 + §4.1 — le site : où l'on est, sous quel ciel, derrière quel relief.
 *
 * T-0113 — c'était le groupe « Séance » en tête du panneau droit, déplié en permanence. Il
 * descend dans la barre basse, derrière la pastille qui affiche déjà le lieu et son Bortle :
 * les six champs commandent bien tout le reste, mais on les règle une fois par sortie, pas
 * une fois par cible. Ce qu'il fallait garder n'était pas leur présence à l'écran — c'était
 * la LECTURE de leurs valeurs sans clic, et c'est la pastille qui la porte maintenant.
 *
 * La date reste dehors, dans la barre : elle date la nuit entière et se change en cours de
 * planification, contrairement aux coordonnées d'un site.
 */

import type { MasqueHorizon, PointMasque, SeuilsSite } from '../core/site.ts'
import { SOURCE_TABLE_BORTLE } from '../registry/bortle.ts'
import { MasqueHorizonSaisie } from './MasqueHorizon.tsx'
import { Etiquette } from './Terme.tsx'
import { TracedValue } from './TracedValue.tsx'

export interface ChampsSiteProps {
  readonly latitude: string
  readonly surLatitude: (v: string) => void
  readonly longitude: string
  readonly surLongitude: (v: string) => void
  readonly altitude: string
  readonly surAltitude: (v: string) => void
  readonly bortle: string
  readonly surBortle: (v: string) => void
  readonly sqm: string
  readonly surSqm: (v: string) => void
  readonly masque: MasqueHorizon
  /** §4.1 — les relevés de relief saisis à la main, et leur commande d'édition. */
  readonly pointsMasque: readonly PointMasque[]
  readonly surPointsMasque: (v: readonly PointMasque[]) => void
  /** Seuils de déclinaison du site — propriété de la latitude, absents si la saisie est refusée. */
  readonly seuils?: SeuilsSite
}

export function ChampsSite(props: ChampsSiteProps) {
  return (
    <section>
      <h2>Site</h2>
      <div className="champs">
        <label>
          <Etiquette cle="latitude" />
          <input
            value={props.latitude}
            inputMode="decimal"
            onChange={(e) => props.surLatitude(e.target.value)}
          />
        </label>
        <label>
          <Etiquette cle="longitude" />
          <input
            value={props.longitude}
            inputMode="decimal"
            onChange={(e) => props.surLongitude(e.target.value)}
          />
        </label>
        <label>
          <Etiquette cle="altitude_site" />
          <input
            value={props.altitude}
            inputMode="decimal"
            onChange={(e) => props.surAltitude(e.target.value)}
          />
        </label>
        <label>
          {/* Bortle est un indice ENTIER (1 à 9, DOMAINES.bortle_declare) : le pavé
              numérique sans séparateur décimal évite une saisie qu'aucune valeur
              du domaine n'accepterait. */}
          <Etiquette cle="bortle" />
          <input
            value={props.bortle}
            inputMode="numeric"
            onChange={(e) => props.surBortle(e.target.value)}
          />
        </label>
        <label>
          <Etiquette cle="sqm" />
          <input
            value={props.sqm}
            inputMode="decimal"
            placeholder="prioritaire si renseigné"
            onChange={(e) => props.surSqm(e.target.value)}
          />
        </label>
      </div>

      <MasqueHorizonSaisie
        points={props.pointsMasque}
        surPoints={props.surPointsMasque}
        masque={props.masque}
      />

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
  )
}
