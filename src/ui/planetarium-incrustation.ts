/**
 * §9.3 — L'incrustation du filé dans le cadre, peinte hors écran.
 *
 * Un rendu par changement de réglage, jamais un par image : la recalculer à chaque frame
 * ferait tomber le compteur d'images du ciel. Pendant un geste continu, la peinture est
 * reportée à la fin du geste, et l'écran annonce le recalcul plutôt que de laisser croire
 * que l'image est à jour.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { K } from '../registry/constants.ts'
import { semisGeneratif } from '../data/semis.ts'
import { axePoleDeDate, type CielInstantane } from '../core/horloges.ts'
import { magnitudeLimitePrevisu } from '../core/galactique.ts'
import { construitIndex, type IndexCiel } from '../core/index-ciel.ts'
import type { Etoile } from '../data/catalog.ts'
import type { Cadre, ProfilCadre } from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import { majLectures, type VueScene } from './scene-etat.ts'
import { poseRenduFile, type ReglagesFile } from './seance-etat.ts'
import { rendIncrustation } from './scene-overlay.ts'
import { renduDiffere } from './rendu-differe.ts'
import type { MaterielFile } from './planetarium-materiel.ts'

const S_PAR_MIN = 60

export interface EntreeIncrustation {
  readonly vue: VueScene
  readonly ciel: CielInstantane
  readonly cadre: Cadre | null
  readonly etoiles: readonly Etoile[]
  readonly file: ReglagesFile
  readonly materiel: MaterielFile | undefined
  readonly site: Site
  readonly modeNuit: boolean
  readonly profils: readonly ProfilCadre[]
}

/**
 * L'index des étoiles réellement catalographiées sous le seuil de §9.3 : au-delà, c'est le
 * semis génératif qui garnit le champ, et il n'est construit qu'à la première incrustation.
 */
export function useIndexReel(etoiles: readonly Etoile[]): IndexCiel {
  return useMemo(
    () => construitIndex(etoiles.filter((e) => e.magV <= K('SEUIL_MAG_ETOILES_REELLES'))),
    [etoiles],
  )
}

/**
 * Rend l'image du filé et la republie dans le magasin de séance. La référence retournée est
 * lue par la boucle de rendu, qui se contente de la redéposer dans le cadre.
 */
export function useIncrustationFile(
  entree: EntreeIncrustation,
): RefObject<CanvasImageSource | null> {
  const { vue, ciel, cadre, file, materiel, site, modeNuit, profils } = entree
  const indexReel = useIndexReel(entree.etoiles)
  const incrustation = useRef<CanvasImageSource | null>(null)
  const indexSemis = useRef<IndexCiel | null>(null)

  /**
   * T-0025 — le pointage, le champ et la durée changent PENDANT un geste continu. Leur
   * signature sert à distinguer « le réglage a changé » de « le réglage est en train de
   * changer » : le premier rend tout de suite, le second attend la fin du geste.
   */
  const cleGeste = `${vue.azimutDeg}|${vue.hauteurDeg}|${vue.rotationDeg}|${vue.fovDeg}|${file.dureeTotaleMin}`
  const cleGestePrecedente = useRef(cleGeste)

  const peintIncrustation = (): void => {
    if (materiel === undefined || cadre === null) return
    // Le semis n'est construit qu'à la première incrustation : sans elle, il ne sert à rien.
    indexSemis.current ??= construitIndex(semisGeneratif())
    const dureeS =
      file.apercu === 'FILE' ? file.dureeTotaleMin * S_PAR_MIN : materiel.profondeur.tPoseS
    const sortie = rendIncrustation({
      vue,
      matriceCiel: ciel.matrice,
      cadre,
      indexReel,
      indexSemis: indexSemis.current,
      magLimite: magnitudeLimitePrevisu(materiel.profondeur).value,
      profondeur: materiel.profondeur,
      echApx: materiel.echApx,
      // Un filé se fait sans suivi par construction : la bascule ne vaut que pour l'aperçu
      // de champ, où une monture qui suit rend les étoiles ponctuelles.
      suiviActif: file.apercu === 'CHAMP' && materiel.tMaxSuiviS !== null,
      sbCiel: materiel.sbCiel,
      dureeS,
      latitudeDeg: site.latitudeDeg,
      axePoleNord: axePoleDeDate(ciel.epoqueAnnee),
      voieLactee: file.voieLactee,
      modeNuit,
    })
    incrustation.current = sortie?.image ?? null
    if (sortie !== null) {
      poseRenduFile({
        reelles: sortie.sortie.etoilesReelles,
        generees: sortie.sortie.etoilesGenerees,
        tronques: sortie.sortie.arcsTronques,
      })
    }
    majLectures({ fileEnAttente: false })
  }

  // La dernière peinture demandée, lue au déclenchement : le report ne doit jamais rendre
  // une image d'après des réglages périmés.
  const dernierePeinture = useRef(peintIncrustation)
  dernierePeinture.current = peintIncrustation
  const planificateur = useRef<ReturnType<typeof renduDiffere> | null>(null)
  planificateur.current ??= renduDiffere(() => dernierePeinture.current())

  useEffect(() => {
    const planifie = planificateur.current!
    const pendantGeste = cleGeste !== cleGestePrecedente.current
    cleGestePrecedente.current = cleGeste

    if (!file.incrustation || materiel === undefined || cadre === null) {
      // Compteurs remis à zéro avec l'image : des chiffres périmés diraient au panneau que
      // des arcs sont tracés alors que le cadre est vide.
      planifie.annule()
      if (incrustation.current !== null) poseRenduFile(null)
      incrustation.current = null
      majLectures({ fileEnAttente: false })
      return
    }
    // Premier rendu, ou changement franc : immédiat. Geste en cours : reporté, et l'écran
    // annonce le recalcul plutôt que de laisser croire que l'image est à jour.
    if (!pendantGeste || incrustation.current === null) {
      planifie.maintenant()
      return
    }
    majLectures({ fileEnAttente: true })
    planifie.bientot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    file.incrustation,
    file.apercu,
    file.voieLactee,
    file.dureeTotaleMin,
    materiel,
    indexReel,
    ciel,
    vue.mode,
    vue.fovDeg,
    vue.azimutDeg,
    vue.hauteurDeg,
    vue.rotationDeg,
    site.latitudeDeg,
    modeNuit,
    profils,
  ])

  // Une passe reportée ne doit pas survivre au démontage : elle peindrait dans un canevas
  // que plus personne ne dépose.
  useEffect(() => () => planificateur.current?.annule(), [])

  return incrustation
}
