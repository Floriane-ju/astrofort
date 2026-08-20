/**
 * §14 — le tiroir de vérification : état du socle, données utilisateur, matrice de
 * dégradation hors-ligne, registre de constantes.
 *
 * Ces quatre écrans vérifient que l'application repose sur quelque chose de sain ; ils ne
 * préparent aucune nuit. Leur place est un tiroir fermé, ouvrable depuis la barre du haut,
 * pas trois pleines hauteurs d'écran sous le planétarium.
 *
 * Le tiroir est un `<details>` : l'élément natif porte déjà l'état ouvert/fermé, le clavier
 * et le rôle d'annonce. Aucun état React n'est nécessaire pour ouvrir un tiroir.
 */

import { MATRICE_DEGRADATION } from '../data/degradation.ts'
import type { EtatDemarrage } from '../data/bootstrap.ts'
import { REGISTRE } from '../registry/constants.ts'

const OCTETS_PAR_MO = 1024 * 1024

export interface VerificationProps {
  readonly etat: EtatDemarrage | null
  readonly modeReseau: string
  readonly messagePersistance: string | null
  readonly surExport: () => void
  readonly surImport: (fichier: File) => void
}

export function Verification(props: VerificationProps) {
  const { etat } = props

  return (
    <details className="tiroir tiroir-verification">
      <summary>Vérification</summary>
      <div className="tiroir-contenu">
        <section>
          <h2>État du socle</h2>
          {etat === null && <p>Vérification en cours…</p>}
          {etat !== null && (
            <>
              <p className="etat">réseau : {props.modeReseau}</p>
              <p className="etat">
                stockage persistant : {etat.stockage.persistant ? 'accordé' : 'non accordé'}
                {etat.stockage.usageMo !== null &&
                  ` · ${etat.stockage.usageMo.toFixed(1)} Mo utilisés`}
              </p>
              {etat.stockage.avertissement !== undefined && (
                <p className="cause">{etat.stockage.avertissement}</p>
              )}
              {etat.catalogues.cause !== undefined && <p className="cause">{etat.catalogues.cause}</p>}
              <ul>
                {etat.catalogues.paquets.map((p) => (
                  <li key={p.manifeste.nom}>
                    {p.manifeste.nom} v{p.manifeste.version} — {p.integrite} (
                    {(p.manifeste.octets / OCTETS_PAR_MO).toFixed(2)} Mo)
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button type="button" onClick={props.surExport}>
              Exporter mes données (JSON)
            </button>
            <label className="bouton-fichier">
              Réimporter
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const fichier = e.target.files?.[0]
                  if (fichier !== undefined) props.surImport(fichier)
                }}
              />
            </label>
          </div>
          {props.messagePersistance !== null && (
            <p className="cause">{props.messagePersistance}</p>
          )}
        </section>

        <section>
          <h2>Matrice de dégradation hors-ligne</h2>
          <table>
            <thead>
              <tr>
                <th>Fonction</th>
                <th>Sections</th>
                <th>Hors réseau</th>
                <th>Dégradation</th>
              </tr>
            </thead>
            <tbody>
              {MATRICE_DEGRADATION.map((ligne) => (
                <tr key={ligne.fonction}>
                  <td>{ligne.fonction}</td>
                  <td>{ligne.sections}</td>
                  <td>{ligne.horsReseau}</td>
                  <td>{ligne.degradation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Registre de constantes</h2>
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Libellé</th>
                <th>Valeur</th>
                <th>Source</th>
                <th>Tolérance</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(REGISTRE).map(([id, c]) => (
                <tr key={id} className={c.deprecie !== undefined ? 'depreciee' : undefined}>
                  <td>{c.ref}</td>
                  <td>{c.libelle}</td>
                  <td>
                    {c.valeur} {c.unite}
                  </td>
                  <td>{c.source}</td>
                  <td>{c.deprecie ?? c.tolerance ?? 'valeur exacte'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </details>
  )
}
