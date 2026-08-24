/**
 * §6.4 — le catalogue tel qu'une liste le montre : ce qui décide, par objet.
 *
 * Deux étages, du moins cher au plus cher, comme `session-candidates.ts`. Celui-ci est le
 * moins cher : brillance de surface (§6.3), taille projetée sur le capteur (§6.2), hauteur
 * et azimut à l'instant affiché (§3.1). Ce ne sont que des appels aux moteurs existants et
 * une multiplication de matrice — donc il passe sur les 14 000 entrées sans éphéméride.
 *
 * La POSE REQUISE n'est pas ici, et c'est délibéré : elle demande le créneau de la nuit,
 * donc une éphéméride par cible. Elle vient de `evalueCandidate` (§8.3), appelée sur les
 * seules lignes rendues. Une seule convention d'extinction traverse ainsi l'application —
 * celle du plan de séance — et la liste ne peut pas annoncer une autre pose que lui.
 *
 * Aucun objet n'est écarté. Sous l'horizon, sans magnitude, sans dimensions : la ligne
 * existe et dit ce qui manque. C'est `filtreLignes` qui restreint, sur demande explicite.
 */

import { ficheCadrage } from './framing.ts'
import { detectabilite, type VerdictDetectabilite } from './detectability.ts'
import { applique, versSpherique, versVecteur, type Mat3 } from './mat3.ts'
import { chercheCatalogue } from './recherche-catalogue.ts'
import { evalueCandidate, preFiltre } from './session-candidates.ts'
import type { Intervalle } from './creneaux.ts'
import { normalisePoids, poidsParDefaut, type ContexteSession } from './session-types.ts'
import { K } from '../registry/constants.ts'
import { DOMAINES } from '../registry/domains.ts'
import type { VerdictCadrage } from '../registry/verdicts.ts'
import { TYPES_OBJET, type ObjetCielProfond, type TypeObjet } from '../data/deepsky.ts'

export interface LigneCible {
  readonly objet: ObjetCielProfond
  /** §3.1 — l'instant affiché par la scène. Négative sous l'horizon : la ligne reste. */
  readonly hauteurDeg: number
  readonly azimutDeg: number
  /** §6.3 — `null` quand magnitude ou dimensions manquent : rien n'est estimé. */
  readonly sbObj: number | null
  readonly verdict: VerdictDetectabilite | null
  /** §6.2 — grand et petit axes projetés sur le capteur. `null` sans dimensions. */
  readonly grandAxePx: number | null
  readonly petitAxePx: number | null
  /**
   * §6.2 — fraction du cadre occupée par le grand axe, orientation comprise. C'est la place
   * sur la photo finale, invariante au pitch : deux boîtiers de résolutions différentes au
   * même capteur donnent le même remplissage et des diamètres en pixels différents.
   */
  readonly remplissage: number | null
  readonly verdictCadrage: VerdictCadrage | null
  readonly cadrable: boolean
}

export interface EntreeLignes {
  readonly catalogue: readonly ObjetCielProfond[]
  /** `cielInstantane(site, date).matrice` — J2000 équatorial → repère horizontal du site. */
  readonly matriceCiel: Mat3
  readonly sbCiel: number
  readonly mLimOeil: number | null
  readonly dMm: number
  readonly fovHDeg: number
  readonly echApx: number
  readonly capteurHMm: number
}

/**
 * Une ligne par objet du catalogue, du plus brillant au plus faible.
 *
 * Une magnitude absente part en FIN de tri plutôt que de valoir zéro (§6.4) : la traiter
 * comme un objet de magnitude 0 mettrait les entrées les moins documentées en tête.
 */
export function lignesCatalogue(entree: EntreeLignes): readonly LigneCible[] {
  const lignes = entree.catalogue.map((objet) => ligne(objet, entree))
  return lignes.sort(
    (a, b) =>
      (a.objet.vMag ?? Number.POSITIVE_INFINITY) - (b.objet.vMag ?? Number.POSITIVE_INFINITY),
  )
}

function ligne(objet: ObjetCielProfond, entree: EntreeLignes): LigneCible {
  const horizon = versSpherique(
    applique(entree.matriceCiel, versVecteur(objet.adDeg, objet.decDeg)),
  )

  const detect = detectabilite({
    mInt: objet.vMag,
    aArcmin: objet.majAxArcmin,
    bArcmin: objet.minAxArcmin,
    typeObjet: objet.type,
    sbCiel: entree.sbCiel,
    mLimOeil: entree.mLimOeil,
    dMm: entree.dMm,
  })

  const commun = {
    objet,
    hauteurDeg: horizon.latitudeDeg,
    azimutDeg: horizon.longitudeDeg,
    sbObj: detect.sbObj.value,
    verdict: detect.verdict,
  }

  const majAxArcmin = objet.majAxArcmin
  if (majAxArcmin === null || majAxArcmin <= 0) {
    return {
      ...commun,
      grandAxePx: null,
      petitAxePx: null,
      remplissage: null,
      verdictCadrage: null,
      cadrable: false,
    }
  }

  const cadrage = ficheCadrage({
    fovHDeg: entree.fovHDeg,
    echApx: entree.echApx,
    capteurHMm: entree.capteurHMm,
    tailleMajArcmin: majAxArcmin,
    tailleMinArcmin: objet.minAxArcmin,
    posAngDeg: objet.posAngDeg,
  })

  // Le petit axe se déduit du grand par leur rapport, plutôt que de recalculer la
  // projection : un seul appel de moteur, donc un seul endroit où la formule §6.2 vit.
  // Sans petit axe au catalogue, `ficheCadrage` a déjà supposé l'objet circulaire.
  const grandAxePx = cadrage.diamPx.value
  const minAxArcmin = objet.minAxArcmin

  return {
    ...commun,
    grandAxePx,
    petitAxePx:
      minAxArcmin === null ? grandAxePx : grandAxePx * (minAxArcmin / majAxArcmin),
    remplissage: cadrage.remplissage.value,
    verdictCadrage: cadrage.verdict,
    cadrable: cadrage.faisable,
  }
}

