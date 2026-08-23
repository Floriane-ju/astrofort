/**
 * §9.2, §9.3 et §9.5 — ce que la scène doit DIRE de l'aperçu qu'elle porte.
 *
 * Depuis T-0116 la passe de filé ne passe plus par ici : elle se dessine à même le canevas du
 * planétarium, dans la boucle, par `dessineChamp`. Ne restent que les deux mentions que le
 * panneau doit afficher, parce qu'elles portent sur un écart entre ce que la scène montre et
 * ce que le capteur enregistrerait — un écart qui se déclare, il ne se corrige pas en douce.
 */

import { K } from '../registry/constants.ts'
import type { ModeProjection } from '../core/projection.ts'

/**
 * §9.2 — le vignettage n'est pas peint sur la scène : il se centre sur le canevas, et le
 * canevas n'est pas le capteur. Appliqué au ciel, il assombrirait les coins du PLANÉTARIUM,
 * pas ceux de l'image. Son chiffre en diaphragmes reste lisible au panneau.
 */
export const MENTION_VIGNETTAGE_FILE =
  'Vignettage non peint sur la scène : il appartient au cadre du capteur, pas au ciel. ' +
  'Son atténuation en diaphragmes reste chiffrée ci-dessus.'

/**
 * §9.3 — T-0118 : le plafond du filé est déclaré, jamais silencieux. Sans cette phrase, un ciel
 * plafonné se lit comme un ciel pauvre, donc comme un bug de rendu. Elle reste affichée tant
 * que l'aperçu est en filé, puisque le plafond, lui, ne bouge pas — ni sous la main, ni au
 * repos.
 */
export const MENTION_PLAFOND_FILE =
  `L’aperçu du filé lit au plus ${K('BUDGET_ETOILES_FILE').toLocaleString('fr-FR')} étoiles ` +
  'sur tout le champ : le capteur en enregistrerait davantage, mais à cette profondeur les ' +
  'étoiles faibles ne laissent pas de trace lisible — elles ne coûteraient que du temps de ' +
  'calcul. Les compteurs disent ce qui est peint, pas ce que la pose atteindrait.'

/** §5.1 — la projection de la scène n'est pas toujours celle que l'objectif produirait. */
export function mentionProjection(
  modeScene: ModeProjection,
  modeObjectif: ModeProjection,
): string | null {
  if (modeScene === modeObjectif) return null
  return (
    'La scène est en projection de planétarium ; l’objectif déclaré, lui, produirait une ' +
    `projection ${modeObjectif === 'MODE_FISHEYE' ? 'équidistante' : 'gnomonique'}. ` +
    'Le contenu du cadre est donc à la bonne place dans le ciel, mais déformé autrement que ' +
    'sur le capteur. « Voir comme l’objectif » recadre la scène sur le champ du cadre.'
  )
}
