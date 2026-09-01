/**
 * §3 — La scène : pipeline à deux horloges, moteur unifié, trois couches de tracés,
 * superposition du cadre matériel et aperçu du filé de §9 peint dans ce cadre.
 *
 * Ce n'est pas une vue décorative : c'est le point d'entrée vers les moteurs. Un clic sur un
 * objet du ciel profond ouvre l'onglet Cible garni (§6.2 / §6.3 / §7), et le cadre superposé
 * montre ce que le matériel déclaré capturerait vraiment — arcs compris.
 *
 * Depuis le lot 6, la scène ne porte plus ses réglages : ils sont dans le panneau droit, à
 * hauteur d'œil de l'image qu'ils modifient. Depuis T-0038 elle ne porte plus non plus ses
 * lectures ; depuis T-0153 il n'en reste qu'une, la phrase qui date l'image, au centre de la
 * barre basse. Ce composant publie dans le magasin de scène ce qu'il est seul à savoir —
 * l'objet cliqué, l'attente d'une passe de filé.
 *
 * Ne reste ici que le canevas et l'assemblage : la boucle de rendu est dans
 * `planetarium-boucle.ts`, l'aperçu du filé dans `planetarium-panorama.ts`, les
 * gestes dans `planetarium-gestes.ts`.
 */

