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

import { useCallback, useSyncExternalStore } from 'react'
import { K } from '../registry/constants.ts'
import type { ModeProjection, Vue } from '../core/projection.ts'
import type { ModeTemps, PasAstronomique } from '../core/curseur-temps.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { CouchesActives } from './dessine-ciel.ts'

/**
 * Résolution de rendu de référence, celle du viewport de §3.2. Ce n'est plus qu'un point de
 * départ : la scène rend désormais à la taille de sa boîte (voir `resolutionRendu`). Elle
 * reste le budget de pixels que ce rendu ne dépasse pas, et la définition servie au premier
 * rendu, avant que la boîte ait été mesurée.
 */
export const LARGEUR_SCENE_PX = 1920
export const HAUTEUR_SCENE_PX = 1080

/**
 * La définition à donner au canevas pour une boîte de `largeurCss × hauteurCss`.
 *
 * Rendre à une définition fixe obligeait à loger un 16/9 dans une boîte qui ne l'est pas :
 * `object-fit: contain` laissait alors des bandes noires en haut et en bas. En suivant la
 * boîte, l'image la remplit sans être ni étirée ni rognée.
 *
 * Le facteur d'échelle est plafonné par le budget de pixels de référence, pas seulement par
 * la densité de l'écran : sur une dalle Retina, suivre `devicePixelRatio` doublerait le
 * nombre de pixels à peindre à chaque image, et le compteur d'images du ciel avec.
 * ponytail: budget constant plutôt qu'adaptatif ; si des machines rapides méritent mieux,
 * c'est le compteur d'images qui doit le décider, pas une constante.
 */
export function resolutionRendu(
  largeurCss: number,
  hauteurCss: number,
  densite: number,
): { readonly largeurPx: number; readonly hauteurPx: number } {
  const surface = Math.max(1, largeurCss * hauteurCss)
  const echelle = Math.min(densite, Math.sqrt((LARGEUR_SCENE_PX * HAUTEUR_SCENE_PX) / surface))
  return {
    largeurPx: Math.max(1, Math.round(largeurCss * echelle)),
    hauteurPx: Math.max(1, Math.round(hauteurCss * echelle)),
  }
}

/**
 * Le pointage : ce que la scène regarde, comment elle le projette, et sur combien de pixels.
 * Un `Vue` de §3.2 à un champ près — le roulis, qui appartient au boîtier et non à la vue.
 *
 * T-0084 — la rotation porte un nom distinct de `Vue.rotationDeg` EXPRÈS. Tant que les deux
 * s'appelaient pareil, le magasin se passait tel quel à `projecteur()` : la vue du planétarium
 * roulait du même angle que le cadre, et le cadre ne pouvait donc jamais paraître tourné à
 * l'écran — seul le ciel tournait derrière lui. §3.3 ne fait dépendre du mode que la fonction
 * radiale R(θ) : le planétarium garde le zénith en haut, et c'est le boîtier qui tourne.
 */
export interface VueScene {
  readonly azimutDeg: number
  readonly hauteurDeg: number
  /** §3.5 `angle_rotation_cadre` — orientation du boîtier, jamais le roulis de la vue. */
  readonly rotationCadreDeg: number
  readonly fovDeg: number
  readonly mode: ModeProjection
  /** Définition de rendu, mesurée sur la boîte du canevas. */
  readonly largeurPx: number
  readonly hauteurPx: number
}

/**
 * La `Vue` de §3.3 pour la scène : sans roulis. Le cadre matériel tourne comme objet de la
 * scène (§3.5) ; la vue, elle, garde le zénith en haut, sans quoi tourner le boîtier ferait
 * tourner tout le ciel et le contour du cadre resterait immobile à l'écran.
 */
