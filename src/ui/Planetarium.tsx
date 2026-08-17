/**
 * §3 — La scène : pipeline à deux horloges, moteur unifié, trois couches de tracés,
 * superposition du cadre matériel et incrustation du filé de §9 dans ce cadre.
 *
 * Ce n'est pas une vue décorative : c'est le point d'entrée vers les moteurs. Un clic sur un
 * objet du ciel profond ouvre l'onglet Cible garni (§6.2 / §6.3 / §7), et le cadre superposé
 * montre ce que le matériel déclaré capturerait vraiment — arcs compris.
 *
 * Depuis le lot 6, la scène ne porte plus ses réglages : ils sont dans le panneau droit, à
 * hauteur d'œil de l'image qu'ils modifient. Ne restent ici que le canevas, les gestes qui
 * s'y font, et les lectures qui datent ce qui est affiché.
 *
 * Le rendu vit dans une boucle `requestAnimationFrame` qui lit un état mutable ; React ne
 * réagit qu'aux commandes et aux diagnostics, jamais à l'image. Sans cette séparation, une
 * animation à 60 Hz déclencherait soixante rendus React par seconde. L'incrustation du filé
 * suit la même règle : elle est peinte hors écran au changement de réglage, et la boucle ne
 * fait que la redéposer.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
  avertissementEpoque,
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
  type Vue,
} from '../core/projection.ts'
import {
  HAUTEUR_SCENE_PX,
  LARGEUR_SCENE_PX,
  afficheInstant,
  useScene,
} from './scene-etat.ts'
import { poseRenduFile, useSeance } from './seance-etat.ts'
import { incrusteDansLeCadre, rendIncrustation } from './scene-overlay.ts'
import { renduDiffere } from './rendu-differe.ts'
import {
  REFUS_SANS_PROFIL,
  cibleDominante,
  refusAuDelaDuMaximum,
  rotationSuggeree,
  type Cadre,
  type ProfilCadre,
} from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import { versSpherique } from '../core/mat3.ts'
import {
  cibleSousLeCurseur,
  dessineCiel,
  type CibleEcran,
} from './dessine-ciel.ts'
import { Terme } from './Terme.tsx'

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
const FACTEUR_ZOOM_MOLETTE = 1.1
const HAUTEUR_MIN_DEG = -90
const HAUTEUR_MAX_DEG = 90
const MS_PAR_S = 1000
const ARCMIN_PAR_DEG = 60
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

interface Diagnostic {
  readonly fps: number
  readonly etoilesExaminees: number
  readonly etoilesDessinees: number
  readonly cellules: number
  readonly labels: number
}

interface Selection {
  readonly titre: string
  readonly lignes: readonly string[]
  readonly objet: ObjetCielProfond | null
}

function decritCible(cible: CibleEcran): Selection {
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

/** Le `Vue` de la scène : celui de la boucle, celui de l'incrustation. Un seul cadrage. */
function vueScene(pointage: {
  readonly mode: ModeProjection
  readonly fovDeg: number
  readonly azimutDeg: number
  readonly hauteurDeg: number
  readonly rotationDeg: number
}): Vue {
  return {
    mode: pointage.mode,
    fovDeg: pointage.fovDeg,
    largeurPx: LARGEUR_SCENE_PX,
    hauteurPx: HAUTEUR_SCENE_PX,
    azimutDeg: pointage.azimutDeg,
    hauteurDeg: pointage.hauteurDeg,
    rotationDeg: pointage.rotationDeg,
  }
}

