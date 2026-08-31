/**
 * §7 — l'heure affichée, à la minute, dans la langue de l'interface.
 *
 * T-0110 — la même fonction vivait dans `Verdicts.tsx` et dans `PlanSession.tsx`, la première
 * commentée « comme partout ailleurs » : une promesse que deux définitions ne peuvent pas
 * tenir. Un plan de séance et le verdict qui le justifie citent les mêmes créneaux ; qu'ils
 * les datent au même format n'est pas une coïncidence à entretenir à la main.
 *
 * T-0162 — la barre basse ne se contente plus d'écrire l'instant, elle le règle champ par
 * champ : le format est celui de la locale, et `partiesJour` en rend les morceaux sans le
 * réécrire — découper l'instant en compteurs ne doit pas en changer l'ordre ni la ponctuation.
 */

/** L'heure seule, sans la date : les deux bornes d'un créneau tombent dans la même nuit. */
export function heure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * T-0164 — le jour en chiffres, et non plus le mois en toutes lettres : « août » et « mai »
 * n'ont pas la même largeur, et la date de la barre basse se tire champ par champ. Un mois
 * littéral déplacerait les compteurs voisins sous le doigt d'un cran à l'autre.
 */
const OPTIONS_JOUR: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

/** L'heure à la seconde. Le défilement §3.2 avance de 2,5 min par seconde : la minute seule
 * afficherait une horloge qui saute par paliers de soixante. */
const OPTIONS_HEURE: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}

export function heureSeconde(date: Date): string {
  return date.toLocaleTimeString('fr-FR', OPTIONS_HEURE)
}

/**
 * Les morceaux du jour et de l'heure, séparateurs compris — l'ordre et la ponctuation restent
 * ceux de la locale, que ce soit « 31/08/2026 » ou une autre langue un jour.
 */
export function partiesJour(date: Date): readonly Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('fr-FR', OPTIONS_JOUR).formatToParts(date)
}

export function partiesHeure(date: Date): readonly Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('fr-FR', OPTIONS_HEURE).formatToParts(date)
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

/** Les six champs que la barre basse règle séparément. Le mois est humain : 1 à 12. */
export type ChampInstant = 'annee' | 'mois' | 'jour' | 'heure' | 'minute' | 'seconde'

/**
 * T-0162 — le même instant, un champ réécrit.
 *
 * Le jour est ramené au dernier jour du mois VISÉ, alors que les heures, les minutes et les
 * secondes débordent librement : glisser les mois depuis un 31 doit donner le 28 février et
 * non le 3 mars — le geste règle un mois, pas une durée —, tandis que glisser les heures
 * au-delà de minuit doit bel et bien changer de jour, puisque c'est un instant qu'on promène.
 */
export function dateAvec(date: Date, champ: ChampInstant, valeur: number): Date {
  const annee = champ === 'annee' ? valeur : date.getFullYear()
  const mois = (champ === 'mois' ? valeur : date.getMonth() + 1) - 1
  const heures = champ === 'heure' ? valeur : date.getHours()
  const minutes = champ === 'minute' ? valeur : date.getMinutes()
  const secondes = champ === 'seconde' ? valeur : date.getSeconds()
  // Le zéroième jour du mois suivant EST le dernier du mois visé.
  const dernierJour = new Date(annee, mois + 1, 0).getDate()
  const jour =
    champ === 'jour' ? valeur : Math.min(date.getDate(), dernierJour)
  return new Date(annee, mois, jour, heures, minutes, secondes)
}
