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
 * boucle, l'objet cliqué, l'attente d'une incrustation. Ne reste ici que le canevas et les
 * gestes qui s'y font.
 *
 * Le rendu vit dans une boucle `requestAnimationFrame` qui lit un état mutable ; React ne
 * réagit qu'aux commandes et aux diagnostics, jamais à l'image. Sans cette séparation, une
 * animation à 60 Hz déclencherait soixante rendus React par seconde. L'incrustation du filé
 * suit la même règle : elle est peinte hors écran au changement de réglage, et la boucle ne
 * fait que la redéposer.
 */

import { useEffect, useMemo, useRef } from 'react'
import { K } from '../registry/constants.ts'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { PaquetConstellations } from '../data/constellations.ts'
import { semisGeneratif } from '../data/semis.ts'
import { coucheAsterismes, coucheFigures, coucheFrontieres } from '../core/constellations.ts'
import { reglageVitesse } from '../core/curseur-temps.ts'
import { construitIndex, type IndexCiel } from '../core/index-ciel.ts'
import {
  avanceEphemerides,
  axePoleDeDate,
  cielInstantane,
  pasEphemeridesMs,
  positionsInterpolees,
  type EtatEphemerides,
} from '../core/horloges.ts'
import { magnitudeLimitePrevisu, type EntreeProfondeur } from '../core/galactique.ts'
import {
  bornesZoom,
  etatProfondeur,
  projecteur,
  type ModeProjection,
} from '../core/projection.ts'
import {
  afficheInstant,
  majLectures,
  majVue,
  resolutionRendu,
  useScene,
  type SelectionScene,
} from './scene-etat.ts'
import { poseRenduFile, useSeance } from './seance-etat.ts'
import { incrusteDansLeCadre, rendIncrustation } from './scene-overlay.ts'
import { renduDiffere } from './rendu-differe.ts'
import type { Cadre, ProfilCadre } from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import {
  cibleSousLeCurseur,
  dessineCiel,
  type CibleEcran,
} from './dessine-ciel.ts'

/** Noms français des corps mobiles de §3.1. */
const NOMS_CORPS: Readonly<Record<string, string>> = {
  Sun: 'Soleil',
  Moon: 'Lune',
  Mercury: 'Mercure',
  Venus: 'Vénus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturne',
  Uranus: 'Uranus',
}

/** Rafraîchissement des compteurs de diagnostic : lisible sans clignoter. */
const PERIODE_DIAGNOSTIC_MS = 500
/** Plafond de rendu : 24 im/s max. Les scènes plus lourdes restent en dessous, sans forcer. */
const FPS_MAX = 30
const INTERVALLE_MIN_MS = 1000 / FPS_MAX
/** Un cran de molette. Le pincement, lui, est continu : son amplitude se lit dans `deltaY`. */
const FACTEUR_ZOOM_MOLETTE = 1.1
/** Pincement au pavé : `deltaY` en pixels vers un facteur de champ, par l'exponentielle. */
const SENSIBILITE_PINCEMENT = 0.01
/** `WheelEvent.DOM_DELTA_PIXEL` : delta en pixels, le cas du pavé et des molettes sur macOS. */
const DOM_DELTA_PIXEL = 0
/** Un cran de molette vaut ±120 en `wheelDeltaY`, hérité de Windows et repris partout. */
const CRAN_WHEEL_DELTA = 120
/** Faute de mieux, la hauteur en pixels d'un cran de molette. À retoucher si un pavé s'y trompe. */
const SEUIL_CRAN_PX = 40
const HAUTEUR_MIN_DEG = -90
const HAUTEUR_MAX_DEG = 90
const MS_PAR_S = 1000
const S_PAR_MIN = 60

/** §9 — ce que la scène doit savoir du filé pour l'incruster dans le cadre. */
export interface MaterielFile {
  readonly profondeur: EntreeProfondeur
  readonly echApx: number
  readonly sbCiel: number
  /** §5.2 — plafond de la monture quand le suivi est actif, `null` sinon. */
  readonly tMaxSuiviS: number | null
}

export interface PlanetariumProps {
  readonly site: Site
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
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
  /** Absent : la scène ne peut pas incruster le filé, faute de matériel chiffrable. */
  readonly file?: MaterielFile
  readonly surSelectionObjet: (objet: ObjetCielProfond) => void
}

