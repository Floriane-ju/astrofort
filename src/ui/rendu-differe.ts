/**
 * T-0025 — un rendu par geste, pas un rendu par événement.
 *
 * L'incrustation du filé est statique par nature : une image par changement de réglage,
 * redéposée par la boucle (§9.3, T-0019). Il manquait la distinction entre « le réglage a
 * changé » et « le réglage est EN TRAIN de changer ». Un panoramique réécrit l'azimut à
 * chaque `pointermove`, le curseur de durée à chaque cran de 5 min : sans ce report, chaque
 * événement de souris relance une passe complète, synchrone, sur le fil principal.
 *
 * Pendant le geste, le cadre continue de montrer l'image précédente : elle est périmée d'un
 * demi-mouvement, pas fausse — et l'écran le dit.
 *
 * Le délai vit ici plutôt qu'à l'appelant pour que le comptage soit testable : « un
 * panoramique ne déclenche qu'un seul rendu » est un critère, pas une impression.
 */

/** Repos entre deux événements au-delà duquel le geste est considéré comme terminé. */
export const DELAI_GESTE_MS = 120

export interface RenduDiffere {
  /** Changement franc — bascule, case cochée, matériel : l'image suit immédiatement. */
  maintenant(): void
  /** Geste continu en cours : le rendu attend que le réglage se pose. */
  bientot(): void
  /** Vrai tant qu'un rendu est en attente : c'est ce que l'écran annonce. */
  enAttente(): boolean
  annule(): void
}

export function renduDiffere(
  rend: () => void,
  delaiMs: number = DELAI_GESTE_MS,
): RenduDiffere {
  let minuterie: ReturnType<typeof setTimeout> | null = null

  const annule = (): void => {
    if (minuterie !== null) clearTimeout(minuterie)
    minuterie = null
  }

  return {
    annule,
    enAttente: () => minuterie !== null,
    maintenant() {
      annule()
      rend()
    },
    bientot() {
      // Chaque nouvel événement repousse l'échéance : c'est ce report qui ramène un
      // panoramique entier à un seul rendu, quel que soit le nombre de `pointermove`.
      annule()
      minuterie = setTimeout(() => {
        minuterie = null
        rend()
      }, delaiMs)
    },
  }
}
