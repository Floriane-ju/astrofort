/**
 * §3 + §9 — un seul pointage pour les deux vues.
 *
 * Ce que ce fichier garde : le magasin de scène est bien partagé, et une visée déplacée
 * ailleurs se lit dans le grand champ. Tant que chaque vue tenait son propre état, cadrer
 * dans l'une ne cadrait pas dans l'autre.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { K } from '../src/registry/constants.ts'
import type { Site } from '../src/core/ephem.ts'
import { pointZeroSysteme } from '../src/data/equipment.ts'
import { PanneauFile } from '../src/ui/PanneauFile.tsx'
import { PanneauExplorer } from '../src/ui/PanneauExplorer.tsx'
import { modeObjectif } from '../src/ui/PanneauMateriel.tsx'
import {
  afficheInstant,
  etatScene,
  instant,
  majTemps,
  majVue,
  reinitialiseScene,
  saute,
  type EtatScene,
} from '../src/ui/scene-etat.ts'
import { epoqueAffichee } from '../src/App.tsx'

const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }

const MATERIEL = {
  site: SITE,
  focaleMm: 10,
  ouvertureN: 2.8,
  pitchUm: 5.12,
  capteurLMm: 35.9,
  capteurHMm: 23.9,
  fovLDeg: 121.7,
  fovHDeg: 100.2,
  echApx: 105.6,
  tailleRawMo: 33,
  profondeur: {
    tPoseS: 25,
    dMm: 10 / 2.8,
    zpSys: K('ZP_SYS_GENERIQUE'),
    eCielPxS: 1.68,
    readNoiseE: 1.5,
    zpEstime: true,
  },
  tMaxSuiviS: null,
  autonomieCipa: null,
  zeroSysteme: pointZeroSysteme(null),
  modeObjectif: 'MODE_CADRE',
} as const

/** La ligne d'état du grand champ porte la visée en ascension droite et déclinaison. */
function viseeAffichee(): string {
  const html = renderToStaticMarkup(createElement(PanneauFile, MATERIEL))
  return /visée[^<]*/.exec(html)?.[0] ?? ''
}

describe('§3 — le magasin de scène', () => {
  beforeEach(() => {
    reinitialiseScene()
  })

  it('part du pointage de référence, celui des deux vues avant fusion', () => {
    expect(etatScene().vue.azimutDeg).toBe(180)
    expect(etatScene().vue.hauteurDeg).toBe(K('SEUIL_HAUTEUR_IMAGERIE_DEG'))
    expect(etatScene().vue.rotationDeg).toBe(0)
    expect(etatScene().temps.modeTemps).toBe('MAINTENANT')
  })

  it('retouche sans muter : l’instantané précédent reste intact', () => {
    const avant = etatScene()
    majVue({ azimutDeg: 90 })
    expect(avant.vue.azimutDeg).toBe(180)
    expect(etatScene().vue.azimutDeg).toBe(90)
    // Le temps n'est pas touché par une retouche de vue : son identité doit survivre.
    expect(etatScene().temps).toBe(avant.temps)
  })

  it('accepte une retouche calculée à partir de l’état courant', () => {
    majVue((v) => ({ azimutDeg: v.azimutDeg + 30 }))
    expect(etatScene().vue.azimutDeg).toBe(210)
  })

  it('sépare le temps du pointage', () => {
    majTemps({ modeTemps: 'FIGE', facteur: 120 })
    expect(etatScene().temps.modeTemps).toBe('FIGE')
    expect(etatScene().temps.facteur).toBe(120)
    expect(etatScene().vue.azimutDeg).toBe(180)
  })

  it('saute d’un pas astronomique sans passer par un rendu', () => {
    const depart = instant.ms
    saute(86164)
    expect(instant.ms - depart).toBe(86164 * 1000)
  })
})

describe('§9 — le grand champ suit la visée de la scène', () => {
  beforeEach(() => {
    reinitialiseScene()
  })

  it('change de cadrage quand le pointage est déplacé ailleurs', () => {
    const initiale = viseeAffichee()
    expect(initiale).not.toBe('')
    majVue({ azimutDeg: 90, hauteurDeg: 70 })
    expect(viseeAffichee()).not.toBe(initiale)
  })
})

describe('§5.1 — le type d’objectif pilote la projection de la scène', () => {
  beforeEach(() => {
    reinitialiseScene()
  })

  it('associe une projection à chaque type d’objectif', () => {
    expect(modeObjectif('RECTILINEAIRE')).toBe('MODE_CADRE')
    expect(modeObjectif('FISHEYE')).toBe('MODE_FISHEYE')
  })

  it('n’offre à la scène que la projection de l’objectif déclaré', () => {
    // Le choix de projection est passé au panneau Explorer avec le reste des réglages de
    // scène ; ce qu'il propose reste dicté par l'objectif déclaré au panneau matériel.
    const html = renderToStaticMarkup(
      createElement(PanneauExplorer, {
        modeObjectif: modeObjectif('FISHEYE'),
        gaiaCharge: false,
        profondeurMag: 6.5,
        mLimOeil: 6.05,
        epoqueAnnee: 2026.6,
        modeNuit: false,
      }),
    )
    expect(html).toContain('MODE_FISHEYE')
    // Un objectif fisheye ne produit pas de projection gnomonique : elle n'est pas proposée.
    expect(html).not.toContain('MODE_CADRE')
  })
})

describe('T-0056 — s’abonner à une tranche, pas au magasin entier', () => {
  beforeEach(() => {
    reinitialiseScene()
  })

  /**
   * Dix secondes de temps qui défile, à la cadence à laquelle la boucle de rendu publie son
   * compte rendu (`PERIODE_DIAGNOSTIC_MS` = 500 ms) et le facteur de défilement par défaut
   * (×60). Chaque publication change l'identité de l'état : c'est le nombre de rendus qu'un
   * abonnement complet — celui que `App` portait — impose à tout l'arbre.
   */
  function publieDixSecondes(): { readonly etats: number; readonly epoques: number } {
    const depart = etatScene().msAffiche
    const etats = new Set<EtatScene>()
    const epoques = new Set<number>()
    for (let n = 1; n <= 20; n++) {
      // ×60 : une demi-seconde de montre vaut trente secondes de ciel.
      afficheInstant(depart + n * 30_000, {
        fps: 24 + (n % 3),
        etoilesExaminees: 10_000 + n,
        etoilesDessinees: 2_000 + n,
        cellules: 40,
        labels: 12,
      })
      etats.add(etatScene())
      epoques.add(epoqueAffichee(etatScene()))
    }
    return { etats: etats.size, epoques: epoques.size }
  }

  it('ne réveille l’application que quand sa tranche change', () => {
    const mesure = publieDixSecondes()
    // Avant : un rendu de `App` par publication, soit deux par seconde.
    expect(mesure.etats).toBe(20)
    // Après : l'époque de précession est prise au jour près, dix minutes de ciel ne la
    // changent pas — `App` ne se rend plus du tout pendant ces dix secondes.
    expect(mesure.epoques).toBe(1)
  })

  it('réveille quand même l’application quand le jour affiché change', () => {
    const depart = etatScene().msAffiche
    const avant = epoqueAffichee(etatScene())
    afficheInstant(depart + 2 * 86_400_000)
    expect(epoqueAffichee(etatScene())).toBeGreaterThan(avant)
  })
})
