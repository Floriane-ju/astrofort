/**
 * §9 + §11.2 — l'intention de séance : ce qu'on veut faire, tenu une seule fois.
 *
 * Le panneau droit est à onglets, et trois choses doivent traverser l'écran de part en part :
 *
 *   1. un clic sur un objet DANS LA SCÈNE doit ouvrir l'onglet Cible, garni ;
 *   2. les réglages du filé se règlent à droite mais se dessinent au centre, dans le cadre ;
 *   3. activer l'incrustation fige le temps de la scène — un filé est une composition fixe.
 *
 * Aucun de ces trois chemins ne remonte à un ancêtre commun autre que l'application. Comme
 * pour [[scene-etat]], l'état vit donc dans le module : un magasin externe se lit aussi bien
 * en rendu serveur que dans le navigateur, et se teste sans DOM.
 */

import { useSyncExternalStore } from 'react'
import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { majTemps } from './scene-etat.ts'

/** Les quatre intentions du panneau droit. Le groupe « Séance » les surplombe toutes. */
export type Onglet = 'EXPLORER' | 'CIBLE' | 'NUIT' | 'FILE'

export const ONGLETS: readonly { readonly cle: Onglet; readonly libelle: string }[] = [
  { cle: 'EXPLORER', libelle: 'Explorer' },
  { cle: 'CIBLE', libelle: 'Cible' },
  { cle: 'NUIT', libelle: 'Nuit' },
  { cle: 'FILE', libelle: 'Filé' },
]

/** §9.2 aperçu d'une pose, §9.3 filé d'une durée accumulée : même moteur, durée différente. */
export type ModeApercu = 'CHAMP' | 'FILE'

/** Réglages de §9.2 à §9.4. Ils pilotent le panneau ET l'incrustation dans le cadre. */
export interface ReglagesFile {
  readonly apercu: ModeApercu
  readonly tPoseS: number
  readonly dureeTotaleMin: number
  readonly intervalleS: number
  readonly temperatureC: string
  readonly autonomieSaisie: string
  readonly espaceLibreGo: string
  readonly reductionBruit: boolean
  readonly voieLactee: boolean
  /** §9.2/§9.3 rendus dans le cadre matériel, sur la scène, plutôt que dans un canevas à part. */
  readonly incrustation: boolean
}

/** Ce que la dernière incrustation a effectivement tracé. `null` tant qu'aucune n'a eu lieu. */
export interface RenduFile {
  readonly reelles: number
  readonly generees: number
  readonly tronques: number
}

export interface EtatSeance {
  readonly onglet: Onglet
  readonly cible: ObjetCielProfond | null
  readonly file: ReglagesFile
  readonly renduFile: RenduFile | null
}

const ETAT_INITIAL: EtatSeance = {
  onglet: 'EXPLORER',
  cible: null,
  file: {
    apercu: 'CHAMP',
    tPoseS: K('T_POSE_FILE_MAX_S'),
    dureeTotaleMin: K('DUREE_FILE_SPECTACULAIRE_MIN'),
    intervalleS: K('INTERVALLE_INTER_POSE_FILE_MAX_S'),
    temperatureC: '5',
    autonomieSaisie: '',
    espaceLibreGo: '',
    reductionBruit: false,
    voieLactee: true,
    incrustation: false,
  },
  renduFile: null,
}

let etat: EtatSeance = ETAT_INITIAL
const abonnes = new Set<() => void>()

export function etatSeance(): EtatSeance {
  return etat
}

function abonne(notifie: () => void): () => void {
  abonnes.add(notifie)
  return () => {
    abonnes.delete(notifie)
  }
}

function pose(suivant: EtatSeance): void {
  etat = suivant
  for (const notifie of abonnes) notifie()
}

export function choisisOnglet(onglet: Onglet): void {
  pose({ ...etat, onglet })
}

/**
 * §3.4 — un objet cliqué dans la scène ouvre sa fiche. Le geste ne se termine pas sur une
 * boîte de dialogue au milieu du ciel : il garnit le panneau droit et l'amène sous les yeux.
 */
export function ouvreCible(cible: ObjetCielProfond): void {
  pose({ ...etat, cible, onglet: 'CIBLE' })
}

export function majFile(retouche: Partial<ReglagesFile>): void {
  pose({ ...etat, file: { ...etat.file, ...retouche } })
}

/** `null` quand l'incrustation s'éteint : des compteurs périmés mentiraient sur ce qui est tracé. */
export function poseRenduFile(rendu: RenduFile | null): void {
  pose({ ...etat, renduFile: rendu })
}

/**
 * §9.3 — l'incrustation fige le temps. La vue animée reste le §3 : un filé est une
 * composition fixe, et faire défiler l'heure sous des arcs déjà accumulés ne veut rien dire.
 */
export function activeIncrustation(actif: boolean): void {
  majFile({ incrustation: actif })
  if (actif) majTemps({ modeTemps: 'FIGE' })
}

/** Remet la séance dans son état de départ. Réservé aux tests. */
export function reinitialiseSeance(): void {
  pose(ETAT_INITIAL)
}

export function useSeance(): EtatSeance {
  return useSyncExternalStore(abonne, etatSeance, etatSeance)
}
