/**
 * §9.4 — Logistique de séquence de filé.
 *
 * La séquence type du PRD sert de référence : 2 h à 25 s donnent 276 images et environ
 * 8,9 Go. Le reste du test porte sur les refus — intervalle trop long, carte trop petite —
 * parce que ce sont eux qui évitent une sortie ratée.
 */

import { describe, expect, it } from 'vitest'
import { sequenceFile, trouTraceDeg } from '../src/core/sequence-file.ts'
import { K } from '../src/registry/constants.ts'

const TAILLE_RAW_MO = 33

function sequence(surcharge: Partial<Parameters<typeof sequenceFile>[0]> = {}) {
  return sequenceFile({
    dureeTotaleMin: 120,
    tPoseS: 25,
    intervalleS: 1,
    tailleRawMo: TAILLE_RAW_MO,
    decDeg: 0,
    ...surcharge,
  })
}

describe('§9.4 — séquence type du PRD', () => {
  it('prescrit 276 poses et environ 8,9 Go pour 2 h à 25 s', () => {
    const resultat = sequence()
    expect(resultat.nPoses.value).toBe(276)
    expect(resultat.volumeGo.value).toBeCloseTo(8.9, 1)
    expect(resultat.arcObtenuDeg.value).toBeCloseTo(30.08, 2)
  })

  it('liste la désactivation du dark automatique en consigne bloquante', () => {
    const resultat = sequence()
    expect(resultat.consignesBloquantes[0]).toMatch(/réduction de bruit sur longue exposition/)
    expect(resultat.intervalleRefuse).toBeNull()
  })

  it('chiffre le désastre quand la réduction de bruit reste active', () => {
    const resultat = sequence({ reductionBruitActive: true })
    expect(resultat.consignesBloquantes.length).toBe(2)
    expect(resultat.consignesBloquantes[1]).toMatch(/intervalle effectif/)
  })
})

describe('§9.4 — refus de l’intervalle trop long', () => {
  it('refuse au-delà de C-09 et chiffre le trou produit dans chaque trace', () => {
    const resultat = sequence({ intervalleS: 3 })
    expect(resultat.intervalleRefuse).not.toBeNull()
    // 15,041 °/h pendant 3 s : 45" de trou dans chaque trace, à l'équateur céleste.
    expect(trouTraceDeg(3, 0).value * 3600).toBeCloseTo(45.1, 1)
    expect(resultat.intervalleRefuse).toMatch(/irréparable/)
  })

  it('accepte l’intervalle maximal du registre', () => {
    expect(sequence({ intervalleS: K('INTERVALLE_INTER_POSE_FILE_MAX_S') }).intervalleRefuse).toBeNull()
  })

  it('trace un trou plus court près du pôle, comme les arcs', () => {
    expect(trouTraceDeg(3, 60).value).toBeCloseTo(trouTraceDeg(3, 0).value / 2, 6)
  })
})

describe('§9.4 — rappel batterie', () => {
  it('rappelle la batterie au-delà du seuil du registre, jamais en dessous', () => {
    const longue = sequence({ dureeTotaleMin: K('DUREE_RAPPEL_BATTERIE_MIN') * 2 })
    expect(longue.messages.some((m) => /[Aa]ttention à la batterie/.test(m))).toBe(true)

    const courte = sequence({ dureeTotaleMin: K('DUREE_RAPPEL_BATTERIE_MIN') })
    expect(courte.messages.some((m) => /batterie/.test(m))).toBe(false)
  })

  it('ne chiffre ni autonomie, ni température, ni nombre de batteries', () => {
    const rappel = sequence({ dureeTotaleMin: K('DUREE_RAPPEL_BATTERIE_MIN') * 2 }).messages.join(
      ' ',
    )
    expect(rappel).not.toMatch(/CIPA|°C|batteries à emporter/)
  })
})

describe('§9.4 — carte pleine', () => {
  it('annonce l’interruption et l’arc réellement obtenu', () => {
    // Carte de 32 Go déjà remplie à 28 Go : il reste 4 Go, soit 124 images.
    const resultat = sequence({ espaceLibreGo: 4 })
    const interruption = resultat.interruptionStockage
    expect(interruption).not.toBeNull()
    expect(interruption!.nPosesTenues).toBe(Math.floor((4 * K('MO_PAR_GO')) / TAILLE_RAW_MO))
    expect(interruption!.dureeTenueMin).toBeCloseTo((interruption!.nPosesTenues * 26) / 60, 6)
    // L'arc obtenu est proportionnellement plus court que celui de la durée visée.
    expect(interruption!.arcObtenuDeg.value).toBeLessThan(resultat.arcObtenuDeg.value)
    expect(interruption!.message).toMatch(/s’interrompra/)
  })

  it('ne signale rien quand la carte tient la séquence entière', () => {
    expect(sequence({ espaceLibreGo: 64 }).interruptionStockage).toBeNull()
  })
})

describe('§9.4 — pose unitaire', () => {
  it('signale une pose hors de la plage recommandée', () => {
    expect(sequence({ tPoseS: 120 }).messages.join(' ')).toMatch(/hors de la plage recommandée/)
    expect(sequence({ tPoseS: 25 }).messages.join(' ')).not.toMatch(/hors de la plage/)
  })
})
