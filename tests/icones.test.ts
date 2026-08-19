import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DOSSIER_ICONES,
  ICONES,
  encodeIcone,
  rasteriseIcone,
} from '../scripts/build-icones.ts'

describe('icônes de la coquille installable (§12.1)', () => {
  it('couvre les tailles exigées pour l’installation et les lanceurs', () => {
    const tailles = ICONES.filter((i) => !i.maskable).map((i) => i.taille)
    expect(tailles).toContain(192)
    expect(tailles).toContain(512)
    expect(ICONES.some((i) => i.maskable)).toBe(true)
  })

  it('ne pose aucune composante verte ou bleue, aucune surface blanche (§11.1)', () => {
    for (const { nom, taille, maskable } of ICONES) {
      const pixels = rasteriseIcone(taille, maskable)
      let vertOuBleu = 0
      let transparent = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 1] !== 0 || pixels[i + 2] !== 0) vertOuBleu++
        if (pixels[i + 3] !== 255) transparent++
      }
      expect({ nom, vertOuBleu, transparent }).toEqual({ nom, vertOuBleu: 0, transparent: 0 })
    }
  })

  it('garde le viseur maskable dans la zone sûre de 80 %', () => {
    const taille = ICONES.find((i) => i.maskable)!.taille
    const pixels = rasteriseIcone(taille, true)
    const centre = taille / 2
    const rayonSur = taille * 0.4
    let debordements = 0
    for (let y = 0; y < taille; y++) {
      for (let x = 0; x < taille; x++) {
        if (pixels[(y * taille + x) * 4]! === 0) continue
        if (Math.hypot(x + 0.5 - centre, y + 0.5 - centre) > rayonSur) debordements++
      }
    }
    expect(debordements).toBe(0)
  })

  it('les fichiers versionnés correspondent au tracé — un clone s’installe sans réseau (§12.2)', async () => {
    for (const { nom, taille, maskable } of ICONES) {
      const disque = await readFile(join(DOSSIER_ICONES, nom))
      expect(new Uint8Array(disque)).toEqual(encodeIcone(taille, maskable))
    }
  })
})
