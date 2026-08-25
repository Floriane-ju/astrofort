/**
 * §6.4 — la vue de l'image de cible : alternative textuelle, absence silencieuse, mode nuit.
 *
 * La suite tourne en environnement `node`, sans DOM : les effets React ne s'exécutent pas.
 * C'est exactement la condition à vérifier ici — au premier rendu, aucune image n'est encore
 * résolue, et ce rendu-là ne doit poser NI cadre vide, NI gabarit, NI message. Le chemin
 * réseau lui-même est couvert par `imagerie-cible.test.ts`, où le service est bouchonné.
 *
 * Le traitement nocturne est vérifié sur la feuille de style, comme tout §11.1 : une règle
 * supprimée par mégarde ne casse aucun rendu, elle laisse seulement fuir du vert et du bleu.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'
import { ImageCible, VignetteCible, alternativeCible } from '../src/ui/ImageCible.tsx'
import { ApercuCadre } from '../src/ui/ApercuCadre.tsx'
import { fovDeg } from '../src/core/optics.ts'
import { DOMAINES } from '../src/registry/domains.ts'
import { LIBELLE_TYPE_OBJET, nomCommun } from '../src/ui/libelles-objet.ts'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

function paquet(nom: string): ArrayBuffer {
  const octets = readFileSync(join(import.meta.dirname, '..', 'public', 'data', nom))
  return octets.buffer.slice(
    octets.byteOffset,
    octets.byteOffset + octets.byteLength,
  ) as ArrayBuffer
}

const CATALOGUE: readonly ObjetCielProfond[] = decodeObjets({
  enregistrements: paquet('openngc-1.bin'),
  chaines: paquet('openngc-noms-1.bin'),
})

/** Le corps d'une règle, désignée par son sélecteur en début de ligne. */
function regle(selecteur: string): string {
  const debut = CSS.indexOf(`\n${selecteur} {`)
  expect(debut, selecteur).toBeGreaterThan(-1)
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

describe('alternative textuelle §6.4', () => {
  it('décrit l’objet, jamais le média', () => {
    for (const objet of CATALOGUE.slice(0, 500)) {
      const texte = alternativeCible(objet)
      expect(texte, objet.designation).toContain(objet.designation)
      expect(texte, objet.designation).toContain(LIBELLE_TYPE_OBJET[objet.type])
      // « image de M31 » n'apprend rien à qui ne voit pas l'image.
      expect(texte.toLowerCase(), objet.designation).not.toContain('image')
      expect(texte.toLowerCase(), objet.designation).not.toContain('photo')
      expect(texte.toLowerCase(), objet.designation).not.toContain('vignette')
    }
  })

  it('donne le nom commun quand le catalogue en porte un', () => {
    const nomme = CATALOGUE.find((o) => nomCommun(o) !== '')
    expect(nomme).toBeDefined()
    expect(alternativeCible(nomme!)).toContain(nomCommun(nomme!))
  })
})

describe('absence d’image §12.5', () => {
  const objet = CATALOGUE[0]!

  it('ne pose ni cadre vide ni gabarit tant qu’il n’y a rien à montrer', () => {
    expect(renderToStaticMarkup(<ImageCible objet={objet} />)).toBe('')
    expect(renderToStaticMarkup(<VignetteCible objet={objet} />)).toBe('')
  })

  it('ne rend rien du tout pour une cible personnalisée, qui n’a pas d’identité au catalogue', () => {
    expect(renderToStaticMarkup(<ImageCible objet={null} />)).toBe('')
  })

  it('ne signale l’absence par aucun message', () => {
    const rendu = renderToStaticMarkup(<ImageCible objet={objet} />)
    expect(rendu).not.toMatch(/erreur|indisponible|introuvable/i)
  })
})

describe('lisibilité en mode nuit §11.1', () => {
  it('éteint le vert et le bleu par un fondu multiplicatif, pas par un filtre de teinte', () => {
    // image × rouge pur = (R, 0, 0), exactement. Un `filter: hue-rotate` laisserait fuir.
    const fondu = regle(":root[data-mode-nuit='true'] .image-cible-vue img")
    expect(fondu).toMatch(/mix-blend-mode:\s*multiply/)
    expect(CSS).not.toMatch(/filter:\s*[^;]*hue-rotate/)
  })

  it('multiplie contre un jeton de palette, donc contre du rouge pur la nuit', () => {
    const fond = regle(":root[data-mode-nuit='true'] .image-cible-vue")
    // Une couleur écrite en dur ici survivrait au basculement et ruinerait le fondu.
    expect(fond).toMatch(/background:\s*var\(--[a-z-]+\)/)
  })

  it('garde à la vignette de liste la hauteur d’une cible de clic', () => {
    // Sans hauteur fixe, une ligne avec image sauterait par rapport à celles sans.
    expect(regle('.cible-vignette')).toMatch(/height: var\(--cible-clic\)/)
  })
})

// ---------------------------------------------------------------------------
// §6.2 — l'aperçu du cadre
// ---------------------------------------------------------------------------

const COTE_CAPTEUR_MM = 36
const FOV_L = fovDeg(COTE_CAPTEUR_MM, DOMAINES.focale_mm.max).value
const FOV_H = fovDeg(COTE_CAPTEUR_MM * (2 / 3), DOMAINES.focale_mm.max).value

describe('aperçu du cadre §6.2', () => {
  const objet = CATALOGUE[0]!

  it('ne pose rien tant que la découpe n’est pas là', () => {
    // Hors réseau, c'est l'état permanent : §12.5 dit que la vue tombe, et sa dégradation
    // nommée est le cadre schématique de §9.2 — déjà dessiné sur la scène, pas ici.
    const rendu = renderToStaticMarkup(
      <ApercuCadre objet={objet} fovLDeg={FOV_L} fovHDeg={FOV_H} angleBoitierDeg={null} />,
    )
    expect(rendu).toBe('')
  })

  it('ne pose rien pour une cible personnalisée', () => {
    expect(
      renderToStaticMarkup(
        <ApercuCadre objet={null} fovLDeg={FOV_L} fovHDeg={FOV_H} angleBoitierDeg={null} />,
      ),
    ).toBe('')
  })

  it('pose le rectangle du cadre en surimpression, pas à côté', () => {
    // Sans `position: relative` sur le conteneur, le rectangle se placerait par rapport à la
    // page : il quitterait l'image sans qu'aucun test ne le remarque.
    expect(regle('.image-cible-vue')).toMatch(/position: relative/)
    expect(regle('.apercu-cadre-rectangle')).toMatch(/position: absolute/)
  })

  it('trace le cadre par un jeton de palette, donc en rouge la nuit', () => {
    expect(regle('.apercu-cadre-rectangle')).toMatch(/border:[^;]*var\(--[a-z-]+\)/)
  })

  it('ne remplit pas le cadre : ce qu’on regarde est ce qui déborde', () => {
    const rectangle = regle('.apercu-cadre-rectangle')
    expect(rectangle).not.toMatch(/background/)
    // Un rectangle qui capte le clic bloquerait l'interaction avec ce qu'il recouvre.
    expect(rectangle).toMatch(/pointer-events: none/)
  })

  it('réutilise le traitement nocturne de la vignette, sans le redéfinir', () => {
    // Le fondu multiplicatif est déclaré une fois, sur `.image-cible-vue img`, et l'aperçu
    // porte cette classe. Une seconde règle propre à l'aperçu serait une occasion de divergence.
    expect(CSS.match(/mix-blend-mode:\s*multiply/g)).toHaveLength(1)
    expect(CSS).toContain('apercu-cadre')
  })
})
