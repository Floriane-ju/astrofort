/**
 * T-0208 — §4.1 et §5.1 : la frontière entre le TEXTE tapé à l'écran et le NOMBRE qu'un
 * moteur reçoit.
 *
 * Elle existe parce qu'elle manquait : la saisie du lieu descendait dans la chaîne de calcul
 * par un `Number()` nu, et une latitude de 456° atteignait `astronomy-engine`, qui lève une
 * chaîne de caractères — pas une `Error`. Une levée en rendu démonte l'arbre React : l'écran
 * devenait noir.
 *
 * Le texte saisi n'est pas corrigé, seulement la valeur consommée. Réécrire le champ à la
 * frappe empêcherait de taper « 45.6 », dont « 456 » est un état transitoire légitime.
 */

import { borne, nombreDeTexte, type Bornage, type DomaineId } from '../registry/domains.ts'

/** La lecture du texte — champ vide, virgule décimale — appartient au registre (T-0274). */
export function nombreSaisi(champ: DomaineId, texte: string): Bornage {
  return borne(champ, nombreDeTexte(texte))
}

/**
 * Un champ optionnel : vide, la grandeur est déclarée inconnue (§2.3) et rien n'est refusé.
 * Renseignée hors plage, elle est bornée comme les autres.
 */
export function nombreSiRenseigne(
  champ: DomaineId,
  texte: string,
): { readonly valeur: number | undefined; readonly refus: string | null } {
  if (texte.trim() === '') return { valeur: undefined, refus: null }
  return nombreSaisi(champ, texte)
}

/**
 * Les causes d'un groupe de champs, en une phrase. Deux champs hors plage disent deux fois
 * la même chose quand ils partagent un domaine : le doublon est retiré, pas la seconde cause.
 */
export function refusDe(
  ...bornages: readonly { readonly refus: string | null }[]
): string | null {
  const causes = [...new Set(bornages.map((b) => b.refus).filter((r) => r !== null))]
  return causes.length === 0 ? null : causes.join(' ')
}
