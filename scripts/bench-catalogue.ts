/**
 * T-0190 — coût d'un changement de minute sur la liste du catalogue.
 *
 * Avant optimisation, chaque minute recalculait détectabilité, cadrage et tri —
 * 96,6 % du coût pour 0 % de changement utile. Ce script mesure avant/après.
 *
 * Deux mésos : invariant (catalogue + optique) et dépendant du temps (azimut/hauteur).
 * Le coût d'une passe de coordonnées seulement doit passer sous 5 ms sur 13 132 objets.
 *
 * Usage : `pnpm bench:catalogue`.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { decodeObjets } from '../src/data/deepsky.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import { ajouteCoordonnees, lignesCatalogue, lignesInvariantes } from '../src/core/cibles-liste.ts'
import type { Site } from '../src/core/ephem.ts'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }

/** §9.3 — setup de référence : 120 mm f/2.8, plein format, sous Bortle 4,5. */
const OPTIQUE = { fovHDeg: 16.4, echApx: 10.1, capteurHMm: 24, dMm: 42.86 }
const CIEL = { sbCiel: 21.0, mLimOeil: 6.1 }

/** Catalogue réel. */
const CATALOGUE = decodeObjets({
  enregistrements: lireBinaire('openngc-1.bin'),
  chaines: lireBinaire('openngc-noms-1.bin'),
})

function lireBinaire(nom: string): ArrayBuffer {
  const buffer = readFileSync(join(RACINE, 'public/data', nom))
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}

// Chauffe.
const date0 = new Date('2026-08-15T22:00:00Z')
const ciel0 = cielInstantane(SITE, date0)
for (let i = 0; i < 10; i++) {
  lignesCatalogue({ catalogue: CATALOGUE, matriceCiel: ciel0.matrice, ...OPTIQUE, ...CIEL })
}

console.log(`Catalogue réel : ${CATALOGUE.length.toLocaleString('fr-FR')} objets\n`)

// T-0190 — avant optimisation : recalculer TOUT à chaque minute
console.log('AVANT optimisation (tout recalculé par minute) :')
const minutes = 60
const debuts = performance.now()
for (let i = 0; i < minutes; i++) {
  const date = new Date(date0.getTime() + i * 60 * 1000)
  const ciel = cielInstantane(SITE, date)
  lignesCatalogue({ catalogue: CATALOGUE, matriceCiel: ciel.matrice, ...OPTIQUE, ...CIEL })
}
const avant = (performance.now() - debuts) / minutes
console.log(`  ${avant.toFixed(2)} ms/minute moyenne sur ${minutes} passes`)

// T-0190 — après optimisation : cache invariant + passe de coordonnées
console.log('\nAPRÈS optimisation (cache invariant + coordonnées) :')
const lignesInvar = lignesInvariantes({ catalogue: CATALOGUE, ...OPTIQUE, ...CIEL })
const debut = performance.now()
for (let i = 0; i < minutes; i++) {
  const date = new Date(date0.getTime() + i * 60 * 1000)
  const ciel = cielInstantane(SITE, date)
  ajouteCoordonnees(lignesInvar, ciel.matrice)
}
const apres = (performance.now() - debut) / minutes
console.log(`  ${apres.toFixed(2)} ms/minute moyenne sur ${minutes} passes`)

console.log(`\nGain : ${(avant - apres).toFixed(2)} ms/minute (${((1 - apres / avant) * 100).toFixed(1)}%)`)
console.log(`Cible T-0190 : ${apres < 5 ? '✓ ATTEINTE' : '✗ échouée'} (< 5 ms)`)
