/**
 * T-0195 — §5.2 : sans suivi, la portée « Photographiables » ne se contente pas d'être vide.
 *
 * Une liste vide muette envoie chercher le levier dans les filtres — type, magnitude — alors
 * que le levier est le toggle de suivi. Le panneau doit donc porter la phrase du moteur.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { majCatalogue, reinitialiseCatalogue } from '../src/ui/catalogue-etat.ts'
import { reinitialiseScene } from '../src/ui/scene-etat.ts'
import { reinitialiseSeance } from '../src/ui/seance-etat.ts'
import { reinitialiseCoque } from '../src/ui/coque-etat.ts'

function panneauCibles(): string {
  const html = renderToStaticMarkup(<App />)
  const debut = html.indexOf('class="cibles"')
  expect(debut).toBeGreaterThan(-1)
  return html.slice(debut, html.indexOf('</section>', debut))
}

afterEach(() => {
  reinitialiseCatalogue()
  reinitialiseScene()
  reinitialiseSeance()
  reinitialiseCoque()
})

describe('T-0195 — la portée « Photographiables » dit pourquoi elle est vide', () => {
  it('nomme le suivi, pas les filtres, quand le domaine est verrouillé', () => {
    majCatalogue({ portee: 'PHOTOGRAPHIABLES' })
    const panneau = panneauCibles()
    expect(panneau).toContain('domaine ciel profond est fermé')
    expect(panneau).not.toContain('Aucun objet ne passe ces filtres')
  })
})
