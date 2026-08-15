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

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeEtoiles, sha256Hex, type Etoile } from '../src/data/catalog.ts'
import {
  encodeObjets,
  type ObjetCielProfond,
  type TypeObjet,
} from '../src/data/deepsky.ts'
import {
  encodeConstellations,
  type AreteFrontiere,
  type Asterisme,
  type EtoileNommee,
  type Figure,
  type Segment,
  type TypeArete,
} from '../src/data/constellations.ts'

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
/**
 * §3.4 — un seul fichier porte les trois couches : figures (culture occidentale), astérismes
 * et frontières IAU de Delporte en coordonnées B1875. C'est le jeu de référence que le PRD
 * nomme, sous licence libre.
 */
const URL_STELLARIUM =
  'https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/index.json'

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

// ---------------------------------------------------------------------------
// §3.4 — figures, astérismes, frontières et étoiles nommées
// ---------------------------------------------------------------------------

interface EtoileHyg {
  readonly adDeg: number
  readonly decDeg: number
  readonly magV: number
  readonly bayer: string
  readonly flamsteed: string
  readonly constellation: string
  readonly nomPropre: string
  readonly spectre: string
  readonly distancePc: number | null
}

/** Abréviations Bayer du catalogue vers la lettre grecque affichée. */
const LETTRES_GRECQUES: Readonly<Record<string, string>> = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ',
  Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ',
  Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ',
  Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
}

/**
 * Les astérismes portent leur nom d'usage français quand il en existe un. Pour les motifs
 * sans usage francophone établi, le nom anglais de la source est conservé tel quel :
 * traduire « Davis' Dog » n'aiderait personne à le reconnaître dans le ciel.
 */
const NOMS_FR_ASTERISMES: Readonly<Record<string, string>> = {
  'Big Dipper (Plough)': 'Grande Casserole',
  'Little Dipper': 'Petite Casserole',
  'Summer Triangle': 'Triangle d’été',
  'Winter Triangle': 'Triangle d’hiver',
  'Spring Triangle': 'Triangle du printemps',
  'Winter Hexagon (Winter Circle)': 'Hexagone d’hiver',
  "Orion's Belt": 'Ceinture d’Orion',
  "Orion's Sword": 'Épée d’Orion',
  Coathanger: 'Cintre',
  'Great Square of Pegasus': 'Grand Carré de Pégase',
  'Northern Cross': 'Croix du Nord',
  Teapot: 'Théière',
  Sickle: 'Faucille du Lion',
  Keystone: 'Clé de voûte d’Hercule',
  'The Pointers': 'Les Gardes',
  'Head of Medusa Gorgon': 'Tête de Méduse',
  'False Cross': 'Fausse Croix',
  'V of Taurus': 'V du Taureau',
  Kite: 'Cerf-volant du Bouvier',
  Circlet: 'Cercle des Poissons',
}

function indexeHyg(csv: string): Map<number, EtoileHyg> {
  const index = new Map<number, EtoileHyg>()
  for (const ligne of analyseCsv(csv, ',')) {
    const hip = nombreOuNull(ligne.get('hip'))
    const adH = nombreOuNull(ligne.get('ra'))
    const dec = nombreOuNull(ligne.get('dec'))
    const mag = nombreOuNull(ligne.get('mag'))
    if (hip === null || adH === null || dec === null || mag === null) continue
    const distance = nombreOuNull(ligne.get('dist'))
    index.set(hip, {
      adDeg: adH * DEG_PAR_HEURE,
      decDeg: dec,
      magV: mag,
      bayer: (ligne.get('bayer') ?? '').trim(),
      flamsteed: (ligne.get('flam') ?? '').trim(),
      constellation: (ligne.get('con') ?? '').trim(),
      nomPropre: (ligne.get('proper') ?? '').trim(),
      spectre: (ligne.get('spect') ?? '').trim(),
      // HYG range les étoiles sans parallaxe fiable à 100 000 pc : ce n'est pas une distance.
      distancePc: distance === null || distance <= 0 || distance >= 100000 ? null : distance,
    })
  }
  return index
}

function designationBayer(etoile: EtoileHyg): string {
  if (etoile.bayer === '') {
    return etoile.flamsteed === '' || etoile.constellation === ''
      ? ''
      : `${etoile.flamsteed} ${etoile.constellation}`
  }
  const lettre = LETTRES_GRECQUES[etoile.bayer] ?? etoile.bayer
  return etoile.constellation === '' ? lettre : `${lettre} ${etoile.constellation}`
}

interface ResolutionLignes {
  readonly segments: Segment[]
  readonly ignores: number
}

