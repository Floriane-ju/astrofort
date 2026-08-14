/**
 * §2.1 — premier critère d'acceptation : aucune valeur numérique non triviale n'existe
 * hors du registre dans les moteurs de calcul.
 *
 * Ce test n'a de valeur que s'il est automatisé dès le Lot 0 : ajouté après coup, il
 * échouerait partout et serait désactivé.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { K, REGISTRE } from '../src/registry/constants.ts'
import { FORMULES } from '../src/registry/formulas.ts'
import { dependDUnOrdreDeGrandeur, trace } from '../src/core/traced.ts'

const DOSSIER_MOTEURS = join(import.meta.dirname, '..', 'src', 'core')

/**
 * Nombres tolérés dans un moteur : entiers d'indexation et de comparaison, conversions
 * d'unités de temps et d'angle, et les valeurs définitionnelles de la géométrie sphérique.
 * Tout le reste doit venir du registre.
 */
const TRIVIAUX = new Set([0, 1, 2, 3, 24, 60, 90, 180, 360, 1000, 3600, 60000])

function sansCommentairesNiChaines(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, ' ')
}

function litterauxNumeriques(source: string): number[] {
  const nettoye = sansCommentairesNiChaines(source)
  const trouves = nettoye.match(/(?<![\w.])\d+(?:_\d+)*(?:\.\d+)?(?:e-?\d+)?/gi) ?? []
  return trouves.map((brut) => Number(brut.replace(/_/g, '')))
}

describe('registre §2.1', () => {
  it('ne laisse aucune constante numérique non triviale dans les moteurs', () => {
    const fautifs: string[] = []
    for (const fichier of readdirSync(DOSSIER_MOTEURS).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(DOSSIER_MOTEURS, fichier), 'utf8')
      for (const valeur of litterauxNumeriques(source)) {
        if (!TRIVIAUX.has(valeur)) fautifs.push(`${fichier} : ${valeur}`)
      }
    }
    expect(fautifs).toEqual([])
  })

  it('est gelé : aucun ajustement à l’exécution', () => {
    expect(Object.isFrozen(REGISTRE)).toBe(true)
    expect(() => {
      // @ts-expect-error — écriture volontairement interdite
      REGISTRE.ROTATION_CIEL_DEG_H = null
    }).toThrow()
  })

  it('porte source et tolérance sur chaque entrée', () => {
    for (const [id, entree] of Object.entries(REGISTRE)) {
      expect(entree.source, id).not.toBe('')
      expect(entree.unite, id).toBeTypeOf('string')
      expect(entree.sections.length, id).toBeGreaterThan(0)
    }
  })

  it('refuse de servir une constante dépréciée', () => {
    // L'approximation linéaire du champ donne 205,7° à 10 mm : elle ne doit être
    // consommée par aucun moteur (§5.1, Annexe C).
    expect(() => K('DEG_PAR_RADIAN_APPROX')).toThrow(/dépréciée/)
  })

  it('marque comme ordre de grandeur les constantes dont la tolérance le dit', () => {
    for (const entree of Object.values(REGISTRE)) {
      if (entree.tolerance === 'ordre de grandeur') {
        expect(entree.ordreDeGrandeur, entree.libelle).toBe(true)
      }
    }
  })

  it('propage l’ordre de grandeur au résultat qui consomme la constante', () => {
    // C-07 est un plafond de terrain, pas une mesure : une sortie qui en dépend
    // s'affiche en plage, jamais comme une valeur exacte (§2.1, dernier critère).
    const approximatif = trace({
      value: K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S'),
      formula: 'MASSE_AIR',
      constants: ['PLAFOND_POSE_SANS_AUTOGUIDAGE_S'],
      range: [180, 300],
    })
    expect(dependDUnOrdreDeGrandeur(approximatif)).toBe(true)
    expect(approximatif.range).toEqual([180, 300])

    const exact = trace({ value: 1, formula: 'MASSE_AIR', constants: ['ROTATION_CIEL_DEG_H'] })
    expect(dependDUnOrdreDeGrandeur(exact)).toBe(false)
  })
})

describe('formulaire Annexe B', () => {
  it('donne une expression et une section à chaque formule', () => {
    for (const [id, formule] of Object.entries(FORMULES)) {
      expect(formule.expression, id).not.toBe('')
      expect(formule.section, id).toMatch(/^\d+(\.\d+)?$/)
    }
  })
})
