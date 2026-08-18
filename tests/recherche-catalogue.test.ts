/**
 * T-0052 — chercher un objet du catalogue par son nom.
 *
 * Le catalogue est forgé ici : ce qui est vérifié est la règle de recherche — quoi se
 * cherche, dans quel ordre les réponses viennent — pas le contenu d'OpenNGC. Le seul point
 * qui touche le vrai catalogue est la portée : elle ne s'arrête pas au plafond de rendu.
 */

import { describe, expect, it } from 'vitest'
import { chercheCatalogue } from '../src/core/recherche-catalogue.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'

function objet(partiel: Partial<ObjetCielProfond> & { designation: string }): ObjetCielProfond {
  return {
    nomsCommuns: '',
    adDeg: 0,
    decDeg: 0,
    type: 'GALAXIE',
    majAxArcmin: 10,
    minAxArcmin: 6,
    posAngDeg: null,
    vMag: 8,
    bMag: null,
    surfBr: null,
    ...partiel,
  }
}

const M45 = objet({
  designation: 'M45',
  nomsCommuns: 'Pléiades|Mel022',
  type: 'AMAS_OUVERT',
  vMag: 1.6,
})
const M31 = objet({ designation: 'M31', nomsCommuns: 'Andromède|NGC0224', vMag: 3.4 })
const IC0434 = objet({ designation: 'IC0434', vMag: 12.1 })

const CATALOGUE = [IC0434, M31, M45]

function designations(objets: readonly ObjetCielProfond[]): readonly string[] {
  return objets.map((o) => o.designation)
}

describe('chercheCatalogue — la désignation et les noms communs', () => {
  it('trouve par désignation', () => {
    expect(designations(chercheCatalogue(CATALOGUE, 'M45', 10))).toEqual(['M45'])
  })

  it('trouve par nom commun, casse et accents ignorés', () => {
    expect(designations(chercheCatalogue(CATALOGUE, 'pleiades', 10))).toEqual(['M45'])
    expect(designations(chercheCatalogue(CATALOGUE, 'PLÉIADES', 10))).toEqual(['M45'])
  })

  it('cherche chacun des noms communs, pas seulement le premier', () => {
    expect(designations(chercheCatalogue(CATALOGUE, 'NGC0224', 10))).toEqual(['M31'])
    expect(designations(chercheCatalogue(CATALOGUE, 'Mel022', 10))).toEqual(['M45'])
  })

  it('trouve sur une occurrence interne', () => {
    expect(designations(chercheCatalogue(CATALOGUE, 'romède', 10))).toEqual(['M31'])
  })

  it('ne rend rien sur une saisie vide ou blanche', () => {
    expect(chercheCatalogue(CATALOGUE, '', 10)).toEqual([])
    expect(chercheCatalogue(CATALOGUE, '   ', 10)).toEqual([])
  })
})

describe('chercheCatalogue — l’ordre des réponses', () => {
  it('met un préfixe devant une occurrence interne, même moins brillant', () => {
    const catalogue = [
      objet({ designation: 'INTERNE', nomsCommuns: 'grande nébuleuse', vMag: 2 }),
      objet({ designation: 'PREFIXE', nomsCommuns: 'nébuleuse du Voile', vMag: 9 }),
    ]
    expect(designations(chercheCatalogue(catalogue, 'nébuleuse', 10))).toEqual([
      'PREFIXE',
      'INTERNE',
    ])
  })

  it('à rang égal, le plus brillant d’abord', () => {
    // Trois préfixes « M » : l'ordre ne peut venir que de la magnitude.
    const catalogue = [M31, M45]
    expect(designations(chercheCatalogue(catalogue, 'M', 10))).toEqual(['M45', 'M31'])
  })

  it('un objet sans magnitude ne passe pas devant un objet qui en a une', () => {
    const catalogue = [
      objet({ designation: 'NGC0001', vMag: null }),
      objet({ designation: 'NGC0002', vMag: 14 }),
    ]
    expect(designations(chercheCatalogue(catalogue, 'NGC', 10))).toEqual(['NGC0002', 'NGC0001'])
  })
})

describe('chercheCatalogue — la portée n’est pas le rendu', () => {
  it('plafonne le nombre de résultats rendus', () => {
    const catalogue = Array.from({ length: 50 }, (_, i) =>
      objet({ designation: `NGC${i}`, vMag: i }),
    )
    expect(chercheCatalogue(catalogue, 'NGC', 5)).toHaveLength(5)
  })

  it('cherche au-delà du plafond : un objet en fin de catalogue reste atteignable', () => {
    const catalogue = [
      ...Array.from({ length: 500 }, (_, i) => objet({ designation: `IC${i}` })),
      M45,
    ]
    expect(designations(chercheCatalogue(catalogue, 'M45', 10))).toEqual(['M45'])
  })
})
