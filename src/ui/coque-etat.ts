/**
 * T-0113 — l'état de la coque : ce qui est posé sur la scène, et ce qui est ouvert à côté.
 *
 * La coque ne pile plus trois colonnes : la scène occupe tout, et les réglages viennent
 * dessus en cartes déplaçables ou à côté en panneau latéral. Trois choses doivent donc être
 * lisibles de plusieurs endroits sans ancêtre commun — un clic sur un objet DANS la scène
 * ouvre la carte Cible ; une carte se replie depuis son propre en-tête ; une carte déplacée
 * mesure ce que la coque réserve. Même raison que [[scene-etat]] et [[seance-etat]] : l'état vit
 * dans le module, donc il se lit en rendu serveur comme dans le navigateur, et se teste sans
 * DOM.
 *
 * Les positions ne sont PAS persistées. Une carte déplacée revient à sa place au rechargement,
 * et c'est voulu : §12.3 enregistre ce qui décrit une séance — un site, un matériel — pas la
 * disposition d'un bureau. Une carte perdue hors écran après une mise à jour de la coque
 * serait un bug irréparable sans vider le stockage.
 */

import { useSyncExternalStore } from 'react'

/** Les trois cartes posées sur la scène. Chacune est nommée d'après ce qu'elle montre. */
export type CleCarte = 'MATERIEL' | 'VUE' | 'CIBLE'

export interface Decalage {
  readonly x: number
  readonly y: number
}

export interface EtatCarte {
  readonly ouverte: boolean
  /** Décalage en pixels par rapport à l'ancrage CSS de la carte, jamais une position absolue. */
  readonly decalage: Decalage
}

export interface EtatCoque {
  readonly cartes: Readonly<Record<CleCarte, EtatCarte>>
}

const SANS_DECALAGE: Decalage = Object.freeze({ x: 0, y: 0 })

/**
 * Deux cartes démarrent repliées, et pour deux raisons distinctes.
 *
 * VUE — ses interrupteurs se règlent une fois puis se laissent tranquilles, alors que le
 * matériel se relit à chaque changement de focale.
 *
 * CIBLE — tant qu'aucun objet n'a été cliqué, la fiche décrit la cible de référence de §6.3,
 * pas un choix de l'utilisateur. Dépliée au démarrage, elle afficherait des lectures que
 * personne n'a demandées, sur un objet que personne n'a désigné. `ouvreCible` la déplie, et
 * c'est le seul chemin qui doit la faire apparaître.
 */
const ETAT_INITIAL: EtatCoque = Object.freeze({
  cartes: Object.freeze({
    MATERIEL: { ouverte: true, decalage: SANS_DECALAGE },
    VUE: { ouverte: false, decalage: SANS_DECALAGE },
    CIBLE: { ouverte: false, decalage: SANS_DECALAGE },
  }),
})

let etat: EtatCoque = ETAT_INITIAL
const abonnes = new Set<() => void>()

export function etatCoque(): EtatCoque {
  return etat
}

function abonne(notifie: () => void): () => void {
  abonnes.add(notifie)
  return () => {
    abonnes.delete(notifie)
  }
}

function pose(suivant: EtatCoque): void {
  etat = suivant
  for (const notifie of abonnes) notifie()
}

function retoucheCarte(cle: CleCarte, retouche: Partial<EtatCarte>): void {
  pose({
    ...etat,
    cartes: { ...etat.cartes, [cle]: { ...etat.cartes[cle], ...retouche } },
  })
}

export function basculeCarte(cle: CleCarte): void {
  retoucheCarte(cle, { ouverte: !etat.cartes[cle].ouverte })
}

/** Ouvre sans replier : appelé quand un geste EXTÉRIEUR à la carte doit la faire lire. */
export function ouvreCarte(cle: CleCarte): void {
  if (etat.cartes[cle].ouverte) return
  retoucheCarte(cle, { ouverte: true })
}

export function deplaceCarte(cle: CleCarte, decalage: Decalage): void {
  retoucheCarte(cle, { decalage })
}

/** Remet la coque dans son état de départ. Réservé aux tests. */
export function reinitialiseCoque(): void {
  pose(ETAT_INITIAL)
}

export function useCoque(): EtatCoque {
  return useSyncExternalStore(abonne, etatCoque, etatCoque)
}

// ---------------------------------------------------------------------------
// Bornage du déplacement — pur, donc testable sans DOM ni pointeur
// ---------------------------------------------------------------------------

/** Un rectangle mesuré, dans le repère du viewport. */
export interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Ce que la coque réserve sur ses bords : les deux barres et le panneau, toujours là. */
export interface MargesCoque {
  readonly haut: number
  readonly bas: number
  readonly droite: number
}

export interface Bornes {
  readonly min: number
  readonly max: number
}

/**
 * Ramène une valeur dans ses bornes, même quand elles sont inversées.
 *
 * Elles le sont dès qu'une carte est plus large ou plus haute que la place restante — cas
 * réel sur une fenêtre courte avec la carte Matériel dépliée. Sans le `Math.min(min, max)`,
 * `Math.max(min, Math.min(v, max))` renverrait alors `min`, c'est-à-dire projetterait la
 * carte contre le bord opposé à chaque mouvement de souris.
 */
export function borne(valeur: number, bornes: Bornes): number {
  const bas = Math.min(bornes.min, bornes.max)
  const haut = Math.max(bornes.min, bornes.max)
  return Math.max(bas, Math.min(valeur, haut))
}

/**
 * Les décalages qui gardent la carte entièrement dans la coque, barres et panneau déduits.
 *
 * T-0181 — le panneau ne se ferme plus : sa largeur est toujours réservée, et une carte
 * poussée à fond vers la droite s'arrête à son bord au lieu de glisser dessous.
 *
 * Le décalage est relatif à l'ancrage CSS, pas absolu : les bornes se calculent donc à partir
 * de la position ACTUELLE de la carte, et le décalage déjà appliqué s'y ajoute à l'appel.
 */
export function bornesDeplacement(
  carte: Rect,
  hote: Rect,
  marges: MargesCoque,
  marge: number,
): { readonly x: Bornes; readonly y: Bornes } {
  return {
    x: {
      min: hote.left + marge - carte.left,
      max: hote.left + hote.width - marge - marges.droite - carte.width - carte.left,
    },
    y: {
      min: hote.top + marges.haut + marge - carte.top,
      max: hote.top + hote.height - marges.bas - marge - carte.height - carte.top,
    },
  }
}
