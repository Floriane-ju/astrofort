/**
 * T-0222 — le créneau photo de la fiche est celui du plan de séance (§8.2).
 *
 * Aucune heure n'est écrite : le test compare la sortie de la fiche à celle de `planSession`
 * sur le même contexte. Une monture GEM est choisie pour que le découpage au méridien — la
 * partie la plus facile à perdre en reconstruisant l'entrée — soit comparé lui aussi.
 */

import { describe, expect, it } from 'vitest'
import { fenetreNocturne } from '../src/core/night.ts'
import { fenetreUtile } from '../src/core/moon.ts'
import { masquePlat } from '../src/core/site.ts'
import { planSession, type ContexteSession } from '../src/core/session.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import { CAUSE_NUIT_NON_CHIFFREE, creneauFiche } from '../src/ui/fiche-cible-creneau.ts'

const SITE = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
const NUIT = fenetreNocturne(SITE, new Date('2026-08-14T12:00:00Z'))

const CONTEXTE: ContexteSession = {
  site: SITE,
  nuit: NUIT,
  fenetreUtile: fenetreUtile(SITE, NUIT),
  masque: masquePlat(),
  fovHDeg: 11.38,
  echApx: 8.8,
  dMm: 42.9,
  capteurHMm: 23.9,
  pitchUm: 5.12,
  ouvertureN: 2.8,
  zpSys: 20.2,
  zpEstime: true,
  readNoiseE: 1.5,
  tailleRawMo: 33,
  isoSession: 640,
  sbCielNoir: 20.95,
  mLimOeil: 6.05,
  tMaxS: 200,
  domaineCpFerme: null,
  snrCible: 10,
  typeMonture: 'GEM',
}

const NGC7000: ObjetCielProfond = {
  designation: 'NGC7000',
  nomsCommuns: 'Amérique du Nord',
  adDeg: 314.75,
  decDeg: 44.52,
  type: 'EMISSION',
  majAxArcmin: 120,
  minAxArcmin: 100,
  posAngDeg: null,
  vMag: 4,
  bMag: null,
  surfBr: null,
}

describe('creneauFiche', () => {
  it('annonce le créneau que le plan de séance retient pour la même cible', () => {
    const etape = planSession(CONTEXTE, [NGC7000]).etapes[0]
    expect(etape).toBeDefined()

    const fiche = creneauFiche(CONTEXTE, NGC7000)
    if (!fiche.chiffre) throw new Error(fiche.cause)
    expect(fiche.creneau.creneaux).toEqual(etape!.creneau.creneaux)
    expect(fiche.creneau.heureCulmination).toEqual(etape!.creneau.heureCulmination)
  })

  it('nomme la cause du moteur quand la cible ne se lève pas', () => {
    const fiche = creneauFiche(CONTEXTE, { ...NGC7000, designation: 'AUSTRALE', decDeg: -80 })
    if (!fiche.chiffre) throw new Error(fiche.cause)
    expect(fiche.creneau.causeExclusion).toBe('JAMAIS_LEVE')
    expect(fiche.creneau.creneaux).toHaveLength(0)
  })

  it('ne chiffre rien sans contexte de nuit', () => {
    expect(creneauFiche(null, NGC7000)).toEqual({ chiffre: false, cause: CAUSE_NUIT_NON_CHIFFREE })
  })
})
