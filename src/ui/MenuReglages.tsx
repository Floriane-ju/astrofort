/**
 * T-0047 — la roue crantée de la barre haute.
 *
 * Le patron est celui de `MenuInfos` : un `<details>` natif porte l'état ouvert/fermé, le
 * clavier et l'annonce ; le seul JavaScript est la fermeture à Échap, que `<details>` ne fait
 * pas de lui-même.
 *
 * T-0128 — la recherche du catalogue a quitté ce tiroir pour l'onglet « Toutes les cibles »,
 * où elle rejoint les filtres et les lectures qui rendent un résultat exploitable. Chercher
 * un objet pour n'en voir que le nom n'avait de sens que tant qu'il n'existait pas d'écran
 * pour le montrer.
 *
 * Ne restent ici que deux réglages qui ne décrivent pas une séance : la densité
 * d'explication, et les poids de scoring de §8.3.
 */

import { normalisePoids } from '../core/session.ts'
import { DOMAINES } from '../registry/domains.ts'
import { CRITERES_SCORING, type CritereScoring, type SaisiePoids } from './app-saisie.ts'
import { Etiquette, type NiveauUtilisateur } from './Terme.tsx'

const POURCENT = 100

/** Le curseur découpe le domaine du registre en centièmes : pas de borne réécrite ici. */
const DOMAINE_POIDS = DOMAINES.poids_scoring
const PAS_CURSEUR = (DOMAINE_POIDS.max - DOMAINE_POIDS.min) / POURCENT

const LIBELLE_CRITERE: Readonly<Record<CritereScoring, string>> = Object.freeze({
  cadrage: 'Cadrage',
  hauteur: 'Hauteur de culmination',
  signal: 'Signal accumulable',
  fenetre: 'Fenêtre d’observation',
  lune: 'Gêne lunaire',
})

/**
 * §8.3 et §2.4 — les cinq poids C-15 se règlent ici, et nulle part ailleurs.
 *
 * Cinq curseurs indépendants, la somme normalisée à 1 par le moteur : redistribuer les quatre
 * autres à chaque geste ferait bouger des valeurs que personne n'a touchées, et le résultat
 * dépendrait de l'ordre des gestes. Le pourcentage affiché est le poids effectif, celui que
 * le plan utilise vraiment.
 */
function ReglagePoids(props: SaisiePoids) {
  const effectifs = normalisePoids(props.poids)

  return (
    <fieldset className="poids-scoring">
      <legend>
        <Etiquette cle="score_cible" />
      </legend>
      <p className="etat">
        Le score n’ordonne pas la nuit — la chronologie suit les culminations. Il tranche les
        créneaux qui se chevauchent et désigne la cible retirée quand le budget déborde.
      </p>
      {CRITERES_SCORING.map((critere) => (
        <label key={critere}>
          <span>
            {LIBELLE_CRITERE[critere]}
            <span className="poids-effectif">
              {' '}
              {(effectifs[critere] * POURCENT).toFixed(0)} %
            </span>
          </span>
          <input
            type="range"
            min={DOMAINE_POIDS.min}
            max={DOMAINE_POIDS.max}
            step={PAS_CURSEUR}
            value={props.poids[critere]}
            onChange={(e) => props.surPoids(critere, Number(e.target.value))}
          />
        </label>
      ))}
      <p className="etat">
        Rien n’est appris de vos choix passés : deux séances réglées de la même façon
        produisent le même plan.
      </p>
      <button type="button" onClick={props.surDefaut}>
        Revenir aux poids C-15
      </button>
    </fieldset>
  )
}

export interface MenuReglagesProps {
  readonly poids: SaisiePoids
  /** §10.1 — le niveau ne change QUE la densité d'explication, jamais un calcul. */
  readonly niveau: NiveauUtilisateur
  readonly surNiveau: (niveau: NiveauUtilisateur) => void
}

export function MenuReglages(props: MenuReglagesProps) {
  return (
    <details
      className="tiroir tiroir-reglages"
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.removeAttribute('open')
      }}
    >
      <summary>Réglages</summary>

      <div className="tiroir-contenu">
        {/* T-0113 — le niveau d'explication rejoint les réglages. Il était dans la barre
            haute, où il occupait une ligne entière pour un choix qu'on fait une fois. */}
        <p className="niveau">
          Niveau d’explication :{' '}
          <select
            value={props.niveau}
            onChange={(e) => props.surNiveau(e.target.value as NiveauUtilisateur)}
          >
            <option value="DEBUTANT">Débutant — gloses visibles</option>
            <option value="CONFIRME">Confirmé — gloses au survol</option>
          </select>
        </p>

        <ReglagePoids {...props.poids} />
      </div>
    </details>
  )
}
