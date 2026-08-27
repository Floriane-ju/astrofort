/**
 * §9 + §11.2 — l'intention de séance : ce qu'on veut faire, tenu une seule fois.
 *
 * Trois choses doivent traverser l'écran de part en part :
 *
 *   1. un clic sur un objet DANS LA SCÈNE doit ouvrir sa fiche, garnie ;
 *   2. les réglages du filé se règlent au panneau mais se dessinent dans le cadre ;
 *   3. activer l'incrustation fige le temps de la scène — un filé est une composition fixe.
 *
 * Aucun de ces trois chemins ne remonte à un ancêtre commun autre que l'application. Comme
 * pour [[scene-etat]], l'état vit donc dans le module : un magasin externe se lit aussi bien
 * en rendu serveur que dans le navigateur, et se teste sans DOM.
 */

import { useSyncExternalStore } from 'react'
import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { ouvreCarte } from './coque-etat.ts'
import { majTemps } from './scene-etat.ts'

/** §9.2 aperçu d'une pose, §9.3 filé d'une durée accumulée : même moteur, durée différente. */
export type ModeApercu = 'CHAMP' | 'FILE'

/** Réglages de §9.2 à §9.4. Ils pilotent le panneau ET l'incrustation dans le cadre. */
export interface ReglagesFile {
  readonly apercu: ModeApercu
  readonly tPoseS: number
  readonly dureeTotaleMin: number
  readonly intervalleS: number
  readonly espaceLibreGo: string
  readonly reductionBruit: boolean
  /** T-0116 — §9.2/§9.3 peints sur toute la scène, sous les repères, plutôt qu'à part. */
  readonly incrustation: boolean
  /** T-0142 — §9.1 peinte DANS le cadre du capteur, qu'elle masque, plutôt qu'au panneau. */
  readonly poseDansCadre: boolean
}

/**
 * Ce que la dernière passe de filé a effectivement tracé. `null` tant qu'aucune n'a eu lieu.
 *
 * T-0154 — seul l'effectif du catalogue réel subsiste : c'est lui qui dit si le cadre offre un
 * repère brillant pour un pointage manuel. Le semis et les arcs tronqués ne se comptaient que
 * pour une phrase de panneau, et la phrase est partie.
 */
export interface RenduFile {
  readonly reelles: number
}

export interface EtatSeance {
  readonly cible: ObjetCielProfond | null
  readonly file: ReglagesFile
  readonly renduFile: RenduFile | null
}

const ETAT_INITIAL: EtatSeance = {
  cible: null,
  file: {
    apercu: 'CHAMP',
    tPoseS: K('T_POSE_FILE_MAX_S'),
    dureeTotaleMin: K('DUREE_FILE_SPECTACULAIRE_MIN'),
    intervalleS: K('INTERVALLE_INTER_POSE_FILE_MAX_S'),
    espaceLibreGo: '',
    reductionBruit: false,
    incrustation: false,
    poseDansCadre: false,
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

/**
 * §3.4 — un objet cliqué dans la scène ouvre sa fiche. Le geste ne se termine pas sur une
 * boîte de dialogue au milieu du ciel : il garnit la carte Cible et la déplie sous les yeux.
 *
 * T-0113 — la fiche est passée d'un onglet du panneau droit à une carte posée sur la scène.
 * Le contrat est le même et c'est lui qui compte : cliquer un objet DOIT le faire lire sans
 * autre geste. Déplier plutôt que basculer un onglet ne change que le chemin.
 */
export function ouvreCible(cible: ObjetCielProfond): void {
  pose({ ...etat, cible })
  ouvreCarte('CIBLE')
}

export function majFile(retouche: Partial<ReglagesFile>): void {
  pose({ ...etat, file: { ...etat.file, ...retouche } })
}

/** `null` quand le filé s'éteint : des compteurs périmés mentiraient sur ce qui est tracé. */
export function poseRenduFile(rendu: RenduFile | null): void {
  pose({ ...etat, renduFile: rendu })
}

/**
 * T-0116 — la passe de filé se peint par image ; ses compteurs, non.
 *
 * `poseRenduFile` écrit dans le magasin, donc déclenche un rendu React. Publiés à chaque
 * peinture, ils en feraient trente par seconde — le défaut de T-0056. La boucle appelle donc
 * ce publicateur au rythme du diagnostic, et il ne laisse passer que ce qui a CHANGÉ : un filé
 * stable, ou éteint, ne coûte alors plus aucun rendu.
 */
export function publicateurRenduFile(
  publie: (rendu: RenduFile | null) => void,
): (rendu: RenduFile | null) => void {
  let cle: string | null = null
  let amorce = false
  return (rendu) => {
    const suivante = rendu === null ? null : `${rendu.reelles}`
    if (amorce && suivante === cle) return
    amorce = true
    cle = suivante
    publie(rendu)
  }
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
