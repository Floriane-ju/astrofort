/**
 * T-0044 — ce que le ciel offre à cet instant, pour ce setup.
 *
 * Les deux moitiés existaient séparément : la conversion J2000 → horizon, faite à l'envers
 * dans `src/ui/dessine-ciel.ts` pour peindre les corps, et le verdict de portée rendu par
 * `detectabilite`. Ce module les met bout à bout sur le catalogue entier — c'est tout ce
 * qu'il fait. Aucun moteur nouveau, aucune formule ajoutée.
 *
 * Le cadrage n'entre pas dans le filtre : un objet trop grand ou trop petit pour le capteur
 * déclaré reste listé. `ciblesDansFenetre` (`framing.ts`) répond à une autre question.
 *
 * `PHOTO_SEULE` est un verdict, pas un refus : cette liste le porte comme les trois autres.
 */

import { detectabilite, type VerdictDetectabilite } from './detectability.ts'
import { applique, versSpherique, versVecteur, type Mat3 } from './mat3.ts'
import { TYPES_OBJET, type ObjetCielProfond, type TypeObjet } from '../data/deepsky.ts'

export interface CibleVisible {
  readonly objet: ObjetCielProfond
  readonly azimutDeg: number
  readonly hauteurDeg: number
  readonly verdict: VerdictDetectabilite
}

export interface EntreeCiblesVisibles {
  readonly catalogue: readonly ObjetCielProfond[]
  /** `cielInstantane(site, date).matrice` — J2000 équatorial → repère horizontal du site. */
  readonly matriceCiel: Mat3
  readonly sbCiel: number
  readonly mLimOeil: number | null
  readonly dMm: number
}

/**
 * Les objets du catalogue au-dessus de l'horizon à l'instant porté par la matrice, pour
 * lesquels le setup produit un verdict, du plus brillant au plus faible.
 *
 * Deux motifs d'exclusion, et deux seulement : sous l'horizon, ou verdict incalculable
 * faute de magnitude ou de dimensions au catalogue.
 */
export function ciblesVisibles(entree: EntreeCiblesVisibles): readonly CibleVisible[] {
  const { catalogue, matriceCiel, sbCiel, mLimOeil, dMm } = entree
  const retenues: CibleVisible[] = []

  for (const objet of catalogue) {
    const horizon = versSpherique(
      applique(matriceCiel, versVecteur(objet.adDeg, objet.decDeg)),
    )
    if (horizon.latitudeDeg <= 0) continue

    const { verdict } = detectabilite({
      mInt: objet.vMag,
      aArcmin: objet.majAxArcmin,
      bArcmin: objet.minAxArcmin,
      typeObjet: objet.type,
      sbCiel,
      mLimOeil,
      dMm,
    })
    if (verdict === null) continue

    retenues.push({
      objet,
      azimutDeg: horizon.longitudeDeg,
      hauteurDeg: horizon.latitudeDeg,
      verdict,
    })
  }

  // Le tri est sûr : un objet sans magnitude n'a pas pu arriver ici, `detectabilite` l'a
  // écarté faute de verdict.
  return retenues.sort((a, b) => (a.objet.vMag ?? 0) - (b.objet.vMag ?? 0))
}

/**
 * T-0050 — les types d'objet réellement levés, dans l'ordre du catalogue.
 *
 * Le filtre se pose sur ceux-là, pas sur les dix de `TYPES_OBJET` : proposer « nébuleuse
 * obscure » quand aucune n'est levée est une impasse offerte à l'utilisateur.
 */
export function typesPresents(visibles: readonly CibleVisible[]): readonly TypeObjet[] {
  return TYPES_OBJET.filter((type) => visibles.some((c) => c.objet.type === type))
}

/**
 * T-0050 — les cibles d'un type, ou toutes quand aucun type n'est retenu.
 *
 * Le filtrage tombe **avant** le plafond de la liste : filtrer les 200 plus brillantes ne
 * dirait rien du ciel.
 */
export function parType(
  visibles: readonly CibleVisible[],
  type: TypeObjet | null,
): readonly CibleVisible[] {
  return type === null ? visibles : visibles.filter((c) => c.objet.type === type)
}
