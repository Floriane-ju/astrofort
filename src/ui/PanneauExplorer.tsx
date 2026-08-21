/**
 * Onglet « Explorer » — les réglages de la scène de §3, sortis du planétarium.
 *
 * Ce qui pilote CE QU'ON VOIT vit ici : la projection, le champ, la rotation du boîtier, les
 * couches de tracés, le curseur temporel de §3.2. La scène, elle, ne garde que le canevas et
 * ses lectures — un réglage posé sous une image qu'il modifie oblige à faire défiler pour
 * voir son effet, ce que le lot 6 supprime précisément.
 *
 * Aucun calcul ne descend ici : `etatProfondeur` et `reglageVitesse` sont les mêmes fonctions
 * que celles que la boucle de rendu consulte, appelées sur le même état de scène.
 */

import {
  RAPPEL_ASTERISME,
  RAPPEL_FIGURES,
  ecartFrontieresDeg,
} from '../core/constellations.ts'
import {
  PAS_ASTRONOMIQUES,
  pasAstronomique,
  reglageVitesse,
  type ModeTemps,
  type PasAstronomique,
} from '../core/curseur-temps.ts'
import { bornesZoom, etatProfondeur, type ModeProjection } from '../core/projection.ts'
import type { MasqueHorizon } from '../core/site.ts'
import type { CouchesActives } from './dessine-ciel.ts'
import { RACCOURCIS_CLAVIER } from './planetarium-gestes.ts'
import { useScene } from './scene-etat.ts'
import { TracedValue } from './TracedValue.tsx'

export interface PanneauExplorerProps {
  /** §5.1 — la projection de l'objectif déclaré au panneau matériel, pas un réglage de rendu. */
  readonly modeObjectif: ModeProjection
  readonly gaiaCharge: boolean
  /** Magnitude la plus faible du paquet chargé : au-delà, le champ paraît plus pauvre qu'il n'est. */
  readonly profondeurMag: number
  /** §2.2 — fond de ciel du site : c'est lui qui plafonne la profondeur en vue réaliste. */
  readonly sbCiel: number | null
  /** Époque de l'instant affiché : elle chiffre l'écart de précession des frontières B1875. */
  readonly epoqueAnnee: number
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
  /** §4.1 — relief du site : la couche Sol masque ce relief, et le déclare quand il est supposé. */
  readonly masque: MasqueHorizon
}

const COUCHES: readonly (readonly [keyof CouchesActives, string])[] = [
  ['figures', 'Figures IAU'],
  ['frontieres', 'Frontières IAU'],
  ['asterismes', 'Astérismes'],
  ['cadre', 'Cadre matériel'],
  ['horizon', 'Horizon'],
  ['sol', 'Sol — masque ce qui est sous l’horizon'],
  ['voieLactee', 'Voie lactée'],
]

