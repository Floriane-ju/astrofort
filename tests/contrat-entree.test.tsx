/**
 * Livrable vérifiable du Lot 1 : un lieu et un matériel saisis produisent, À L'ÉCRAN, le
 * champ, l'échantillonnage, la pose maximale et les seuils de déclinaison du site.
 *
 * Le rendu statique suffit : il n'y a rien à cliquer pour que le contrat d'entrée produise
 * ses sorties, et c'est précisément ce qu'on vérifie. Les variantes qui demandent une
 * interaction — recadrage APS-C, suivi actif — sont couvertes sur leurs moteurs.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { GLOSSAIRE } from '../src/registry/glossaire.ts'

const ecran = renderToStaticMarkup(<App />)

describe('contrat d’entrée — écran par défaut, setup de l’Annexe A', () => {
  it('affiche le champ du profil de référence', () => {
    // 17,01° × 11,37° : l'Annexe A annonce 17,02 × 11,38, arrondis d'un intermédiaire.
    expect(ecran).toContain('17.01')
    expect(ecran).toContain('11.37')
  })

  it('affiche l’échantillonnage, la pupille et le pouvoir séparateur', () => {
    expect(ecran).toContain('8.80')
    expect(ecran).toContain('42.86')
    expect(ecran).toContain('2.71')
  })

  it('affiche la pose maximale sans suivi', () => {
    expect(ecran).toContain('2.10')
  })

  it('affiche les seuils de déclinaison du site', () => {
    expect(ecran).toContain('-13.6')
    expect(ecran).toContain('-23.6')
    expect(ecran).toContain('43.6')
  })

  it('annonce le grand champ assumé sans le présenter comme un défaut', () => {
    expect(ecran).toContain('Grand champ assumé')
    expect(ecran).not.toContain('Sur-échantillonné')
  })

  it('affiche le masque plat comme une hypothèse, pas comme une mesure', () => {
    expect(ecran).toContain('[HYP]')
    expect(ecran).toContain('horizon plat')
  })

  it('ferme le ciel profond faute de suivi, en renvoyant au grand champ', () => {
    expect(ecran).toContain('[DONNÉE MANQUANTE]')
    expect(ecran).toMatch(/domaine ciel profond est fermé/)
  })

  it('glose chaque terme technique au contact', () => {
    for (const cle of ['champ', 'echantillonnage', 'npf', 'masque_horizon'] as const) {
      expect(ecran, cle).toContain(GLOSSAIRE[cle].glose)
    }
  })
})
