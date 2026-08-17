/**
 * T-0025 — un rendu par geste, pas un rendu par événement.
 *
 * « Un panoramique complet ne déclenche qu'un seul rendu » est un critère : il se compte,
 * il ne se suppose pas. C'est ce que ce fichier compte, sur la mécanique de report seule —
 * le composant, lui, se contente de lui dire si le réglage change ou est en train de changer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELAI_GESTE_MS, renduDiffere } from '../src/ui/rendu-differe.ts'

describe('T-0025 — report du rendu pendant un geste', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ramène un panoramique entier à un seul rendu', () => {
    let rendus = 0
    const planifie = renduDiffere(() => {
      rendus++
    })

    // Soixante `pointermove`, comme un panoramique d'une seconde à 60 Hz.
    for (let i = 0; i < 60; i++) {
      planifie.bientot()
      vi.advanceTimersByTime(16)
    }
    expect(rendus).toBe(0)
    expect(planifie.enAttente()).toBe(true)

    vi.advanceTimersByTime(DELAI_GESTE_MS)
    expect(rendus).toBe(1)
    expect(planifie.enAttente()).toBe(false)
  })

  it('ramène un glissement de curseur de 5 à 480 min à un seul rendu', () => {
    let rendus = 0
    const planifie = renduDiffere(() => {
      rendus++
    })
    // 96 crans de 5 min, tous pendant le même glissement.
    for (let i = 0; i < 96; i++) {
      planifie.bientot()
      vi.advanceTimersByTime(20)
    }
    vi.advanceTimersByTime(DELAI_GESTE_MS)
    expect(rendus).toBe(1)
  })

  it('rend immédiatement un changement franc, sans attendre la fin d’un geste', () => {
    let rendus = 0
    const planifie = renduDiffere(() => {
      rendus++
    })
    planifie.maintenant()
    expect(rendus).toBe(1)
  })

  it('n’exécute jamais deux fois le rendu quand un changement franc suit un geste', () => {
    let rendus = 0
    const planifie = renduDiffere(() => {
      rendus++
    })
    planifie.bientot()
    planifie.maintenant()
    vi.advanceTimersByTime(10 * DELAI_GESTE_MS)
    // L'image n'est jamais périmée : le rendu franc remplace le report, il ne s'y ajoute pas.
    expect(rendus).toBe(1)
  })

  it('n’exécute rien après annulation — l’incrustation éteinte ne repeint pas', () => {
    let rendus = 0
    const planifie = renduDiffere(() => {
      rendus++
    })
    planifie.bientot()
    planifie.annule()
    vi.advanceTimersByTime(10 * DELAI_GESTE_MS)
    expect(rendus).toBe(0)
  })
})
