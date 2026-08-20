/**
 * §4 et §5 — l'état de saisie de l'application : où l'on est, avec quoi on photographie.
 *
 * Chaque hook rend ses valeurs ET ses commandes sous les noms qu'attendent les panneaux,
 * pour qu'une région se garnisse d'un seul étalement plutôt que de seize propriétés
 * recopiées à la main.
 */

import { useState } from 'react'
import type { PointMasque } from '../core/site.ts'
import { BOITIER_REFERENCE, type CapteurMode, type SaisieBoitier } from '../data/equipment.ts'
import type { QualiteMiseEnStation, TypeMonture } from '../core/tracking.ts'
import { etatScene, majVue } from './scene-etat.ts'
import { modeObjectif, type TypeObjectif } from './PanneauMateriel.tsx'

/** Site et configuration ciel profond de l'Annexe A. */
const DEFAUT = {
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

export function useSaisieLieu(): SaisieLieu {
  const [latitude, surLatitude] = useState(DEFAUT.latitude)
  const [longitude, surLongitude] = useState(DEFAUT.longitude)
  const [altitude, surAltitude] = useState(DEFAUT.altitude)
  const [bortle, surBortle] = useState(DEFAUT.bortle)
  const [sqm, surSqm] = useState('')
  const [dateIso, surDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [pointsMasque, surPointsMasque] = useState<readonly PointMasque[]>([])

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

export function useSaisieMateriel(): SaisieMateriel {
  const [boitier, surBoitier] = useState<SaisieBoitier>(() => ({
    boitierId: BOITIER_REFERENCE.id,
    ...BOITIER_VIDE,
  }))
  const [iso, surIso] = useState('')
  const [focale, surFocale] = useState(DEFAUT.focale)
  const [ouverture, surOuverture] = useState(DEFAUT.ouverture)
  const [capteurMode, surCapteurMode] = useState<CapteurMode>('FULL_FRAME')
  const [comparerRecadrage, surComparerRecadrage] = useState(false)
  const [typeObjectif, setTypeObjectif] = useState<TypeObjectif>('RECTILINEAIRE')
  const [suiviActif, surSuiviActif] = useState(false)
  const [qualiteMes, surQualiteMes] = useState<QualiteMiseEnStation>('INCONNUE')
  const [typeMonture, surTypeMonture] = useState<TypeMonture>('TRACKER')

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
