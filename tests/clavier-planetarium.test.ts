/**
 * T-0069 — le planétarium se pilote au clavier (WCAG 2.1.1, niveau A).
 *
 * Ce qui se vérifie ici n'est pas un événement du DOM mais la règle : les touches rejouent les
 * gestes du pointeur, avec les mêmes bornes et le même choix de cible. Le gestionnaire du
 * canevas ne fait que brancher ces fonctions pures — c'est pourquoi elles portent le test.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { K } from '../src/registry/constants.ts'
import { bornesZoom } from '../src/core/projection.ts'
import {
  choisitCible,
  commandeClavier,
  facteurZoom,
  fovBorne,
  viseeApresCommande,
} from '../src/ui/planetarium-gestes.ts'
import { decritCible } from '../src/ui/planetarium-selection.ts'
import { etatScene, reinitialiseScene, type VueScene } from '../src/ui/scene-etat.ts'
import type { CibleEcran } from '../src/ui/dessine-ciel.ts'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'

const M31: ObjetCielProfond = {
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
}

/** Sans le paquet Gaia : les bornes que la molette applique déjà (§3.3). */
const BORNES = bornesZoom(false, 'MODE_PLANETARIUM')
const FRACTION = K('PAS_VISEE_CLAVIER_FRACTION')

function vue(retouche: Partial<VueScene> = {}): VueScene {
  return { ...etatScene().vue, ...retouche }
}

afterEach(() => {
  reinitialiseScene()
})

describe('T-0069 — quelles touches portent un geste', () => {
  it('reconnaît les flèches, le zoom et le choix', () => {
    expect(commandeClavier('ArrowLeft')).toBe('VISEE_GAUCHE')
    expect(commandeClavier('ArrowRight')).toBe('VISEE_DROITE')
    expect(commandeClavier('ArrowUp')).toBe('VISEE_HAUT')
    expect(commandeClavier('ArrowDown')).toBe('VISEE_BAS')
    expect(commandeClavier('Enter')).toBe('CHOISIR')
    expect(commandeClavier(' ')).toBe('CHOISIR')
  })

  it('zoome sur `+` et `-` sans exiger la touche Maj', () => {
    expect(commandeClavier('+')).toBe('ZOOM_AVANT')
    expect(commandeClavier('=')).toBe('ZOOM_AVANT')
    expect(commandeClavier('-')).toBe('ZOOM_ARRIERE')
    expect(commandeClavier('_')).toBe('ZOOM_ARRIERE')
  })

  it('laisse passer tout le reste : la scène ne confisque pas le parcours au clavier', () => {
    for (const touche of ['Tab', 'Escape', 'a', 'Home', 'PageDown', 'F5']) {
      expect(commandeClavier(touche), touche).toBeNull()
    }
  })
})

describe('T-0069 — les flèches déplacent la visée', () => {
  it('avance d’une fraction du champ, pas d’un nombre de degrés figé', () => {
    // À 5° de champ comme à 180°, un appui déplace la visée de la même part d'image.
    for (const fovDeg of [BORNES.fovMinDeg, K('FOV_REFERENCE_RENDU_DEG'), BORNES.fovMaxDeg]) {
      const depart = vue({ fovDeg, azimutDeg: 180 })
      const apres = viseeApresCommande(depart, 'VISEE_DROITE', BORNES)
      expect(apres.azimutDeg, `${fovDeg}°`).toBeCloseTo(180 + fovDeg * FRACTION, 9)
    }
  })

  it('suit le sens du glisser : la droite augmente l’azimut, le haut la hauteur', () => {
    const depart = vue({ azimutDeg: 180, hauteurDeg: 0 })
    expect(viseeApresCommande(depart, 'VISEE_GAUCHE', BORNES).azimutDeg).toBeLessThan(180)
    expect(viseeApresCommande(depart, 'VISEE_DROITE', BORNES).azimutDeg).toBeGreaterThan(180)
    expect(viseeApresCommande(depart, 'VISEE_BAS', BORNES).hauteurDeg).toBeLessThan(0)
    expect(viseeApresCommande(depart, 'VISEE_HAUT', BORNES).hauteurDeg).toBeGreaterThan(0)
  })

  it('garde les bornes du glisser : l’azimut fait le tour, la hauteur bute au zénith', () => {
    const pas = K('FOV_REFERENCE_RENDU_DEG') * FRACTION
    const bord = vue({ fovDeg: K('FOV_REFERENCE_RENDU_DEG'), azimutDeg: pas / 2 })
    // Un tour complet ramène dans 0–360°, jamais une valeur négative.
    expect(viseeApresCommande(bord, 'VISEE_GAUCHE', BORNES).azimutDeg).toBeCloseTo(
      360 - pas / 2,
      9,
    )
    const zenith = vue({ fovDeg: K('FOV_REFERENCE_RENDU_DEG'), hauteurDeg: 89 })
    expect(viseeApresCommande(zenith, 'VISEE_HAUT', BORNES).hauteurDeg).toBe(90)
    const nadir = vue({ fovDeg: K('FOV_REFERENCE_RENDU_DEG'), hauteurDeg: -89 })
    expect(viseeApresCommande(nadir, 'VISEE_BAS', BORNES).hauteurDeg).toBe(-90)
  })
})

