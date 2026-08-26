/**
 * T-0082, §12.3 — ce que l'utilisateur saisit doit survivre au rechargement, et l'export
 * doit l'emporter. Le trajet vérifié ici est le trajet réel : saisie → enregistrement en
 * base → relecture → saisie. Un aller sans retour ne prouve rien.
 *
 * `fake-indexeddb/auto` fournit l'implémentation IndexedDB manquante à Node.
 */

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/data/db.ts'
import {
  enregistreProfilActif,
  enregistreSiteActif,
  exporteDonneesUtilisateur,
  importeDonneesUtilisateur,
  litProfilActif,
  litSiteActif,
} from '../src/data/persistence.ts'
import {
  departLieu,
  departMateriel,
  profilAEnregistrer,
  siteAEnregistrer,
} from '../src/ui/saisie-persistee.ts'
import type { SaisieLieu, SaisieMateriel } from '../src/ui/app-saisie.ts'
import { masqueDepuisPoints } from '../src/core/site.ts'

/** Les commandes de la saisie ne servent à rien ici : c'est la valeur qui voyage. */
const RIEN = () => undefined

function saisieLieu(champs: Partial<SaisieLieu> = {}): SaisieLieu {
  return {
    latitude: '45.833',
    longitude: '6.865',
    altitude: '1200',
    dateIso: '2026-08-21',
    bortle: '4.5',
    sqm: '',
    pointsMasque: [],
    surLatitude: RIEN,
    surLongitude: RIEN,
    surAltitude: RIEN,
    surDateIso: RIEN,
    surBortle: RIEN,
    surSqm: RIEN,
    surPointsMasque: RIEN,
    ...champs,
  }
}

function saisieMateriel(champs: Partial<SaisieMateriel> = {}): SaisieMateriel {
  return {
    boitier: {
      formatCapteur: 'PLEIN_FORMAT',
      resolutionMpx: '',
      readNoiseE: '',
      seuilDoubleGainIso: '',
      fullWellE: '',
      zpSys: '',
      tailleRawMo: '',
      autonomieCipa: '',
    },
    iso: '',
    focale: '135',
    ouverture: '2',
    capteurMode: 'APSC_CROP',
    comparerRecadrage: true,
    typeObjectif: 'FISHEYE',
    suiviActif: true,
    qualiteMes: 'SOIGNEE',
    typeMonture: 'GEM',
    surBoitier: RIEN,
    surIso: RIEN,
    surFocale: RIEN,
    surOuverture: RIEN,
    surCapteurMode: RIEN,
    surComparerRecadrage: RIEN,
    surTypeObjectif: RIEN,
    surSuiviActif: RIEN,
    surQualiteMes: RIEN,
    surTypeMonture: RIEN,
    ...champs,
  }
}

/** Le trajet complet d'un rechargement : ce qui est à l'écran, écrit puis relu. */
async function rechargeLieu(lieu: SaisieLieu) {
  const aEcrire = siteAEnregistrer(lieu, masqueDepuisPoints(lieu.pointsMasque))
  if (aEcrire !== null) await enregistreSiteActif(aEcrire)
  return departLieu(await litSiteActif())
}

async function rechargeMateriel(materiel: SaisieMateriel) {
  const aEcrire = profilAEnregistrer(materiel)
  if (aEcrire !== null) await enregistreProfilActif(aEcrire)
  return departMateriel(await litProfilActif())
}

beforeEach(async () => {
  const base = await db()
  const tx = base.transaction(['sites', 'profils'], 'readwrite')
  await Promise.all([tx.objectStore('sites').clear(), tx.objectStore('profils').clear(), tx.done])
})

describe('T-0082 — la saisie survit au rechargement', () => {
  it('rend le lieu, son ciel déclaré et ses relevés de relief', async () => {
    const lieu = saisieLieu({
      pointsMasque: [
        { azimutDeg: 0, altitudeDeg: 18 },
        { azimutDeg: 180, altitudeDeg: 4 },
      ],
    })

    expect(await rechargeLieu(lieu)).toEqual({
      latitude: lieu.latitude,
      longitude: lieu.longitude,
      altitude: lieu.altitude,
      bortle: lieu.bortle,
      sqm: '',
      pointsMasque: lieu.pointsMasque,
    })
  })

  it('garde vide le champ que l’utilisateur a vidé', async () => {
    // Un SQM mesuré remplace le Bortle : le Bortle par défaut ne doit pas revenir au
    // rechargement, sinon le fond de ciel changerait tout seul (§4.1).
    const releve = await rechargeLieu(saisieLieu({ bortle: '', sqm: '21.2' }))
    expect(releve?.bortle).toBe('')
    expect(releve?.sqm).toBe('21.2')
  })

  it('rend le boîtier saisi à la main, grandeur par grandeur', async () => {
    // §5.1 — ces grandeurs ne se retéléchargent pas : perdues, le profil décrirait le
    // capteur d'un autre appareil.
    const materiel = saisieMateriel({
      boitier: {
        formatCapteur: 'APSC_NIKON',
        resolutionMpx: '24',
        readNoiseE: '1.5',
        seuilDoubleGainIso: '800',
        fullWellE: '52000',
        zpSys: '21.4',
        tailleRawMo: '25',
        autonomieCipa: '780',
      },
      iso: '1600',
    })

    expect(await rechargeMateriel(materiel)).toEqual({
      boitier: materiel.boitier,
      iso: materiel.iso,
      focale: materiel.focale,
      ouverture: materiel.ouverture,
      capteurMode: materiel.capteurMode,
      typeObjectif: materiel.typeObjectif,
      suiviActif: materiel.suiviActif,
      qualiteMes: materiel.qualiteMes,
      typeMonture: materiel.typeMonture,
    })
  })

  it('n’écrit pas une saisie hors domaine et laisse le dernier état valable', async () => {
    // §2.1 — un NaN ou un Bortle 12 persisté ressortirait à chaque démarrage, et rendrait
    // l'export irréimportable : le contrôle du réimport applique les mêmes plages.
    const bon = saisieLieu()
    await rechargeLieu(bon)
    expect(await rechargeLieu(saisieLieu({ bortle: '12' }))).toEqual(await rechargeLieu(bon))
    // Un champ vide n'est pas un zéro : une latitude vide enregistrée à 0° reviendrait à
    // chaque démarrage comme un site au large du golfe de Guinée.
    expect(siteAEnregistrer(saisieLieu({ latitude: '' }), masqueDepuisPoints([]))).toBeNull()
    expect(profilAEnregistrer(saisieMateriel({ focale: '' }))).toBeNull()
  })
})

describe('T-0082 — l’export cesse d’être vide', () => {
  it('emporte le site et le profil de la séance, et son réimport les restaure', async () => {
    const lieu = saisieLieu({ pointsMasque: [{ azimutDeg: 90, altitudeDeg: 9 }] })
    const materiel = saisieMateriel()
    const attenduLieu = await rechargeLieu(lieu)
    const attenduMateriel = await rechargeMateriel(materiel)

    const fichier = await exporteDonneesUtilisateur()
    expect(fichier.sites).toHaveLength(1)
    expect(fichier.profils).toHaveLength(1)

    const base = await db()
    const tx = base.transaction(['sites', 'profils'], 'readwrite')
    await Promise.all([tx.objectStore('sites').clear(), tx.objectStore('profils').clear(), tx.done])
    expect(await litSiteActif()).toBeNull()

    await importeDonneesUtilisateur(fichier)
    expect(departLieu(await litSiteActif())).toEqual(attenduLieu)
    expect(departMateriel(await litProfilActif())).toEqual(attenduMateriel)
  })
})