function decritCible(cible: CibleEcran): SelectionScene {
  if (cible.type === 'OBJET' && cible.objet !== undefined) {
    const o = cible.objet
    return {
      titre: o.designation + (o.nomsCommuns === '' ? '' : ` — ${o.nomsCommuns.split('|')[0]}`),
      lignes: [
        `type ${o.type}`,
        o.vMag === null ? 'magnitude intégrée absente du catalogue' : `magnitude ${o.vMag}`,
        o.majAxArcmin === null ? 'dimensions absentes' : `grand axe ${o.majAxArcmin}’`,
      ],
      objet: o,
    }
  }
  if (cible.type === 'CORPS' && cible.corps !== undefined) {
    const c = cible.corps
    return {
      titre: cible.nom,
      lignes: [
        `ascension droite ${c.adH.toFixed(3)} h · déclinaison ${c.decDeg.toFixed(2)}°`,
        `azimut ${c.azimutDeg.toFixed(1)}° · hauteur ${c.hauteurDeg.toFixed(1)}°`,
        'Position interpolée entre deux échantillons d’éphémérides (§3.1).',
      ],
      objet: null,
    }
  }
  const nommee = cible.etoileNommee
  if (nommee !== undefined) {
    return {
      titre: nommee.nomPropre === '' ? nommee.designation : `${nommee.nomPropre} — ${nommee.designation}`,
      lignes: [
        `magnitude ${nommee.magV.toFixed(2)} · constellation ${nommee.constellation}`,
        nommee.spectre === '' ? 'type spectral absent du catalogue' : `type spectral ${nommee.spectre}`,
        nommee.distancePc === null
          ? 'distance non fiable : la parallaxe manque, aucune valeur n’est estimée'
          : `distance ${nommee.distancePc.toFixed(1)} pc`,
      ],
      objet: null,
    }
  }
  const etoile = cible.etoile
  return {
    titre: 'Étoile sans désignation dans le paquet chargé',
    lignes: [
      etoile === undefined
        ? ''
        : `magnitude ${etoile.magV.toFixed(2)} · indice B−V ${etoile.bv.toFixed(2)}`,
      'Le paquet des étoiles nommées ne porte que les désignations Bayer sous magnitude ' +
        `${K('MAG_LABEL_BAYER_MAX')} et les noms propres. Aucune désignation n’est inventée.`,
    ].filter((l) => l !== ''),
    objet: null,
  }
}

/**
 * Le facteur appliqué au champ pour un `wheel`. La molette avance par crans : facteur fixe. Le
 * pincement au pavé est continu — Chrome et Firefox le traduisent en `wheel` à `ctrlKey` — et son
 * amplitude est dans `deltaY` : l'exponentielle en fait un facteur multiplicatif continu, où deux
 * demi-gestes valent exactement le geste entier.
 */
export function facteurZoom(deltaY: number, pincement: boolean): number {
  if (pincement) return Math.exp(deltaY * SENSIBILITE_PINCEMENT)
  return deltaY > 0 ? FACTEUR_ZOOM_MOLETTE : 1 / FACTEUR_ZOOM_MOLETTE
}

/** Ce qu'un `wheel` doit déclencher sur la scène. */
export type SourceGeste = 'PINCEMENT' | 'MOLETTE' | 'DEFILEMENT'

/**
 * Un `wheel` sur macOS peut venir de trois gestes qui ne doivent pas faire la même chose : le
 * pincement zoome, le défilement à deux doigts promène la visée, la molette zoome. Aucun
 * navigateur ne dit lequel c'est ; il faut le déduire de trois signaux, du plus sûr au moins sûr.
 */
export function sourceMolette(e: {
  readonly ctrlKey: boolean
  readonly deltaMode: number
  readonly deltaX: number
  readonly deltaY: number
  readonly wheelDeltaY?: number
}): SourceGeste {
  // Le pincement au pavé, seul geste que le navigateur signale lui-même — par `ctrlKey`.
  if (e.ctrlKey) return 'PINCEMENT'
  // Un delta en lignes plutôt qu'en pixels : Firefox ne le fait que pour une vraie molette.
  if (e.deltaMode !== DOM_DELTA_PIXEL) return 'MOLETTE'
  // WebKit et Blink : un cran de molette vaut un multiple de 120 en `wheelDeltaY`. Le pavé, lui,
  // renvoie −3 × `deltaY`, qui tombe rarement juste.
  if (e.wheelDeltaY !== undefined && e.wheelDeltaY !== 0) {
    return e.wheelDeltaY % CRAN_WHEEL_DELTA === 0 ? 'MOLETTE' : 'DEFILEMENT'
  }
  // Faute de `wheelDeltaY` (Firefox en pixels) : un cran est gros, entier et strictement vertical.
  const cran = e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= SEUIL_CRAN_PX
  return cran ? 'MOLETTE' : 'DEFILEMENT'
}