/** Une polyligne de la source est une suite d'identifiants HIP à relier deux à deux. */
function resoutLignes(
  lignes: readonly (readonly (number | string)[])[],
  index: Map<number, EtoileHyg>,
): ResolutionLignes {
  const segments: Segment[] = []
  let ignores = 0
  for (const ligne of lignes) {
    for (let i = 0; i + 1 < ligne.length; i++) {
      const a = typeof ligne[i] === 'number' ? index.get(ligne[i] as number) : undefined
      const b = typeof ligne[i + 1] === 'number' ? index.get(ligne[i + 1] as number) : undefined
      if (a === undefined || b === undefined) {
        // Sommet Gaia absent du catalogue HYG : le segment est écarté, jamais inventé.
        ignores++
        continue
      }
      segments.push({ ad1Deg: a.adDeg, dec1Deg: a.decDeg, ad2Deg: b.adDeg, dec2Deg: b.decDeg })
    }
  }
  return { segments, ignores }
}

function sexagesimal(brut: string, uniteParHeure: number): number {
  const signe = brut.trim().startsWith('-') ? -1 : 1
  const [a = '0', b = '0', c = '0'] = brut.trim().replace('+', '').replace('-', '').split(':')
  const MINUTES_PAR_UNITE = 60
  const SECONDES_PAR_MINUTE = 60
  return (
    signe *
    (Number(a) +
      Number(b) / MINUTES_PAR_UNITE +
      Number(c) / (MINUTES_PAR_UNITE * SECONDES_PAR_MINUTE)) *
    uniteParHeure
  )
}

interface SkycultureStellarium {
  readonly constellations: readonly {
    readonly id: string
    readonly lines?: readonly (readonly (number | string)[])[]
    readonly common_name?: { readonly native?: string; readonly english?: string }
  }[]
  readonly asterisms: readonly {
    readonly id: string
    readonly is_ray_helper?: boolean
    readonly lines?: readonly (readonly (number | string)[])[]
    readonly common_name?: { readonly english?: string }
  }[]
  readonly edges: readonly string[]
  readonly edges_epoch: string
}

/** « CON modern Aql » → « Aql ». Le code IAU est le dernier mot de l'identifiant source. */
function codeIau(id: string): string {
  const morceaux = id.trim().split(/\s+/)
  return (morceaux[morceaux.length - 1] ?? id).toUpperCase()
}

