/**
 * §9.1 — Pose maximale à étoiles ponctuelles, par région du ciel.
 *
 * IL N'EXISTE PAS UNE POSE MAX, MAIS UNE POSE MAX PAR DÉCLINAISON. Sur un grand champ, la
 * déclinaison varie de plusieurs dizaines de degrés d'un bord du cadre à l'autre : la sortie
 * est une carte, et la valeur retenue est celle de la zone la plus contraignante, c'est-à-dire
 * de plus faible déclinaison absolue.
 *
 * La grille est celle du cadre matériel, projetée par la même inverse gnomonique que §3.5 :
 * la déclinaison d'une cellule n'est pas interpolée, elle est calculée.
 */

import { K } from '../registry/constants.ts'
import { DEG, applique, transpose, type Vec3 } from './mat3.ts'
import { matriceVue } from './projection.ts'
import { npf, type ToleranceNpf } from './tracking.ts'
import { trace, type Traced } from './traced.ts'

const POLE_DEG = 90

export interface EntreeCartePose {
  readonly focaleMm: number
  readonly ouvertureN: number
  readonly pitchUm: number
  /** Champs du cadre matériel (§5.1), grande puis petite dimension. */
  readonly fovLDeg: number
  readonly fovHDeg: number
  readonly centreAdDeg: number
  readonly centreDecDeg: number
  readonly rotationDeg: number
  readonly tolerance?: ToleranceNpf
  /** §5.2 — renseigné quand le suivi est actif : la pose opérante cesse d'être la NPF. */
  readonly tMaxSuiviS?: number | null
}

export interface CellulePose {
  /** Position dans le cadre, de −1 (gauche, bas) à +1 (droite, haut). */
  readonly uFrac: number
  readonly vFrac: number
  readonly decDeg: number
  /** `null` au pôle exact : la NPF y diverge et cesse d'être la contrainte. */
  readonly tNpfS: number | null
}

export type RegimeGrandChamp = 'NPF' | 'SUIVI'

export interface CartePoseMax {
  readonly cellules: readonly CellulePose[]
  /** Côté de la grille : les cellules sont rangées ligne par ligne, du haut vers le bas. */
  readonly cote: number
  readonly tMaxCadreS: Traced<number | null>
  readonly zoneLimitante: string
  readonly decMinAbsDeg: number
  readonly decMaxAbsDeg: number
  /** Pose réellement opérante : NPF sans suivi, plafond de monture avec (§5.2). */
  readonly poseOperanteS: number | null
  readonly regime: RegimeGrandChamp
  readonly messages: readonly string[]
}

/** Pose d'une cellule pour la comparaison : au pôle exact, la NPF ne borne plus rien. */
function pose(tNpfS: number | null): number {
  return tNpfS ?? Infinity
}

function nommeZone(uFrac: number, vFrac: number, decDeg: number): string {
  const vertical = vFrac > 0 ? 'bord haut' : vFrac < 0 ? 'bord bas' : 'milieu'
  const horizontal = uFrac > 0 ? 'à droite' : uFrac < 0 ? 'à gauche' : 'au centre'
  return `${vertical} ${horizontal}, δ = ${decDeg.toFixed(0)}°`
}

/**
 * Carte de pose maximale du cadre. Chaque cellule porte sa déclinaison réelle, obtenue par
 * l'inverse gnomonique du cadre — c'est la projection physique d'un objectif rectilinéaire,
 * la même qu'en §3.5.
 */
