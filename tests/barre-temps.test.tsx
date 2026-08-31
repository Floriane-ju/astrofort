/**
 * §3.2 / T-0137 — le temps se pilote depuis la barre basse, comme un lecteur.
 *
 * Ce qui est vérifié n'est pas une apparence mais un câblage : quatre chevrons portent les
 * deux vitesses du registre dans les deux sens, la lecture et la pause se lisent sur leur
 * bouton, et l'écrêtage par la lisibilité s'affiche en clair. Le rendu statique suffit —
 * l'état du transport vit dans le magasin de scène, réglable sans DOM.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { facteurDefilement } from '../src/core/curseur-temps.ts'
import { K } from '../src/registry/constants.ts'
import { jourLocalIso, pourChampDateHeure } from '../src/ui/horaire.ts'
import { BarreTemps } from '../src/ui/BarreTemps.tsx'
import {
  etatScene,
  instant,
  majTemps,
  majVue,
  reinitialiseScene,
  reprend,
  vaA,
} from '../src/ui/scene-etat.ts'

function barre(): string {
  return renderToStaticMarkup(<BarreTemps surDateIso={() => undefined} />)
}

/**
 * L'emplacement du libellé d'un contrôle. T-0147 — un bouton à glyphe seul n'écrit plus son
 * nom dans un `aria-label` : il le tient de la bulle qui le suit, via `aria-labelledby`.
 */
function place(html: string, libelle: string): number {
  const bulle = html.indexOf(`role="tooltip" data-place="haut">${libelle}</span>`)
  return bulle > -1 ? bulle : html.indexOf(`aria-label="${libelle}"`)
}

/** Le fragment d'un contrôle, de son ouverture à son libellé : de quoi lire son état pressé. */
function controle(html: string, libelle: string): string {
  const fin = place(html, libelle)
  expect(fin, libelle).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf('<button', fin), fin)
}

afterEach(() => {
  reinitialiseScene()
})

