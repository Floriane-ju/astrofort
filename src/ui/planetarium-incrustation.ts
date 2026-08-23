/**
 * §9.3 — Ce que la passe de filé tient des réglages, publié pour la boucle de rendu.
 *
 * T-0116 — il n'y a plus d'image à peindre ici. La passe se dessine dans la boucle, image par
 * image, avec le projecteur de la scène : ce module ne fournit plus que la part des paramètres
 * qui vient du matériel et du panneau, et qui ne dépend donc d'aucune image en particulier.
 *
 * Les paramètres s'écrivent PENDANT le rendu React, comme l'état de boucle de `Planetarium` :
 * la boucle les relit à chaque image, et un panoramique n'a donc rien à replanifier.
 */

import { useMemo, useRef, type RefObject } from 'react'
import { K } from '../registry/constants.ts'
import { semisGeneratif } from '../data/semis.ts'
import { magnitudeLimitePrevisu } from '../core/galactique.ts'
import { construitIndex, type IndexCiel } from '../core/index-ciel.ts'
import type { Etoile } from '../data/catalog.ts'
import type { VueScene } from './scene-etat.ts'
import type { ReglagesFile } from './seance-etat.ts'
import type { ParametresFile } from './dessine-champ.ts'
import type { MaterielFile } from './planetarium-materiel.ts'

const S_PAR_MIN = 60

export interface EntreeParametresFile {
  readonly etoiles: readonly Etoile[]
  readonly file: ReglagesFile
  readonly materiel: MaterielFile | undefined
}

/**
 * L'index des étoiles réellement catalographiées sous le seuil de §9.3 : au-delà, c'est le
 * semis génératif qui garnit le champ, et il n'est construit qu'à la première passe de filé.
 */
export function useIndexReel(etoiles: readonly Etoile[]): IndexCiel {
  return useMemo(
    () => construitIndex(etoiles.filter((e) => e.magV <= K('SEUIL_MAG_ETOILES_REELLES'))),
    [etoiles],
  )
}

/**
 * T-0025 — la signature d'un geste en cours : le pointage, le champ et la durée.
 *
 * Elle ne pilote plus le filé, qui se recalcule maintenant par image (T-0116). Elle reste le
 * critère de « une répétition de touche ne relance pas le calcul » (T-0069) : un pas au
 * clavier n'écrit que ces champs-là. T-0117 tranchera ce qu'il reste de report à supprimer.
 */
export function signatureGeste(vue: VueScene, dureeTotaleMin: number): string {
  return `${vue.azimutDeg}|${vue.hauteurDeg}|${vue.rotationCadreDeg}|${vue.fovDeg}|${dureeTotaleMin}`
}

/**
 * Les paramètres de la passe de filé, ou `null` quand elle est éteinte. La référence est lue
 * par la boucle de rendu : c'est elle qui appelle `dessineChamp` avec la vue de l'image.
 */
export function useParametresFile(
  entree: EntreeParametresFile,
): RefObject<ParametresFile | null> {
  const { file, materiel } = entree
  const indexReel = useIndexReel(entree.etoiles)
  const parametres = useRef<ParametresFile | null>(null)
  const indexSemis = useRef<IndexCiel | null>(null)

  if (!file.incrustation || materiel === undefined) {
    parametres.current = null
    return parametres
  }
  // Le semis n'est construit qu'à la première passe : sans elle, il ne sert à rien.
  indexSemis.current ??= construitIndex(semisGeneratif())
  parametres.current = {
    indexReel,
    indexSemis: indexSemis.current,
    magLimite: magnitudeLimitePrevisu(materiel.profondeur).value,
    profondeur: materiel.profondeur,
    echApx: materiel.echApx,
    // Un filé se fait sans suivi par construction : la bascule ne vaut que pour l'aperçu
    // de champ, où une monture qui suit rend les étoiles ponctuelles.
    suiviActif: file.apercu === 'CHAMP' && materiel.tMaxSuiviS !== null,
    dureeS:
      file.apercu === 'FILE' ? file.dureeTotaleMin * S_PAR_MIN : materiel.profondeur.tPoseS,
  }
  return parametres
}
