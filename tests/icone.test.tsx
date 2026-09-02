/**
 * T-0122 — l'icône est un glyphe de police, pas une image : ce qui peut casser n'est pas un
 * rendu mais un contrat. Trois choses le tiennent, et une seule suffit à afficher « CLOSE »
 * dans un bouton si elle lâche : la ligature n'est pas altérée par la casse ni par le suivi,
 * la police est livrée avec l'artefact, et le glyphe n'est pas annoncé comme du texte.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Icone } from '../src/ui/Icone.tsx'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

/** Le corps de la règle `.icone`, sans les accolades. */
function reglePointIcone(): string {
  const debut = CSS.indexOf('.icone {')
  expect(debut).toBeGreaterThan(-1)
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

/** Le corps de la `@font-face` de la police d'icônes — T-0191 en a livré d'autres. */
function faceIcone(): string {
  const faces = [...CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, corps]) => corps!)
  const face = faces.find((corps) => corps.includes("'Material Symbols Sharp'"))
  expect(face).toBeDefined()
  return face!
}

describe('composant Icone', () => {
  it('rend la ligature demandée dans la classe de style commune', () => {
    const html = renderToStaticMarkup(<Icone nom="close" />)
    expect(html).toContain('close')
    expect(html).toMatch(/class="icone"/)
  })

  it('cache le glyphe aux lecteurs d’écran quand le contrôle porte déjà son libellé', () => {
    // Sans cela, un bouton « Fermer le panneau » s'annonce « Fermer le panneau close ».
    expect(renderToStaticMarkup(<Icone nom="close" />)).toContain('aria-hidden="true"')
  })

  it('redevient une image nommée quand elle porte seule l’information', () => {
    const html = renderToStaticMarkup(<Icone nom="visibility_off" libelle="Cible masquée" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Cible masquée"')
    expect(html).not.toContain('aria-hidden')
  })

  it('accepte une classe supplémentaire sans perdre le style de base', () => {
    expect(renderToStaticMarkup(<Icone nom="close" classe="lateral-fermer" />)).toMatch(
      /class="icone lateral-fermer"/,
    )
  })
})

describe('style des icônes §11.1', () => {
  it('neutralise la casse et le suivi, sans quoi la ligature ne se forme plus', () => {
    // `--suivi-micro` et les capitales sont la grammaire des libellés de T-0113 : une icône
    // posée dans l'un d'eux en hérite.
    const regle = reglePointIcone()
    expect(regle).toMatch(/text-transform:\s*none/)
    expect(regle).toMatch(/letter-spacing:\s*normal/)
  })

  it('trace les glyphes à l’épaisseur 300, plus fine que le nominal de la police', () => {
    expect(reglePointIcone()).toMatch(/font-variation-settings:[^;]*'wght'\s*300/)
  })

  it('nomme la famille par le jeton, jamais en dur', () => {
    expect(reglePointIcone()).toMatch(/font-family:\s*var\(--police-icone\)/)
  })

  it('embarque le fichier de police plutôt que d’aller le chercher (§12.2, §13.1)', () => {
    const face = faceIcone()
    const source = /src:\s*url\('([^']+)'\)/.exec(face)?.[1]
    expect(source).toBeDefined()
    expect(source).not.toMatch(/^https?:/)
    // Le chemin est relatif à `src/ui/` : il doit désigner un fichier réellement versionné.
    expect(() =>
      readFileSync(join(import.meta.dirname, '..', 'src', 'ui', source!)),
    ).not.toThrow()
  })

  it('déclare la famille du fichier sous le nom que le jeton référence', () => {
    const famille = /--police-icone:\s*([^;]+);/.exec(CSS)?.[1]?.trim()
    expect(famille).toBeDefined()
    expect(faceIcone()).toContain(`font-family: ${famille}`)
  })
})
