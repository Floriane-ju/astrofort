/**
 * §4.1 et §5.1 — effacer un champ pour le retaper est un état transitoire normal.
 *
 * Deux exigences distinctes, et T-0149 les sépare :
 *   - le message du moteur remonte, pas l'exception — un `throw` en rendu démonte l'arbre
 *     et l'écran devient noir ;
 *   - un champ MATÉRIEL effacé ne refuse que le matériel. Le ciel du lieu reste calculable,
 *     donc la scène reste dessinable.
 */

import { describe, expect, it } from 'vitest'
import { evalueCiel, evalueMateriel } from '../src/ui/app-calcul.ts'
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

const LIEU = lieu({ bortle: DEFAUT.bortle, sqm: '' })

describe('saisie transitoirement vide', () => {
  it('Bortle et SQM effacés : erreur nommée, pas d’exception', () => {
    const ciel = evalueCiel(SITE, lieu({ bortle: '', sqm: '' }))
    expect(ciel.ok).toBe(false)
    if (!ciel.ok) expect(ciel.erreur).toContain('fond de ciel')
  })

  it('le Bortle du départ reste calculable', () => {
    expect(evalueCiel(SITE, LIEU).ok).toBe(true)
  })

  it('le matériel du départ se chiffre', () => {
    expect(evalueMateriel(MATERIEL).ok).toBe(true)
  })
})

/** T-0149 — ce qui doit rester vrai pour que la scène survive à un matériel incomplet. */
describe('champ matériel effacé', () => {
  const CHAMPS = ['focale', 'ouverture'] as const

  it.each(CHAMPS)('%s effacée : le matériel est refusé en nommant le champ', (champ) => {
    const calcul = evalueMateriel({ ...MATERIEL, [champ]: '' })
    expect(calcul.ok).toBe(false)
    if (!calcul.ok) expect(calcul.erreur).toContain('Saisie refusée')
  })

  it('résolution effacée : le matériel est refusé', () => {
    const calcul = evalueMateriel({
      ...MATERIEL,
      boitier: { ...MATERIEL.boitier, resolutionMpx: '' },
    })
    expect(calcul.ok).toBe(false)
  })

  it.each(CHAMPS)('%s effacée : le ciel du lieu reste dessinable', (champ) => {
    // La scène ne demande que ces deux grandeurs-là : elles ne viennent pas du matériel.
    const ciel = evalueCiel(SITE, LIEU)
    expect(evalueMateriel({ ...MATERIEL, [champ]: '' }).ok).toBe(false)
    expect(ciel.ok).toBe(true)
    if (ciel.ok) {
      expect(Number.isFinite(ciel.ciel.sbCiel.value)).toBe(true)
      expect(Number.isFinite(ciel.ciel.mLimOeil.value)).toBe(true)
    }
  })
})
