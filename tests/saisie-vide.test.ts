/**
 * §4.1 — effacer le Bortle pour le retaper laisse le site sans source de fond de ciel.
 *
 * Cet état transitoire est normal en cours de frappe : il doit produire le message du
 * moteur, pas remonter l'exception jusqu'à React — un `throw` en rendu démonte l'arbre
 * et l'écran devient noir.
 */

import { describe, expect, it } from 'vitest'
import { evalueMateriel } from '../src/ui/app-calcul.ts'
import { DEFAUT, type SaisieLieu, type SaisieMateriel } from '../src/ui/app-saisie.ts'
import type { Site } from '../src/core/ephem.ts'

const rien = () => undefined

const SITE: Site = {
  latitudeDeg: Number(DEFAUT.latitude),
  longitudeDeg: Number(DEFAUT.longitude),
  altitudeM: Number(DEFAUT.altitude),
}

function lieu(champs: { readonly bortle: string; readonly sqm: string }): SaisieLieu {
  return {
    latitude: DEFAUT.latitude,
    surLatitude: rien,
    longitude: DEFAUT.longitude,
    surLongitude: rien,
    altitude: DEFAUT.altitude,
    surAltitude: rien,
    dateIso: new Date().toISOString().slice(0, 10),
    surDateIso: rien,
    bortle: champs.bortle,
    surBortle: rien,
    sqm: champs.sqm,
    surSqm: rien,
    pointsMasque: [],
    surPointsMasque: rien,
  }
}

const MATERIEL: SaisieMateriel = {
  boitier: {
    formatCapteur: 'PLEIN_FORMAT',
    resolutionMpx: DEFAUT.resolutionMpx,
    readNoiseE: '',
    seuilDoubleGainIso: '',
    fullWellE: '',
    zpSys: '',
    tailleRawMo: '',
    autonomieCipa: '',
  },
  surBoitier: rien,
  iso: '',
  surIso: rien,
  focale: DEFAUT.focale,
  surFocale: rien,
  ouverture: DEFAUT.ouverture,
  surOuverture: rien,
  capteurMode: 'FULL_FRAME',
  surCapteurMode: rien,
  comparerRecadrage: false,
  surComparerRecadrage: rien,
  typeObjectif: 'RECTILINEAIRE',
  surTypeObjectif: rien,
  suiviActif: false,
  surSuiviActif: rien,
  qualiteMes: 'INCONNUE',
  surQualiteMes: rien,
  typeMonture: 'TRACKER',
  surTypeMonture: rien,
}

describe('saisie transitoirement vide', () => {
  it('Bortle et SQM effacés : erreur nommée, pas d’exception', () => {
    const calcul = evalueMateriel(SITE, lieu({ bortle: '', sqm: '' }), MATERIEL)
    expect(calcul.ok).toBe(false)
    if (!calcul.ok) expect(calcul.erreur).toContain('fond de ciel')
  })

  it('le Bortle du départ reste calculable', () => {
    expect(evalueMateriel(SITE, lieu({ bortle: DEFAUT.bortle, sqm: '' }), MATERIEL).ok).toBe(true)
  })
})
