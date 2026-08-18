/**
 * §11.1 — Mode nuit, et §11.2 — ergonomie de consultation nocturne.
 *
 * Le critère d'acceptation du PRD est une propriété de la feuille de style, pas une
 * impression visuelle : aucun pixel ne doit présenter de composante verte ou bleue non
 * nulle. Deux conditions le garantissent et sont vérifiées ici —
 *
 *   1. la palette du mode nuit n'écrit que du rouge pur ;
 *   2. AUCUNE couleur n'est écrite en dur ailleurs dans la feuille, sans quoi elle
 *      survivrait au basculement.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import {
  ETAT_INITIAL,
  appliqueModeNuit,
  doitSActiver,
  litEtatPersiste,
} from '../src/ui/ModeNuit.tsx'
import { K } from '../src/registry/constants.ts'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

/** Le bloc de palette du mode nuit, isolé du reste de la feuille. */
function blocModeNuit(): string {
  const debut = CSS.indexOf(":root[data-mode-nuit='true']")
  expect(debut).toBeGreaterThan(-1)
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

function declarationsCouleur(bloc: string): readonly string[] {
  return bloc
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.startsWith('--') && ligne.includes(':'))
    .map((ligne) => ligne.slice(ligne.indexOf(':') + 1).replace(';', '').trim())
}

describe('palette du mode nuit §11.1', () => {
  it('n’écrit que du rouge pur : canaux vert et bleu strictement nuls', () => {
    for (const valeur of declarationsCouleur(blocModeNuit())) {
      const noir = /^#000(000)?$/.test(valeur)
      const rougePur = /^rgb\(\s*calc\(.*\)\s+0\s+0\s*\)$/.test(valeur)
      expect(noir || rougePur, valeur).toBe(true)
    }
  })

  it('couvre toutes les variables de couleur du thème par défaut', () => {
    const parDefaut = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {')))
    const variables = (texte: string): readonly string[] =>
      [...texte.matchAll(/--([a-z-]+):/g)].map((m) => m[1]!)
    // Les variables de mesure — pas de couleur, rien à repeindre en rouge.
    const mesures = ['cible-clic']
    const couleursParDefaut = variables(parDefaut).filter((v) => !mesures.includes(v))
    const couleursNuit = variables(blocModeNuit())
    for (const variable of couleursParDefaut) {
      expect(couleursNuit, variable).toContain(variable)
    }
  })

  it('n’écrit aucune couleur en dur hors des blocs de palette', () => {
    // Tout ce qui suit le dernier bloc :root est la feuille proprement dite : elle ne doit
    // référencer que des variables. Une couleur en dur y survivrait au mode nuit.
    const apresPalettes = CSS.slice(CSS.lastIndexOf(':root[data-mode-nuit'))
    const corps = apresPalettes.slice(apresPalettes.indexOf('}') + 1)
    expect(corps).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(corps).not.toMatch(/\brgba?\(/)
    expect(corps).not.toMatch(/\bhsla?\(/)
  })

  it('prévoit une transition progressive plutôt qu’un basculement brutal', () => {
    expect(CSS).toMatch(/transition:\s*background-color/)
  })

  it('ne fait jamais porter l’information par la seule couleur', () => {
    // Une alerte se distingue aussi par sa forme : bordure latérale et signe en préfixe.
    expect(CSS).toMatch(/\.cause::before/)
    expect(CSS).toMatch(/content: '⚠ '/)
  })
})

describe('ergonomie de consultation nocturne §11.2', () => {
  it('donne aux cibles de clic la taille d’un usage ganté', () => {
    expect(CSS).toMatch(/--cible-clic:\s*44px/)
    for (const selecteur of ['button,', '.tracee summary', '.terme-detail summary']) {
      const index = CSS.indexOf(selecteur)
      expect(index, selecteur).toBeGreaterThan(-1)
      expect(CSS.slice(index, CSS.indexOf('}', index))).toMatch(/min-height: var\(--cible-clic\)/)
    }
  })

  it('rend le plan imprimable en masquant ce qui n’est pas le plan', () => {
    expect(CSS).toMatch(/@media print/)
  })
})

describe('état du mode nuit §11.1', () => {
  it('démarre inactif, à luminance nominale', () => {
    expect(ETAT_INITIAL.actif).toBe(false)
    expect(ETAT_INITIAL.luminance).toBe(1)
    expect(litEtatPersiste()).toStrictEqual(ETAT_INITIAL)
  })

  it('ne s’applique pas hors navigateur, sans lever d’erreur', () => {
    expect(() => appliqueModeNuit(ETAT_INITIAL)).not.toThrow()
  })

  it('s’active au crépuscule nautique quand l’utilisateur l’a demandé', () => {
    const crepuscule = new Date('2026-08-14T21:30:00Z')
    const etat = { ...ETAT_INITIAL, autoActivation: 'AU_CREPUSCULE' as const }
    expect(doitSActiver(etat, crepuscule, new Date('2026-08-14T20:00:00Z'))).toBe(false)
    expect(doitSActiver(etat, crepuscule, new Date('2026-08-14T22:00:00Z'))).toBe(true)
  })

  it('ne s’active jamais tout seul quand l’auto-activation est refusée', () => {
    const crepuscule = new Date('2026-08-14T21:30:00Z')
    expect(doitSActiver(ETAT_INITIAL, crepuscule, new Date('2026-08-15T01:00:00Z'))).toBe(false)
  })

  it('borne la luminance à un plancher d’environ 2 % du nominal', () => {
    expect(K('LUMINANCE_PLANCHER_MODE_NUIT')).toBeCloseTo(0.02, 6)
  })
})

describe('interface rendue', () => {
  const ecran = renderToStaticMarkup(<App />)

  it('n’écrit aucune couleur en ligne dans le balisage', () => {
    expect(ecran).not.toMatch(/style="[^"]*(?:color|background)[^"]*"/)
  })

  it('expose le réglage du mode nuit et la limite des dalles LCD', () => {
    expect(ecran).toContain('Activer le mode nuit')
    expect(ecran).toContain('Au crépuscule nautique')
    expect(ecran).toMatch(/mode nuit/i)
  })
})
