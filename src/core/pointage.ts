/**
 * §8.4 — Cheminement d'étoiles et carte de pointage.
 *
 * Le chaînon entre « l'application recommande une cible » et « la cible est dans le cadre »,
 * pour une monture motorisée sans pointage automatique.
 *
 * Le besoin dépend du champ. Un objectif de 120 mm sur plein format couvre 17° : à cette
 * échelle, le cheminement traditionnel — sauts successifs dans un chercheur étroit — est
 * surdimensionné, le cadre contient toujours plusieurs étoiles brillantes. Sous 8°, le
 * cheminement redevient nécessaire.
 *
 * L'ORIENTATION EST UNE SORTIE, PAS UN DÉTAIL. Le champ tourne au cours de la nuit dans le
 * référentiel de l'observateur : un schéma non orienté est inutilisable dans le noir.
 *
 * LA MISE EN STATION RESTE À LA CHARGE DE L'UTILISATEUR. L'application aide à trouver les
 * objets ; elle ne prétend ni mesurer ni corriger l'installation.
 */

import { K } from '../registry/constants.ts'
import type { Etoile } from '../data/catalog.ts'
import type { Site } from './ephem.ts'
import { tempsSideralLocal } from './ephem.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'
import { DEG } from './mat3.ts'

const HEURES_PAR_TOUR = 24
const DEG_PAR_HEURE = 360 / HEURES_PAR_TOUR

export type ModePointage = 'CARTE_DIRECTE' | 'CHEMINEMENT'

export interface Ancrage {
  readonly adH: number
  readonly decDeg: number
  readonly magV: number
  /** Position dans le cadre, en fraction de largeur et de hauteur, origine au centre. */
  readonly xCadre: number
  readonly yCadre: number
  /** Décalages chiffrés vers la cible, pour cercles gradués ou flexibles (§8.4). */
  readonly deltaAdH: number
  readonly deltaDecDeg: number
  readonly separationDeg: number
  /** L'ancrage principal : le plus brillant, sous la magnitude fiable en ciel dégradé. */
  readonly principal: boolean
}

export interface Saut {
  readonly ordre: number
  readonly adH: number
  readonly decDeg: number
  readonly magV: number
  readonly distanceDeg: number
}

export interface CartePointage {
  readonly mode: ModePointage
  readonly ancrages: readonly Ancrage[]
  readonly sauts: readonly Saut[]
  /** Angle de position du zénith : l'orientation réelle du schéma à cet instant. */
  readonly angleOrientationDeg: Traced<number>
  readonly deltaAdH: number
  readonly deltaDecDeg: number
  readonly message: string
  /** Renseignée quand aucun ancrage ni aucun itinéraire n'est proposable. */
  readonly cause?: string
  /** Contraintes que l'utilisateur peut relâcher, plutôt qu'un itinéraire inventé. */
  readonly contraintesARelacher?: readonly string[]
}

export interface EntreePointage {
  readonly site: Site
  readonly date: Date
  readonly adCibleH: number
  readonly decCibleDeg: number
  readonly fovHDeg: number
  readonly fovLDeg: number
  /** Magnitude limite à l'œil nu du site (§2.2) : elle pilote le choix des ancrages. */
  readonly mLimOeil: number | null
  /** Champ du chercheur, quand l'utilisateur en déclare un. */
  readonly fovChercheurDeg?: number
  readonly etoiles: readonly Etoile[]
}

// ---------------------------------------------------------------------------
// Géométrie
// ---------------------------------------------------------------------------

/** Séparation angulaire entre deux directions équatoriales, en degrés. */
export function separationEtoilesDeg(
  adAH: number,
  decADeg: number,
  adBH: number,
  decBDeg: number,
): number {
  const d1 = decADeg * DEG
  const d2 = decBDeg * DEG
  const dAd = (adAH - adBH) * DEG_PAR_HEURE * DEG
  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dAd)
  return Math.acos(Math.min(1, Math.max(-1, cos))) / DEG
}

/**
 * Angle de position du zénith à l'instant du pointage — l'angle parallactique. C'est lui
 * qui donne le haut et le bas réels du champ tel que l'œil le verra.
 */
export function angleOrientation(
  site: Site,
  date: Date,
  adH: number,
  decDeg: number,
): Traced<number> {
  const tsl = tempsSideralLocal(date, site.longitudeDeg)
  const angleHoraire = (tsl.value - adH) * DEG_PAR_HEURE * DEG
  const latitude = site.latitudeDeg * DEG
  const declinaison = decDeg * DEG
  const q =
    Math.atan2(
      Math.sin(angleHoraire),
      Math.tan(latitude) * Math.cos(declinaison) -
        Math.sin(declinaison) * Math.cos(angleHoraire),
    ) / DEG
  return trace({
    value: q,
    formula: 'ANGLE_ZENITH',
    inputs: {
      tsl_h: tsl.value,
      ad_h: adH,
      dec_deg: decDeg,
      latitude_deg: site.latitudeDeg,
    },
    note: 'Le ciel tourne : ce schéma vaut pour cette heure-là.',
  })
}

