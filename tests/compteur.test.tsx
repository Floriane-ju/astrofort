/**
 * T-0162 — les compteurs de la barre basse : un nombre se règle en le tirant.
 *
 * Ce qui se vérifie ici n'est pas un pixel de curseur mais deux promesses chiffrables : la loi
 * du glisser — impaire, accélérée, muette sous le premier cran — et l'arithmétique des dates
 * quand le mois visé n'a pas le jour d'où l'on part.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { cransGlisse } from '../src/ui/compteur-glisse.ts'
import { dateAvec, partiesHeure, partiesJour } from '../src/ui/horaire.ts'
import { reinitialiseScene } from '../src/ui/scene-etat.ts'
import { reinitialiseSeance } from '../src/ui/seance-etat.ts'
import { reinitialiseCoque } from '../src/ui/coque-etat.ts'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

function ecran(): string {
  return renderToStaticMarkup(<App />)
}

/** Le fragment d'un compteur, de son ouverture à sa fermeture — de quoi lire ce qu'il annonce. */
function compteur(html: string, libelle: string): string {
  const ancre = html.indexOf(`aria-label="${libelle}"`)
  expect(ancre, libelle).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<span', ancre), html.indexOf('</span>', ancre))
}

afterEach(() => {
  reinitialiseSeance()
  reinitialiseScene()
  reinitialiseCoque()
})

describe('T-0162 — la loi du glisser latéral', () => {
  it('ne compte rien tant que le premier cran n’est pas franchi', () => {
    // C'est ce silence qui laisse exister le clic : sans lui, aucun geste ne serait un clic.
    expect(cransGlisse(0)).toBe(0)
    expect(cransGlisse(1)).toBe(0)
    expect(cransGlisse(-1)).toBe(0)
  })

  it('ajoute vers la droite, retire vers la gauche, du même compte', () => {
    for (const dx of [8, 30, 120, 400]) {
      expect(cransGlisse(dx), `${dx} px`).toBeGreaterThan(0)
      expect(cransGlisse(-dx), `${-dx} px`).toBe(-cransGlisse(dx))
    }
  })

  it('accélère : deux fois plus loin fait PLUS de deux fois plus de crans', () => {
    // La différence avec un rail : un curseur `range` mappe une course finie sur une plage
    // finie, un compteur n'a pas de course — c'est l'éloignement qui la fournit.
    for (const dx of [12, 40, 100]) {
      expect(cransGlisse(2 * dx), `${dx} px`).toBeGreaterThan(2 * cransGlisse(dx))
    }
  })

  it('ne recule jamais quand le pointeur avance', () => {
    let precedent = 0
    for (let dx = 0; dx <= 300; dx += 3) {
      const crans = cransGlisse(dx)
      expect(crans, `${dx} px`).toBeGreaterThanOrEqual(precedent)
      precedent = crans
    }
  })

  it('annonce le geste au survol, avant tout clic', () => {
    // Rien ne distingue une valeur réglable d'une lecture sinon le curseur qui la survole.
    const debut = CSS.indexOf('.compteur {')
    expect(debut).toBeGreaterThan(-1)
    expect(CSS.slice(debut, CSS.indexOf('}', debut))).toContain('cursor: ew-resize')
  })
})

describe('T-0162 — un champ de l’instant réécrit', () => {
  const nuit = new Date(2026, 2, 31, 22, 41, 7)

  it('ramène le jour au dernier du mois visé plutôt que de déborder', () => {
    // 31 mars → février : le geste règle un MOIS. Sans le rabattement, `new Date` glisserait
    // au 3 mars et le compteur sauterait le mois qu'on visait.
    const fevrier = dateAvec(nuit, 'mois', 2)
    expect(fevrier.getMonth()).toBe(1)
    expect(fevrier.getDate()).toBe(new Date(2026, 2, 0).getDate())
    expect(fevrier.getHours()).toBe(nuit.getHours())
  })

  it('laisse déborder les heures : un instant qu’on promène change de jour', () => {
    const lendemain = dateAvec(nuit, 'heure', 25)
    expect(lendemain.getMonth()).toBe(nuit.getMonth() + 1)
    expect(lendemain.getDate()).toBe(1)
    expect(lendemain.getHours()).toBe(1)
  })

  it('laisse déborder les mois sur l’année suivante', () => {
    const janvier = dateAvec(new Date(2026, 2, 15, 22, 0, 0), 'mois', 13)
    expect(janvier.getFullYear()).toBe(2027)
    expect(janvier.getMonth()).toBe(0)
  })

  it('découpe l’instant sans en changer le format', () => {
    const recompose = (parties: readonly Intl.DateTimeFormatPart[]) =>
      parties.map((p) => p.value).join('')
    expect(recompose(partiesJour(nuit))).toBe(nuit.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }))
    expect(recompose(partiesHeure(nuit))).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('pose un compteur nommé et réglable au clavier sur chacun des six champs', () => {
    const html = ecran()
    for (const libelle of ['Jour', 'Mois', 'Année', 'Heure', 'Minute', 'Seconde']) {
      const balise = compteur(html, libelle)
      expect(balise, libelle).toContain('role="spinbutton"')
      expect(balise, libelle).toContain('tabindex="0"')
      expect(balise, libelle).toMatch(/aria-valuenow="-?\d+"/)
    }
  })
})
