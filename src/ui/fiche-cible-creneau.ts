/**
 * §8.2 côté fiche — T-0222 : quand photographier la cible cette nuit.
 *
 * Le créneau n'est pas recalculé à la façon de la fiche : fenêtre, masque, seuil et monture
 * passent par `prepareEvaluation` et `entreeCreneau`, les deux mêmes portes que le plan de
 * séance. Une fiche qui annoncerait 22 h – 3 h quand le plan alloue 23 h – 2 h pour la même
 * cible serait un désaccord de plus, de ceux que T-0089 a déjà dû corriger.
 */

import { prepareEvaluation } from '../core/cibles-liste.ts'
import { creneauCible, type CreneauCible } from '../core/creneaux.ts'
import { entreeCreneau } from '../core/session-candidates.ts'
import type { ContexteSession } from '../core/session-types.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'

export type CreneauFiche =
  | { readonly chiffre: true; readonly creneau: CreneauCible }
  | { readonly chiffre: false; readonly cause: string }

export const CAUSE_NUIT_NON_CHIFFREE =
  'La nuit n’est pas chiffrable pour ce lieu et cette date, ou le matériel est incomplet : ' +
  'aucun créneau photo n’est annoncé plutôt qu’un créneau inventé.'

export function creneauFiche(
  contexte: ContexteSession | null,
  objet: ObjetCielProfond,
): CreneauFiche {
  const entree = contexte === null ? null : prepareEvaluation(contexte)
  if (contexte === null || entree === null) return { chiffre: false, cause: CAUSE_NUIT_NON_CHIFFREE }
  return { chiffre: true, creneau: creneauCible(entreeCreneau(contexte, objet, entree.fenetre)) }
}