/**
 * `wheelDeltaY` est déprécié et absent des types du DOM, mais reste le seul signal fiable pour
 * distinguer un cran de molette d'un défilement au pavé dans WebKit et Blink.
 */
interface EvenementMolette extends WheelEvent {
  readonly wheelDeltaY?: number
}

/**
 * Safari macOS émet ces événements non standard pour le pincement au pavé, en plus — ou à la
 * place — du `wheel` à `ctrlKey`. Ils sont absents des types du DOM : on les déclare ici.
 */
interface EvenementGeste extends Event {
  readonly scale: number
}

export function Planetarium(props: PlanetariumProps) {
  const canevas = useRef<HTMLCanvasElement>(null)

  // Pointage, temps et couches sont ceux de la scène, réglés depuis le panneau droit.
  const { vue: pointage, temps, rendu, msAffiche, instant, actions } = useScene()
  const { fovDeg, azimutDeg, hauteurDeg, rotationDeg, mode, largeurPx, hauteurPx } = pointage
  const { modeTemps } = temps
  const { couches, vueRealiste } = rendu
  const { file } = useSeance()

  const index = props.index
  const figures = useMemo(
    () => coucheFigures(props.constellations.figures),
    [props.constellations],
  )
  const asterismes = useMemo(
    () => coucheAsterismes(props.constellations.asterismes),
    [props.constellations],
  )
  const frontieres = useMemo(() => coucheFrontieres(props.constellations), [props.constellations])

  const profondeur = useMemo(
    () => etatProfondeur(fovDeg, index.profondeurMag, props.mLimOeil, vueRealiste),
    [fovDeg, index.profondeurMag, props.mLimOeil, vueRealiste],
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
          azimutDeg,
          hauteurDeg,
          rotationDeg,
        }

  /**
   * §9.3 — l'incrustation, peinte hors écran. Un rendu par changement de réglage : le
   * recalculer à chaque image ferait tomber le compteur d'images du ciel.
   */
  const incrustation = useRef<CanvasImageSource | null>(null)
  const indexSemis = useRef<IndexCiel | null>(null)
  const indexReel = useMemo(
    () =>
      construitIndex(props.etoiles.filter((e) => e.magV <= K('SEUIL_MAG_ETOILES_REELLES'))),
    [props.etoiles],
  )
  const materielFile = props.file

  /**
   * T-0025 — le pointage, le champ et la durée changent PENDANT un geste continu. Leur
   * signature sert à distinguer « le réglage a changé » de « le réglage est en train de
   * changer » : le premier rend tout de suite, le second attend la fin du geste.
   */
  const cleGeste = `${azimutDeg}|${hauteurDeg}|${rotationDeg}|${fovDeg}|${file.dureeTotaleMin}`
  const cleGestePrecedente = useRef(cleGeste)

  const peintIncrustation = (): void => {
    if (materielFile === undefined || cadrePrincipal === null) return
    // Le semis n'est construit qu'à la première incrustation : sans elle, il ne sert à rien.
    indexSemis.current ??= construitIndex(semisGeneratif())
    const dureeS =
      file.apercu === 'FILE' ? file.dureeTotaleMin * S_PAR_MIN : materielFile.profondeur.tPoseS
    const sortie = rendIncrustation({
      vue: pointage,
      matriceCiel: ciel.matrice,
      cadre: cadrePrincipal,
      indexReel,
      indexSemis: indexSemis.current,
      magLimite: magnitudeLimitePrevisu(materielFile.profondeur).value,
      profondeur: materielFile.profondeur,
      echApx: materielFile.echApx,
      // Un filé se fait sans suivi par construction : la bascule ne vaut que pour l'aperçu
      // de champ, où une monture qui suit rend les étoiles ponctuelles.
      suiviActif: file.apercu === 'CHAMP' && materielFile.tMaxSuiviS !== null,
      sbCiel: materielFile.sbCiel,
      dureeS,
      latitudeDeg: props.site.latitudeDeg,
      axePoleNord: axePoleDeDate(ciel.epoqueAnnee),
      voieLactee: file.voieLactee,
      modeNuit: props.modeNuit,
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

    if (!file.incrustation || materielFile === undefined || cadrePrincipal === null) {
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
    materielFile,
    indexReel,
    ciel,
    mode,
    fovDeg,
    azimutDeg,
    hauteurDeg,
    rotationDeg,
    props.site.latitudeDeg,
    props.modeNuit,
    props.profils,
  ])

  // Une passe reportée ne doit pas survivre au démontage : elle peindrait dans un canevas
  // que plus personne ne dépose.
  useEffect(() => () => planificateur.current?.annule(), [])

  /**
   * T-0040 — la définition de rendu suit la boîte, sinon l'image s'y loge en laissant des
   * bandes. C'est la taille CSS qui est observée, jamais les attributs du canevas : les
   * réécrire ne change pas la boîte, donc l'observation ne se rappelle pas elle-même.
   */
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
  }, [])

  // État mutable lu par la boucle de rendu, réécrit à chaque rendu React.
  const scene = useRef({
    props,
    index,
    figures,
    asterismes,
    frontieres,
    couches,
    magLimite: profondeur.magLimite.value,
    vue: pointage,
    modeTemps,
    facteur: reglage.facteur,
    anime: modeTemps === 'DEFILEMENT' && !props.modeNuit,
  })
  scene.current = {
    props,
    index,
    figures,
    asterismes,
    frontieres,
    couches,
    magLimite: profondeur.magLimite.value,
    vue: pointage,
    modeTemps,
    facteur: reglage.facteur,
    anime: modeTemps === 'DEFILEMENT' && !props.modeNuit,
  }

  const cibles = useRef<readonly CibleEcran[]>([])
  const ephemerides = useRef<EtatEphemerides | null>(null)

  useEffect(() => {
    const contexte = canevas.current?.getContext('2d') ?? null
    if (contexte === null) return

    let actif = true
    let dernierTs: number | null = null
    let dernierDiag = 0
    let images = 0

    const image = (ts: number): void => {
      if (!actif) return
      if (dernierTs !== null && ts - dernierTs < INTERVALLE_MIN_MS) {
        // Plafond 24 im/s : on saute ce tick, la prochaine frame réévaluera.
        requestAnimationFrame(image)
        return
      }
      const etat = scene.current
      const dt = dernierTs === null ? 0 : ts - dernierTs
      dernierTs = ts

      if (etat.modeTemps === 'MAINTENANT') {
        // Resynchronisation continue : aucune dérive ne s'accumule sur plusieurs heures.
        instant.ms = Date.now()
      } else if (etat.anime) {
        instant.ms += dt * etat.facteur
      }
      const date = new Date(instant.ms)

      const ciel = cielInstantane(etat.props.site, date)
      ephemerides.current = avanceEphemerides(
        ephemerides.current,
        etat.props.site,
        instant.ms,
        pasEphemeridesMs(etat.anime ? etat.facteur : 1),
      )
      const corps = ciel.corpsMasques
        ? []
        : positionsInterpolees(ephemerides.current, instant.ms)

      const vue = etat.vue
      const cadres = etat.couches.cadre
        ? etat.props.profils.map(
            (profil): Cadre => ({
              profil,
              azimutDeg: etat.vue.azimutDeg,
              hauteurDeg: etat.vue.hauteurDeg,
              rotationDeg: etat.vue.rotationDeg,
            }),
          )
        : []
      const proj = projecteur(vue, ciel.matrice)
      // §9.3 — le filé, déposé dans le premier cadre. Rien n'est recalculé ici : l'image
      // se glisse juste au-dessus du fond, sous les repères et les noms du planétarium.
      const cadre = cadres[0]
      const apercu = incrustation.current
      const sortie = dessineCiel({
        ctx: contexte,
        projecteur: proj,
        matriceCiel: ciel.matrice,
        index: etat.index,
        etoiles: etat.props.etoiles,
        objets: etat.props.objets,
        figures: etat.figures,
        asterismes: etat.asterismes,
        frontieres: etat.frontieres,
        etoilesNommees: etat.props.constellations.etoilesNommees,
        corps,
        nomsCorps: NOMS_CORPS,
        cadres,
        couches: etat.couches,
        magLimite: etat.magLimite,
        modeNuit: etat.props.modeNuit,
        surLeFond:
          apercu !== null && cadre !== undefined
            ? (ctx) => {
                incrusteDansLeCadre(ctx, vue, ciel.matrice, cadre, apercu)
              }
            : undefined,
      })
      cibles.current = sortie.cibles

      images++
      if (ts - dernierDiag >= PERIODE_DIAGNOSTIC_MS) {
        afficheInstant(instant.ms, {
          fps: (images * MS_PAR_S) / (ts - dernierDiag),
          etoilesExaminees: sortie.stats.etoilesExaminees,
          etoilesDessinees: sortie.etoilesDessinees,
          cellules: sortie.stats.cellulesRetenues,
          labels: sortie.labels.length,
        })
        images = 0
        dernierDiag = ts
      }
      requestAnimationFrame(image)
    }

    const id = requestAnimationFrame(image)
    return () => {
      actif = false
      cancelAnimationFrame(id)
    }
  }, [instant])

  const glisse = useRef<{ x: number; y: number } | null>(null)

  function surPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    glisse.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function surPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    const depart = glisse.current
    if (depart === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const echelle = largeurPx / rect.width
    const dx = (e.clientX - depart.x) * echelle
    const dy = (e.clientY - depart.y) * echelle
    const degresParPixel = fovDeg / largeurPx
    actions.majVue((v) => ({
      azimutDeg: (((v.azimutDeg - dx * degresParPixel) % 360) + 360) % 360,
      hauteurDeg: Math.max(
        HAUTEUR_MIN_DEG,
        Math.min(HAUTEUR_MAX_DEG, v.hauteurDeg + dy * degresParPixel),
      ),
    }))
    glisse.current = { x: e.clientX, y: e.clientY }
  }

  function surPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    const depart = glisse.current
    glisse.current = null
    if (depart === null) return
    if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const echelle = largeurPx / rect.width
    const cible = cibleSousLeCurseur(
      cibles.current,
      (e.clientX - rect.left) * echelle,
      (e.clientY - rect.top) * echelle,
    )
    const decrite = cible === null ? null : decritCible(cible)
    majLectures({ selection: decrite })
    // §3.4 — un objet du ciel profond ouvre sa fiche : le geste ne s'arrête pas sur un nom.
    if (decrite?.objet != null) props.surSelectionObjet(decrite.objet)
  }

  // Le zoom est posé à la main, hors de React : `onWheel` attache un écouteur passif, où
  // `preventDefault()` reste sans effet — le navigateur zoomerait alors toute la page par-dessus
  // le champ de la scène. Safari ajoute ses `gesture*`, qui zooment la page de leur côté.
  useEffect(() => {
    const brut = canevas.current
    if (brut === null) return
    const cible: HTMLCanvasElement = brut
    const bornes = bornesZoom(props.gaiaCharge)
    const borne = (fov: number): number =>
      Math.max(bornes.fovMinDeg, Math.min(bornes.fovMaxDeg, fov))

    function surMolette(e: WheelEvent): void {
      e.preventDefault()
      const source = sourceMolette(e as EvenementMolette)
      if (source === 'DEFILEMENT') {
        // Deux doigts sur le pavé promènent le ciel comme le ferait un glisser : le ciel suit les
        // doigts, donc le signe des deltas s'inverse. Le champ est lu dans l'état, pas capturé.
        const largeurCss = cible.getBoundingClientRect().width
        majVue((v) => {
          const degresParPixel = v.fovDeg / largeurCss
          return {
            azimutDeg: (((v.azimutDeg + e.deltaX * degresParPixel) % 360) + 360) % 360,
            hauteurDeg: Math.max(
              HAUTEUR_MIN_DEG,
              Math.min(HAUTEUR_MAX_DEG, v.hauteurDeg - e.deltaY * degresParPixel),
            ),
          }
        })
        return
      }
      majVue((v) => ({ fovDeg: borne(v.fovDeg * facteurZoom(e.deltaY, source === 'PINCEMENT')) }))
    }

    // Safari : `scale` est cumulée depuis le début du geste, on n'en garde que la variation.
    let echelleGeste = 1
    function surGesteDebut(e: Event): void {
      e.preventDefault()
      echelleGeste = 1
    }
    function surGesteChange(e: Event): void {
      e.preventDefault()
      const echelle = (e as EvenementGeste).scale
      if (!Number.isFinite(echelle) || echelle <= 0) return
      const facteur = echelleGeste / echelle
      echelleGeste = echelle
      majVue((v) => ({ fovDeg: borne(v.fovDeg * facteur) }))
    }
    function surGesteFin(e: Event): void {
      e.preventDefault()
    }

    cible.addEventListener('wheel', surMolette, { passive: false })
    cible.addEventListener('gesturestart', surGesteDebut)
    cible.addEventListener('gesturechange', surGesteChange)
    cible.addEventListener('gestureend', surGesteFin)
    return () => {
      cible.removeEventListener('wheel', surMolette)
      cible.removeEventListener('gesturestart', surGesteDebut)
      cible.removeEventListener('gesturechange', surGesteChange)
      cible.removeEventListener('gestureend', surGesteFin)
    }
  }, [props.gaiaCharge])

  return (
    <section className="scene">
      <canvas
        ref={canevas}
        className="planetarium"
        width={largeurPx}
        height={hauteurPx}
        onPointerDown={surPointerDown}
        onPointerMove={surPointerMove}
        onPointerUp={surPointerUp}
      />
    </section>
  )
}
