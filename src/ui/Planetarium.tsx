/**
 * §3 — La scène : pipeline à deux horloges, moteur unifié, trois couches de tracés,
 * superposition du cadre matériel et incrustation du filé de §9 dans ce cadre.
 *
 * Ce n'est pas une vue décorative : c'est le point d'entrée vers les moteurs. Un clic sur un
 * objet du ciel profond ouvre l'onglet Cible garni (§6.2 / §6.3 / §7), et le cadre superposé
 * montre ce que le matériel déclaré capturerait vraiment — arcs compris.
 *
 * Depuis le lot 6, la scène ne porte plus ses réglages : ils sont dans le panneau droit, à
 * hauteur d'œil de l'image qu'ils modifient. Depuis T-0038 elle ne porte plus non plus ses
 * lectures : elles sont dans le menu d'information de la barre haute (`MenuInfos`), et ce
 * composant publie dans le magasin de scène ce qu'il est seul à savoir — le diagnostic de la
 * boucle, l'objet cliqué, l'attente d'une incrustation.
 *
 * Ne reste ici que le canevas et l'assemblage : la boucle de rendu est dans
 * `planetarium-boucle.ts`, l'incrustation du filé dans `planetarium-incrustation.ts`, les
 * gestes dans `planetarium-gestes.ts`.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { PaquetConstellations } from '../data/constellations.ts'
import { coucheAsterismes, coucheFigures, coucheFrontieres } from '../core/constellations.ts'
import { reglageVitesse } from '../core/curseur-temps.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import { cielInstantane } from '../core/horloges.ts'
import { etatProfondeur, type ModeProjection } from '../core/projection.ts'
import { majVue, resolutionRendu, useScene } from './scene-etat.ts'
import { useSeance } from './seance-etat.ts'
import type { Cadre, ProfilCadre } from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import type { MasqueHorizon } from '../core/site.ts'
import type { SurvolEcran } from './dessine-ciel.ts'
import { useBoucleRendu, type EtatBoucle } from './planetarium-boucle.ts'
import { useIncrustationFile } from './planetarium-incrustation.ts'
import {
  RACCOURCIS_CLAVIER,
  useGestesZoom,
  usePilotageClavier,
  usePointageSouris,
} from './planetarium-gestes.ts'
import { ligneVisee } from './scene-lecture.ts'

export {
  facteurZoom,
  roulisApresGlisser,
  sourceMolette,
  type SourceGeste,
} from './planetarium-gestes.ts'

/**
 * T-0068 — la description associée au canevas. Un identifiant plutôt qu'un `aria-label` long :
 * le nom dit CE QUE C'EST, la description dit CE QU'ON Y VOIT EN CE MOMENT.
 */
const ID_DESCRIPTION = 'planetarium-description'
export type { MaterielFile } from './planetarium-materiel.ts'

import type { MaterielFile } from './planetarium-materiel.ts'

export interface PlanetariumProps {
  readonly site: Site
  /** §4.1 — relief relevé du site : c'est lui que la couche Sol masque, pas un horizon plat. */
  readonly masque: MasqueHorizon
  readonly etoiles: readonly Etoile[]
  /** Index de sélection du catalogue, construit une fois par l'application. */
  readonly index: IndexCiel
  readonly objets: readonly ObjetCielProfond[]
  readonly constellations: PaquetConstellations
  /** Profils de cadre à superposer (§3.5). Vide : l'app demande le profil, sans en inventer. */
  readonly profils: readonly ProfilCadre[]
  readonly mLimOeil: number | null
  readonly gaiaCharge: boolean
  /**
   * §5.1 — la projection de l'objectif déclaré au panneau matériel. C'est elle, et pas un
   * réglage de rendu, qui décide ce que « voir comme l'objectif » veut dire ici.
   */
  readonly modeObjectif: ModeProjection
  /**
   * §3.7 — fond de ciel du site (§2.2). C'est lui qui décide du contraste de la bande de la
   * Voie lactée : la scène montre le ciel de CE site, pas une carte de référence idéale.
   */
  readonly sbCiel: number
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
  /** Absent : la scène ne peut pas incruster le filé, faute de matériel chiffrable. */
  readonly file?: MaterielFile
  readonly surSelectionObjet: (objet: ObjetCielProfond) => void
}

/**
 * T-0040 — la définition de rendu suit la boîte, sinon l'image s'y loge en laissant des
 * bandes. C'est la taille CSS qui est observée, jamais les attributs du canevas : les
 * réécrire ne change pas la boîte, donc l'observation ne se rappelle pas elle-même.
 */
function useResolutionSuitLaBoite(canevas: React.RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const cible = canevas.current
    if (cible === null || typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver((entrees) => {
      const boite = entrees[0]?.contentRect
      if (boite === undefined || boite.width === 0 || boite.height === 0) return
      majVue(resolutionRendu(boite.width, boite.height, window.devicePixelRatio || 1))
    })
    observateur.observe(cible)
    return () => {
      observateur.disconnect()
    }
  }, [canevas])
}

