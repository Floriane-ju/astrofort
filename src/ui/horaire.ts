/**
 * §7 — l'heure affichée, à la minute, dans la langue de l'interface.
 *
 * T-0110 — la même fonction vivait dans `Verdicts.tsx` et dans `PlanSession.tsx`, la première
 * commentée « comme partout ailleurs » : une promesse que deux définitions ne peuvent pas
 * tenir. Un plan de séance et le verdict qui le justifie citent les mêmes créneaux ; qu'ils
 * les datent au même format n'est pas une coïncidence à entretenir à la main.
 */

/** L'heure seule, sans la date : les deux bornes d'un créneau tombent dans la même nuit. */
export function heure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
