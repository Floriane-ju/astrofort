/**
 * §3.4 — Composition des labels.
 *
 * HIÉRARCHIE PAR ZOOM
 *   fov > 40°   noms de constellations uniquement
 *   10° à 40°   + désignations Bayer des étoiles de mag ≤ 3,5
 *   fov < 10°   + noms propres et désignations des objets du ciel profond
 *
 * Densité plafonnée à 25 labels simultanés, priorité à la magnitude, anti-chevauchement
 * obligatoire. Un champ dense sans ces deux règles produit une bouillie illisible ; c'est
 * une contrainte de lecture, pas une optimisation.
 */

import { K } from '../registry/constants.ts'

export type CategorieLabel = 'CONSTELLATION' | 'ETOILE' | 'OBJET'

export interface CandidatLabel {
  readonly texte: string
  readonly categorie: CategorieLabel
  readonly xPx: number
  readonly yPx: number
  /** Plus petit = plus prioritaire. La magnitude s'y verse directement. */
  readonly priorite: number
  readonly largeurPx: number
  readonly hauteurPx: number
  /** Teinte propre au label, quand la couleur de texte commune ne le rattacherait à rien. */
  readonly couleur?: string
}

/** Catégories admises au champ donné. */
export function categoriesActives(fovDeg: number): ReadonlySet<CategorieLabel> {
  const actives: CategorieLabel[] = ['CONSTELLATION']
  if (fovDeg <= K('FOV_LABELS_CONSTELLATIONS_DEG')) actives.push('ETOILE')
  if (fovDeg < K('FOV_LABELS_OBJETS_DEG')) actives.push('OBJET')
  return new Set(actives)
}

function chevauche(a: CandidatLabel, b: CandidatLabel): boolean {
  return (
    Math.abs(a.xPx - b.xPx) * 2 < a.largeurPx + b.largeurPx &&
    Math.abs(a.yPx - b.yPx) * 2 < a.hauteurPx + b.hauteurPx
  )
}

/**
 * Retient les labels affichables : catégories du zoom, priorité à la magnitude, aucun
 * chevauchement, au plus `LABELS_MAX`. Un label écarté l'est par manque de place, jamais
 * par troncature arbitraire de la liste d'entrée.
 */
export function composeLabels(
  candidats: readonly CandidatLabel[],
  fovDeg: number,
): readonly CandidatLabel[] {
  const actives = categoriesActives(fovDeg)
  const eligibles = candidats
    .filter((c) => actives.has(c.categorie))
    .slice()
    .sort((a, b) => a.priorite - b.priorite)

  const retenus: CandidatLabel[] = []
  for (const candidat of eligibles) {
    if (retenus.length >= K('LABELS_MAX')) break
    if (retenus.some((r) => chevauche(r, candidat))) continue
    retenus.push(candidat)
  }
  return retenus
}

/** §3.4 — seules les étoiles de magnitude ≤ 3,5 portent leur désignation Bayer. */
export function etoileLabellisable(magV: number): boolean {
  return magV <= K('MAG_LABEL_BAYER_MAX')
}
