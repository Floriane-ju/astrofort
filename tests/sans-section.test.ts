/**
 * §1.5 — le registre garde ses renvois au PRD, l'interface n'en montre aucun.
 *
 * Le corpus est balayé en entier plutôt qu'échantillonné : une constante ajoutée demain
 * avec une forme de renvoi inédite fait échouer ce test, pas l'affichage.
 */

import { describe, expect, test } from 'vitest'
import { REGISTRE } from '../src/registry/constants.ts'
import { FORMULES } from '../src/registry/formulas.ts'
import { sansSection } from '../src/ui/sans-section.ts'

/** Tout ce que la valeur tracée déplie sous une formule. */
function textesAffiches(): readonly string[] {
  const constantes = Object.values(REGISTRE).flatMap((c) => [c.source, c.tolerance ?? ''])
  const formules = Object.values(FORMULES).map((f) => ('note' in f ? f.note : ''))
  return [...constantes, ...formules].filter((t) => t.includes('§'))
}

describe('sansSection', () => {
  test('le corpus du registre citant le PRD n’est pas vide', () => {
    expect(textesAffiches().length).toBeGreaterThan(0)
  })

  test('aucun renvoi ne survit au rendu', () => {
    const restants = textesAffiches().filter((t) => sansSection(t).includes('§'))
    expect(restants).toEqual([])
  })

  // Le retrait ne doit pas laisser de préposition orpheline ni de ponctuation en l'air.
  // Le décompte est comparé au texte d'origine : une expression mathématique déjà espacée
  // ainsi (`exp( −|b| / 20° )`) n'est pas une régression.
  test('la phrase reste grammaticale une fois le renvoi retiré', () => {
    const orphelins = (t: string) => t.match(/\s,|\s\.|\s\)|(^|\s)(de|du|par|à)\s*[,.:]/g)?.length ?? 0
    const bancal = textesAffiches().filter((t) => orphelins(sansSection(t)) > orphelins(t))
    expect(bancal).toEqual([])
  })

  test('le renvoi en tête part avec son tiret, la suite est conservée', () => {
    expect(sansSection('§8.3 et §8.4 — cheminement ou carte directe')).toBe(
      'cheminement ou carte directe',
    )
  })

  test('une parenthèse qui ne porte que le renvoi disparaît entièrement', () => {
    expect(sansSection('jamais appliqué en silence (§2.4)')).toBe('jamais appliqué en silence')
  })

  test('une parenthèse qui porte aussi une précision garde la précision', () => {
    expect(sansSection('une plage (§2.1, dernier critère)')).toBe('une plage (dernier critère)')
  })

  test('un texte sans renvoi traverse inchangé', () => {
    const source = 'Garstang, via Krisciunas & Schaefer (1991)'
    expect(sansSection(source)).toBe(source)
  })
})
