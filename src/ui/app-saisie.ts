/**
 * §4 et §5 — l'état de saisie de l'application : où l'on est, avec quoi on photographie.
 *
 * Chaque hook rend ses valeurs ET ses commandes sous les noms qu'attendent les panneaux,
 * pour qu'une région se garnisse d'un seul étalement plutôt que de seize propriétés
 * recopiées à la main.
 */

import { useState } from 'react'
import { poidsParDefaut, type PoidsScoring } from '../core/session.ts'
import type { PointMasque } from '../core/site.ts'
import { BOITIER_REFERENCE, type CapteurMode, type SaisieBoitier } from '../data/equipment.ts'
import type { QualiteMiseEnStation, TypeMonture } from '../core/tracking.ts'
import { jourLocalIso } from './horaire.ts'
import { etatScene, majVue } from './scene-etat.ts'
import { modeObjectif, type TypeObjectif } from './PanneauMateriel.tsx'

/** Site et configuration ciel profond de l'Annexe A. */
export const DEFAUT = {
  latitude: '46.391',
  longitude: '6.697',
  altitude: '500',
  bortle: '4.5',
  focale: '120',
  ouverture: '2.8',
}

export interface SaisieLieu {
  readonly latitude: string
  readonly surLatitude: (v: string) => void
  readonly longitude: string
  readonly surLongitude: (v: string) => void
  readonly altitude: string
  readonly surAltitude: (v: string) => void
  readonly dateIso: string
  readonly surDateIso: (v: string) => void
  readonly bortle: string
  readonly surBortle: (v: string) => void
  readonly sqm: string
  readonly surSqm: (v: string) => void
  /** §4.1 — les relevés de relief saisis à la main, interpolés sur les 360 azimuts. */
  readonly pointsMasque: readonly PointMasque[]
  readonly surPointsMasque: (v: readonly PointMasque[]) => void
}

/**
 * §12.3 — le lieu tel qu'il a été enregistré, relu au démarrage. `null` au premier
 * démarrage : les valeurs de l'Annexe A servent alors de départ.
 *
 * La date n'en fait pas partie : une séance se prépare pour la nuit qui vient, pas pour
 * celle du dernier rechargement.
 */
export interface DepartLieu {
  readonly latitude: string
  readonly longitude: string
  readonly altitude: string
  readonly bortle: string
  readonly sqm: string
  readonly pointsMasque: readonly PointMasque[]
}

export function useSaisieLieu(depart: DepartLieu | null): SaisieLieu {
  const [latitude, surLatitude] = useState(depart?.latitude ?? DEFAUT.latitude)
  const [longitude, surLongitude] = useState(depart?.longitude ?? DEFAUT.longitude)
  const [altitude, surAltitude] = useState(depart?.altitude ?? DEFAUT.altitude)
  const [bortle, surBortle] = useState(depart?.bortle ?? DEFAUT.bortle)
  const [sqm, surSqm] = useState(depart?.sqm ?? '')
  // Le jour LOCAL : `toISOString()` donnerait le jour UTC, donc la nuit suivante après
  // minuit UTC en été — celle qu'on ne prépare pas.
  const [dateIso, surDateIso] = useState(() => jourLocalIso(new Date()))
  const [pointsMasque, surPointsMasque] = useState<readonly PointMasque[]>(
    depart?.pointsMasque ?? [],
  )

  return {
    latitude,
    surLatitude,
    longitude,
    surLongitude,
    altitude,
    surAltitude,
    dateIso,
    surDateIso,
    bortle,
    surBortle,
    sqm,
    surSqm,
    pointsMasque,
    surPointsMasque,
  }
}

/** §5.1 — mode `custom` : tous les champs vides, aucun n'est présumé (§2.3). */
const BOITIER_VIDE = {
  capteurLMm: '',
  capteurHMm: '',
  pitchUm: '',
  readNoiseE: '',
  seuilDoubleGainIso: '',
  fullWellE: '',
  zpSys: '',
  tailleRawMo: '',
  autonomieCipa: '',
} as const

export interface SaisieMateriel {
  /** §5.1 — le boîtier retenu et, en mode `custom`, ses grandeurs capteur saisies. */
  readonly boitier: SaisieBoitier
  readonly surBoitier: (v: SaisieBoitier) => void
  /** §7.2 — ISO de capture, vide tant que celui du double gain convient. */
  readonly iso: string
  readonly surIso: (v: string) => void
  readonly focale: string
  readonly surFocale: (v: string) => void
  readonly ouverture: string
  readonly surOuverture: (v: string) => void
  readonly capteurMode: CapteurMode
  readonly surCapteurMode: (v: CapteurMode) => void
  readonly comparerRecadrage: boolean
  readonly surComparerRecadrage: (v: boolean) => void
  readonly typeObjectif: TypeObjectif
  readonly surTypeObjectif: (v: TypeObjectif) => void
  readonly suiviActif: boolean
  readonly surSuiviActif: (v: boolean) => void
  readonly qualiteMes: QualiteMiseEnStation
  readonly surQualiteMes: (v: QualiteMiseEnStation) => void
  readonly typeMonture: TypeMonture
  readonly surTypeMonture: (v: TypeMonture) => void
}

