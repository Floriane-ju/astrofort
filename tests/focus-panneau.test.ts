/**
 * T-0188 — le focus suit le panneau quand son contenu change.
 *
 * Ce qui se vérifie ici est la règle, pas l'appel à `.focus()` : la liste et la fiche ne
 * coexistent jamais dans le DOM, donc c'est la DÉCISION — où aller, et vers quoi se replier
 * quand la ligne d'origine a disparu — qui porte le contrat du motif « détail puis retour »
 * de l'APG. Le branchement, lui, est un `useEffect` de six lignes dans `RegionSeance`.
 *
 * L'identifiant de ligne se teste avec : c'est lui qui fait le lien entre la fiche qu'on
 * quitte et la ligne qu'on retrouve, et une désignation porte des espaces.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cibleFocus, idLigneCible } from '../src/ui/focus-panneau.ts'
import { etatSeance, ouvreCible, poseMode, reinitialiseSeance } from '../src/ui/seance-etat.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'

afterEach(() => {
  reinitialiseSeance()
})

describe('T-0188 — la séquence liste → fiche → retour', () => {
  it('ouvrir une fiche fait entrer le focus dans la fiche', () => {
    expect(cibleFocus('LISTE', 'FICHE', false)).toBe('TITRE_FICHE')
  })

  it('revenir rend le focus à la ligne d’où l’on est parti', () => {
    expect(cibleFocus('FICHE', 'LISTE', true)).toBe('LIGNE_CIBLE')
  })

  it('se replie sur la recherche quand les filtres ont écarté la ligne', () => {
    expect(cibleFocus('FICHE', 'LISTE', false)).toBe('CHAMP_RECHERCHE')
  })

  it('ne déplace jamais le focus quand la vue n’a pas changé', () => {
    expect(cibleFocus('LISTE', 'LISTE', true)).toBeNull()
    expect(cibleFocus('FICHE', 'FICHE', false)).toBeNull()
  })

  it('ne rend jamais « nulle part » sur un retour : le focus ne retombe pas sur le corps', () => {
    for (const presente of [true, false]) {
      expect(cibleFocus('FICHE', 'LISTE', presente)).not.toBeNull()
    }
  })
})

describe('T-0188 — retrouver la ligne d’une cible', () => {
  it('rend un identifiant que le document peut porter', () => {
    for (const designation of ['M31', 'NGC 7000', 'IC 1396A', 'Sh2-155', 'Barnard 33']) {
      const id = idLigneCible(designation)
      expect(id, designation).toMatch(/^cible-[A-Za-z0-9-]+$/)
    }
  })

  it('reste stable pour une même désignation, et distingue deux cibles', () => {
    expect(idLigneCible('NGC 7000')).toBe(idLigneCible('NGC 7000'))
    expect(idLigneCible('M31')).not.toBe(idLigneCible('M32'))
  })
})

describe('T-0188 — la bascule de mode ne perd pas le focus de son bouton', () => {
  /**
   * Le bouton de bascule survit au changement : il est rendu dans les deux modes, donc le
   * navigateur lui garde le focus sans aucun code. Ce qui pourrait le lui retirer serait un
   * démontage du panneau — c'est-à-dire un changement de `vueCibles`. Changer de mode n'en
   * provoque pas, et c'est ce que ce test tient.
   */
  const CIBLE = {
    designation: 'M31',
    nomsCommuns: 'Andromède',
    adDeg: 10.6847,
    decDeg: 41.269,
    type: 'GALAXIE',
    majAxArcmin: 189.1,
    minAxArcmin: 61.7,
    posAngDeg: 35,
    vMag: 3.4,
    bMag: 4.4,
    surfBr: 13.5,
  } as const satisfies ObjetCielProfond

  it('laisse la vue du panneau telle quelle dans les deux sens', () => {
    ouvreCible(CIBLE)
    expect(etatSeance().vueCibles).toBe('FICHE')

    poseMode('PANORAMA')
    expect(etatSeance().vueCibles).toBe('FICHE')

    poseMode('CIEL_PROFOND')
    expect(etatSeance().vueCibles).toBe('FICHE')
    expect(cibleFocus('FICHE', etatSeance().vueCibles, true)).toBeNull()
  })
})