describe('T-0137 — la barre basse pilote le temps', () => {
  it('porte les quatre chevrons, le cadran et la lecture', () => {
    const html = barre()
    for (const libelle of ['Reculer vite', 'Reculer', 'Avancer', 'Avancer vite']) {
      expect(place(html, libelle), libelle).toBeGreaterThan(-1)
    }
    // T-0162 — le cadran n'est plus un bouton unique : six compteurs, un par champ réglable.
    for (const libelle of ['Jour', 'Mois', 'Année', 'Heure', 'Minute', 'Seconde']) {
      expect(place(html, libelle), libelle).toBeGreaterThan(-1)
    }
    expect(html).toContain('Mettre le temps en pause')
  })

  it('encadre le cadran : les reculs à gauche, les avances à droite', () => {
    // L'ordre EST l'information : deux chevrons posés du même côté du cadran ne diraient plus
    // dans quel sens ils emmènent le ciel.
    const html = barre()
    const ou = (libelle: string) => place(html, libelle)
    expect(ou('Reculer vite')).toBeLessThan(ou('Reculer'))
    expect(ou('Reculer')).toBeLessThan(ou('Jour'))
    expect(ou('Seconde')).toBeLessThan(ou('Avancer'))
    expect(ou('Avancer')).toBeLessThan(ou('Avancer vite'))
    expect(ou('Avancer vite')).toBeLessThan(ou('Mettre le temps en pause'))
  })

  it('dessine ses commandes avec des glyphes de la police d’icônes, pas des caractères', () => {
    const html = barre()
    for (const ligature of [
      'keyboard_double_arrow_left',
      'chevron_left',
      'chevron_right',
      'keyboard_double_arrow_right',
      'pause',
    ]) {
      expect(html, ligature).toContain(ligature)
    }
    expect(html).not.toMatch(/[‹›»«▶⏸]/)
  })

  it('marque le chevron actif, et lui seul', () => {
    majTemps({ modeTemps: 'DEFILEMENT', facteur: -facteurDefilement(true) })
    const html = barre()
    expect(controle(html, 'Reculer vite')).toContain('aria-pressed="true"')
    for (const inactif of ['Reculer', 'Avancer', 'Avancer vite']) {
      expect(controle(html, inactif), inactif).toContain('aria-pressed="false"')
    }
  })

  it('tire ses deux vitesses du registre', () => {
    expect(facteurDefilement(false)).toBe(K('FACTEUR_DEFILEMENT_NORMAL'))
    expect(facteurDefilement(true)).toBe(K('FACTEUR_DEFILEMENT_RAPIDE'))
  })

  it('bascule le bouton de lecture selon l’état du temps', () => {
    expect(place(barre(), 'Mettre le temps en pause')).toBeGreaterThan(-1)
    majTemps({ modeTemps: 'FIGE' })
    const enPause = barre()
    expect(place(enPause, 'Reprendre l’écoulement du temps')).toBeGreaterThan(-1)
    expect(enPause).toContain('play_arrow')
  })

  it('reprend la lecture DEPUIS l’instant choisi, sans sauter à l’heure du jour', () => {
    // Le défaut que ça corrige : `MAINTENANT` resynchronisait sur `Date.now()` à chaque image,
    // donc appuyer sur lecture effaçait la date qu'on venait de choisir.
    const choisi = Date.UTC(2026, 7, 21, 20, 41, 7)
    vaA(choisi)
    reprend()
    expect(etatScene().temps.modeTemps).toBe('MAINTENANT')
    expect(instant.ms).toBe(choisi)
    // C'est l'expression même de la boucle de rendu : l'horloge système donne la cadence,
    // le décalage donne l'ancrage. La tolérance couvre le temps passé dans le test.
    expect(Date.now() + etatScene().temps.decalageMs).toBeCloseTo(choisi, -3)
  })

  it('ouvre sur l’instant présent : aucun décalage tant qu’on n’a rien choisi', () => {
    expect(etatScene().temps.decalageMs).toBe(0)
  })

  it('affiche le facteur réellement appliqué et la raison de l’écrêtage', () => {
    // §3.2 — à 5° de champ sur 1920 px, le plafond tombe à ×374 : la vitesse rapide y est
    // ramenée, et l'app le dit plutôt que de laisser l'image se replier.
    majVue({ fovDeg: 5, largeurPx: 1920 })
    majTemps({ modeTemps: 'DEFILEMENT', facteur: facteurDefilement(true) })
    const html = barre()
    // La pastille porte le facteur APPLIQUÉ ; le ×1500 demandé ne survit que dans la phrase
    // qui explique son écrêtage.
    expect(html).toMatch(/barretemps-facteur">×374</)
    expect(html).toMatch(/ramené de ×1500 à ×374/)
  })

  it('ne signale rien quand la vitesse tient dans la plage lisible', () => {
    majTemps({ modeTemps: 'DEFILEMENT', facteur: facteurDefilement(false) })
    const html = barre()
    expect(html).toMatch(new RegExp(`barretemps-facteur">×${K('FACTEUR_DEFILEMENT_NORMAL')}<`))
    expect(html).not.toMatch(/ramené/)
  })

  it('date l’instant à la seconde, jour compris', () => {
    // T-0162 — chaque champ est un compteur : c'est le texte rendu, balises retirées, qui
    // porte encore la date en toutes lettres et l'heure à la seconde.
    const texte = barre().replaceAll('<!-- -->', '').replace(/<[^>]*>/g, '')
    expect(texte).toMatch(/\d{1,2}\s\S+\s\d{4}/)
    expect(texte).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('remplace le tiroir de réglages et le champ de date de la barre', () => {
    const ecran = renderToStaticMarkup(<App />)
    expect(ecran).not.toContain('tiroir-temps')
    expect(ecran).not.toContain('type="date"')
    expect(ecran).not.toContain('Pas astronomiques')
    expect(ecran).toContain('barretemps')
  })
})

describe('T-0138 — la date-heure se choisit sans confondre les fuseaux', () => {
  it('donne au champ natif une heure locale, seconde comprise', () => {
    const instant = new Date(2026, 7, 21, 22, 41, 7)
    expect(pourChampDateHeure(instant)).toBe('2026-08-21T22:41:07')
  })

  it('date la nuit sur le calendrier LOCAL, pas sur la tranche UTC', () => {
    // Piège A1 — après minuit local en été, `toISOString()` désigne encore la veille à l'ouest
    // de Greenwich, la nuit suivante à l'est. C'est la nuit qu'on observe qui compte.
    const apresMinuit = new Date(2026, 6, 15, 1, 30, 0)
    expect(jourLocalIso(apresMinuit)).toBe('2026-07-15')
    expect(jourLocalIso(apresMinuit)).toBe(apresMinuit.toLocaleDateString('sv-SE'))
    if (apresMinuit.getTimezoneOffset() !== 0) {
      expect(apresMinuit.toISOString().slice(0, 10)).not.toBe(jourLocalIso(apresMinuit))
    }
  })
})
