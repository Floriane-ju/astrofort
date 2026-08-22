/**
 * §9 — Les nombres du panneau Filé, calculés à part de ce qui les affiche.
 *
 * Les quatre features de §9 partagent le même pointage et le même projecteur, parce qu'elles
 * décrivent la même photographie. Ce module tient cette chaîne : de la visée courante à la
 * carte de pose, au diagnostic des arcs et à la séquence de prises de vue.
 */

import { useMemo } from 'react'
import { axePoleDeDate, cielInstantane } from '../core/horloges.ts'
import { cartePoseMax, traceePx, type CartePoseMax } from '../core/grand-champ.ts'
import { diagnosticFile, type DiagnosticFile } from '../core/file-etoiles.ts'
import { magnitudeLimitePrevisu, type EntreeProfondeur } from '../core/galactique.ts'
import { focaleEquivalente24x36 } from '../core/optics.ts'
import { sequenceFile, type SequenceFile } from '../core/sequence-file.ts'
import type { Site } from '../core/ephem.ts'
import { DEG, versSpherique } from '../core/mat3.ts'
import { projecteur, rayonProjete, type ModeProjection, type Vue } from '../core/projection.ts'
import type { Traced } from '../core/traced.ts'
import type { VueScene } from './scene-etat.ts'
import type { ReglagesFile, RenduFile } from './seance-etat.ts'
import { mentionProjection } from './scene-overlay.ts'

/**
 * Définition de référence du cadre pour les diagnostics. Elle ne décrit aucun canevas :
 * c'est l'échelle en pixels sur laquelle §9.3 chiffre longueurs d'arcs et position du pôle.
 */
export const LARGEUR_CADRE_PX = 1200

export interface MaterielCadre {
  readonly site: Site
  readonly focaleMm: number
  readonly ouvertureN: number
  readonly pitchUm: number
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly fovLDeg: number
  readonly fovHDeg: number
  readonly echApx: number
  readonly tailleRawMo: number
  readonly profondeur: EntreeProfondeur
  readonly tMaxSuiviS: number | null
  readonly autonomieCipa: number | null
  readonly modeObjectif: ModeProjection
}

export interface LecturesFile {
  /** Centre du cadre en coordonnées équatoriales : ce que le boîtier vise vraiment. */
  readonly visee: { readonly longitudeDeg: number; readonly latitudeDeg: number }
  readonly focaleEquivalente: Traced<number>
  readonly carte: CartePoseMax
  readonly profondeur: Traced<number>
  readonly trainee: Traced<number>
  /** Vrai quand la pose unitaire dépasse ce que le cadre tolère : les étoiles s'ovalisent. */
  readonly poseDepassee: boolean
  /** Renseignée quand la scène ne regarde pas comme l'objectif : la mention le dit. */
  readonly mentionProj: string | null
  readonly diagnostic: DiagnosticFile
  readonly sequence: SequenceFile
}

export function useLecturesFile(
  materiel: MaterielCadre,
  vue: VueScene,
  file: ReglagesFile,
  renduFile: RenduFile | null,
): LecturesFile {
  const mode = materiel.modeObjectif
  const { azimutDeg, hauteurDeg, rotationCadreDeg: rotationDeg } = vue
  const hauteurCadrePx = Math.round(
    (LARGEUR_CADRE_PX * rayonProjete(mode, (materiel.fovHDeg / 2) * DEG)) /
      rayonProjete(mode, (materiel.fovLDeg / 2) * DEG),
  )

  const ciel = useMemo(() => cielInstantane(materiel.site, new Date()), [materiel.site])
  // Les arcs tournent autour du pôle DE L'ÉPOQUE, pas de l'axe z du repère J2000 (§3.1).
  const axePoleNord = useMemo(() => axePoleDeDate(ciel.epoqueAnnee), [ciel.epoqueAnnee])

  const proj = useMemo(() => {
    const vueCadre: Vue = {
      mode,
      fovDeg: materiel.fovLDeg,
      largeurPx: LARGEUR_CADRE_PX,
      hauteurPx: hauteurCadrePx,
      azimutDeg,
      hauteurDeg,
      rotationDeg,
    }
    return projecteur(vueCadre, ciel.matrice)
  }, [mode, materiel.fovLDeg, hauteurCadrePx, azimutDeg, hauteurDeg, rotationDeg, ciel])
  const visee = useMemo(
    () => versSpherique(proj.inverse(LARGEUR_CADRE_PX / 2, hauteurCadrePx / 2)),
    [proj, hauteurCadrePx],
  )

  const focaleEquivalente = focaleEquivalente24x36(
    materiel.focaleMm,
    materiel.capteurLMm,
    materiel.capteurHMm,
  )

  const carte = useMemo(
    () =>
      cartePoseMax({
        focaleMm: materiel.focaleMm,
        ouvertureN: materiel.ouvertureN,
        pitchUm: materiel.pitchUm,
        fovLDeg: materiel.fovLDeg,
        fovHDeg: materiel.fovHDeg,
        centreAdDeg: visee.longitudeDeg,
        centreDecDeg: visee.latitudeDeg,
        rotationDeg,
        focaleEquivalenteMm: focaleEquivalente.value,
        tMaxSuiviS: materiel.tMaxSuiviS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materiel, visee, rotationDeg, focaleEquivalente.value],
  )

  const diagnostic = useMemo(
    () =>
      diagnosticFile({
        projecteur: proj,
        latitudeDeg: materiel.site.latitudeDeg,
        axePoleNord,
        dureeMin: file.dureeTotaleMin,
        decMinAbsDeg: carte.decMinAbsDeg,
        decMaxAbsDeg: carte.decMaxAbsDeg,
        hauteurCadreDeg: materiel.fovHDeg,
        arcsTronques: renduFile?.tronques ?? 0,
      }),
    [
      proj,
      materiel.site.latitudeDeg,
      axePoleNord,
      materiel.fovHDeg,
      file.dureeTotaleMin,
      carte,
      renduFile,
    ],
  )

  const sequence = useMemo(
    () =>
      sequenceFile({
        dureeTotaleMin: file.dureeTotaleMin,
        tPoseS: file.tPoseS,
        intervalleS: file.intervalleS,
        temperatureC: Number(file.temperatureC),
        tailleRawMo: materiel.tailleRawMo,
        autonomieCipa:
          file.autonomieSaisie.trim() === ''
            ? materiel.autonomieCipa
            : Number(file.autonomieSaisie),
        espaceLibreGo: file.espaceLibreGo.trim() === '' ? null : Number(file.espaceLibreGo),
        decDeg: carte.decMinAbsDeg,
        reductionBruitActive: file.reductionBruit,
      }),
    [file, materiel.tailleRawMo, materiel.autonomieCipa, carte.decMinAbsDeg],
  )

  return {
    visee,
    focaleEquivalente,
    carte,
    profondeur: magnitudeLimitePrevisu(materiel.profondeur),
    trainee: traceePx(file.tPoseS, carte.decMinAbsDeg, materiel.echApx),
    poseDepassee: carte.poseOperanteS !== null && file.tPoseS > carte.poseOperanteS,
    mentionProj: mentionProjection(vue.mode, mode),
    diagnostic,
    sequence,
  }
}
