/**
 * §4.1 — masque d'horizon.
 *
 * Un site sans donnée de relief reçoit un masque plat à 0°, marqué [HYP] : l'hypothèse est
 * annoncée, jamais présentée comme une mesure du terrain.
 */

import { describe, expect, it } from 'vitest'
import { NB_AZIMUTS, masqueDepuisRelief, masquePlat, obstructionDeg } from '../src/core/site.ts'
import { SaisieRefuseeError } from '../src/registry/domains.ts'

describe('masque d’horizon §4.1', () => {
  it('replie sur un masque plat marqué [HYP] faute de donnée de relief', () => {
    const masque = masquePlat()
    expect(masque.altitudesDeg).toHaveLength(NB_AZIMUTS)
    expect(masque.altitudesDeg.every((a) => a === 0)).toBe(true)
    expect(masque.estHypothese).toBe(true)
    expect(masque.flags).toContain('HYP')
    expect(masque.note).toMatch(/complét/i)
  })

  it('accepte un profil de relief mesuré, qui n’est plus une hypothèse', () => {
    const relief = Array.from({ length: NB_AZIMUTS }, (_, az) => (az < 180 ? 12 : 3))
    const masque = masqueDepuisRelief(relief)
    expect(masque.estHypothese).toBe(false)
    expect(masque.flags).toBeUndefined()
    expect(obstructionDeg(masque, 90)).toBe(12)
    expect(obstructionDeg(masque, 270)).toBe(3)
  })

  it('referme l’azimut sur lui-même : 360° est 0°', () => {
    const relief = Array.from({ length: NB_AZIMUTS }, (_, az) => az / 10)
    const masque = masqueDepuisRelief(relief)
    expect(obstructionDeg(masque, 360)).toBe(obstructionDeg(masque, 0))
    expect(obstructionDeg(masque, -1)).toBe(obstructionDeg(masque, 359))
  })

  it('refuse un relief incomplet plutôt que de compléter au hasard', () => {
    expect(() => masqueDepuisRelief([0, 1, 2])).toThrow(SaisieRefuseeError)
    expect(() => masqueDepuisRelief([0, 1, 2])).toThrow(/360/)
  })

  it('refuse une obstruction hors de la plage 0 à 90°', () => {
    const relief = Array.from({ length: NB_AZIMUTS }, () => 0)
    relief[42] = 95
    expect(() => masqueDepuisRelief(relief)).toThrow(/masque/i)
  })
})
