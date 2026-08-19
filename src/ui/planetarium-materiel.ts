/** §9 — ce que la scène doit savoir du filé pour l'incruster dans le cadre. */

import type { EntreeProfondeur } from '../core/galactique.ts'

export interface MaterielFile {
  readonly profondeur: EntreeProfondeur
  readonly echApx: number
  readonly sbCiel: number
  /** §5.2 — plafond de la monture quand le suivi est actif, `null` sinon. */
  readonly tMaxSuiviS: number | null
}