/**
 * §12.3 — le matériel tel qu'il a été enregistré, relu au démarrage.
 *
 * La comparaison de recadrage n'en fait pas partie : c'est une superposition d'affichage,
 * pas une caractéristique du matériel (§3.5).
 */
export interface DepartMateriel {
  readonly boitier: SaisieBoitier
  readonly iso: string
  readonly focale: string
  readonly ouverture: string
  readonly capteurMode: CapteurMode
  readonly typeObjectif: TypeObjectif
  readonly suiviActif: boolean
  /** Absents d'un enregistrement venu d'ailleurs : le départ de la saisie s'applique. */
  readonly qualiteMes?: QualiteMiseEnStation
  readonly typeMonture?: TypeMonture
}

export function useSaisieMateriel(depart: DepartMateriel | null): SaisieMateriel {
  const [boitier, surBoitier] = useState<SaisieBoitier>(
    () => depart?.boitier ?? { boitierId: BOITIER_REFERENCE.id, ...BOITIER_VIDE },
  )
  const [iso, surIso] = useState(depart?.iso ?? '')
  const [focale, surFocale] = useState(depart?.focale ?? DEFAUT.focale)
  const [ouverture, surOuverture] = useState(depart?.ouverture ?? DEFAUT.ouverture)
  const [capteurMode, surCapteurMode] = useState<CapteurMode>(depart?.capteurMode ?? 'FULL_FRAME')
  const [comparerRecadrage, surComparerRecadrage] = useState(false)
  const [typeObjectif, setTypeObjectif] = useState<TypeObjectif>(
    depart?.typeObjectif ?? 'RECTILINEAIRE',
  )
  const [suiviActif, surSuiviActif] = useState(depart?.suiviActif ?? false)
  const [qualiteMes, surQualiteMes] = useState<QualiteMiseEnStation>(
    depart?.qualiteMes ?? 'INCONNUE',
  )
  const [typeMonture, surTypeMonture] = useState<TypeMonture>(depart?.typeMonture ?? 'TRACKER')

  /**
   * §5.1 — changer d'objectif change la projection, pas un réglage de rendu. Si la scène
   * regarde déjà « comme l'objectif », elle suit ; si elle est en planétarium, elle y reste.
   */
  function surTypeObjectif(type: TypeObjectif) {
    setTypeObjectif(type)
    if (etatScene().vue.mode !== 'MODE_PLANETARIUM') majVue({ mode: modeObjectif(type) })
  }

  return {
    boitier,
    surBoitier,
    iso,
    surIso,
    focale,
    surFocale,
    ouverture,
    surOuverture,
    capteurMode,
    surCapteurMode,
    comparerRecadrage,
    surComparerRecadrage,
    typeObjectif,
    surTypeObjectif,
    suiviActif,
    surSuiviActif,
    qualiteMes,
    surQualiteMes,
    typeMonture,
    surTypeMonture,
  }
}

/** Les cinq critères du score C-15, dans l'ordre où ils se règlent (§8.3). */
export const CRITERES_SCORING = Object.freeze([
  'cadrage',
  'hauteur',
  'signal',
  'fenetre',
  'lune',
] as const)

export type CritereScoring = (typeof CRITERES_SCORING)[number]

export interface SaisiePoids {
  /** Poids bruts tels qu'ils sont réglés. La normalisation à 1 appartient au moteur (§8.3). */
  readonly poids: PoidsScoring
  readonly surPoids: (critere: CritereScoring, valeur: number) => void
  /** Retour aux valeurs C-15 du registre, qui restent la référence (§2.1). */
  readonly surDefaut: () => void
}

/**
 * §8.3 et §2.4 — les poids de scoring se règlent, et rien ne les apprend.
 *
 * L'état vit ici, comme le reste de la saisie : il n'est ni mémorisé entre deux séances ni
 * ajusté d'après les choix passés. Ce qui le protège d'une éviction, c'est l'export §12.3,
 * pas une persistance silencieuse.
 */
export function useSaisiePoids(): SaisiePoids {
  const [poids, setPoids] = useState<PoidsScoring>(poidsParDefaut)

  return {
    poids,
    surPoids: (critere, valeur) => setPoids((p) => Object.freeze({ ...p, [critere]: valeur })),
    surDefaut: () => setPoids(poidsParDefaut()),
  }
}