/** §6.4 — les types RÉELLEMENT présents, jamais l'énumération complète de §6.3. */
export function typesPresents(lignes: readonly LigneCible[]): readonly TypeObjet[] {
  return TYPES_OBJET.filter((type) => lignes.some((l) => l.objet.type === type))
}

export interface FiltreListe {
  readonly type: TypeObjet | null
  /** Magnitude intégrée maximale retenue. Au maximum du domaine, le filtre ne restreint pas. */
  readonly magMax: number
  readonly recherche: string
}

/**
 * §6.4 — les trois restrictions, appliquées AVANT tout plafond d'affichage.
 *
 * Une magnitude absente ne passe le filtre de magnitude que tant qu'il est au repos : dès
 * qu'on demande « plus brillant que 8 », affirmer qu'un objet sans magnitude l'est serait
 * une estimation inventée.
 *
 * La recherche garde l'ordre de `chercheCatalogue` — préfixes d'abord, puis du plus
 * brillant au plus faible — et sa portée est celle des lignes reçues, jamais plafonnée.
 */
export function filtreLignes(
  lignes: readonly LigneCible[],
  filtre: FiltreListe,
): readonly LigneCible[] {
  const parType =
    filtre.type === null ? lignes : lignes.filter((l) => l.objet.type === filtre.type)

  const parMag =
    filtre.magMax >= DOMAINES.m_int.max
      ? parType
      : parType.filter((l) => l.objet.vMag !== null && l.objet.vMag <= filtre.magMax)

  if (filtre.recherche.trim() === '') return parMag

  const objets = parMag.map((l) => l.objet)
  const rangs = new Map(
    chercheCatalogue(objets, filtre.recherche, objets.length).map((o, i) => [o.designation, i]),
  )
  return parMag
    .filter((l) => rangs.has(l.objet.designation))
    .sort((a, b) => rangs.get(a.objet.designation)! - rangs.get(b.objet.designation)!)
}

// ---------------------------------------------------------------------------
// Second étage — la pose requise, qui coûte une éphéméride par cible
// ---------------------------------------------------------------------------

/** Ce qu'une cible photographiable ce soir demande, avec le créneau qui le permet. */
export interface PoseCible {
  readonly tRequisS: number
  readonly nPoses: number
  readonly tPoseS: number
  /** §8.2 — minutes au-dessus du seuil d'imagerie pendant la fenêtre nocturne. */
  readonly dureeCreneauMin: number
  /** §7.3 — plus d'une quand l'intégration ne tient pas dans le créneau de la nuit. */
  readonly nNuits: number
}

/**
 * §6.4 — les cibles photographiables ce soir, et le temps que chacune demande.
 *
 * Photographiable ne veut pas dire « levée maintenant ». Le PRD l'interdit explicitement :
 * filtrer sur la hauteur instantanée ferait disparaître une cible qui sera excellente dans
 * deux heures. Le critère est le CRÉNEAU — un passage au-dessus du seuil d'imagerie pendant
 * la fenêtre nocturne, un cadrage que le capteur tient, une intégration à portée.
 *
 * Rien de tout cela n'est recalculé ici : `evalueCandidate` (§8.3) le fait déjà pour le plan
 * de séance, extinction par masse d'air moyenne du créneau et Lune au milieu du créneau
 * comprises. Réemployer ce moteur est ce qui garantit que la liste et le plan annoncent la
 * MÊME pose pour la même cible — le désaccord que T-0089 a corrigé une fois.
 */
export function posesRequises(
  contexte: ContexteSession,
  catalogue: readonly ObjetCielProfond[],
): ReadonlyMap<string, PoseCible> {
  const poses = new Map<string, PoseCible>()
  const debut = contexte.nuit.debutReference
  const fin = contexte.nuit.finReference
  if (debut === null || fin === null) return poses

  // Les trois dérivations que `planSession` fait de son contexte, refaites à l'identique
  // plutôt que reçues en paramètre : un appelant libre de les fournir est un appelant libre
  // de les fournir autrement, donc d'annoncer une pose que le plan ne reconnaît pas.
  const fenetre: Intervalle = { debut, fin }
  const sbCielBase = contexte.sbCielNoir - contexte.nuit.penaliteSbMag
  const poids = normalisePoids(contexte.poids ?? poidsParDefaut())
  const { candidates } = preFiltre(contexte, catalogue, K('CIBLES_EVALUEES_MAX'))

  for (const objet of candidates) {
    const r = evalueCandidate(contexte, objet, fenetre, sbCielBase, poids)
    if (!('objet' in r)) continue
    poses.set(objet.designation, {
      tRequisS: r.integration.tRequisS.value,
      nPoses: r.integration.nPoses.value,
      tPoseS: r.pose.tAfficheeS,
      dureeCreneauMin: r.creneau.dureeTotaleMin.value,
      nNuits: r.integration.nNuits?.value ?? 1,
    })
  }

  return poses
}
