/**
 * §8.3 et §9.4 — le rappel qui remplace le budget batterie chiffré (C-16, T-0150/T-0151).
 *
 * L'application ne modélise plus aucune autonomie : l'autonomie CIPA se mesure en rafale au
 * flash, la température prévue se saisit à la main, et le produit des deux donnait à un ordre
 * de grandeur l'allure d'une prédiction. Ce qui reste vrai, et qu'elle calcule elle-même,
 * c'est la durée de prise de vue. Au-delà du seuil, elle rappelle le risque et s'arrête là.
 */

import { K } from '../registry/constants.ts'
import { dureeLisible } from './exposure.ts'

const S_PAR_MIN = 60

/** `null` sous le seuil : un rappel affiché sur toute séance ne serait plus un rappel. */
export function rappelBatterie(dureeMin: number): string | null {
  const seuil = K('DUREE_RAPPEL_BATTERIE_MIN')
  if (!Number.isFinite(dureeMin) || dureeMin <= seuil) return null
  return (
    `Attention à la batterie : ${dureeLisible(dureeMin * S_PAR_MIN)} de prise de vue, au-delà ` +
    `des ${seuil} min à partir desquelles une charge unique devient juste. Prévoir de quoi ` +
    'tenir la nuit — l’application ne chiffre aucune autonomie, elle serait fausse.'
  )
}
