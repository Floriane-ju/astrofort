/**
 * Carte « Vue » — ce qui commande CE QU'ON VOIT de la scène de §3.
 *
 * La projection, le champ, la rotation du boîtier, les couches de tracés. La scène, elle, ne
 * garde que le canevas et ses lectures : un réglage posé sous une image qu'il modifie oblige
 * à faire défiler pour voir son effet.
 *
 * T-0113 — c'était la moitié haute de l'onglet « Explorer ». Le curseur temporel de §3.2, qui
 * partageait cet onglet, est descendu dans la barre basse : le temps date toute la nuit, il
 * n'appartient pas plus à la vue qu'au plan de séance. Ce qui reste ici ne décrit que le
 * rendu, et c'est ce qui rend la carte repliable sans rien perdre.
 *
 * La profondeur affichée se lit dans la barre haute (`BarreHaut.tsx`), pas ici : c'est une
 * lecture d'atelier, pas un réglage de rendu, et elle reste visible carte repliée.
 */

import {
  RAPPEL_ASTERISME,
  RAPPEL_FIGURES,
  ecartFrontieresDeg,
} from '../core/constellations.ts'
import { bornesZoom, type ModeProjection } from '../core/projection.ts'
import type { MasqueHorizon } from '../core/site.ts'
import type { CouchesActives } from './dessine-ciel.ts'
import { RACCOURCIS_CLAVIER } from './planetarium-gestes.ts'
import { useScene } from './scene-etat.ts'
import { useSeance } from './seance-etat.ts'
import { TracedValue } from './TracedValue.tsx'

export interface PanneauVueProps {
  /** §5.1 — la projection de l'objectif déclaré au panneau matériel, pas un réglage de rendu. */
  readonly modeObjectif: ModeProjection
  readonly gaiaCharge: boolean
  /** Époque de l'instant affiché : elle chiffre l'écart de précession des frontières B1875. */
  readonly epoqueAnnee: number
  /** §4.1 — relief du site : la couche Sol masque ce relief, et le déclare quand il est supposé. */
  readonly masque: MasqueHorizon
}

/**
 * Les couches qui se décident. L'horizon n'en fait pas partie : c'est la ligne à laquelle se
 * lisent les hauteurs et l'azimut, donc le repère du reste — l'effacer rendait la scène
 * illisible sans rien libérer. Il reste une passe de rendu (`CouchesActives.horizon`), toujours
 * allumée dans l'état de scène, que les tests de tracé isolent couche par couche.
 */
const COUCHES: readonly (readonly [keyof CouchesActives, string])[] = [
  ['figures', 'Figures IAU'],
  ['frontieres', 'Frontières IAU'],
  ['asterismes', 'Astérismes'],
  ['cadre', 'Cadre matériel'],
  ['sol', 'Sol — masque ce qui est sous l’horizon'],
  ['voieLactee', 'Voie lactée'],
]

export function PanneauVue(props: PanneauVueProps) {
  const { vue, rendu, actions } = useScene()
  const { mode: modeInterface } = useSeance()
  const { mode } = vue
  const { couches, vueRealiste } = rendu

  const bornes = bornesZoom(props.gaiaCharge, mode)

  return (
    <>
      <section>
        <h2>Vue</h2>
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
              exige le réseau ; et la teinte du crépuscule ne vire pas vers l’azimut du
              Soleil, alors que le vrai ciel y est plus clair et plus jaune.
            </p>
          )}
        </div>
        {bornes.cause !== undefined && <p className="cause">{bornes.cause}</p>}

        {/* T-0069 — un raccourci qui n'est écrit que dans le code n'existe pas. Il est
            annoncé ici, avec les autres gestes de la scène (§11.2). */}
        <p className="etat">{RACCOURCIS_CLAVIER}</p>
      </section>

      <section>
        <h2>Couches</h2>
        {/* T-0171 — un interrupteur qui ne commande rien doit dire pourquoi : sous l'aperçu
            peint sur toute la scène, ces couches sont éteintes quel que soit leur état. */}
        {modeInterface === 'PANORAMA' && (
          <p className="etat">
            L’aperçu est peint sur toute la scène : seuls le sol, l’horizon, le cadre
            matériel et le trait du plan galactique s’y ajoutent. La bande de la Voie lactée,
            les autres couches, les marqueurs d’objets, les corps et les noms restent éteints
            tant qu’il est actif — le survol nomme toujours ce qu’il désigne.
          </p>
        )}
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
            sa note. L'hypothèse d'horizon plat, elle, reste au panneau Lieu (MasqueHorizon) :
            elle invite à éditer le relief, un geste que la carte Vue ne propose pas. */}
        {couches.sol && !props.masque.estHypothese && props.masque.note !== undefined && (
          <p className="etat">{props.masque.note}</p>
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
    </>
  )
}