export function vuePlanetarium(vue: VueScene): Vue {
  return {
    mode: vue.mode,
    fovDeg: vue.fovDeg,
    largeurPx: vue.largeurPx,
    hauteurPx: vue.hauteurPx,
    azimutDeg: vue.azimutDeg,
    hauteurDeg: vue.hauteurDeg,
    rotationDeg: 0,
  }
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

/** §3 — le compte rendu de la boucle : publié deux fois par seconde, jamais à chaque image. */
export interface DiagnosticRendu {
  readonly fps: number
  readonly etoilesExaminees: number
  readonly etoilesDessinees: number
  readonly cellules: number
  readonly labels: number
}

/** §3.4 — l'objet cliqué dans la scène, décrit en clair. */
export interface SelectionScene {
  readonly titre: string
  readonly lignes: readonly string[]
  /** Renseigné pour un objet du ciel profond seulement : lui seul ouvre une fiche. */
  readonly objet: ObjetCielProfond | null
}

/**
 * T-0038 — ce que la scène a à dire sur ce qu'elle vient de rendre.
 *
 * Ces lectures étaient l'état local du planétarium tant qu'elles s'affichaient sous lui.
 * Depuis qu'elles sont posées dans le menu d'information de la barre haute — à l'autre bout
 * de l'arbre — elles suivent le même chemin que le pointage : le magasin de module, lisible
 * en rendu serveur comme dans le navigateur.
 */
export interface LecturesScene {
  readonly diagnostic: DiagnosticRendu
  readonly selection: SelectionScene | null
  /** §9.3 — une incrustation est demandée mais l'image affichée est la précédente. */
  readonly fileEnAttente: boolean
}

export interface EtatScene {
  readonly vue: VueScene
  readonly temps: TempsScene
  readonly rendu: RenduScene
  readonly lectures: LecturesScene
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
    rotationCadreDeg: 0,
    fovDeg: K('FOV_REFERENCE_RENDU_DEG'),
    mode: 'MODE_PLANETARIUM',
    largeurPx: LARGEUR_SCENE_PX,
    hauteurPx: HAUTEUR_SCENE_PX,
  },
  temps: { modeTemps: 'MAINTENANT', facteur: 60, pas: 'JOUR_SIDERAL' },
  rendu: {
    couches: {
      figures: true,
      frontieres: false,
      asterismes: true,
      cadre: true,
      horizon: true,
      voieLactee: true,
    },
    vueRealiste: false,
  },
  lectures: {
    diagnostic: { fps: 0, etoilesExaminees: 0, etoilesDessinees: 0, cellules: 0, labels: 0 },
    selection: null,
    fileEnAttente: false,
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

export function majLectures(retouche: Retouche<LecturesScene>): void {
  pose({ ...etat, lectures: applique(etat.lectures, retouche) })
}

/**
 * Publie l'instant rendu. L'égalité est testée avant de notifier : en temps figé, la boucle
 * republie le même instant deux fois par seconde et rien ne doit se redessiner pour autant.
 */
export function afficheInstant(ms: number, diagnostic?: DiagnosticRendu): void {
  const lectures =
    diagnostic === undefined ? etat.lectures : { ...etat.lectures, diagnostic }
  if (ms === etat.msAffiche && lectures === etat.lectures) return
  pose({ ...etat, msAffiche: ms, lectures })
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

/**
 * T-0056 — s'abonner à une tranche du magasin plutôt qu'à sa totalité.
 *
 * `useScene` réveille son composant à chaque écriture, donc deux fois par seconde : c'est la
 * cadence à laquelle la boucle republie l'instant affiché et le diagnostic. Un composant qui
 * ne lit qu'une valeur dérivée — l'époque à l'année, la minute affichée — n'a rien à
 * redessiner entre deux publications identiques.
 *
 * Le sélecteur doit être défini au niveau du module (identité stable) et rendre une valeur
 * comparable par `Object.is` : c'est cette comparaison que `useSyncExternalStore` applique
 * pour décider de rendre ou non.
 */
export function useTrancheScene<T>(selecteur: (etat: EtatScene) => T): T {
  const lit = useCallback(() => selecteur(etatScene()), [selecteur])
  return useSyncExternalStore(abonne, lit, lit)
}

/** Les commandes du magasin, telles que la scène et ses gestes les reçoivent. */
export interface ActionsScene {
  readonly majVue: typeof majVue
  readonly majTemps: typeof majTemps
  readonly majRendu: typeof majRendu
  readonly majLectures: typeof majLectures
  readonly saute: typeof saute
}

export function useScene(): {
  readonly vue: VueScene
  readonly temps: TempsScene
  readonly rendu: RenduScene
  readonly lectures: LecturesScene
  readonly msAffiche: number
  readonly instant: { ms: number }
  readonly actions: ActionsScene
} {
  const courant = useSyncExternalStore(abonne, etatScene, etatScene)
  return {
    vue: courant.vue,
    temps: courant.temps,
    rendu: courant.rendu,
    lectures: courant.lectures,
    msAffiche: courant.msAffiche,
    instant,
    actions: { majVue, majTemps, majRendu, majLectures, saute },
  }
}
