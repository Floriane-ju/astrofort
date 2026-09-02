/**
 * T-0189 — Échap referme la bulle et les tiroirs (WCAG 2.2, 1.4.13 et motif « disclosure »).
 *
 * Ce qui se vérifie ici n'est pas un événement du DOM mais la règle de priorité : une glose
 * ouverte se congédie AVANT le tiroir qui la porte, faute de quoi une seule touche emporterait
 * les deux et l'utilisateur perdrait le tiroir qu'il consultait. Le branchement DOM est un
 * `addEventListener` sur le document ; c'est la décision qui porte le test, comme pour le
 * clavier du planétarium (T-0069).
 *
 * Le reste du contrat se lit dans la feuille de style : la bulle reste survolable et
 * persistante — congédier ne doit pas avoir retiré `:hover` / `:focus-within` à l'ancre.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cibleEchap } from '../src/ui/gere-echap.ts'

const RACINE = join(import.meta.dirname, '..', 'src')
const CSS = readFileSync(join(RACINE, 'ui', 'styles.css'), 'utf8')

describe('T-0189 — ce qu’Échap ferme', () => {
  it('congédie la bulle avant le tiroir qui la porte', () => {
    expect(cibleEchap('Escape', true, true)).toBe('BULLE')
  })

  it('referme le tiroir quand aucune bulle n’est ouverte', () => {
    expect(cibleEchap('Escape', false, true)).toBe('TIROIR')
  })

  it('congédie la bulle ouverte hors de tout tiroir', () => {
    expect(cibleEchap('Escape', true, false)).toBe('BULLE')
  })

  it('ne ferme rien quand rien n’est ouvert', () => {
    expect(cibleEchap('Escape', false, false)).toBe('RIEN')
  })

  it('ne répond qu’à Échap', () => {
    for (const touche of ['Enter', ' ', 'ArrowDown', 'Tab', 'esc', 'Escape ']) {
      expect(cibleEchap(touche, true, true), touche).toBe('RIEN')
    }
  })
})

describe('T-0189 — la bulle reste survolable et persistante', () => {
  it('son ouverture tient toujours au survol et au focus de l’ancre, sans JavaScript', () => {
    expect(CSS).toContain('.bulle-ancre:hover > .bulle')
    expect(CSS).toContain('.bulle-ancre:focus-within > .bulle')
  })

  it('le composant ne pose aucune écoute : l’écoute est unique, sur le document', () => {
    const bulle = readFileSync(join(RACINE, 'ui', 'Bulle.tsx'), 'utf8')
    expect(bulle).not.toContain('addEventListener')
    expect(bulle).not.toContain('useEffect')
    const app = readFileSync(join(RACINE, 'App.tsx'), 'utf8')
    expect(app).toContain('installeEchap(document)')
  })
})

describe('T-0189 — les trois tiroirs sont couverts par la même règle', () => {
  it('aucun tiroir ne garde sa propre écoute d’Échap', () => {
    for (const fichier of ['BarreHaut.tsx', 'BarreBas.tsx', 'MenuReglages.tsx', 'Verification.tsx']) {
      const source = readFileSync(join(RACINE, 'ui', fichier), 'utf8')
      expect(source, fichier).not.toContain("'Escape'")
    }
  })

  it('les trois tiroirs portent la classe que l’écoute reconnaît', () => {
    const barreHaut = readFileSync(join(RACINE, 'ui', 'BarreHaut.tsx'), 'utf8')
    const barreBas = readFileSync(join(RACINE, 'ui', 'BarreBas.tsx'), 'utf8')
    expect(barreHaut).toContain('className="tiroir tiroir-nuit"')
    expect(barreHaut).toContain('className="tiroir tiroir-outils"')
    expect(barreBas).toContain('className="tiroir tiroir-site"')
  })
})
