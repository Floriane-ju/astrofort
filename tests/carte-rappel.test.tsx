/**
 * T-0161 — le rappel d'en-tête : ce qu'une carte dit encore quand elle est repliée.
 *
 * Deux contrats, et chacun casse en silence. Le rappel doit survivre au repli — c'est sa seule
 * raison d'être — et il doit rester MUET aux lecteurs d'écran, parce que l'en-tête est un
 * bouton dont le nom décrit l'action. Sans cela, « Cible » s'annonce « Cible facilité 4 sur 5,
 * confortable », et l'information est dite deux fois : une fois dans le nom du bouton, une
 * fois dans le corps de la carte.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { Carte } from '../src/ui/Carte.tsx'
import { Pastilles } from '../src/ui/Pastilles.tsx'
import { basculeCarte, etatCoque, ouvreCarte } from '../src/ui/coque-etat.ts'

const CORPS = 'corps-de-la-carte'

function carte(rappel: React.ReactNode) {
  return renderToStaticMarkup(
    <Carte cle="CIBLE" titre="Cible" accent="cible" rappel={rappel}>
      <p>{CORPS}</p>
    </Carte>,
  )
}

/** Le repli passe par le magasin de module, appelable sans DOM. */
function replie(): void {
  ouvreCarte('CIBLE')
  if (etatCoque().cartes.CIBLE.ouverte) basculeCarte('CIBLE')
  expect(etatCoque().cartes.CIBLE.ouverte).toBe(false)
}

afterEach(() => {
  ouvreCarte('CIBLE')
})

describe('rappel d’en-tête de carte', () => {
  it('reste visible quand le corps de la carte est replié', () => {
    replie()
    const html = carte(<Pastilles note={4} libelle="confortable" />)
    expect(html).toContain('carte-rappel')
    expect(html).toContain('facilite-pleine')
    // La preuve que le repli a bien eu lieu : sans elle, le test passerait carte ouverte.
    expect(html).not.toContain(CORPS)
  })

  it('porte le libellé qu’on lui donne, à côté des pastilles', () => {
    const html = carte(
      <>
        Facilité
        <Pastilles note={2} libelle="exigeante" />
      </>,
    )
    expect(html).toContain('Facilité')
    expect(html).toContain('facilite-pleine')
  })

  it('reste muet aux lecteurs d’écran : le nom du bouton décrit l’action, pas la note', () => {
    const html = carte(<Pastilles note={4} libelle="confortable" />)
    const entete = html.slice(html.indexOf('carte-entete'), html.indexOf('carte-corps'))

    // `aria-hidden` sur l'enveloppe élague TOUT son sous-arbre : le `role="img"` des pastilles
    // et son nom restent dans le balisage, mais sortent de l'arbre d'accessibilité. C'est cette
    // imbrication qui est le contrat — vérifier l'absence du `aria-label` vérifierait le
    // contraire, et casserait le jour où `Pastilles` gagnerait un libellé légitime ailleurs.
    const debut = entete.indexOf('class="carte-rappel"')
    expect(debut).toBeGreaterThan(-1)
    expect(entete.slice(debut)).toMatch(/^class="carte-rappel" aria-hidden="true"/)
    expect(entete.indexOf('aria-label="facilité'), 'la note est DANS le rappel masqué')
      .toBeGreaterThan(debut)
  })

  it('n’ajoute aucune enveloppe quand il n’y a rien à rappeler', () => {
    expect(carte(null)).not.toContain('carte-rappel')
    const sansRappel = renderToStaticMarkup(
      <Carte cle="CIBLE" titre="Cible">
        <p>{CORPS}</p>
      </Carte>,
    )
    expect(sansRappel).not.toContain('carte-rappel')
  })
})