describe('T-0069 — `+` et `-` zooment comme la molette', () => {
  it('applique le facteur d’un cran, dans les deux sens', () => {
    const depart = vue({ fovDeg: K('FOV_REFERENCE_RENDU_DEG') })
    const avant = viseeApresCommande(depart, 'ZOOM_AVANT', BORNES).fovDeg!
    const arriere = viseeApresCommande(depart, 'ZOOM_ARRIERE', BORNES).fovDeg!
    // Le même facteur que `facteurZoom` sert la molette : un seul cran, une seule source.
    expect(depart.fovDeg / avant).toBeCloseTo(K('FACTEUR_ZOOM_CRAN'), 9)
    expect(arriere / depart.fovDeg).toBeCloseTo(K('FACTEUR_ZOOM_CRAN'), 9)
    expect(avant).toBeCloseTo(fovBorne(depart.fovDeg * facteurZoom(-1, false), BORNES), 9)
  })

  it('bute sur les bornes de §3.3, celles que la molette respecte déjà', () => {
    const large = vue({ fovDeg: BORNES.fovMaxDeg })
    expect(viseeApresCommande(large, 'ZOOM_ARRIERE', BORNES).fovDeg).toBe(BORNES.fovMaxDeg)
    const serre = vue({ fovDeg: BORNES.fovMinDeg })
    expect(viseeApresCommande(serre, 'ZOOM_AVANT', BORNES).fovDeg).toBe(BORNES.fovMinDeg)
  })

  it('ne franchit pas le plancher sans Gaia, même en martelant la touche', () => {
    let courant = vue({ fovDeg: BORNES.fovMaxDeg })
    for (let i = 0; i < 100; i += 1) {
      courant = { ...courant, ...viseeApresCommande(courant, 'ZOOM_AVANT', BORNES) }
    }
    expect(courant.fovDeg).toBe(BORNES.fovMinDeg)
  })
})

describe('T-0069 — une cible se choisit sans pointeur', () => {
  const CENTRE_X = 960
  const CENTRE_Y = 540

  function ciblesAvec(xPx: number, yPx: number): readonly CibleEcran[] {
    return [{ type: 'OBJET', xPx, yPx, nom: 'M31', objet: M31 }]
  }

  it('retient au centre du canevas ce que le clic aurait retenu sur l’objet', () => {
    // Le geste au clavier : la cible est à une fraction de champ du centre visé.
    const cibles = ciblesAvec(CENTRE_X + 50, CENTRE_Y)
    const ouvertes: ObjetCielProfond[] = []
    choisitCible(cibles, CENTRE_X, CENTRE_Y, (o) => ouvertes.push(o), 1920 * FRACTION)
    const auClavier = etatScene().lectures.selection

    reinitialiseScene()
    // Le geste au pointeur : le clic tombe sur l'objet lui-même.
    const cliquees: ObjetCielProfond[] = []
    choisitCible(cibles, CENTRE_X + 50, CENTRE_Y, (o) => cliquees.push(o))
    const auPointeur = etatScene().lectures.selection

    expect(auClavier).toStrictEqual(decritCible(cibles[0]!))
    expect(auClavier).toStrictEqual(auPointeur)
    expect(ouvertes).toStrictEqual([M31])
    expect(cliquees).toStrictEqual([M31])
  })

  it('ne désigne rien quand la cible est hors du pas de visée', () => {
    const ouvertes: ObjetCielProfond[] = []
    choisitCible(
      ciblesAvec(CENTRE_X + 1920, CENTRE_Y),
      CENTRE_X,
      CENTRE_Y,
      (o) => ouvertes.push(o),
      1920 * FRACTION,
    )
    expect(etatScene().lectures.selection).toBeNull()
    expect(ouvertes).toStrictEqual([])
  })

  it('élargit la tolérance pour la touche seulement : le pointeur garde la sienne', () => {
    // Une cible à 50 px du centre : hors de portée du clic, dans le pas d'une flèche.
    const cibles = ciblesAvec(CENTRE_X + 50, CENTRE_Y)
    choisitCible(cibles, CENTRE_X, CENTRE_Y, () => undefined)
    expect(etatScene().lectures.selection).toBeNull()
    choisitCible(cibles, CENTRE_X, CENTRE_Y, () => undefined, 1920 * FRACTION)
    expect(etatScene().lectures.selection?.titre).toContain('M31')
  })
})

/**
 * T-0117 — il n'y a plus de report de geste : la boucle relit la vue à chaque image et son
 * plafond d'images borne le travail, quel que soit le rythme de la répétition de touche. Ce
 * qui reste à garantir côté clavier, c'est qu'un appui n'écrive que la vue — un appui qui
 * toucherait le temps ou les couches ferait plus que déplacer la visée.
 */
describe('T-0069 — la répétition de touche n’écrit que la vue', () => {
  it('n’écrit qu’un seul champ de la vue par appui', () => {
    const depart = vue()
    for (const commande of ['VISEE_GAUCHE', 'VISEE_HAUT', 'ZOOM_AVANT'] as const) {
      const retouche = viseeApresCommande(depart, commande, BORNES)
      expect(Object.keys(retouche).length, commande).toBe(1)
      const [champ] = Object.keys(retouche) as (keyof VueScene)[]
      expect(champ, commande).toBeDefined()
      expect(retouche[champ!], commande).not.toBe(depart[champ!])
    }
  })

  it('déplace la visée d’un pas par appui, trente appuis durant', () => {
    let courant = vue()
    const vus = new Set<number>([courant.azimutDeg])
    for (let i = 0; i < 30; i += 1) {
      courant = { ...courant, ...viseeApresCommande(courant, 'VISEE_DROITE', BORNES) }
      vus.add(courant.azimutDeg)
    }
    // Aucun appui perdu ni fusionné : la vue avance à chaque touche, c'est l'image qui
    // arbitre le rythme du calcul, pas une minuterie de geste.
    expect(vus.size).toBe(31)
  })
})
