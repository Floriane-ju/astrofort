/**
 * §8.2 — Créneau d'observation par cible.
 *
 * L'intervalle où une cible est simultanément assez haute, hors relief et dans la fenêtre
 * nocturne. Trois exigences produit sont câblées ici :
 *
 *   1. UNE CIBLE ÉCARTÉE NOMME SA CAUSE. `causeExclusion` n'est pas une donnée technique :
 *      une cible rejetée sans motif est la première source de méfiance envers l'application.
 *   2. LE RELIEF EST NOMMÉ COMME TEL. Une cible bloquée par une crête n'est pas « trop
 *      basse » : elle est derrière le relief, et le masque le dit.
 *   3. UNE MONTURE ÉQUATORIALE ALLEMANDE SCINDE LE CRÉNEAU AU MÉRIDIEN. Le tube heurte le
 *      pied : l'interruption est obligatoire, et l'orientation du capteur bascule de 180°.
 *
 * Les coordonnées du catalogue sont J2000 : la précession déplace une cible de moins d'un
 * demi-degré sur la durée de vie du catalogue, sans effet sur un créneau au quart d'heure.
 */

import { Horizon } from 'astronomy-engine'
import { K } from '../registry/constants.ts'
import type { TypeMonture } from './tracking.ts'
import type { Site } from './ephem.ts'
import { observateur } from './ephem.ts'
import type { MasqueHorizon } from './site.ts'
import { altitudeCulmination, masseAir, obstructionDeg } from './site.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const MS_PAR_MINUTE = 60000
const ANGLE_DROIT_DEG = 90

export type CauseExclusion = 'HAUTEUR' | 'RELIEF' | 'LUNE' | 'HORS_FENETRE' | 'JAMAIS_LEVE'

export interface Intervalle {
  readonly debut: Date
  readonly fin: Date
}

export interface SousCreneau extends Intervalle {
  readonly dureeMin: number
  /** Vrai pour la portion suivant le retournement au méridien d'une monture GEM. */
  readonly apresRetournement: boolean
}

export interface EntreeCreneau {
  readonly site: Site
  /** Ascension droite en heures et déclinaison en degrés, coordonnées du catalogue. */
  readonly adH: number
  readonly decDeg: number
  readonly fenetre: Intervalle
  readonly masque: MasqueHorizon
  readonly seuilHauteurDeg?: number
  readonly typeMonture: TypeMonture
}

export interface CreneauCible {
  readonly altCulminationDeg: Traced<number>
  readonly heureCulmination: Date | null
  readonly creneaux: readonly SousCreneau[]
  readonly dureeTotaleMin: Traced<number>
  readonly masseAirMin: Traced<number | null>
  readonly circumpolaire: boolean
  readonly retournementMeridien: boolean
  readonly causeExclusion?: CauseExclusion
  readonly message: string
  /** Latitude sous laquelle la cible deviendrait accessible, quand la hauteur l'exclut. */
  readonly latitudeAccessibleDeg?: number
}

interface Echantillon {
  readonly instant: Date
  readonly altitudeDeg: number
  readonly azimutDeg: number
}

function echantillonne(entree: EntreeCreneau): readonly Echantillon[] {
  const obs = observateur(entree.site)
  const echantillons: Echantillon[] = []
  for (
    let t = entree.fenetre.debut.getTime();
    t <= entree.fenetre.fin.getTime();
    t += MS_PAR_MINUTE
  ) {
    const instant = new Date(t)
    const hz = Horizon(instant, obs, entree.adH, entree.decDeg, 'normal')
    echantillons.push({ instant, altitudeDeg: hz.altitude, azimutDeg: hz.azimuth })
  }
  return echantillons
}

function dureeMinutes(debut: Date, fin: Date): number {
  return (fin.getTime() - debut.getTime()) / MS_PAR_MINUTE
}

/**
 * Découpe la suite d'échantillons visibles en intervalles contigus, puis scinde au méridien
 * quand la monture impose un retournement.
 */
function assembleCreneaux(
  visibles: readonly Echantillon[],
  culmination: Date | null,
  scindeAuMeridien: boolean,
): readonly SousCreneau[] {
  const creneaux: SousCreneau[] = []
  let debut: Echantillon | null = null
  let precedent: Echantillon | null = null

  const pousse = (a: Date, b: Date, apresRetournement: boolean): void => {
    if (b.getTime() > a.getTime()) {
      creneaux.push({ debut: a, fin: b, dureeMin: dureeMinutes(a, b), apresRetournement })
    }
  }

  const cloture = (): void => {
    if (debut === null || precedent === null) return
    const coupe =
      scindeAuMeridien &&
      culmination !== null &&
      culmination.getTime() > debut.instant.getTime() &&
      culmination.getTime() < precedent.instant.getTime()
    if (coupe && culmination !== null) {
      pousse(debut.instant, culmination, false)
      pousse(culmination, precedent.instant, true)
    } else {
      pousse(debut.instant, precedent.instant, false)
    }
    debut = null
  }

  for (const echantillon of visibles) {
    if (
      precedent !== null &&
      echantillon.instant.getTime() - precedent.instant.getTime() > MS_PAR_MINUTE
    ) {
      cloture()
    }
    debut ??= echantillon
    precedent = echantillon
  }
  cloture()
  return creneaux
}

