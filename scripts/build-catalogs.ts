/**
 * §12.2 — Génération des paquets de données binaires.
 *
 * Télécharge les catalogues publics, les filtre, les encode et écrit `public/data/`.
 * Lancé explicitement par `pnpm data:build`, jamais au `postinstall` : pnpm bloque les
 * scripts de cycle de vie par défaut et c'est une protection à conserver.
 *
 * Les binaires produits sont versionnés dans le dépôt avec leur manifeste, de sorte qu'un
 * clone n'ait pas besoin du réseau pour démarrer.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeEtoiles, sha256Hex, type Etoile } from '../src/data/catalog.ts'
import {
  encodeObjets,
  type ObjetCielProfond,
  type TypeObjet,
} from '../src/data/deepsky.ts'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER_SORTIE = join(RACINE, 'public', 'data')

/**
 * Le PRD nomme « HYG v3 ». Le projet amont a depuis publié la v4.1 sous `hyg/CURRENT`, et
 * ne sert plus la v3 à son ancienne adresse. Même base de données, version postérieure.
 */
const URL_HYG =
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'
const URL_OPENNGC =
  'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv'

/** §3.3 : HYG est complet jusqu'à magnitude ≈ 9. Au-delà, le catalogue n'est plus fiable. */
const MAG_LIMITE_HYG = 9
const VERSION_PAQUETS = '1'

const DEG_PAR_HEURE = 360 / 24

interface ManifestePaquet {
  nom: string
  version: string
  nombreEntrees: number
  octets: number
  sha256: string
  source: string
  obligatoire: boolean
}

async function telecharge(url: string): Promise<string> {
  process.stdout.write(`  téléchargement ${url}\n`)
  const reponse = await fetch(url)
  if (!reponse.ok) {
    throw new Error(
      `Téléchargement impossible (${reponse.status}) : ${url}\n` +
        'Vérifier le réseau, ou l’adresse du catalogue si le projet amont l’a déplacée.',
    )
  }
  return reponse.text()
}

/** Découpe une ligne CSV en respectant les champs entre guillemets. */
function champsCsv(ligne: string, separateur: string): string[] {
  const champs: string[] = []
  let courant = ''
  let entreGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]!
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"'
        i++
      } else {
        entreGuillemets = !entreGuillemets
      }
    } else if (c === separateur && !entreGuillemets) {
      champs.push(courant)
      courant = ''
    } else {
      courant += c
    }
  }
  champs.push(courant)
  return champs
}

function nombreOuNull(brut: string | undefined): number | null {
  if (brut === undefined) return null
  const nettoye = brut.trim()
  if (nettoye === '') return null
  const valeur = Number(nettoye)
  return Number.isFinite(valeur) ? valeur : null
}

