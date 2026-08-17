/**
 * §3 + §9 — le pointage et le temps de la scène, tenus une seule fois.
 *
 * Le planétarium (§3) et le grand champ (§9) décrivent la même photographie : un azimut, une
 * hauteur, une rotation de boîtier. Tant que chaque vue tenait son propre `useState`, cadrer
 * dans l'une ne cadrait pas dans l'autre — l'utilisateur cadrait deux fois la même image.
 *
 * L'état vit dans le module, pas dans un contexte React : les deux vues sont montées côte à
 * côte sans ancêtre commun autre que l'application, et un magasin externe se lit aussi bien
 * en rendu serveur (`renderToStaticMarkup`) que dans le navigateur.
 * ponytail: un seul magasin pour tout le document — il n'y a qu'une scène ; si un jour deux
 * scènes doivent coexister, ce module devient un contexte.
 */

import { useSyncExternalStore } from 'react'
import { K } from '../registry/constants.ts'
import type { ModeProjection } from '../core/projection.ts'
import type { ModeTemps, PasAstronomique } from '../core/curseur-temps.ts'
import type { CouchesActives } from './dessine-ciel.ts'

/**
 * Résolution de rendu de la scène, celle du viewport de référence de §3.2 : c'est elle qui
 * fixe l'échelle en pixels par degré, donc le plafond de défilement lisible. La feuille de
 * style met le canevas à la largeur disponible ; le rendu reste calculé à cette définition.
 */
export const LARGEUR_SCENE_PX = 1920
export const HAUTEUR_SCENE_PX = 1080

/** Le pointage : ce que la scène regarde, et comment elle le projette. */
export interface VueScene {
  readonly azimutDeg: number
  readonly hauteurDeg: number
  /** Rotation du boîtier autour de l'axe de visée (§3.5). */
  readonly rotationDeg: number
  readonly fovDeg: number
  readonly mode: ModeProjection
}

/** Le temps : le mode du curseur temporel de §3.2 et ses réglages. */
export interface TempsScene {
  readonly modeTemps: ModeTemps
  /** Facteur de défilement demandé, avant plafonnement par la lisibilité. */
  readonly facteur: number
  readonly pas: PasAstronomique
}

/**
 * Ce que la scène dessine. Les interrupteurs vivent ici et non dans le planétarium : depuis
 * le lot 6 ils sont actionnés depuis l'onglet Explorer, à l'autre bout de l'écran.
 */
export interface RenduScene {
  readonly couches: CouchesActives
  /** §3.3 — profondeur plafonnée par le fond de ciel plutôt que par le zoom. */
  readonly vueRealiste: boolean
}

export interface EtatScene {
  readonly vue: VueScene
  readonly temps: TempsScene
  readonly rendu: RenduScene
  /**
   * Horloge d'affichage, en millisecondes : l'instant que la boucle a effectivement rendu.
   * Elle est publiée deux fois par seconde, pas à chaque image — les panneaux datent leurs
   * lectures sans être redessinés soixante fois par seconde.
   */
  readonly msAffiche: number
}

/**
 * L'instant affiché, en millisecondes. Réécrit à chaque image par la boucle de rendu : le
 * garder hors de l'état réactif est ce qui évite soixante rendus React par seconde (§3).
 */
export const instant = { ms: Date.now() }

const ETAT_INITIAL: EtatScene = {
  vue: {
    azimutDeg: 180,
    hauteurDeg: K('SEUIL_HAUTEUR_IMAGERIE_DEG'),
    rotationDeg: 0,
    fovDeg: K('FOV_REFERENCE_RENDU_DEG'),
    mode: 'MODE_PLANETARIUM',
  },
  temps: { modeTemps: 'MAINTENANT', facteur: 60, pas: 'JOUR_SIDERAL' },
  rendu: {
    couches: { figures: true, frontieres: false, asterismes: true, cadre: true, horizon: true },
    vueRealiste: false,
  },
  msAffiche: instant.ms,
}

let etat: EtatScene = ETAT_INITIAL
const abonnes = new Set<() => void>()

/** Instantané courant. Son identité ne change qu'à une écriture : `useSyncExternalStore` s'y fie. */
export function etatScene(): EtatScene {
  return etat
}

function abonne(notifie: () => void): () => void {
  abonnes.add(notifie)
  return () => {
    abonnes.delete(notifie)
  }
}

type Retouche<T> = Partial<T> | ((precedent: T) => Partial<T>)

function applique<T extends object>(precedent: T, retouche: Retouche<T>): T {
  return {
    ...precedent,
    ...(typeof retouche === 'function' ? retouche(precedent) : retouche),
  }
}

function pose(suivant: EtatScene): void {
  etat = suivant
  for (const notifie of abonnes) notifie()
}

export function majVue(retouche: Retouche<VueScene>): void {
  pose({ ...etat, vue: applique(etat.vue, retouche) })
}

export function majTemps(retouche: Retouche<TempsScene>): void {
  pose({ ...etat, temps: applique(etat.temps, retouche) })
}

export function majRendu(retouche: Retouche<RenduScene>): void {
  pose({ ...etat, rendu: applique(etat.rendu, retouche) })
}

/**
 * Publie l'instant rendu. L'égalité est testée avant de notifier : en temps figé, la boucle
 * republie le même instant deux fois par seconde et rien ne doit se redessiner pour autant.
 */
export function afficheInstant(ms: number): void {
  if (ms === etat.msAffiche) return
  pose({ ...etat, msAffiche: ms })
}

/** §3.2 — un pas astronomique est un saut de l'horloge d'affichage, pas un défilement. */
export function saute(secondes: number): void {
  instant.ms += secondes * 1000
}

/** Remet la scène dans son état de départ. Réservé aux tests : l'application n'en a pas besoin. */
export function reinitialiseScene(): void {
  instant.ms = Date.now()
  pose({ ...ETAT_INITIAL, msAffiche: instant.ms })
}

export function useScene(): {
  readonly vue: VueScene
  readonly temps: TempsScene
  readonly rendu: RenduScene
  readonly msAffiche: number
  readonly instant: { ms: number }
  readonly actions: {
    readonly majVue: typeof majVue
    readonly majTemps: typeof majTemps
    readonly majRendu: typeof majRendu
    readonly saute: typeof saute
  }
} {
  const courant = useSyncExternalStore(abonne, etatScene, etatScene)
  return {
    vue: courant.vue,
    temps: courant.temps,
    rendu: courant.rendu,
    msAffiche: courant.msAffiche,
    instant,
    actions: { majVue, majTemps, majRendu, saute },
  }
}
