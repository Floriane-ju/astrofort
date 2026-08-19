/**
 * §12.1 — Icônes de la coquille installable, §11.1 — rouge sur noir.
 *
 * Sans icône de 192 et de 512 pixels, le navigateur ne propose pas l'installation, et
 * l'octroi du stockage persistant de §12.3 perd son levier principal.
 *
 * Les icônes sont DESSINÉES ici plutôt que posées en fichier opaque : une image importée
 * d'ailleurs peut porter du blanc ou du bleu sans que rien ne le signale, et une icône
 * claire dans un dock ruine l'adaptation à l'obscurité aussi sûrement qu'une modale
 * blanche. Le tracé garantit par construction que les canaux vert et bleu sont nuls.
 *
 * Lancé explicitement par `pnpm icones:build` ; les PNG produits sont versionnés dans
 * `public/` pour qu'un clone s'installe sans réseau (§12.2).
 */

import { deflateSync, crc32 } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DOSSIER_ICONES = join(RACINE, 'public', 'icones')

/** Rouge du texte de la palette nocturne (`--texte` de `styles.css`, §11.1). */
const ROUGE = 230

/** Proportions du viseur, en fraction du côté de l'image. */
const RAYON = 0.34
const TRAIT = 0.055
const POINT = 0.075
const TIRET_INTERIEUR = 0.62
const TIRET_EXTERIEUR = 1.32

/**
 * Une icône `maskable` peut être rognée en cercle : seuls les 80 % centraux sont sûrs.
 * Le viseur est donc resserré pour tenir dans cette zone.
 */
const FACTEUR_MASKABLE = 0.72

/** Couverture d'un pixel par une forme, adoucie sur la largeur d'un pixel. */
function couverture(distanceAuBord: number): number {
  return Math.max(0, Math.min(1, 0.5 - distanceAuBord))
}

/**
 * Trame RGBA du viseur : anneau, quatre tirets cardinaux, point central, sur fond noir
 * opaque. Le rouge n'est modulé qu'en intensité — vert et bleu restent à zéro.
 */
export function rasteriseIcone(taille: number, maskable = false): Uint8Array {
  const echelle = maskable ? FACTEUR_MASKABLE : 1
  const centre = taille / 2
  const rayon = taille * RAYON * echelle
  const demiTrait = (taille * TRAIT * echelle) / 2
  const rayonPoint = taille * POINT * echelle
  const pixels = new Uint8Array(taille * taille * 4)

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const dx = x + 0.5 - centre
      const dy = y + 0.5 - centre
      const distance = Math.hypot(dx, dy)

      const anneau = couverture(Math.abs(distance - rayon) - demiTrait)
      const point = couverture(distance - rayonPoint)
      const tiret = Math.max(
        tranche(dx, dy, rayon, demiTrait),
        tranche(dy, dx, rayon, demiTrait),
      )
      const intensite = Math.max(anneau, point, tiret)

      const i = (y * taille + x) * 4
      pixels[i] = Math.round(ROUGE * intensite)
      pixels[i + 3] = 255
    }
  }
  return pixels
}

/** Un tiret cardinal : une barre étroite le long d'un axe, à cheval sur l'anneau. */
function tranche(le: number, travers: number, rayon: number, demiTrait: number): number {
  const long = Math.abs(le)
  const dedans = Math.max(
    rayon * TIRET_INTERIEUR - long,
    long - rayon * TIRET_EXTERIEUR,
  )
  return Math.min(couverture(Math.abs(travers) - demiTrait), couverture(dedans))
}

function chunk(type: string, corps: Uint8Array): Uint8Array {
  const entete = new Uint8Array(8 + corps.length + 4)
  const vue = new DataView(entete.buffer)
  vue.setUint32(0, corps.length)
  entete.set([...type].map((c) => c.charCodeAt(0)), 4)
  entete.set(corps, 8)
  const aCrc = entete.subarray(4, 8 + corps.length)
  vue.setUint32(8 + corps.length, crc32(aCrc))
  return entete
}

/** PNG 8 bits RVBA, sans filtre de ligne — l'image est petite, la compression suffit. */
export function encodePng(pixels: Uint8Array, taille: number): Uint8Array {
  const brut = new Uint8Array(taille * (taille * 4 + 1))
  for (let y = 0; y < taille; y++) {
    brut.set(pixels.subarray(y * taille * 4, (y + 1) * taille * 4), y * (taille * 4 + 1) + 1)
  }

  const ihdr = new Uint8Array(13)
  const vue = new DataView(ihdr.buffer)
  vue.setUint32(0, taille)
  vue.setUint32(4, taille)
  ihdr[8] = 8 // profondeur par canal
  ihdr[9] = 6 // RVBA

  const morceaux = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(brut, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = morceaux.reduce((n, m) => n + m.length, 0)
  const png = new Uint8Array(total)
  let offset = 0
  for (const m of morceaux) {
    png.set(m, offset)
    offset += m.length
  }
  return png
}

/** Les fichiers attendus par le manifeste, `index.html` et le précache. */
export const ICONES: readonly { readonly nom: string; readonly taille: number; readonly maskable: boolean }[] =
  Object.freeze([
    { nom: 'favicon.png', taille: 32, maskable: false },
    { nom: 'apple-touch-icon.png', taille: 180, maskable: false },
    { nom: 'icone-192.png', taille: 192, maskable: false },
    { nom: 'icone-512.png', taille: 512, maskable: false },
    { nom: 'icone-512-maskable.png', taille: 512, maskable: true },
  ])

export function encodeIcone(taille: number, maskable: boolean): Uint8Array {
  return encodePng(rasteriseIcone(taille, maskable), taille)
}

if (import.meta.main) {
  await mkdir(DOSSIER_ICONES, { recursive: true })
  for (const { nom, taille, maskable } of ICONES) {
    const png = encodeIcone(taille, maskable)
    await writeFile(join(DOSSIER_ICONES, nom), png)
    process.stdout.write(`${nom} — ${taille}×${taille}, ${png.length} octets\n`)
  }
}
