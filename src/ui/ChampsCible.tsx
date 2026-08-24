/**
 * La région « Cible » de la fiche : ce qu'on vise, choisi dans le catalogue ou saisi à la main.
 *
 * T-0128 — le choix ne se fait plus ici. Deux `<select>` y vivaient — la liste des visibles et
 * son filtre par type — et ils tenaient dans une carte posée sur la scène ce que le panneau
 * « Toutes les cibles » montre maintenant en entier, chiffres compris. La carte ne garde que
 * ce qu'elle sait faire : décrire la cible retenue.
 *
 * Une cible venue du catalogue verrouille la saisie — les valeurs viennent d'OpenNGC et ne se
 * retouchent pas (T-0051, §6.4). « Cible personnalisée » la rouvre.
 */

import { TYPES_OBJET, type TypeObjet } from '../data/deepsky.ts'
import { Etiquette } from './Terme.tsx'
import { LIBELLE_TYPE_OBJET } from './libelles-objet.ts'
import type { EtatSaisieCible } from './fiche-cible-saisie.ts'

export interface ChampsCibleProps {
  readonly saisie: EtatSaisieCible
}

export function ChampsCible(props: ChampsCibleProps) {
  const { saisie } = props

  return (
    <section>
      <h2>Cible</h2>
      <div className="champs">
        <label>
          Désignation
          <input
            value={saisie.designation}
            onChange={(e) => saisie.surDesignation(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        {saisie.verrouille && (
          <div className="actions">
            <span className="etat">Valeurs du catalogue, en lecture seule.</span>
            <button type="button" onClick={() => saisie.appliqueObjet(null)}>
              Cible personnalisée
            </button>
          </div>
        )}
        <label>
          Type d’objet
          {/* Un `<select>` ne connaît pas `readonly` : c'est `disabled` qui le ferme. */}
          <select
            value={saisie.typeObjet}
            onChange={(e) => saisie.surTypeObjet(e.target.value as TypeObjet)}
            disabled={saisie.verrouille}
          >
            {TYPES_OBJET.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE_OBJET[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Etiquette cle="magnitude_integree" />
          <input
            value={saisie.mInt}
            onChange={(e) => saisie.surMInt(e.target.value)}
            placeholder="absente"
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Grand axe (’)
          <input
            value={saisie.aArcmin}
            onChange={(e) => saisie.surAArcmin(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Petit axe (’)
          <input
            value={saisie.bArcmin}
            onChange={(e) => saisie.surBArcmin(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Angle de position (°)
          <input
            value={saisie.posAngDeg}
            onChange={(e) => saisie.surPosAngDeg(e.target.value)}
            placeholder="absent du catalogue"
            readOnly={saisie.verrouille}
          />
        </label>
      </div>
    </section>
  )
}