function analyseCsv(contenu: string, separateur: string): Map<string, string>[] {
  const lignes = contenu.split('\n').filter((l) => l.trim() !== '')
  const entetes = champsCsv(lignes[0]!, separateur).map((e) => e.replace(/"/g, '').trim())
  return lignes.slice(1).map((ligne) => {
    const valeurs = champsCsv(ligne, separateur)
    const enregistrement = new Map<string, string>()
    entetes.forEach((entete, i) => enregistrement.set(entete, valeurs[i] ?? ''))
    return enregistrement
  })
}

function construitEtoiles(csv: string): Etoile[] {
  const etoiles: Etoile[] = []
  for (const ligne of analyseCsv(csv, ',')) {
    const mag = nombreOuNull(ligne.get('mag'))
    const adH = nombreOuNull(ligne.get('ra'))
    const dec = nombreOuNull(ligne.get('dec'))
    if (mag === null || adH === null || dec === null) continue
    if (mag > MAG_LIMITE_HYG) continue
    // L'entrée « Sol » du catalogue est le Soleil vu depuis lui-même : distance nulle.
    if (nombreOuNull(ligne.get('dist')) === 0) continue
    etoiles.push({
      adDeg: adH * DEG_PAR_HEURE,
      decDeg: dec,
      magV: mag,
      bv: nombreOuNull(ligne.get('ci')) ?? 0,
    })
  }
  return etoiles
}

/** Correspondance des codes OpenNGC vers les types de §6.3. */
const TYPES_OPENNGC: Readonly<Record<string, TypeObjet>> = {
  G: 'GALAXIE',
  GPair: 'GALAXIE',
  GTrpl: 'GALAXIE',
  GGroup: 'GALAXIE',
  PN: 'NEB_PLANETAIRE',
  OCl: 'AMAS_OUVERT',
  GCl: 'AMAS_GLOB',
  'Cl+N': 'AMAS_OUVERT',
  HII: 'EMISSION',
  EmN: 'EMISSION',
  RfN: 'REFLEXION',
  DrkN: 'NEB_OBSCURE',
  SNR: 'RESTE_SUPERNOVA',
  Neb: 'AUTRE',
  Nova: 'AUTRE',
}

/** Entrées sans objet réel : doublons, non-existants, étoiles simples ou doubles. */
const TYPES_IGNORES = new Set(['Dup', 'NonEx', '*', '**', '*Ass'])

function sexagesimalVersDeg(brut: string | undefined, uniteParHeure: number): number | null {
  if (brut === undefined || brut.trim() === '') return null
  const morceaux = brut.trim().split(':').map(Number)
  const [a, b = 0, c = 0] = morceaux
  if (a === undefined || !Number.isFinite(a)) return null
  const SECONDES_PAR_MINUTE = 60
  const MINUTES_PAR_UNITE = 60
  const signe = brut.trim().startsWith('-') ? -1 : 1
  const magnitude =
    Math.abs(a) + b / MINUTES_PAR_UNITE + c / (MINUTES_PAR_UNITE * SECONDES_PAR_MINUTE)
  return signe * magnitude * uniteParHeure
}

function construitObjets(csv: string): ObjetCielProfond[] {
  const objets: ObjetCielProfond[] = []
  for (const ligne of analyseCsv(csv, ';')) {
    const codeType = (ligne.get('Type') ?? '').trim()
    if (TYPES_IGNORES.has(codeType)) continue

    const adDeg = sexagesimalVersDeg(ligne.get('RA'), DEG_PAR_HEURE)
    const decDeg = sexagesimalVersDeg(ligne.get('Dec'), 1)
    if (adDeg === null || decDeg === null) continue

    const messier = (ligne.get('M') ?? '').trim()
    const nom = (ligne.get('Name') ?? '').trim()
    objets.push({
      // OpenNGC écrit le numéro Messier sur trois chiffres : « 031 » devient « M31 ».
      designation: messier === '' ? nom : `M${Number(messier)}`,
      nomsCommuns: [(ligne.get('Common names') ?? '').trim(), messier === '' ? '' : nom]
        .filter((n) => n !== '')
        .join('|'),
      adDeg,
      decDeg,
      type: TYPES_OPENNGC[codeType] ?? 'INCONNU',
      majAxArcmin: nombreOuNull(ligne.get('MajAx')),
      minAxArcmin: nombreOuNull(ligne.get('MinAx')),
      posAngDeg: nombreOuNull(ligne.get('PosAng')),
      vMag: nombreOuNull(ligne.get('V-Mag')),
      bMag: nombreOuNull(ligne.get('B-Mag')),
      surfBr: nombreOuNull(ligne.get('SurfBr')),
    })
  }
  return objets
}

async function ecritPaquet(
  nom: string,
  buffer: ArrayBuffer,
  nombreEnregistrements: number,
  source: string,
  obligatoire: boolean,
): Promise<ManifestePaquet> {
  const fichier = join(DOSSIER_SORTIE, `${nom}-${VERSION_PAQUETS}.bin`)
  await writeFile(fichier, Buffer.from(buffer))
  const OCTETS_PAR_MO = 1024 * 1024
  process.stdout.write(
    `  ${nom} : ${nombreEnregistrements} entrées, ` +
      `${(buffer.byteLength / OCTETS_PAR_MO).toFixed(2)} Mo\n`,
  )
  return {
    nom,
    version: VERSION_PAQUETS,
    nombreEntrees: nombreEnregistrements,
    octets: buffer.byteLength,
    sha256: await sha256Hex(buffer),
    source,
    obligatoire,
  }
}

async function principal(): Promise<void> {
  await mkdir(DOSSIER_SORTIE, { recursive: true })

  process.stdout.write('HYG (étoiles)\n')
  const etoiles = construitEtoiles(await telecharge(URL_HYG))
  const manifesteHyg = await ecritPaquet(
    'hyg',
    encodeEtoiles(etoiles),
    etoiles.length,
    `HYG Database CURRENT (v4.1), filtré à magnitude ≤ ${MAG_LIMITE_HYG} — ${URL_HYG}`,
    true,
  )

  process.stdout.write('OpenNGC (ciel profond)\n')
  const objets = construitObjets(await telecharge(URL_OPENNGC))
  const paquetObjets = encodeObjets(objets)
  const manifesteObjets = await ecritPaquet(
    'openngc',
    paquetObjets.enregistrements,
    objets.length,
    `OpenNGC — ${URL_OPENNGC}`,
    true,
  )
  const manifesteChaines = await ecritPaquet(
    'openngc-noms',
    paquetObjets.chaines,
    objets.length,
    'Bloc de chaînes du paquet openngc',
    true,
  )

  const manifeste = [manifesteHyg, manifesteObjets, manifesteChaines]
  await writeFile(
    join(DOSSIER_SORTIE, 'manifest.json'),
    `${JSON.stringify(manifeste, null, 2)}\n`,
  )

  const OCTETS_PAR_MO = 1024 * 1024
  const total = manifeste.reduce((somme, p) => somme + p.octets, 0) / OCTETS_PAR_MO
  process.stdout.write(`Paquet de base : ${total.toFixed(2)} Mo\n`)
}

await principal()