function construitConstellations(brut: string, index: Map<number, EtoileHyg>) {
  const source = JSON.parse(brut) as SkycultureStellarium
  if (source.edges_epoch !== 'B1875') {
    throw new Error(
      `Les frontières amont sont annoncées à l’époque ${source.edges_epoch} et non B1875. ` +
        'Le rendu les précesse depuis B1875 (§3.4) : ne pas encoder un jeu déjà précessé, ' +
        'la correction serait appliquée deux fois.',
    )
  }

  let ignores = 0

  const figures: Figure[] = source.constellations.map((c) => {
    const resolution = resoutLignes(c.lines ?? [], index)
    ignores += resolution.ignores
    return {
      code: codeIau(c.id),
      nom: c.common_name?.native ?? c.common_name?.english ?? codeIau(c.id),
      segments: resolution.segments,
    }
  })

  const asterismes: Asterisme[] = []
  for (const a of source.asterisms) {
    // Les « ray helpers » ne sont pas des astérismes : ce sont des guides de repérage
    // internes au moteur de rendu amont.
    if (a.is_ray_helper === true) continue
    const nomAnglais = a.common_name?.english
    if (nomAnglais === undefined) continue
    const resolution = resoutLignes(a.lines ?? [], index)
    ignores += resolution.ignores
    if (resolution.segments.length === 0) continue
    asterismes.push({
      id: a.id,
      nom: NOMS_FR_ASTERISMES[nomAnglais] ?? nomAnglais,
      segments: resolution.segments,
    })
  }

  const frontieres: AreteFrontiere[] = source.edges.map((ligne) => {
    const champs = ligne.trim().split(/\s+/)
    const [, type, ra1, dec1, ra2, dec2, con1, con2] = champs
    const typeArete: TypeArete = (type ?? '').startsWith('M') ? 'MERIDIEN' : 'PARALLELE'
    return {
      type: typeArete,
      ad1Deg: sexagesimal(ra1 ?? '0', DEG_PAR_HEURE),
      dec1Deg: sexagesimal(dec1 ?? '0', 1),
      ad2Deg: sexagesimal(ra2 ?? '0', DEG_PAR_HEURE),
      dec2Deg: sexagesimal(dec2 ?? '0', 1),
      codes: [(con1 ?? '').toUpperCase(), (con2 ?? '').toUpperCase()] as const,
    }
  })

  // §3.4 — les labels ne nomment que les étoiles de magnitude ≤ 3,5 ; le clic les identifie.
  const MAG_ETOILES_NOMMEES = 3.5
  const etoilesNommees: EtoileNommee[] = []
  for (const etoile of index.values()) {
    const designation = designationBayer(etoile)
    if (etoile.magV > MAG_ETOILES_NOMMEES && etoile.nomPropre === '') continue
    if (designation === '' && etoile.nomPropre === '') continue
    etoilesNommees.push({
      adDeg: etoile.adDeg,
      decDeg: etoile.decDeg,
      magV: etoile.magV,
      designation,
      nomPropre: etoile.nomPropre,
      spectre: etoile.spectre,
      distancePc: etoile.distancePc,
      constellation: etoile.constellation,
    })
  }
  etoilesNommees.sort((a, b) => a.magV - b.magV)

  return {
    figures,
    asterismes,
    frontieres,
    etoilesNommees,
    segmentsIgnores: ignores,
    source: `Stellarium, culture « modern » — ${URL_STELLARIUM} ; frontières IAU de Delporte (B1875)`,
  }
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

const CHEMIN_MANIFESTE = join(DOSSIER_SORTIE, 'manifest.json')

async function litManifesteExistant(): Promise<ManifestePaquet[]> {
  try {
    return JSON.parse(await readFile(CHEMIN_MANIFESTE, 'utf8')) as ManifestePaquet[]
  } catch {
    return []
  }
}

/**
 * Fusionne les entrées produites avec celles déjà présentes. Régénérer un seul paquet ne
 * doit pas effacer le manifeste des autres, ni les forcer à retélécharger leur source.
 */
function fusionne(
  existant: readonly ManifestePaquet[],
  produits: readonly ManifestePaquet[],
): ManifestePaquet[] {
  const parNom = new Map(existant.map((p) => [p.nom, p]))
  for (const p of produits) parNom.set(p.nom, p)
  return [...parNom.values()]
}

/** Groupes constructibles : `pnpm data:build [hyg] [openngc] [constellations]`. */
const GROUPES = ['hyg', 'openngc', 'constellations'] as const
type Groupe = (typeof GROUPES)[number]

async function principal(): Promise<void> {
  await mkdir(DOSSIER_SORTIE, { recursive: true })

  const demandes = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const inconnus = demandes.filter((a) => !GROUPES.includes(a as Groupe))
  if (inconnus.length > 0) {
    throw new Error(
      `Groupe inconnu : ${inconnus.join(', ')}. Groupes disponibles : ${GROUPES.join(', ')}.`,
    )
  }
  const aConstruire = new Set<Groupe>(
    demandes.length === 0 ? GROUPES : (demandes as Groupe[]),
  )

  const produits: ManifestePaquet[] = []
  // Le CSV HYG sert deux paquets : il n'est téléchargé qu'une fois.
  let csvHyg: string | null = null
  const hyg = async (): Promise<string> => (csvHyg ??= await telecharge(URL_HYG))

  if (aConstruire.has('hyg')) {
    process.stdout.write('HYG (étoiles)\n')
    const etoiles = construitEtoiles(await hyg())
    produits.push(
      await ecritPaquet(
        'hyg',
        encodeEtoiles(etoiles),
        etoiles.length,
        `HYG Database CURRENT (v4.1), filtré à magnitude ≤ ${MAG_LIMITE_HYG} — ${URL_HYG}`,
        true,
      ),
    )
  }

  if (aConstruire.has('openngc')) {
    process.stdout.write('OpenNGC (ciel profond)\n')
    const objets = construitObjets(await telecharge(URL_OPENNGC))
    const paquetObjets = encodeObjets(objets)
    produits.push(
      await ecritPaquet(
        'openngc',
        paquetObjets.enregistrements,
        objets.length,
        `OpenNGC — ${URL_OPENNGC}`,
        true,
      ),
      await ecritPaquet(
        'openngc-noms',
        paquetObjets.chaines,
        objets.length,
        'Bloc de chaînes du paquet openngc',
        true,
      ),
    )
  }

  if (aConstruire.has('constellations')) {
    process.stdout.write('Constellations (figures, astérismes, frontières B1875)\n')
    const paquet = construitConstellations(await telecharge(URL_STELLARIUM), indexeHyg(await hyg()))
    process.stdout.write(
      `  ${paquet.figures.length} figures · ${paquet.asterismes.length} astérismes · ` +
        `${paquet.frontieres.length} arêtes · ${paquet.etoilesNommees.length} étoiles nommées · ` +
        `${paquet.segmentsIgnores} segments écartés faute d’étoile résolue\n`,
    )
    produits.push(
      await ecritPaquet(
        'constellations',
        encodeConstellations(paquet),
        paquet.figures.length + paquet.asterismes.length + paquet.frontieres.length,
        paquet.source,
        true,
      ),
    )
  }

  const manifeste = fusionne(await litManifesteExistant(), produits)
  await writeFile(CHEMIN_MANIFESTE, `${JSON.stringify(manifeste, null, 2)}\n`)

  const OCTETS_PAR_MO = 1024 * 1024
  const total = manifeste.reduce((somme, p) => somme + p.octets, 0) / OCTETS_PAR_MO
  process.stdout.write(`Paquet de base : ${total.toFixed(2)} Mo\n`)
}

await principal()