export function creneauCible(entree: EntreeCreneau): CreneauCible {
  const seuil = entree.seuilHauteurDeg ?? K('SEUIL_HAUTEUR_IMAGERIE_DEG')
  const latitude = entree.site.latitudeDeg
  const altCulmination = altitudeCulmination(latitude, entree.decDeg)
  const circumpolaire = entree.decDeg > ANGLE_DROIT_DEG - Math.abs(latitude)
  const neSeLevePas = entree.decDeg < latitude - ANGLE_DROIT_DEG
  const retournementMeridien = entree.typeMonture === 'GEM'

  const echantillons = echantillonne(entree)
  const culminant = echantillons.reduce<Echantillon | null>(
    (meilleur, e) => (meilleur === null || e.altitudeDeg > meilleur.altitudeDeg ? e : meilleur),
    null,
  )
  const heureCulmination =
    culminant === null ||
    culminant.instant.getTime() === entree.fenetre.debut.getTime() ||
    culminant.instant.getTime() === entree.fenetre.fin.getTime()
      ? null
      : culminant.instant

  const assezHaut = echantillons.filter((e) => e.altitudeDeg > seuil)
  const visibles = assezHaut.filter(
    (e) => e.altitudeDeg > obstructionDeg(entree.masque, e.azimutDeg),
  )
  const creneaux = assembleCreneaux(visibles, heureCulmination, retournementMeridien)
  const dureeTotale = creneaux.reduce((somme, c) => somme + c.dureeMin, 0)
  const altitudeMax = visibles.reduce((max, e) => Math.max(max, e.altitudeDeg), 0)

  const commun = {
    altCulminationDeg: altCulmination,
    heureCulmination,
    creneaux,
    dureeTotaleMin: trace({
      value: dureeTotale,
      formula: 'DUREE_CRENEAU',
      inputs: { seuil_hauteur_deg: seuil, alt_culmination_deg: altCulmination.value },
      constants: entree.seuilHauteurDeg === undefined ? ['SEUIL_HAUTEUR_IMAGERIE_DEG'] : [],
    }),
    masseAirMin: masseAir(altitudeMax > 0 ? altitudeMax : altCulmination.value),
    circumpolaire,
    retournementMeridien: retournementMeridien && creneaux.some((c) => c.apresRetournement),
  }

  if (neSeLevePas) {
    return {
      ...commun,
      causeExclusion: 'JAMAIS_LEVE',
      message:
        `Depuis la latitude ${latitude.toFixed(3)}°, une déclinaison de ` +
        `${entree.decDeg.toFixed(1)}° ne se lève jamais : la cible reste sous l’horizon toute ` +
        'l’année. Aucun créneau n’existe, à aucune date.',
    }
  }

  if (altCulmination.value <= seuil) {
    // La cible deviendrait accessible depuis une latitude plus basse : le seuil est atteint
    // dès que | latitude − δ | < 90° − seuil.
    const latitudeAccessible = entree.decDeg + (ANGLE_DROIT_DEG - seuil)
    return {
      ...commun,
      causeExclusion: 'HAUTEUR',
      latitudeAccessibleDeg: latitudeAccessible,
      message:
        `La cible culmine à ${altCulmination.value.toFixed(1)}°, sous le seuil de ${seuil}° : ` +
        'elle est hors du domaine depuis ce site, quelle que soit l’heure. Elle deviendrait ' +
        `accessible depuis une latitude inférieure à ${latitudeAccessible.toFixed(1)}°.`,
    }
  }

  if (assezHaut.length === 0) {
    return {
      ...commun,
      causeExclusion: 'HORS_FENETRE',
      message:
        `La cible atteint bien ${altCulmination.value.toFixed(1)}° depuis ce site, mais pas ` +
        'pendant la fenêtre nocturne de cette date : son passage a lieu de jour. Une autre ' +
        'date de l’année la ramène dans la nuit.',
    }
  }

  if (visibles.length === 0) {
    const azimuts = assezHaut.map((e) => Math.round(e.azimutDeg))
    const azimutBloquant = azimuts[Math.floor(azimuts.length / 2)] ?? 0
    return {
      ...commun,
      causeExclusion: 'RELIEF',
      message:
        `La cible passe assez haut (${altCulmination.value.toFixed(1)}° à la culmination) mais ` +
        `reste derrière le relief : le masque d’horizon culmine à ` +
        `${obstructionDeg(entree.masque, azimutBloquant).toFixed(0)}° dans l’azimut ` +
        `${azimutBloquant}°. C’est le relief qui exclut cette cible, pas sa hauteur.`,
    }
  }

  return {
    ...commun,
    message:
      `Créneau de ${dureeTotale.toFixed(0)} min au-dessus de ${seuil}°` +
      (circumpolaire ? ', cible circumpolaire : ni lever ni coucher' : '') +
      (commun.retournementMeridien
        ? '. Le passage au méridien scinde le créneau en deux : sur une équatoriale ' +
          'allemande, le tube heurte le pied et l’orientation du capteur bascule de 180°. ' +
          'Les flats restent valides, le cadrage se re-vérifie et la séquence redémarre.'
        : '.'),
  }
}
