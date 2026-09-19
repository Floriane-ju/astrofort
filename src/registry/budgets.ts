/**
 * §3.2 et §1.5.1 — Budgets de réactivité de l'interface.
 *
 * §3.2 chiffre l'animation (50 Hz) et §1.5.1 la séance (un plan en moins de deux minutes).
 * Aucun des deux ne dit ce qu'une FRAPPE a le droit de coûter, et c'est pourtant là que les
 * deux se paient : une saisie qui recalcule toute la nuit dans le rendu de la touche les rend
 * inatteignables sans qu'aucun critère du PRD soit formellement violé.
 *
 * Ces valeurs ne sont pas des grandeurs physiques — aucune formule n'en dépend, aucun verdict
 * ne les cite. Elles vivent donc à côté de §2.1 plutôt que dedans, comme `imagerie.ts`. Ce
 * qu'elles gardent est la règle du projet : un seuil écrit dans le banc qui le mesure n'est
 * plus un seuil, c'est une constatation.
 */

export interface ValeurBudget {
  readonly valeur: number
  readonly unite: string
  readonly source: string
  readonly tolerance: string
}

function valeur(v: ValeurBudget): ValeurBudget {
  return Object.freeze(v)
}

export const BUDGETS = Object.freeze({
  /**
   * Ce qu'un caractère tapé a le droit de coûter, bridage compris.
   *
   * Le repère n'est pas le confort, c'est la cadence de frappe soutenue : au-delà de ce délai
   * la touche suivante arrive avant que la précédente soit peinte, et la saisie décroche. Ce
   * n'est pas une gêne subjective — c'est le symptôme que T-0291 a mesuré, 486 à 692 ms par
   * caractère en configuration télescope.
   */
  FRAPPE_MS: valeur({
    valeur: 50,
    unite: 'ms',
    source: 'convention d’interaction — sous l’intervalle d’une frappe soutenue (~7 car./s)',
    tolerance: 'sans objet — budget d’interface, pas une grandeur mesurée',
  }),

  /**
   * Le bridage sous lequel le budget vaut.
   *
   * Les mesures de T-0255 sont prises à ×4 parce que c'est la classe de machine que §11.2
   * vise — une tablette sur le terrain, pas la station de développement. Un banc qui tourne
   * sans bridage divise donc son budget par ce facteur avant de conclure.
   */
  BRIDAGE_CPU: valeur({
    valeur: 4,
    unite: '—',
    source: 'classe de machine visée §11.2 — tablette, mesurée au bridage ×4 du navigateur',
    tolerance: 'sans objet — conversion entre machine de mesure et machine visée',
  }),
} satisfies Record<string, ValeurBudget>)

export type IdBudget = keyof typeof BUDGETS

/** Lecture d'une valeur, sur le modèle de `K()` du registre §2.1. */
export function B(id: IdBudget): number {
  return BUDGETS[id].valeur
}