import { useEffect, useMemo, useRef } from 'react'
import { Body } from 'astronomy-engine'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { PaquetConstellations } from '../data/constellations.ts'
import { coucheAsterismes, coucheFigures, coucheFrontieres } from '../core/constellations.ts'
import { reglageVitesse } from '../core/curseur-temps.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import { cielInstantane } from '../core/horloges.ts'
import { etatLune } from '../core/moon.ts'
import { sbEffectifRendu, sbZenithAvecCrepuscule } from '../core/fond-ciel-rendu.ts'
import { separationDeg, versVecteur } from '../core/mat3.ts'
import type { LuneEcran } from './dessine-fond-ciel.ts'
import { etatProfondeur, type ModeProjection } from '../core/projection.ts'
import { majVue, resolutionRendu, useScene } from './scene-etat.ts'
import { useSeance } from './seance-etat.ts'
import type { ProfilCadre } from '../core/cadre.ts'
import { positionCorps, type Site } from '../core/ephem.ts'
import type { MasqueHorizon } from '../core/site.ts'
import type { SurvolEcran } from './dessine-ciel.ts'
import { useBoucleRendu, type EtatBoucle } from './planetarium-boucle.ts'
import { useParametresFile } from './planetarium-panorama.ts'
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
  signaturePave,
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
  const { file, mode } = useSeance()

  const figures = useMemo(() => coucheFigures(props.constellations.figures), [props.constellations])
  const asterismes = useMemo(
    () => coucheAsterismes(props.constellations.asterismes),
    [props.constellations],
  )
  const frontieres = useMemo(() => coucheFrontieres(props.constellations), [props.constellations])

  const dateAffichee = useMemo(() => new Date(msAffiche), [msAffiche])
  // T-0100 — la Lune de l'instant affiché : le halo est centré sur ELLE, donc sur le même
  // état que le corps dessiné. §12.5 — un instant hors du domaine des séries n'éteint pas la
  // scène : la Lune sort du calcul, le reste continue.
  const lune = useMemo((): LuneEcran | null => {
    try {
      const etat = etatLune(props.site, dateAffichee)
      return {
        adH: etat.adH,
        decDeg: etat.decDeg,
        altitudeDeg: etat.altitudeDeg,
        anglePhaseDeg: etat.anglePhaseDeg,
        azimutDeg: etat.azimutDeg,
      }
    } catch {
      return null
    }
  }, [props.site, dateAffichee])

  /**
   * T-0099 — dépression du Soleil sous l'horizon à l'instant affiché, en degrés. C'est elle,
   * et non l'heure légale, qui décide de la clarté du fond : le curseur de temps traverse le
   * crépuscule à chaque séance.
   *
   * La hauteur est celle corrigée de la réfraction, comme partout ailleurs dans l'app. La
   * table de Patat 2006 est ajustée sur une dépression géométrique, mais elle commence à 5°
   * sous l'horizon — là où la réfraction ne corrige plus rien.
   *
   * §12.5 — un instant hors du domaine des séries n'éteint pas la scène : le crépuscule sort
   * du calcul, le reste continue. Même règle que la Lune juste au-dessus.
   */
  const depressionSolaireDeg = useMemo((): number | null => {
    try {
      return -positionCorps(Body.Sun, dateAffichee, props.site).hauteurDeg
    } catch {
      return null
    }
  }, [props.site, dateAffichee])

  /**
   * T-0098, T-0100 — le fond de ciel EFFECTIF dans la direction visée : celui du site, majoré
   * du halo d'horizon et de la Lune. C'est lui qui plafonne la magnitude limite en vue
   * réaliste, sans quoi une pleine Lune montrerait autant d'étoiles qu'une nuit noire.
   */
  const sbEffectif = useMemo(
    () =>
      sbEffectifRendu({
        sbSiteMag: props.sbCiel,
        hauteurDeg: pointage.hauteurDeg,
        ...(depressionSolaireDeg === null ? {} : { depressionSolaireDeg }),
        ...(lune === null || lune.altitudeDeg <= 0
          ? {}
          : {
              lune: {
                altitudeLuneDeg: lune.altitudeDeg,
                altitudeCibleDeg: pointage.hauteurDeg,
                separationDeg: separationDeg(
                  versVecteur(pointage.azimutDeg, pointage.hauteurDeg),
                  versVecteur(lune.azimutDeg, lune.altitudeDeg),
                ),
                anglePhaseDeg: lune.anglePhaseDeg,
              },
            }),
      }),
    [props.sbCiel, pointage.azimutDeg, pointage.hauteurDeg, lune, depressionSolaireDeg],
  )

  /**
   * T-0099 — fond de ciel du site au zénith, crépuscule compris. La scène en part pour TOUTES
   * ses couches : teinte du fond, paliers de halo, contraste de la bande. Vue réaliste
   * décochée, c'est le fond du site nu — la scène est alors celle d'avant T-0097, au pixel près.
   */
  const sbCielScene = useMemo(
    () =>
      rendu.vueRealiste && depressionSolaireDeg !== null
        ? sbZenithAvecCrepuscule(props.sbCiel, depressionSolaireDeg)
        : props.sbCiel,
    [props.sbCiel, rendu.vueRealiste, depressionSolaireDeg],
  )

  const profondeur = useMemo(
    () => etatProfondeur(fovDeg, props.index.profondeurMag, sbEffectif, rendu.vueRealiste),
    [fovDeg, props.index.profondeurMag, sbEffectif, rendu.vueRealiste],
  )
  const reglage = useMemo(
    () => reglageVitesse(temps.facteur, largeurPx, fovDeg),
    [temps.facteur, largeurPx, fovDeg],
  )
  const ciel = useMemo(
    () => cielInstantane(props.site, dateAffichee),
    [props.site, dateAffichee],
  )

  // T-0116 — le filé se peint dans la boucle, sur toute la scène : ce hook ne fournit plus que
  // ce qu'il tient du matériel et du panneau. La vue, le fond et le pôle viennent de l'image.
  const parametresFile = useParametresFile({
    etoiles: props.etoiles,
    mode,
    file,
    materiel: props.file,
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
    // T-0142 — la carte de pose ne se peint que si elle est demandée ET chiffrable : sans
    // matériel, il n'y a pas de NPF, donc pas de cadre à masquer.
    poseCadre: file.poseDansCadre && props.file !== undefined ? props.file.optique : null,
    magLimite: profondeur.magLimite.value,
    sbCiel: sbCielScene,
    vueRealiste: rendu.vueRealiste,
    lune,
    vue: pointage,
    modeTemps: temps.modeTemps,
    facteur: reglage.facteur,
    decalageMs: temps.decalageMs,
    // T-0137 — le mode nuit ne change que les couleurs : il ne coupe pas le défilement, qui
    // se règle sous le ciel comme en préparation. T-0072 : `prefers-reduced-motion` n'ajoute
    // rien ici non plus — le défilement n'est jamais l'état de départ (§3.2, `MAINTENANT`),
    // il ne peut donc pas s'imposer, et le couper d'office retirerait un mode demandé.
    anime: temps.modeTemps === 'DEFILEMENT',
  }

  const cibles = useBoucleRendu({ canevas, etat: etatBoucle, instant, parametresFile, survol })
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
          affichée à la barre basse : `ligneVisee` est la seule à composer la phrase.
          Hors flux visuel — la colonne centrale ne réserve aucune hauteur sous le canevas
          (T-0040) — mais présente dans l'arbre d'accessibilité. */}
      <p className="scene-description" id={ID_DESCRIPTION}>
        {ligneVisee(pointage, ciel.matrice, dateAffichee)}. {RACCOURCIS_CLAVIER}
      </p>
    </section>
  )
}
