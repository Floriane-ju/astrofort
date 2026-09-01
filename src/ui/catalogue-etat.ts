/**
 * §6.4 — ce que le catalogue montre : la portée, la recherche et les deux filtres.
 *
 * T-0182 — la fiche prend la place de la liste dans le panneau, et la liste est démontée
 * pendant ce temps. Une saisie tenue par le composant partirait donc avec lui : revenir de la
 * fiche rendrait un catalogue remis à zéro, alors que le geste est « je regarde celle-là, puis
 * je reviens à ma recherche ». L'état vit ici pour cette seule raison — comme [[scene-etat]],
 * un magasin externe se lit en rendu serveur comme dans le navigateur, et se teste sans DOM.
 */

import { useSyncExternalStore } from 'react'
import { DOMAINES } from '../registry/domains.ts'
import type { TypeObjet } from '../data/deepsky.ts'

/** Les deux portées de la liste. La seconde est un sur-ensemble de contraintes, pas un tri. */
export type Portee = 'CATALOGUE' | 'PHOTOGRAPHIABLES'

export interface EtatCatalogue {
  readonly portee: Portee
  readonly recherche: string
  readonly type: TypeObjet | null
  readonly magMax: number
}

const ETAT_INITIAL: EtatCatalogue = Object.freeze({
  portee: 'CATALOGUE',
  recherche: '',
  type: null,
  // La borne du domaine, jamais un nombre écrit ici : le curseur lit le même registre.
  magMax: DOMAINES.m_int.max,
})

let etat: EtatCatalogue = ETAT_INITIAL
const abonnes = new Set<() => void>()

export function etatCatalogue(): EtatCatalogue {
  return etat
}

function abonne(notifie: () => void): () => void {
  abonnes.add(notifie)
  return () => {
    abonnes.delete(notifie)
  }
}

export function majCatalogue(retouche: Partial<EtatCatalogue>): void {
  etat = { ...etat, ...retouche }
  for (const notifie of abonnes) notifie()
}

/** Remet le catalogue dans son état de départ. Réservé aux tests. */
export function reinitialiseCatalogue(): void {
  majCatalogue(ETAT_INITIAL)
}

export function useCatalogue(): EtatCatalogue {
  return useSyncExternalStore(abonne, etatCatalogue, etatCatalogue)
}
