/**
 * §3.2 — Curseur temporel et plafond de vitesse.
 *
 * Les deux chiffres du PRD sont vérifiés tels quels : 0,13 px/s au temps réel sur un
 * viewport de 1920 px à 60° de champ, et un plafond ramené sous ×374 dès qu'on zoome à 5°.
 * Le second est le critère d'acceptation du ticket : le curseur est couplé au zoom.
 */

import { describe, expect, it } from 'vitest'
import {
  PAS_ASTRONOMIQUES,
  etatLisibilite,
  facteurMax,
  pasAstronomique,
  pxParDegre,
  reglageVitesse,
  vitesseEcran,
} from '../src/core/curseur-temps.ts'
import { K } from '../src/registry/constants.ts'

const VIEWPORT = 1920

describe('vitesse écran §3.2', () => {
  it('donne 32 px/° à 60° de champ sur 1920 px', () => {
    expect(pxParDegre(VIEWPORT, 60)).toBe(32)
  })

  it('condamne le temps réel : 0,13 px/s, imperceptible', () => {
    const v = vitesseEcran(1, 32)
    expect(v.value).toBeCloseTo(0.13, 2)
    expect(etatLisibilite(v.value)).toBe('IMPERCEPTIBLE')
  })

  it('reproduit la table du PRD, du lisible au repliement', () => {
    expect(vitesseEcran(60, 32).value).toBeCloseTo(8.0, 1)
    expect(etatLisibilite(vitesseEcran(60, 32).value)).toBe('LISIBLE')
    expect(vitesseEcran(600, 32).value).toBeCloseTo(80.2, 1)
    expect(etatLisibilite(vitesseEcran(600, 32).value)).toBe('LISIBLE')
    expect(vitesseEcran(3600, 32).value).toBeCloseTo(481, 0)
    expect(etatLisibilite(vitesseEcran(3600, 32).value)).toBe('RAPIDE')
    expect(vitesseEcran(10000, 32).value).toBeCloseTo(1337, 0)
    expect(etatLisibilite(vitesseEcran(10000, 32).value)).toBe('REPLIEMENT')
  })

  it('plafonne à ×4 488 en vue large et à ×374 à 5° de champ', () => {
    expect(facteurMax(32).value).toBeCloseTo(4488, 0)
    expect(facteurMax(pxParDegre(VIEWPORT, 5)).value).toBeCloseTo(374, 0)
  })
})

describe('couplage du curseur au zoom §3.2', () => {
  it('ramène ×3600 sous ×374 quand on zoome de 60° à 5°, et le signale', () => {
    const large = reglageVitesse(3600, VIEWPORT, 60)
    expect(large.ajuste).toBe(false)
    expect(large.facteur).toBe(3600)

    const serre = reglageVitesse(3600, VIEWPORT, 5)
    expect(serre.ajuste).toBe(true)
    expect(serre.facteur).toBeLessThan(374)
    expect(serre.facteur).toBeCloseTo(serre.facteurMax.value, 6)
    expect(serre.message).toMatch(/ramené/)
    expect(serre.message).toMatch(/illisible/)
    // L'ajustement remet la vue dans la plage lisible plutôt que de laisser replier.
    expect(serre.etat).not.toBe('REPLIEMENT')
  })

  it('propose un facteur utile plutôt que d’animer dans le vide', () => {
    const reel = reglageVitesse(1, VIEWPORT, 60)
    expect(reel.etat).toBe('IMPERCEPTIBLE')
    expect(reel.facteurPropose).toBe(60)
    expect(reel.message).toMatch(/imperceptible/)
  })

  it('conserve le sens de la marche arrière', () => {
    const arriere = reglageVitesse(-3600, VIEWPORT, 5)
    expect(arriere.facteur).toBeLessThan(0)
    expect(Math.abs(arriere.facteur)).toBeCloseTo(arriere.facteurMax.value, 6)
  })

  it('ne signale rien quand le réglage est déjà lisible', () => {
    const bon = reglageVitesse(600, VIEWPORT, 60)
    expect(bon.etat).toBe('LISIBLE')
    expect(bon.message).toBeUndefined()
    expect(bon.ajuste).toBe(false)
  })
})

describe('pas astronomiques §3.2', () => {
  it('cale les quatre pas sur des périodes réelles du registre', () => {
    expect(pasAstronomique('JOUR_SIDERAL').dureeS).toBe(K('JOUR_SIDERAL_S'))
    expect(pasAstronomique('JOUR_SOLAIRE').dureeS).toBe(K('JOUR_SOLAIRE_S'))
    expect(pasAstronomique('MOIS_SYNODIQUE').dureeS).toBe(
      K('MOIS_SYNODIQUE_J') * K('JOUR_SOLAIRE_S'),
    )
    expect(pasAstronomique('ANNEE_TROPIQUE').dureeS).toBe(
      K('ANNEE_TROPIQUE_J') * K('JOUR_SOLAIRE_S'),
    )
  })

  it('dit ce que chaque pas enseigne — « +1 heure » n’enseignerait rien', () => {
    for (const pas of PAS_ASTRONOMIQUES) {
      expect(pasAstronomique(pas).enseigne.length, pas).toBeGreaterThan(20)
    }
    expect(pasAstronomique('JOUR_SIDERAL').enseigne).toMatch(/planètes/)
  })
})