export function Planetarium(props: PlanetariumProps) {
  const canevas = useRef<HTMLCanvasElement>(null)
  // T-0085 — le survol vit hors de React : il change à chaque mouvement de souris, et la
  // boucle est seule à le lire. Le passer par l'état rendrait la scène soixante fois par
  // seconde pour un label transitoire.
  const survol = useRef<SurvolEcran | null>(null)

  // Pointage, temps et couches sont ceux de la scène, réglés depuis le panneau droit.
  const { vue: pointage, temps, rendu, msAffiche, instant, actions } = useScene()
  const { fovDeg, largeurPx, hauteurPx } = pointage
  const { file } = useSeance()

  const figures = useMemo(() => coucheFigures(props.constellations.figures), [props.constellations])
  const asterismes = useMemo(
    () => coucheAsterismes(props.constellations.asterismes),
    [props.constellations],
  )
  const frontieres = useMemo(() => coucheFrontieres(props.constellations), [props.constellations])

  const profondeur = useMemo(
    () => etatProfondeur(fovDeg, props.index.profondeurMag, props.mLimOeil, rendu.vueRealiste),
    [fovDeg, props.index.profondeurMag, props.mLimOeil, rendu.vueRealiste],
  )
  const reglage = useMemo(
    () => reglageVitesse(temps.facteur, largeurPx, fovDeg),
    [temps.facteur, largeurPx, fovDeg],
  )
  const dateAffichee = useMemo(() => new Date(msAffiche), [msAffiche])
  const ciel = useMemo(
    () => cielInstantane(props.site, dateAffichee),
    [props.site, dateAffichee],
  )

  const cadrePrincipal: Cadre | null =
    props.profils.length === 0
      ? null
      : {
          profil: props.profils[0]!,
          azimutDeg: pointage.azimutDeg,
          hauteurDeg: pointage.hauteurDeg,
          rotationDeg: pointage.rotationCadreDeg,
        }

  const incrustation = useIncrustationFile({
    vue: pointage,
    ciel,
    cadre: cadrePrincipal,
    etoiles: props.etoiles,
    file,
    materiel: props.file,
    site: props.site,
    modeNuit: props.modeNuit,
    profils: props.profils,
  })

  useResolutionSuitLaBoite(canevas)

  // État mutable lu par la boucle de rendu, réécrit à chaque rendu React.
  const etatBoucle = useRef<EtatBoucle>(null!)
  etatBoucle.current = {
    site: props.site,
    masque: props.masque,
    etoiles: props.etoiles,
    objets: props.objets,
    constellations: props.constellations,
    profils: props.profils,
    modeNuit: props.modeNuit,
    index: props.index,
    figures,
    asterismes,
    frontieres,
    couches: rendu.couches,
    magLimite: profondeur.magLimite.value,
    sbCiel: props.sbCiel,
    vue: pointage,
    modeTemps: temps.modeTemps,
    facteur: reglage.facteur,
    // §11.2 — aucune animation non sollicitée : le mode nuit met le défilement en pause.
    // T-0072 : `prefers-reduced-motion` n'ajoute rien ici. Le défilement n'est jamais l'état
    // de départ (§3.2, `MAINTENANT`) — il ne peut donc pas s'imposer, et le couper d'office
    // sous la préférence retirerait un mode que l'utilisateur a explicitement demandé.
    anime: temps.modeTemps === 'DEFILEMENT' && !props.modeNuit,
  }

  const cibles = useBoucleRendu({ canevas, etat: etatBoucle, instant, incrustation, survol })
  const souris = usePointageSouris({
    largeurPx,
    fovDeg,
    actions,
    cibles,
    survol,
    surSelectionObjet: props.surSelectionObjet,
  })
  useGestesZoom(canevas, props.gaiaCharge)
  // T-0069 — WCAG 2.1.1 : les mêmes gestes, au clavier, dans les mêmes bornes.
  const clavier = usePilotageClavier({
    largeurPx,
    hauteurPx,
    gaiaCharge: props.gaiaCharge,
    cibles,
    surSelectionObjet: props.surSelectionObjet,
  })

  return (
    <section className="scene">
      <canvas
        ref={canevas}
        className="planetarium"
        width={largeurPx}
        height={hauteurPx}
        /* T-0068 / T-0069 — `application` et non `img` : la scène se pilote au clavier, et
           une technologie d'assistance doit lui laisser passer les flèches plutôt que de les
           garder pour son propre parcours. Sans rôle, un canevas n'est qu'une boîte de pixels
           qui n'existe pas pour elle. */
        role="application"
        tabIndex={0}
        aria-label="Planétarium — le ciel du site à l’instant affiché"
        aria-describedby={ID_DESCRIPTION}
        onKeyDown={clavier.onKeyDown}
        onPointerDown={souris.onPointerDown}
        onPointerMove={souris.onPointerMove}
        onPointerUp={souris.onPointerUp}
        onPointerLeave={souris.onPointerLeave}
      />
      {/* T-0068 — ce que la vue montre en ce moment, dans les mots exacts de la lecture
          affichée au menu d'information : `ligneVisee` est la seule à composer la phrase.
          Hors flux visuel — la colonne centrale ne réserve aucune hauteur sous le canevas
          (T-0040) — mais présente dans l'arbre d'accessibilité. */}
      <p className="scene-description" id={ID_DESCRIPTION}>
        {ligneVisee(pointage, ciel.matrice, dateAffichee)}. {RACCOURCIS_CLAVIER}
      </p>
    </section>
  )
}