// ---------------------------------------------------------------------------
// §8.4 — carte directe
// ---------------------------------------------------------------------------

function ancrage(entree: EntreePointage, etoile: Etoile, principal: boolean): Ancrage {
  const adH = etoile.adDeg / DEG_PAR_HEURE
  const dAd = adH - entree.adCibleH
  const dDec = etoile.decDeg - entree.decCibleDeg
  // Projection locale : à l'échelle d'un cadre, la convergence des méridiens se réduit au
  // cosinus de la déclinaison de la cible.
  const dx = dAd * DEG_PAR_HEURE * Math.cos(entree.decCibleDeg * DEG)
  return {
    adH,
    decDeg: etoile.decDeg,
    magV: etoile.magV,
    xCadre: dx / entree.fovLDeg,
    yCadre: dDec / entree.fovHDeg,
    deltaAdH: entree.adCibleH - adH,
    deltaDecDeg: entree.decCibleDeg - etoile.decDeg,
    separationDeg: separationEtoilesDeg(
      adH,
      etoile.decDeg,
      entree.adCibleH,
      entree.decCibleDeg,
    ),
    principal,
  }
}

function dansLeCadre(entree: EntreePointage, etoile: Etoile): boolean {
  const dAd = etoile.adDeg / DEG_PAR_HEURE - entree.adCibleH
  const dx = Math.abs(dAd * DEG_PAR_HEURE * Math.cos(entree.decCibleDeg * DEG))
  const dy = Math.abs(etoile.decDeg - entree.decCibleDeg)
  return dx <= entree.fovLDeg / 2 && dy <= entree.fovHDeg / 2
}

function carteDirecte(entree: EntreePointage): CartePointage {
  const orientation = angleOrientation(entree.site, entree.date, entree.adCibleH, entree.decCibleDeg)
  const magLimite = entree.mLimOeil
  const visibles = entree.etoiles
    .filter((e) => dansLeCadre(entree, e))
    .filter((e) => magLimite === null || e.magV <= magLimite)
    .slice()
    .sort((a, b) => a.magV - b.magV)

  const principale = visibles.find((e) => e.magV <= K('MAG_ANCRAGE_PRINCIPAL_MAX'))
  const ancrages = visibles.map((e) => ancrage(entree, e, e === principale))
  const commun = {
    mode: 'CARTE_DIRECTE' as const,
    sauts: [] as readonly Saut[],
    angleOrientationDeg: orientation,
    deltaAdH: 0,
    deltaDecDeg: 0,
  }

  if (ancrages.length === 0) {
    return {
      ...commun,
      ancrages,
      message: 'Aucune étoile d’ancrage dans le cadre.',
      cause:
        magLimite === null
          ? 'Ciel hors de l’échelle de Bortle : aucune étoile repère proposée.'
          : `Aucune étoile visible à l’œil (magnitude ${magLimite.toFixed(2)}) dans le cadre.`,
      contraintesARelacher: [
        'Un site plus sombre montre plus d’étoiles repères.',
        'Un chercheur, même petit, montre bien plus d’étoiles.',
      ],
    }
  }

  const premier = ancrages[0]!
  return {
    ...commun,
    ancrages,
    deltaAdH: premier.deltaAdH,
    deltaDecDeg: premier.deltaDecDeg,
    message:
      `Pointage direct : ${ancrages.length} étoile${ancrages.length > 1 ? 's' : ''} repère` +
      `${ancrages.length > 1 ? 's' : ''} dans le cadre` +
      (principale === undefined
        ? ', toutes assez faibles : repérage délicat sous un ciel voilé.'
        : `, la plus brillante de magnitude ${premier.magV.toFixed(1)}.`) +
      ` Écart : ${premier.deltaAdH.toFixed(3)} h en ascension droite, ` +
      `${premier.deltaDecDeg.toFixed(2)}° en déclinaison. Schéma tourné de ` +
      `${orientation.value.toFixed(0)}°.`,
  }
}

// ---------------------------------------------------------------------------
// §8.4 — cheminement
// ---------------------------------------------------------------------------

interface Noeud {
  readonly etoile: Etoile
  readonly precedent: Noeud | null
  readonly profondeur: number
  readonly distanceDeg: number
}

