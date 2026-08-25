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

/** Le jour en toutes lettres : la barre basse date l'instant, pas seulement l'heure. */
export function jourLong(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** L'heure à la seconde. Le défilement §3.2 avance de 2,5 min par seconde : la minute seule
 * afficherait une horloge qui saute par paliers de soixante. */
export function heureSeconde(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const deuxChiffres = (n: number): string => String(n).padStart(2, '0')

/**
 * Le jour LOCAL au format ISO. `toISOString().slice(0, 10)` donnerait le jour UTC : après
 * minuit UTC en été, il désigne la nuit suivante — pas celle qu'on observe (piège A1).
 */
export function jourLocalIso(date: Date): string {
  return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
}

/** `YYYY-MM-DDTHH:mm:ss` en heure locale — la forme qu'attend `<input type="datetime-local">`. */
export function pourChampDateHeure(date: Date): string {
  const h = deuxChiffres(date.getHours())
  const m = deuxChiffres(date.getMinutes())
  const s = deuxChiffres(date.getSeconds())
  return `${jourLocalIso(date)}T${h}:${m}:${s}`
}