export function PanneauExplorer(props: PanneauExplorerProps) {
  const { vue, temps, rendu, actions } = useScene()
  const { fovDeg, rotationCadreDeg: rotationDeg, mode } = vue
  const { modeTemps, facteur, pas } = temps
  const { couches, vueRealiste } = rendu

  const bornes = bornesZoom(props.gaiaCharge, mode)
  const profondeur = etatProfondeur(fovDeg, props.profondeurMag, props.sbCiel, vueRealiste)
  const reglage = reglageVitesse(facteur, vue.largeurPx, fovDeg)

  return (
    <>
      <section>
        <h2>Vue — §3.3</h2>
        <div className="champs">
          <label>
            Projection
            {/* Deux choix seulement : la vue de planétarium, ou celle de l'objectif déclaré.
                Offrir gnomonique ET équidistante ici laisserait choisir une projection que le
                matériel ne produit pas — §5.1 en fait une propriété de l'objectif. */}
            <select
              value={mode === 'MODE_PLANETARIUM' ? 'MODE_PLANETARIUM' : props.modeObjectif}
              onChange={(e) => actions.majVue({ mode: e.target.value as ModeProjection })}
            >
              <option value="MODE_PLANETARIUM">Planétarium — stéréographique</option>
              <option value={props.modeObjectif}>
                Comme l’objectif —{' '}
                {props.modeObjectif === 'MODE_FISHEYE' ? 'équidistante' : 'gnomonique'}
              </option>
            </select>
          </label>
          <label>
            Champ : {fovDeg.toFixed(1)}°
            <input
              type="range"
              min={bornes.fovMinDeg}
              max={bornes.fovMaxDeg}
              step={1}
              value={fovDeg}
              onChange={(e) => actions.majVue({ fovDeg: Number(e.target.value) })}
            />
          </label>
          <label>
            {/* Le geste équivalent est sur la scène ; sans mention ici, il reste introuvable. */}
            Rotation du cadre : {rotationDeg.toFixed(0)}° — ou Maj + glisser sur la scène
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotationDeg}
              onChange={(e) => actions.majVue({ rotationCadreDeg: Number(e.target.value) })}
            />
          </label>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={vueRealiste}
              onChange={(e) => actions.majRendu({ vueRealiste: e.target.checked })}
            />
            {/* T-0097 — la case ne plafonne plus seulement la magnitude : elle peint le fond
                de ciel du site, son halo d'horizon et celui de la Lune. */}
            Vue réaliste — fond de ciel et magnitude limite du site
          </label>
          {/* T-0096 — les limites du fond peint se disent DANS l'app, pas seulement dans le
              ticket : une approximation tue est une approximation que l'utilisateur prend
              pour une mesure. */}
          {vueRealiste && (
            <p className="cause">
              Le fond peint additionne, en nanolamberts, la brillance du site, son halo
              d’horizon (van&nbsp;Rhijn 1921), la lueur du crépuscule (Patat, Ugolnikov &amp;
              Postylyakov 2006, mesurée de 5° à 15° de dépression solaire) et celle de la Lune
              (Krisciunas &amp; Schaefer 1991). Hors périmètre, et dit plutôt que supposé : le
              sol ne s’éclaircit pas ; le halo du site reste symétrique en azimut — le dôme
              lumineux d’une ville est plus clair de son côté, mais l’atlas qui le donnerait
              exige le réseau (§4.1) ; et la teinte du crépuscule ne vire pas vers l’azimut du
              Soleil, alors que le vrai ciel y est plus clair et plus jaune.
            </p>
          )}
        </div>
        {bornes.cause !== undefined && <p className="cause">{bornes.cause}</p>}

        {/* T-0069 — un raccourci qui n'est écrit que dans le code n'existe pas. Il est
            annoncé ici, avec les autres gestes de la scène (§11.2). */}
        <p className="etat">{RACCOURCIS_CLAVIER}</p>

        <TracedValue terme="magnitude_limite_rendue" trace={profondeur.magLimite} unite="mag" />
        {profondeur.cause !== undefined && <p className="cause">{profondeur.cause}</p>}
      </section>

      <section>
        <h2>Couches — §3.4</h2>
        <div className="champs">
          {COUCHES.map(([cle, libelle]) => (
            <label className="interrupteur" key={cle}>
              <input
                type="checkbox"
                checked={couches[cle]}
                onChange={(e) =>
                  actions.majRendu((r) => ({
                    couches: { ...r.couches, [cle]: e.target.checked },
                  }))
                }
              />
              {libelle}
            </label>
          ))}
        </div>
        {/* §4.1 — le sol masque, il doit donc dire sur quoi il repose : le masque porte déjà
            sa note, hypothèse d'horizon plat comprise. La réécrire ici la ferait diverger. */}
        {couches.sol && props.masque.note !== undefined && (
          <p className={props.masque.estHypothese ? 'cause' : 'etat'}>{props.masque.note}</p>
        )}
        {couches.asterismes && <p className="etat">{RAPPEL_ASTERISME}</p>}
        {couches.figures && <p className="etat">{RAPPEL_FIGURES}</p>}
        {couches.frontieres && (
          <TracedValue
            terme="precession"
            suffixe="frontières B1875 → époque affichée"
            trace={ecartFrontieresDeg(props.epoqueAnnee)}
            unite="°"
          />
        )}
      </section>

      <section>
        <h2>Temps — §3.2</h2>
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
                n’est jouée en mode nuit (§11.1) — la vue reste manipulable.
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}
