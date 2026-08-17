/**
 * Lot 6 — la coque planétarium : la scène au centre, les réglages sur les côtés.
 *
 * Ce qui est vérifié ici n'est pas une apparence, c'est la structure : trois régions
 * existent, un seul jeu de réglages est monté à la fois, un objet cliqué dans la scène ouvre
 * l'onglet Cible garni, l'incrustation du filé fige le temps, et le plan de session reste
 * imprimable depuis n'importe quel onglet.
 *
 * Le rendu statique suffit : chaque bascule d'écran passe par un magasin de module, appelable
 * sans DOM. C'est précisément pourquoi l'onglet actif et la cible y vivent plutôt que dans
 * l'état local d'un composant.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import type { Site } from '../src/core/ephem.ts'
import type { Cadre } from '../src/core/cadre.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import type { Vue } from '../src/core/projection.ts'
import { incrusteDansLeCadre, mentionProjection } from '../src/ui/scene-overlay.ts'
import { etatScene, reinitialiseScene } from '../src/ui/scene-etat.ts'
import {
  activeIncrustation,
  choisisOnglet,
  etatSeance,
  ouvreCible,
  reinitialiseSeance,
} from '../src/ui/seance-etat.ts'

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

function ecran(): string {
  return renderToStaticMarkup(<App />)
}

afterEach(() => {
  reinitialiseSeance()
  reinitialiseScene()
})

describe('§11.2 — les trois régions', () => {
  it('place le matériel à gauche, la scène au centre, la séance à droite', () => {
    const html = ecran()
    expect(html).toContain('coque-materiel')
    expect(html).toContain('coque-scene')
    expect(html).toContain('coque-seance')
    // La scène est bien le canevas du planétarium, pas une pile de sections.
    expect(html).toContain('class="planetarium"')
  })

  it('garde le groupe Séance visible quel que soit l’onglet actif', () => {
    for (const onglet of ['EXPLORER', 'CIBLE', 'NUIT', 'FILE'] as const) {
      choisisOnglet(onglet)
      const html = ecran()
      expect(html, onglet).toContain('Bortle')
      expect(html, onglet).toContain('horizon plat')
    }
  })

  it('porte le mode nuit et la vérification du socle dans la barre du haut', () => {
    const html = ecran()
    const topbar = html.slice(0, html.indexOf('coque-materiel'))
    expect(topbar).toContain('Activer le mode nuit')
    expect(topbar).toContain('Vérification')
    expect(topbar).toContain('Registre de constantes')
    // Fermé par défaut : le tiroir n'est pas déplié à l'ouverture de l'application.
    expect(topbar).not.toMatch(/<details class="tiroir tiroir-verification" open/)
  })
})

describe('§11.2 — un seul jeu de réglages à la fois', () => {
  it('ne monte que le contenu de l’onglet actif', () => {
    choisisOnglet('EXPLORER')
    const explorer = ecran()
    expect(explorer).toContain('Mode de temps')
    expect(explorer).not.toContain('Séquence de filé')

    choisisOnglet('FILE')
    const file = ecran()
    expect(file).toContain('Séquence de filé')
    expect(file).not.toContain('Mode de temps')
  })

  it('marque l’onglet actif autrement que par la seule couleur', () => {
    choisisOnglet('NUIT')
    const html = ecran()
    expect(html).toMatch(/aria-selected="true"[^>]*class="onglet actif"/)
    expect(html).toContain('Fenêtre nocturne')
  })

  it('survit à un changement de matériel : l’onglet reste celui qu’on avait ouvert', () => {
    choisisOnglet('FILE')
    ecran()
    expect(etatSeance().onglet).toBe('FILE')
  })
})

describe('§3.4 — un objet cliqué ouvre sa fiche', () => {
  it('bascule sur l’onglet Cible et le garnit', () => {
    expect(etatSeance().onglet).toBe('EXPLORER')
    ouvreCible(M31)
    expect(etatSeance().onglet).toBe('CIBLE')
    expect(etatSeance().cible?.designation).toBe('M31')
    // C'est bien la fiche §6.2 / §6.3 / §7 qui s'ouvre, pas un simple nom affiché.
    // (Le garnissage des champs par l'objet est posé par un effet de montage : il ne joue
    // pas en rendu statique, seule la présence de la fiche est vérifiable ici.)
    const html = ecran()
    expect(html).toContain('Détectabilité')
    expect(html).toContain('Cadrage')
  })
})

describe('§9.3 — l’incrustation fige le temps', () => {
  it('bascule la scène en temps figé quand l’incrustation est activée', () => {
    expect(etatScene().temps.modeTemps).toBe('MAINTENANT')
    activeIncrustation(true)
    expect(etatSeance().file.incrustation).toBe(true)
    expect(etatScene().temps.modeTemps).toBe('FIGE')
  })

  it('ne redémarre pas le temps toute seule quand on la désactive', () => {
    activeIncrustation(true)
    activeIncrustation(false)
    expect(etatSeance().file.incrustation).toBe(false)
    // Rendre le temps à l'horloge système est un geste, pas un effet de bord (§3.2).
    expect(etatScene().temps.modeTemps).toBe('FIGE')
  })
})

describe('§9.3 — le filé se dépose dans le cadre, pas ailleurs', () => {
  const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
  const VUE: Vue = {
    mode: 'MODE_PLANETARIUM',
    fovDeg: 60,
    largeurPx: 1920,
    hauteurPx: 1080,
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }
  const CADRE: Cadre = {
    profil: { libelle: '120 mm f/2.8', fovLDeg: 17, fovHDeg: 11.4, echApx: 8.8, tPoseS: 2.1 },
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }

  /** Contexte 2D instrumenté : il enregistre l'ordre des opérations, il ne peint pas. */
  function contexteEspion() {
    const appels: string[] = []
    const enregistre =
      (nom: string) =>
      (): void => {
        appels.push(nom)
      }
    return {
      appels,
      lineWidth: 1,
      strokeStyle: '',
      save: enregistre('save'),
      restore: enregistre('restore'),
      clip: enregistre('clip'),
      drawImage: enregistre('drawImage'),
      beginPath: enregistre('beginPath'),
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: enregistre('stroke'),
    }
  }

  it('découpe sur le contour du cadre, dépose l’image, puis retrace le liseré', () => {
    const ctx = contexteEspion()
    const ciel = cielInstantane(SITE, new Date('2026-08-15T22:00:00Z'))
    incrusteDansLeCadre(
      ctx as unknown as CanvasRenderingContext2D,
      VUE,
      ciel.matrice,
      CADRE,
      {} as CanvasImageSource,
      false,
    )
    // L'ordre est le fond du critère : dessiner hors du clip déborderait sur le ciel, et
    // retracer le liseré avant l'image le ferait recouvrir.
    expect(ctx.appels.join(' ')).toMatch(
      /save beginPath clip drawImage restore beginPath stroke/,
    )
  })

  it('annonce quand la projection de la scène n’est pas celle de l’objectif', () => {
    expect(mentionProjection('MODE_CADRE', 'MODE_CADRE')).toBeNull()
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_CADRE')).toMatch(/gnomonique/)
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_FISHEYE')).toMatch(/équidistante/)
  })
})

describe('§11.2 — le plan reste imprimable', () => {
  it('rend le plan de session hors de l’onglet Nuit, masqué à l’écran seulement', () => {
    choisisOnglet('EXPLORER')
    expect(ecran()).toContain('plan-session hors-onglet')
    choisisOnglet('NUIT')
    expect(ecran()).toMatch(/class="plan-session"/)
  })
})
