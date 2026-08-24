/**
 * L'onglet « Nuit » : quand la nuit commence, ce qu'elle vaut en fond de ciel, et pourquoi
 * le plan de session peut être absent.
 *
 * Chaque nombre reste dépliable jusqu'à sa formule (§1.5.2, §10.1), et chaque terme technique
 * porte sa définition au contact.
 */

import type { FenetreNocturne } from '../core/night.ts'
import type { FondDeCiel } from '../core/sky-background.ts'
import type { Traced } from '../core/traced.ts'
import { TracedValue } from './TracedValue.tsx'
import { Terme } from './Terme.tsx'

function heure(date: Date | null): string {
  return date === null ? '—' : date.toLocaleString('fr-FR')
}

export interface RegionNuitProps {
  readonly nuit: FenetreNocturne
  readonly ciel: FondDeCiel
  readonly offsetMidi: Traced<number>
  /** Vrai tant qu'aucun catalogue vérifié n'alimente le plan : la région le dit en clair. */
  readonly planIndisponible: boolean
}

export function RegionNuit(props: RegionNuitProps) {
  return (
    <>
      <FenetreNocturneVue nuit={props.nuit} offsetMidi={props.offsetMidi} />
      <FondDeCielVue ciel={props.ciel} />
      {props.planIndisponible && (
        <section>
          <h2>Plan de session</h2>
          <p className="cause">
            Les catalogues ne sont pas encore vérifiés : aucun plan n’est produit tant qu’un
            binaire non validé pourrait l’alimenter. Les moteurs de cadrage, de pose et
            d’intégration restent utilisables sur une cible saisie à la main.
          </p>
        </section>
      )}
    </>
  )
}

/** §2.3 — les bornes de la nuit, du coucher du Soleil à son lever. */
function FenetreNocturneVue({
  nuit,
  offsetMidi,
}: {
  readonly nuit: FenetreNocturne
  readonly offsetMidi: Traced<number>
}) {
  return (
    <section>
      <h2>Fenêtre nocturne</h2>
      <p className="etat">état : {nuit.etat}</p>
      <Terme
        cle={nuit.modeDegrade ? 'mode_degrade_nuit' : 'nuit_astronomique'}
        contexte={`${nuit.dureeReferenceH.toFixed(2)} h exploitables`}
      />
      {nuit.cause !== undefined && <p className="cause">{nuit.cause}</p>}
      <table>
        <tbody>
          <tr>
            <th>Coucher du Soleil</th>
            <td>{heure(nuit.coucherSoleil)}</td>
          </tr>
          <tr>
            <th>Début de nuit astronomique (−18°)</th>
            <td>{heure(nuit.debutNuitAstronomique)}</td>
          </tr>
          <tr>
            <th>Milieu de nuit vrai</th>
            <td>{heure(nuit.milieuNuitVrai)}</td>
          </tr>
          <tr>
            <th>Fin de nuit astronomique</th>
            <td>{heure(nuit.finNuitAstronomique)}</td>
          </tr>
          <tr>
            <th>Lever du Soleil</th>
            <td>{heure(nuit.leverSoleil)}</td>
          </tr>
          <tr>
            <th>Durée de nuit astronomique</th>
            <td>{nuit.dureeNuitH.toFixed(2)} h</td>
          </tr>
        </tbody>
      </table>
      <TracedValue terme="midi_solaire_vrai" trace={offsetMidi} decimales={1} unite="min" />
    </section>
  )
}

/** §2.2 — d'où vient le fond de ciel retenu, et ce qu'il laisse voir à l'œil nu. */
function FondDeCielVue({ ciel }: { readonly ciel: FondDeCiel }) {
  return (
    <section>
      <h2>Fond de ciel</h2>
      <p className="etat">source : {ciel.sourceSb}</p>
      {ciel.confirmationRequise !== undefined && (
        <p className="cause">{ciel.confirmationRequise}</p>
      )}
      <TracedValue terme="fond_de_ciel" trace={ciel.sbCiel} unite="mag/as²" />
      <TracedValue terme="magnitude_limite_oeil" trace={ciel.mLimOeil} unite="mag" />
    </section>
  )
}
