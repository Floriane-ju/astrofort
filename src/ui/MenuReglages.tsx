/**
 * T-0047 — la roue crantée de la barre haute.
 *
 * Le choix brut dans le catalogue n'est plus la façon normale de désigner une cible : T-0045
 * met la liste des visibles à sa place dans l'onglet Cible. Il ne disparaît pas pour autant —
 * parcourir le catalogue reste utile — mais il quitte le chemin principal pour ce tiroir.
 *
 * Le patron est celui de `MenuInfos` : un `<details>` natif porte l'état ouvert/fermé, le
 * clavier et l'annonce ; le seul JavaScript est la fermeture à Échap, que `<details>` ne fait
 * pas de lui-même.
 *
 * T-0053 — le catalogue se cherche au lieu de se dérouler. `<input list>` + `<datalist>`,
 * natifs : le navigateur porte la liste déroulante, la navigation clavier, le filtrage à la
 * frappe et l'annonce aux lecteurs d'écran. Aucune bibliothèque de combobox, aucun
 * `aria-activedescendant`, aucun gestionnaire de focus. Le `<datalist>` ne porte que les
 * résultats de la frappe en cours — une poignée d'options, pas 14 000 nœuds — et ce qui est
 * cherchable n'est plus plafonné pour autant : la portée est celle de `chercheCatalogue`.
 *
 * Le choix appelle `ouvreCible`, le chemin qu'emprunte déjà un clic sur la scène : il garnit
 * la fiche *et* amène l'onglet Cible au premier plan. Depuis la barre haute, c'est exactement
 * le geste attendu — sinon on choisirait un objet sans rien voir se passer.
 */

import { useState } from 'react'
import { chercheCatalogue } from '../core/recherche-catalogue.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { libelleObjet } from './libelles-objet.ts'
import { ouvreCible } from './seance-etat.ts'

/**
 * Combien de résultats le `<datalist>` porte à la fois. Ce n'est pas une fenêtre sur le
 * catalogue : la recherche, elle, va au bout des ~14 000 entrées (T-0052).
 */
const RESULTATS_RENDUS_MAX = 30

const ID_LISTE = 'catalogue-objets'

/**
 * Résolution avant `ouvreCible` : un champ libre accepte n'importe quoi. Seule une
 * désignation exacte du catalogue ouvre une fiche — validation d'entrée à la frontière, pas
 * un détail d'ergonomie.
 */
export function objetDesigne(
  catalogue: readonly ObjetCielProfond[],
  saisie: string,
): ObjetCielProfond | null {
  const designation = saisie.trim()
  if (designation === '') return null
  return catalogue.find((o) => o.designation === designation) ?? null
}

export interface OptionsCatalogueProps {
  readonly catalogue: readonly ObjetCielProfond[]
  readonly saisie: string
}

/**
 * Les options de la frappe en cours. `<datalist>` insère l'attribut `value` dans le champ et
 * ne montre le contenu textuel qu'en aide à la lecture : la désignation seule est la valeur,
 * sinon la saisie retenue serait « M45 — Pléiades · amas ouvert · mag 1.6 », qu'aucune
 * recherche ultérieure ne retrouverait.
 *
 * Le contenu textuel porte `libelleObjet` en entier, désignation comprise : les navigateurs
 * qui n'affichent que ce texte — et non la valeur à côté — laissaient sinon la liste sans son
 * « M47 ». La répétition chez ceux qui montrent les deux coûte moins qu'une liste anonyme.
 */
export function OptionsCatalogue(props: OptionsCatalogueProps) {
  return (
    <>
      {chercheCatalogue(props.catalogue, props.saisie, RESULTATS_RENDUS_MAX).map((o) => (
        <option key={o.designation} value={o.designation}>
          {libelleObjet(o)}
        </option>
      ))}
    </>
  )
}

export interface MenuReglagesProps {
  readonly catalogue: readonly ObjetCielProfond[]
}

export function MenuReglages(props: MenuReglagesProps) {
  const [saisie, setSaisie] = useState('')
  const [introuvable, setIntrouvable] = useState(false)

  /** Une saisie qui ne désigne aucun objet n'ouvre rien et le dit. */
  function valide(texte: string) {
    const objet = objetDesigne(props.catalogue, texte)
    if (objet === null) {
      setIntrouvable(texte.trim() !== '')
      return
    }
    setSaisie('')
    setIntrouvable(false)
    ouvreCible(objet)
  }

  return (
    <details
      className="tiroir tiroir-reglages"
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.removeAttribute('open')
      }}
    >
      <summary>⚙ Réglages</summary>

      <div className="tiroir-contenu">
        {props.catalogue.length === 0 ? (
          <p className="etat">
            Les catalogues ne sont pas encore vérifiés : aucune entrée n’est proposée tant
            qu’un paquet n’a pas passé son contrôle d’intégrité.
          </p>
        ) : (
          <>
            <label>
              Chercher dans le catalogue
              <input
                type="text"
                list={ID_LISTE}
                value={saisie}
                placeholder="M45, pléiades, NGC0224… (Entrée pour ouvrir)"
                // Frapper ne choisit rien : « M » puis « 1 » forme « M1 », une désignation
                // valide, et ouvrait la fiche au milieu d'une saisie plus longue. Chercher et
                // choisir sont deux gestes distincts — seul Entrée engage la cible.
                onChange={(e) => {
                  setSaisie(e.target.value)
                  setIntrouvable(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') valide(saisie)
                }}
              />
            </label>
            <datalist id={ID_LISTE}>
              <OptionsCatalogue catalogue={props.catalogue} saisie={saisie} />
            </datalist>
            {introuvable && (
              <p className="cause">
                Aucun objet du catalogue ne porte cette désignation : choisissez une entrée
                proposée.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  )
}
