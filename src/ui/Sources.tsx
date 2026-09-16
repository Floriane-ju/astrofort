/**
 * T-0228 — le contenu du tiroir « info » : d'où viennent les données affichées.
 *
 * Un tableau et non une liste de phrases : la question qu'on se pose ici est « celle-là, elle
 * vient d'où ? », et une colonne de données en regard d'une colonne d'amonts y répond d'un
 * balayage. C'est la forme qu'a déjà le registre de constantes de `Verification`, au même
 * endroit de l'écran et pour la même raison.
 *
 * Aucune chaîne de provenance ici : elles vivent dans `src/registry/sources.ts`, où trois
 * d'entre elles sont celles-là mêmes que leur table publie. Ce composant ne fait que rendre.
 */

import { SOURCES } from '../registry/sources.ts'

export function Sources() {
  return (
    <section>
      <h2>Sources des données</h2>
      <p className="etat">
        Les catalogues sont embarqués : ils ne se mettent pas à jour tout seuls, et la version
        nommée ici est celle que l’application porte.
      </p>
      <table>
        <thead>
          <tr>
            <th>Donnée</th>
            <th>Provenance</th>
          </tr>
        </thead>
        <tbody>
          {SOURCES.map((s) => (
            <tr key={s.donnee}>
              <td>{s.donnee}</td>
              <td>
                {s.provenance}
                {s.lien !== undefined && (
                  <>
                    {' '}
                    <a href={s.lien} target="_blank" rel="noreferrer">
                      amont
                    </a>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
