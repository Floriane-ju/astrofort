/** §12.2, §12.3 — encodage binaire, fidélité des positions et contrôle d'intégrité. */

import 'fake-indexeddb/auto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  OCTETS_PAR_ETOILE,
  decodeEtoiles,
  encodeEtoiles,
  sha256Hex,
  verifieIntegrite,
  type Etoile,
  type ManifestePaquet,
} from '../src/data/catalog.ts'
import { decodeObjets, encodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'
import { chercheCatalogue } from '../src/core/recherche-catalogue.ts'
import {
  chargeObjetsCielProfond,
  PAQUET_NOMS_OBJETS,
  PAQUET_OBJETS,
} from '../src/data/bootstrap.ts'
import { ecritPaquet } from '../src/data/db.ts'

const RACINE = join(import.meta.dirname, '..')
const ARCSEC_PAR_DEG = 3600

/** Positions pseudo-aléatoires mais déterministes, pour un test reproductible. */
function echantillon(n: number): Etoile[] {
  const etoiles: Etoile[] = []
  for (let i = 0; i < n; i++) {
    etoiles.push({
      adDeg: (i * 137.508) % 360,
      decDeg: ((i * 53.7) % 180) - 90,
      magV: -1.46 + (i % 105) / 10,
      bv: -0.3 + (i % 21) / 10,
    })
  }
  return etoiles
}

describe('encodage des étoiles §12.2', () => {
  it('occupe exactement 12 octets par étoile', () => {
    expect(OCTETS_PAR_ETOILE).toBe(12)
    expect(encodeEtoiles(echantillon(1000)).byteLength).toBe(1000 * 12)
  })

  it('restitue 100 positions à moins d’une seconde d’arc de la source', () => {
    const source = echantillon(100)
    const decodees = decodeEtoiles(encodeEtoiles(source))
    for (let i = 0; i < source.length; i++) {
      const attendue = source[i]!
      const obtenue = decodees[i]!
      expect(Math.abs(obtenue.adDeg - attendue.adDeg) * ARCSEC_PAR_DEG).toBeLessThan(1)
      expect(Math.abs(obtenue.decDeg - attendue.decDeg) * ARCSEC_PAR_DEG).toBeLessThan(1)
      expect(obtenue.magV).toBeCloseTo(attendue.magV, 2)
      expect(obtenue.bv).toBeCloseTo(attendue.bv, 3)
    }
  })
})

describe('encodage du ciel profond §12.2', () => {
  const objets: ObjetCielProfond[] = [
    {
      designation: 'M31',
      nomsCommuns: 'Andromeda Galaxy|NGC0224',
      adDeg: 10.6847,
      decDeg: 41.269,
      type: 'GALAXIE',
      majAxArcmin: 190,
      minAxArcmin: 60,
      posAngDeg: 35,
      vMag: 3.4,
      bMag: 4.3,
      surfBr: 22.2,
    },
    {
      designation: 'Sh2-276',
      nomsCommuns: 'Barnard’s Loop',
      adDeg: 84.0,
      decDeg: -3.0,
      type: 'EMISSION',
      majAxArcmin: 600,
      minAxArcmin: 300,
      posAngDeg: null,
      vMag: null,
      bMag: null,
      surfBr: null,
    },
  ]

  it('fait un aller-retour sans perte utile', () => {
    const rendus = decodeObjets(encodeObjets(objets))
    expect(rendus[0]!.designation).toBe('M31')
    expect(rendus[0]!.nomsCommuns).toBe('Andromeda Galaxy|NGC0224')
    expect(rendus[0]!.vMag).toBeCloseTo(3.4, 2)
    expect(rendus[0]!.majAxArcmin).toBeCloseTo(190, 1)
    expect(rendus[1]!.designation).toBe('Sh2-276')
    // Un objet plus grand que le champ d'un 10 mm doit tenir dans l'encodage.
    expect(rendus[1]!.majAxArcmin).toBeCloseTo(600, 1)
  })

  it('distingue une donnée absente d’une valeur nulle', () => {
    const rendus = decodeObjets(encodeObjets(objets))
    expect(rendus[1]!.vMag).toBeNull()
    expect(rendus[1]!.posAngDeg).toBeNull()
  })
})

describe('intégrité des paquets §12.3', () => {
  const buffer = encodeEtoiles(echantillon(50))

  async function manifestePour(donnees: ArrayBuffer): Promise<ManifestePaquet> {
    return {
      nom: 'test',
      version: '1',
      nombreEntrees: 50,
      octets: donnees.byteLength,
      sha256: await sha256Hex(donnees),
      source: 'échantillon de test',
      obligatoire: true,
    }
  }

  it('valide un paquet intact', async () => {
    expect(await verifieIntegrite(buffer, await manifestePour(buffer))).toBe('OK')
  })

  it('refuse un paquet tronqué après interruption', async () => {
    const manifeste = await manifestePour(buffer)
    expect(await verifieIntegrite(buffer.slice(0, buffer.byteLength - 12), manifeste)).toBe(
      'CORROMPU',
    )
  })

  it('refuse un paquet altéré à taille constante', async () => {
    const manifeste = await manifestePour(buffer)
    const altere = buffer.slice(0)
    new DataView(altere).setFloat32(0, 123.456, true)
    expect(await verifieIntegrite(altere, manifeste)).toBe('CORROMPU')
  })

  it('signale un paquet absent sans lever d’erreur', async () => {
    expect(await verifieIntegrite(null, await manifestePour(buffer))).toBe('ABSENT')
  })
})

describe('paquets générés §12.2', () => {
  it('tient le budget de 10 Mo et correspond à son manifeste', async () => {
    const brut = await readFile(join(RACINE, 'public', 'data', 'manifest.json'), 'utf8').catch(
      () => null,
    )
    if (brut === null) {
      // Les paquets se génèrent par `pnpm data:build` ; leur absence n'invalide pas le codec.
      return
    }
    const manifeste = JSON.parse(brut) as ManifestePaquet[]
    const OCTETS_PAR_MO = 1024 * 1024
    const totalMo =
      manifeste.filter((p) => p.obligatoire).reduce((somme, p) => somme + p.octets, 0) /
      OCTETS_PAR_MO
    expect(totalMo).toBeLessThan(10)

    for (const paquet of manifeste) {
      const donnees = await readFile(
        join(RACINE, 'public', 'data', `${paquet.nom}-${paquet.version}.bin`),
      )
      const buffer = donnees.buffer.slice(
        donnees.byteOffset,
        donnees.byteOffset + donnees.byteLength,
      ) as ArrayBuffer
      expect(await verifieIntegrite(buffer, paquet), paquet.nom).toBe('OK')
    }
  })

  it('porte les Messier hors NGC : « M45 » se cherche par sa désignation', async () => {
    const lit = async (nom: string) =>
      await readFile(join(RACINE, 'public', 'data', `${nom}-1.bin`)).catch(() => null)
    const enregistrements = await lit('openngc')
    const chaines = await lit('openngc-noms')
    if (enregistrements === null || chaines === null) return

    const objets = decodeObjets({
      enregistrements: enregistrements.buffer.slice(
        enregistrements.byteOffset,
        enregistrements.byteOffset + enregistrements.byteLength,
      ) as ArrayBuffer,
      chaines: chaines.buffer.slice(
        chaines.byteOffset,
        chaines.byteOffset + chaines.byteLength,
      ) as ArrayBuffer,
    })

    // M45 n'est ni NGC ni IC : il vient du fichier d'appoint d'OpenNGC, pas de `NGC.csv`.
    expect(chercheCatalogue(objets, 'M45', 10).map((o) => o.designation)).toContain('M45')
    expect(chercheCatalogue(objets, 'pleiades', 10).map((o) => o.designation)).toContain('M45')
  })
})

describe('chargement du catalogue ciel profond §6.1', () => {
  it('décode les objets rangés par le démarrage, et rend une liste vide sans paquet', async () => {
    // La fiche de cible tire ses exemples de cette liste : le chemin de bout en bout
    // — paquet vérifié → IndexedDB → décodage — doit être couvert, pas seulement le codec.
    expect(await chargeObjetsCielProfond()).toHaveLength(0)

    const lit = async (nom: string): Promise<ArrayBuffer> => {
      const octets = await readFile(join(RACINE, 'public', 'data', nom))
      return octets.buffer.slice(
        octets.byteOffset,
        octets.byteOffset + octets.byteLength,
      ) as ArrayBuffer
    }
    await ecritPaquet({ nom: PAQUET_OBJETS, version: '1', donnees: await lit('openngc-1.bin') })
    await ecritPaquet({
      nom: PAQUET_NOMS_OBJETS,
      version: '1',
      donnees: await lit('openngc-noms-1.bin'),
    })

    const objets = await chargeObjetsCielProfond()
    expect(objets.length).toBeGreaterThan(10000)
    const m31 = objets.find((o) => o.designation === 'M31')
    expect(m31?.majAxArcmin).toBeCloseTo(177.8, 1)
    expect(m31?.type).toBe('GALAXIE')
  })
})