export function cartePoseMax(entree: EntreeCartePose): CartePoseMax {
  const cote = Math.max(1, Math.round(K('CELLULES_CARTE_POSE')))
  const uMax = Math.tan((entree.fovLDeg / 2) * DEG)
  const vMax = Math.tan((entree.fovHDeg / 2) * DEG)
  const versEquatorial = transpose(
    matriceVue(entree.centreAdDeg, entree.centreDecDeg, entree.rotationDeg),
  )

  const cellules: CellulePose[] = []
  let limitante: CellulePose | null = null
  let plusLongue: CellulePose | null = null
  let decMinAbs = POLE_DEG
  let decMaxAbs = 0

  for (let ligne = 0; ligne < cote; ligne++) {
    // Ligne 0 en haut du cadre : v décroît quand la ligne augmente.
    const vFrac = cote === 1 ? 0 : 1 - (2 * ligne) / (cote - 1)
    for (let colonne = 0; colonne < cote; colonne++) {
      const uFrac = cote === 1 ? 0 : (2 * colonne) / (cote - 1) - 1
      const u = uFrac * uMax
      const v = vFrac * vMax
      const norme = Math.hypot(u, v, 1)
      const local: Vec3 = { x: u / norme, y: v / norme, z: 1 / norme }
      const equatorial = applique(versEquatorial, local)
      const decDeg =
        Math.asin(Math.max(-1, Math.min(1, equatorial.z))) / DEG
      const tNpfS = npf({
        focaleMm: entree.focaleMm,
        ouvertureN: entree.ouvertureN,
        pitchUm: entree.pitchUm,
        decDeg,
        ...(entree.tolerance === undefined ? {} : { tolerance: entree.tolerance }),
      }).value
      const cellule: CellulePose = { uFrac, vFrac, decDeg, tNpfS }
      cellules.push(cellule)

      const absolue = Math.abs(decDeg)
      if (absolue < decMinAbs) decMinAbs = absolue
      if (absolue > decMaxAbs) decMaxAbs = absolue
      if (tNpfS !== null && (limitante === null || tNpfS < limitante.tNpfS!)) limitante = cellule
      // Le pôle exact, sans NPF définie, tient les poses les plus longues du cadre : sa
      // cellule l'emporte sur toutes les autres.
      if (plusLongue === null || pose(tNpfS) > pose(plusLongue.tNpfS)) plusLongue = cellule
    }
  }

  const zone = limitante as CellulePose | null
  const tMaxCadreS = trace({
    value: zone === null ? null : zone.tNpfS,
    formula: 'POSE_MAX_CADRE',
    inputs: {
      dec_min_abs_deg: decMinAbs,
      focale_mm: entree.focaleMm,
      ouverture_N: entree.ouvertureN,
      pitch_um: entree.pitchUm,
    },
    constants: [
      'NPF_COEF_OUVERTURE',
      'NPF_COEF_PITCH',
      entree.tolerance === 'TOLERANT' ? 'NPF_K_TOLERANT' : 'NPF_K_STRICT',
    ],
    ...(zone === null
      ? {
          flags: ['HORS_DOMAINE' as const],
          note:
            'Le cadre ne contient que le pôle céleste exact : la NPF y diverge et ne limite ' +
            'plus la pose.',
        }
      : {}),
  })

  const suiviActif = entree.tMaxSuiviS !== undefined && entree.tMaxSuiviS !== null
  const regime: RegimeGrandChamp = suiviActif ? 'SUIVI' : 'NPF'
  const poseOperanteS = suiviActif ? entree.tMaxSuiviS! : (zone?.tNpfS ?? null)

  const messages: string[] = []
  const longue = plusLongue
  // L'avertissement porte sur la zone la plus polaire du cadre, celle où la NPF cesse d'être
  // la contrainte — c'est là qu'il est utile, que le reste du cadre la suive ou non.
  if (longue !== null && pose(longue.tNpfS) >= K('POSE_LONGUE_AVERTISSEMENT_S')) {
    const global = zone === null || zone.tNpfS! >= K('POSE_LONGUE_AVERTISSEMENT_S')
    messages.push(
      `${global ? 'Sur tout le cadre' : 'Près du pôle, dans ce cadre'}, la pose tolérée dépasse ` +
        `${K('POSE_LONGUE_AVERTISSEMENT_S')} s : le filé cesse d’y être la contrainte, ce sont ` +
        'le bruit thermique du capteur et le fond de ciel qui limitent désormais la pose.',
    )
  }
  if (suiviActif) {
    messages.push(
      'Suivi actif : la NPF reste affichée à titre informatif, mais la pose opérante devient ' +
        'le plafond de la monture (§5.2), qui dépend de la mise en station et de l’erreur ' +
        'périodique, pas de la rotation du ciel.',
    )
  }

  return {
    cellules,
    cote,
    tMaxCadreS,
    zoneLimitante: zone === null ? 'aucune : le cadre ne contient que le pôle' : nommeZone(zone.uFrac, zone.vFrac, zone.decDeg),
    decMinAbsDeg: decMinAbs,
    decMaxAbsDeg: decMaxAbs,
    poseOperanteS,
    regime,
    messages,
  }
}

/**
 * §9.1 — traînée réellement inscrite sur le capteur pour une pose donnée. C'est elle qui
 * ovalise les étoiles dans la prévisualisation de §9.2 quand la pose dépasse la pose max.
 */
export function traceePx(tPoseS: number, decDeg: number, echApx: number): Traced<number> {
  // Un degré par heure vaut une arcseconde par seconde : la rotation du ciel se lit
  // directement en arcsecondes par seconde de pose, sans conversion.
  const traceArcsec = K('ROTATION_CIEL_DEG_H') * tPoseS * Math.cos(decDeg * DEG)
  return trace({
    value: traceArcsec / echApx,
    formula: 'TRACE',
    inputs: { t_pose_s: tPoseS, dec_deg: decDeg, ech_apx: echApx },
    constants: ['ROTATION_CIEL_DEG_H'],
  })
}
