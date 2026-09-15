/**
 * T-0210 — l'écran noir n'est plus une issue possible.
 *
 * L'application se montait sans aucune frontière d'erreur : une levée en rendu démontait
 * l'arbre React entier, et la page devenait vide sans rien dire. C'est ce qu'une latitude de
 * 456° produisait.
 *
 * Le cas qui compte est celui qu'une garde naïve laisserait passer : `astronomy-engine` lève
 * des CHAÎNES de caractères, pas des `Error`. Une garde écrite autour de `erreur.message`
 * afficherait « undefined ».
 *
 * La classe elle-même ne se rend pas ici : React n'active pas les frontières d'erreur au rendu
 * serveur, et c'est le seul rendu dont ce projet dispose (`environment: 'node'`). Ses deux
 * moitiés se vérifient séparément — la conversion de la cause, et l'écran qui l'affiche.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EcranInterrompu, GardeErreur } from '../src/ui/GardeErreur.tsx'

describe('la cause reste lisible, quelle que soit la forme de la levée', () => {
  it('une chaîne levée — le cas d’astronomy-engine — devient la cause affichée', () => {
    const levee = 'Latitude 456 is out of range. Must be -90..+90.'
    expect(GardeErreur.getDerivedStateFromError(levee)).toEqual({ cause: levee })
  })

  it('une Error donne son message, pas son inspection', () => {
    expect(GardeErreur.getDerivedStateFromError(new Error('nuit incalculable'))).toEqual({
      cause: 'nuit incalculable',
    })
  })

  it('une levée sans forme connue reste dite plutôt qu’avalée', () => {
    expect(GardeErreur.getDerivedStateFromError({ code: 12 }).cause).not.toBe('')
    expect(GardeErreur.getDerivedStateFromError(null).cause).toBe('null')
  })
})

describe('l’écran de repli', () => {
  const markup = renderToStaticMarkup(<EcranInterrompu cause="Latitude 456 is out of range." />)

  it('énonce la cause au lieu de laisser la page vide', () => {
    expect(markup).toContain('Latitude 456 is out of range.')
    expect(markup).not.toBe('')
  })

  it('se signale aux technologies d’assistance', () => {
    expect(markup).toContain('role="alert"')
  })

  it('offre une sortie, et dit que rien n’est perdu', () => {
    expect(markup).toContain('<button')
    expect(markup).toContain('Recharger')
    expect(markup).toContain('intactes')
  })
})

describe('tant que rien ne lève, la garde est transparente', () => {
  it('rend ses enfants tels quels', () => {
    expect(
      renderToStaticMarkup(
        <GardeErreur>
          <p>le ciel</p>
        </GardeErreur>,
      ),
    ).toBe('<p>le ciel</p>')
  })
})
