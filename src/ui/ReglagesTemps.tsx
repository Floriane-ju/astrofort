/**
 * §3.2 — le curseur temporel : maintenant, figé, en défilement, ou par pas astronomiques.
 *
 * T-0113 — c'était la moitié basse de l'onglet « Explorer ». Le temps ne décrit pas la vue :
 * il date la nuit entière, donc le plan, la fenêtre utile, la position de chaque cible et le
 * filé. Sa place est la barre basse, à côté du lieu, avec les deux autres entrées qui
 * commandent tout le reste — pas dans un onglet parmi quatre.
 *
 * Aucun calcul ne descend ici : `reglageVitesse` est la fonction que la boucle de rendu
 * consulte, appelée sur le même état de scène.
 */

import {
  PAS_ASTRONOMIQUES,
  pasAstronomique,
  reglageVitesse,
  type ModeTemps,
  type PasAstronomique,
} from '../core/curseur-temps.ts'
import { useScene } from './scene-etat.ts'
import { TracedValue } from './TracedValue.tsx'

export interface ReglagesTempsProps {
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
}

export function ReglagesTemps(props: ReglagesTempsProps) {
  const { vue, temps, actions } = useScene()
  const { modeTemps, facteur, pas } = temps
  const reglage = reglageVitesse(facteur, vue.largeurPx, vue.fovDeg)

  return (
    <section>
      <h2>Temps</h2>
      <div className="champs">
        <label>
          Mode de temps
          <select
            value={modeTemps}
            onChange={(e) => actions.majTemps({ modeTemps: e.target.value as ModeTemps })}
          >
            <option value="MAINTENANT">Maintenant — suit l’horloge système</option>
            <option value="FIGE">Figé</option>
            <option value="DEFILEMENT">Défilement</option>
            <option value="PAS_ASTRONOMIQUES">Pas astronomiques</option>
          </select>
        </label>
        {modeTemps === 'DEFILEMENT' && (
          <label>
            Facteur ×{facteur.toFixed(0)}
            <input
              type="range"
              min={-reglage.facteurMax.value}
              max={reglage.facteurMax.value}
              step={1}
              value={facteur}
              onChange={(e) => actions.majTemps({ facteur: Number(e.target.value) })}
            />
          </label>
        )}
        {modeTemps === 'PAS_ASTRONOMIQUES' && (
          <>
            <label>
              Pas
              <select
                value={pas}
                onChange={(e) => actions.majTemps({ pas: e.target.value as PasAstronomique })}
              >
                {PAS_ASTRONOMIQUES.map((p) => (
                  <option key={p} value={p}>
                    {pasAstronomique(p).libelle}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="button" onClick={() => actions.saute(-pasAstronomique(pas).dureeS)}>
                − 1 {pasAstronomique(pas).libelle.toLowerCase()}
              </button>
              <button type="button" onClick={() => actions.saute(pasAstronomique(pas).dureeS)}>
                + 1 {pasAstronomique(pas).libelle.toLowerCase()}
              </button>
            </div>
            <p className="etat">{pasAstronomique(pas).enseigne}</p>
          </>
        )}
      </div>

      {modeTemps === 'DEFILEMENT' && (
        <>
          <TracedValue terme="vitesse_ecran" trace={reglage.vEcran} unite="px/s" />
          <TracedValue
            terme="facteur_vitesse_max"
            trace={reglage.facteurMax}
            decimales={0}
            unite="×"
          />
          <p className={reglage.etat === 'LISIBLE' ? 'etat' : 'cause'}>
            lisibilité : {reglage.etat}
          </p>
          {reglage.message !== undefined && <p className="cause">{reglage.message}</p>}
          {reglage.facteurPropose !== undefined && (
            <button
              type="button"
              onClick={() => actions.majTemps({ facteur: reglage.facteurPropose! })}
            >
              Passer à ×{reglage.facteurPropose.toFixed(0)}
            </button>
          )}
          {props.modeNuit && (
            <p className="cause">
              Mode nuit actif : le défilement est en pause. Aucune animation non sollicitée
              n’est jouée en mode nuit — la vue reste manipulable.
            </p>
          )}
        </>
      )}
    </section>
  )
}