export function Planetarium(props: PlanetariumProps) {
  const canevas = useRef<HTMLCanvasElement>(null)

  // Pointage, temps et couches sont ceux de la scène, réglés depuis le panneau droit.
  const { vue: pointage, temps, rendu, msAffiche, instant, actions } = useScene()
  const { fovDeg, azimutDeg, hauteurDeg, rotationDeg, mode } = pointage
  const { modeTemps } = temps
  const { couches, vueRealiste } = rendu
  const { file } = useSeance()

  const [diagnostic, setDiagnostic] = useState<Diagnostic>({
    fps: 0,
    etoilesExaminees: 0,
    etoilesDessinees: 0,
    cellules: 0,
    labels: 0,
  })
  const [selection, setSelection] = useState<Selection | null>(null)

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
    () => reglageVitesse(temps.facteur, LARGEUR_SCENE_PX, fovDeg),
    [temps.facteur, fovDeg],
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
  const [fileEnAttente, setFileEnAttente] = useState(false)

  const peintIncrustation = (): void => {
    if (materielFile === undefined || cadrePrincipal === null) return
    // Le semis n'est construit qu'à la première incrustation : sans elle, il ne sert à rien.
    indexSemis.current ??= construitIndex(semisGeneratif())
    const dureeS =
      file.apercu === 'FILE' ? file.dureeTotaleMin * S_PAR_MIN : materielFile.profondeur.tPoseS
    const sortie = rendIncrustation({
      vue: vueScene(pointage),
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
    setFileEnAttente(false)
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
      setFileEnAttente(false)
      return
    }
    // Premier rendu, ou changement franc : immédiat. Geste en cours : reporté, et l'écran
    // annonce le recalcul plutôt que de laisser croire que l'image est à jour.
    if (!pendantGeste || incrustation.current === null) {
      planifie.maintenant()
      return
    }
    setFileEnAttente(true)
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

      const vue = vueScene(etat.vue)
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
      })
      cibles.current = sortie.cibles

      // §9.3 — le filé, déposé dans le premier cadre. Rien n'est recalculé ici.
      const cadre = cadres[0]
      if (incrustation.current !== null && cadre !== undefined) {
        incrusteDansLeCadre(
          contexte,
          vue,
          ciel.matrice,
          cadre,
          incrustation.current,
          etat.props.modeNuit,
        )
      }

      images++
      if (ts - dernierDiag >= PERIODE_DIAGNOSTIC_MS) {
        setDiagnostic({
          fps: (images * MS_PAR_S) / (ts - dernierDiag),
          etoilesExaminees: sortie.stats.etoilesExaminees,
          etoilesDessinees: sortie.etoilesDessinees,
          cellules: sortie.stats.cellulesRetenues,
          labels: sortie.labels.length,
        })
        afficheInstant(instant.ms)
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
    const echelle = LARGEUR_SCENE_PX / rect.width
    const dx = (e.clientX - depart.x) * echelle
    const dy = (e.clientY - depart.y) * echelle
    const degresParPixel = fovDeg / LARGEUR_SCENE_PX
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
    const echelle = LARGEUR_SCENE_PX / rect.width
    const cible = cibleSousLeCurseur(
      cibles.current,
      (e.clientX - rect.left) * echelle,
      (e.clientY - rect.top) * echelle,
    )
    const decrite = cible === null ? null : decritCible(cible)
    setSelection(decrite)
    // §3.4 — un objet du ciel profond ouvre sa fiche : le geste ne s'arrête pas sur un nom.
    if (decrite?.objet != null) props.surSelectionObjet(decrite.objet)
  }

  function surMolette(e: React.WheelEvent<HTMLCanvasElement>): void {
    const facteur = e.deltaY > 0 ? FACTEUR_ZOOM_MOLETTE : 1 / FACTEUR_ZOOM_MOLETTE
    const bornes = bornesZoom(props.gaiaCharge)
    actions.majVue((v) => ({
      fovDeg: Math.max(bornes.fovMinDeg, Math.min(bornes.fovMaxDeg, v.fovDeg * facteur)),
    }))
  }

  const dominante = useMemo(
    () => (cadrePrincipal === null ? null : cibleDominante(props.objets, cadrePrincipal, ciel.matrice)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.objets, ciel, azimutDeg, hauteurDeg, rotationDeg, props.profils],
  )
  const suggestion = useMemo(
    () =>
      dominante === null || cadrePrincipal === null
        ? null
        : rotationSuggeree(dominante, cadrePrincipal, ciel.matrice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dominante, ciel, azimutDeg, hauteurDeg, rotationDeg],
  )
  const viseeJ2000 = useMemo(
    () =>
      versSpherique(
        projecteur(vueScene(pointage), ciel.matrice).inverse(
          LARGEUR_SCENE_PX / 2,
          HAUTEUR_SCENE_PX / 2,
        ),
      ),
    [pointage, ciel],
  )

  const tropDeProfils = refusAuDelaDuMaximum(props.profils.length)
  const avertissement = avertissementEpoque(ciel.epoqueAnnee)

  return (
    <section className="scene">
      <canvas
        ref={canevas}
        className="planetarium"
        width={LARGEUR_SCENE_PX}
        height={HAUTEUR_SCENE_PX}
        onPointerDown={surPointerDown}
        onPointerMove={surPointerMove}
        onPointerUp={surPointerUp}
        onWheel={surMolette}
      />

      <div className="scene-lectures">
        <p className="etat">
          {dateAffichee.toLocaleString('fr-FR')} · visée {viseeJ2000.longitudeDeg.toFixed(2)}° AD /{' '}
          {viseeJ2000.latitudeDeg.toFixed(2)}° δ · azimut {azimutDeg.toFixed(0)}°, hauteur{' '}
          {hauteurDeg.toFixed(0)}° · champ {fovDeg.toFixed(1)}° · jusqu’à la magnitude{' '}
          {profondeur.magLimite.value.toFixed(1)} · époque {ciel.epoqueAnnee.toFixed(1)}
          {file.incrustation && couches.cadre && ' · filé incrusté dans le cadre, temps figé'}
          {fileEnAttente && ' · filé en cours de recalcul, le cadre montre l’image précédente'}
        </p>
        {ciel.cause !== undefined && <p className="cause">{ciel.cause}</p>}
        {avertissement !== null && <p className="cause">{avertissement}</p>}
        {file.incrustation && !couches.cadre && (
          <p className="cause">
            Incrustation demandée alors que la couche « Cadre matériel » est éteinte : sans
            cadre, il n’y a pas de surface où déposer le filé. La rallumer dans l’onglet
            Explorer.
          </p>
        )}

        {couches.cadre && (
          <>
            {props.profils.length === 0 && <p className="cause">{REFUS_SANS_PROFIL}</p>}
            {tropDeProfils !== null && <p className="cause">{tropDeProfils}</p>}
            {props.profils.length > 1 && (
              <p className="etat">
                L’échantillonnage est identique dans les deux cadres : un recadrage de capteur
                ne change ni le pitch ni la focale, donc ni la résolution (§5.1).
              </p>
            )}
            {dominante !== null && (
              <p className="etat">
                Cible dominante dans le cadre : {dominante.objet.designation}, grand axe{' '}
                {(dominante.tailleDeg * ARCMIN_PAR_DEG).toFixed(0)}’ — remplissage{' '}
                {((dominante.tailleDeg / (props.profils[0]?.fovHDeg ?? 1)) * 100).toFixed(0)} % de
                la petite dimension du champ.
              </p>
            )}
            {suggestion !== null && (
              <div className="actions">
                <span className="etat">{suggestion.message}</span>
                <button
                  type="button"
                  onClick={() => actions.majVue({ rotationDeg: suggestion.angleDeg })}
                >
                  Appliquer {suggestion.angleDeg.toFixed(0)}°
                </button>
              </div>
            )}
          </>
        )}

        {selection !== null && (
          <div className="selection">
            <h3>{selection.titre}</h3>
            {selection.lignes.map((ligne) => (
              <p className="etat" key={ligne}>
                {ligne}
              </p>
            ))}
            {selection.objet !== null && (
              <p className="etat">
                Fiche de cadrage, de détectabilité et de pose ouverte dans l’onglet Cible.
              </p>
            )}
          </div>
        )}

        <Terme cle="deux_horloges" contexte={`${diagnostic.fps.toFixed(0)} images/s`} />
        <p className="etat">
          {diagnostic.etoilesDessinees} étoiles tracées sur {diagnostic.etoilesExaminees} lues,{' '}
          {diagnostic.cellules} cellules d’index retenues sur {index.cellules.length},{' '}
          {index.nombreEtoiles} étoiles au catalogue, {diagnostic.labels} labels composés sur{' '}
          {K('LABELS_MAX')} au plus.
        </p>
      </div>
    </section>
  )
}
