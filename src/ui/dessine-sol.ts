/**
 * §4.1 — le sol du site, peint.
 *
 * Écarter les sommets sous l'horizon ne suffit pas : la bande de la Voie lactée est un TRAIT
 * ÉPAIS de la largeur d'une tranche de latitude, et sa largeur débordait sous l'horizon là où
 * ses sommets étaient déjà écartés. Un masque qui laisse passer la moitié d'un trait n'est pas
 * un masque. Le sol se peint donc, opaque, avant les repères.
 *
 * La frontière se cherche en espace écran — voir `balayage-ecran.ts`, qui porte la géométrie
 * et la raison de ce choix. Le halo d'horizon (T-0098) balaie exactement de la même façon.
 */

import type { Mat3 } from '../core/mat3.ts'
import type { Projecteur } from '../core/projection.ts'
import type { MasqueHorizon } from '../core/site.ts'
import { sousLeSol } from '../core/sol.ts'
import { frontiereEcran, remplitRegion, traceFrontiere } from './balayage-ecran.ts'

/**
 * Peint le sol et souligne sa crête.
 *
 * Sans la crête, le sol et le fond de ciel se touchent sans se séparer, et l'horizon n'est
 * plus qu'une absence d'étoiles.
 */
export function dessineSol(
  ctx: CanvasRenderingContext2D,
  projecteur: Projecteur,
  matriceCiel: Mat3,
  masque: MasqueHorizon,
  couleurSol: string,
  couleurCrete: string,
): void {
  const frontiere = frontiereEcran(projecteur, sousLeSol(masque, matriceCiel))
  remplitRegion(ctx, frontiere, couleurSol)
  traceFrontiere(ctx, frontiere, couleurCrete)
}