function cheminement(entree: EntreePointage): CartePointage {
  const orientation = angleOrientation(entree.site, entree.date, entree.adCibleH, entree.decCibleDeg)
  const chercheur = entree.fovChercheurDeg ?? entree.fovHDeg
  const sautMax = K('RECOUVREMENT_SAUT') * chercheur
  const sautsMax = K('SAUTS_MAX')
  const rayon = sautMax * (sautsMax + 1)

  const distanceCible = (e: Etoile): number =>
    separationEtoilesDeg(
      e.adDeg / DEG_PAR_HEURE,
      e.decDeg,
      entree.adCibleH,
      entree.decCibleDeg,
    )

  const proches = entree.etoiles
    .filter((e) => e.magV <= K('MAG_SAUT_MAX'))
    .filter((e) => distanceCible(e) <= rayon)

  // Parcours en largeur DEPUIS la cible : le premier sommet atteint sous la magnitude de
  // départ donne le plus court chemin, donc le moins d'occasions de se perdre.
  const file: Noeud[] = proches
    .filter((e) => distanceCible(e) <= sautMax)
    .map((e) => ({ etoile: e, precedent: null, profondeur: 1, distanceDeg: distanceCible(e) }))
  const vus = new Set<Etoile>(file.map((n) => n.etoile))
  let arrivee: Noeud | null = null

  while (file.length > 0 && arrivee === null) {
    const noeud = file.shift()!
    if (noeud.etoile.magV <= K('MAG_DEPART_CHEMINEMENT_MAX')) {
      arrivee = noeud
      break
    }
    if (noeud.profondeur >= sautsMax) continue
    for (const voisin of proches) {
      if (vus.has(voisin)) continue
      const distance = separationEtoilesDeg(
        noeud.etoile.adDeg / DEG_PAR_HEURE,
        noeud.etoile.decDeg,
        voisin.adDeg / DEG_PAR_HEURE,
        voisin.decDeg,
      )
      if (distance > sautMax) continue
      vus.add(voisin)
      file.push({
        etoile: voisin,
        precedent: noeud,
        profondeur: noeud.profondeur + 1,
        distanceDeg: distance,
      })
    }
  }

  const commun = {
    mode: 'CHEMINEMENT' as const,
    ancrages: [] as readonly Ancrage[],
    angleOrientationDeg: orientation,
  }

  if (arrivee === null) {
    return {
      ...commun,
      sauts: [],
      deltaAdH: 0,
      deltaDecDeg: 0,
      message: 'Aucun chemin d’étoile en étoile trouvé.',
      cause:
        `Aucun chemin en ${sautsMax} sauts au plus, de ${sautMax.toFixed(1)}° maximum chacun, ` +
        `depuis une étoile de magnitude ${K('MAG_DEPART_CHEMINEMENT_MAX')}.`,
      contraintesARelacher: [
        `Partir d’une étoile plus faible que magnitude ${K('MAG_DEPART_CHEMINEMENT_MAX')}.`,
        `Autoriser plus de ${sautsMax} sauts.`,
        'Utiliser un chercheur au champ plus large.',
      ],
    }
  }

  // Le chemin est reconstruit de l'étoile de départ vers la cible.
  const chemin: Noeud[] = []
  for (let n: Noeud | null = arrivee; n !== null; n = n.precedent) chemin.push(n)
  const sauts: Saut[] = chemin.map((n, index) => ({
    ordre: index + 1,
    adH: n.etoile.adDeg / DEG_PAR_HEURE,
    decDeg: n.etoile.decDeg,
    magV: n.etoile.magV,
    distanceDeg: n.distanceDeg,
  }))
  const depart = sauts[0]!

  return {
    ...commun,
    sauts,
    deltaAdH: entree.adCibleH - depart.adH,
    deltaDecDeg: entree.decCibleDeg - depart.decDeg,
    message:
      `${sauts.length} saut${sauts.length > 1 ? 's' : ''} d’étoile en étoile, depuis une ` +
      `étoile de magnitude ${depart.magV.toFixed(1)}. Écart total : ` +
      `${(entree.adCibleH - depart.adH).toFixed(3)} h en ascension droite, ` +
      `${(entree.decCibleDeg - depart.decDeg).toFixed(2)}° en déclinaison. Schéma tourné de ` +
      `${orientation.value.toFixed(0)}°.`,
  }
}

/**
 * Mode de pointage choisi automatiquement selon le champ (§8.4). Au-delà de 8°, le cadre
 * contient toujours plusieurs étoiles brillantes : une seule étape suffit.
 */
export function cartePointage(entree: EntreePointage): CartePointage {
  return entree.fovHDeg > K('FOV_SEUIL_CARTE_DIRECTE_DEG')
    ? carteDirecte(entree)
    : cheminement(entree)
}

export const RAPPEL_MISE_EN_STATION =
  'La mise en station reste à faire vous-même : l’application aide seulement à trouver les objets.'
