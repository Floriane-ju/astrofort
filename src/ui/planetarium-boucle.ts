/**
 * §3 — La boucle de rendu du ciel, en marge de React.
 *
 * Le rendu vit dans un `requestAnimationFrame` qui lit un état mutable ; React ne réagit
 * qu'aux commandes et aux diagnostics, jamais à l'image. Sans cette séparation, une
 * animation à 60 Hz déclencherait soixante rendus React par seconde.
 */

import { useEffect, useRef, type RefObject } from 'react'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { PaquetConstellations } from '../data/constellations.ts'
import type { CoucheFrontieres, CoucheTraces } from '../core/constellations.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import {
  avanceEphemerides,
  axePoleDeDate,
  cielInstantane,
  pasEphemeridesMs,
  positionsInterpolees,
  type EtatEphemerides,
} from '../core/horloges.ts'
import { projecteur } from '../core/projection.ts'
import type { Cadre, ProfilCadre } from '../core/cadre.ts'
import type { MasqueHorizon } from '../core/site.ts'
import type { Site } from '../core/ephem.ts'
import { afficheInstant, vuePlanetarium, type VueScene } from './scene-etat.ts'
import { poseRenduFile, publicateurRenduFile } from './seance-etat.ts'
import type { CouchesActives } from './dessine-ciel.ts'
import { dessineChamp, type ParametresFile, type SortieDessinChamp } from './dessine-champ.ts'
import { dessineCiel, type CibleEcran, type SurvolEcran } from './dessine-ciel.ts'
import type { LuneEcran } from './dessine-fond-ciel.ts'

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
const MS_PAR_S = 1000

/** Tout ce que la boucle lit à chaque image, réécrit à chaque rendu React. */
export interface EtatBoucle {
  readonly site: Site
  readonly etoiles: readonly Etoile[]
  readonly objets: readonly ObjetCielProfond[]
  readonly constellations: PaquetConstellations
  readonly profils: readonly ProfilCadre[]
  readonly modeNuit: boolean
  readonly index: IndexCiel
  readonly figures: readonly CoucheTraces[]
  readonly asterismes: readonly CoucheTraces[]
  readonly frontieres: CoucheFrontieres
  readonly couches: CouchesActives
  /** §4.1 — relief du site : la couche Sol y prend la hauteur du sol, azimut par azimut. */
  readonly masque: MasqueHorizon
  readonly magLimite: number
  /** §3.7 — fond de ciel du site : il module le contraste de la bande de la Voie lactée. */
  readonly sbCiel: number
  /** §3.3 — vue réaliste : le fond du ciel prend la luminance du site (T-0097). */
  readonly vueRealiste: boolean
  /** T-0100 — la Lune de l'instant affiché. Absente : aucun halo lunaire n'est peint. */
  readonly lune: LuneEcran | null
  readonly vue: VueScene
  readonly modeTemps: string
  readonly facteur: number
  readonly anime: boolean
}

/**
 * Démarre la boucle et rend la liste des cibles à l'écran, réécrite à chaque image : c'est
 * elle que le clic interroge pour savoir ce qui se trouve sous le curseur.
 */
export function useBoucleRendu(entree: {
  readonly canevas: RefObject<HTMLCanvasElement | null>
  readonly etat: RefObject<EtatBoucle>
  readonly instant: { ms: number }
  /** §9.3 — les paramètres de la passe de filé, ou `null` quand elle est éteinte. */
  readonly parametresFile: RefObject<ParametresFile | null>
  /** T-0085 — l'élément désigné par le curseur, relu par image plutôt qu'à chaque rendu React. */
  readonly survol: RefObject<SurvolEcran | null>
}): RefObject<readonly CibleEcran[]> {
  const { canevas, etat, instant, parametresFile, survol } = entree
  const cibles = useRef<readonly CibleEcran[]>([])
  const ephemerides = useRef<EtatEphemerides | null>(null)

  useEffect(() => {
    const contexte = canevas.current?.getContext('2d') ?? null
    if (contexte === null) return

    let actif = true
    let dernierTs: number | null = null
    let dernierDiag = 0
    let images = 0
    // T-0116 — les compteurs du filé se publient au rythme du diagnostic, jamais par image :
    // `poseRenduFile` passe par le magasin de séance, donc par un rendu React.
    const publieFile = publicateurRenduFile(poseRenduFile)
    // Boîte réécrite par image plutôt qu'une variable locale : la passe de filé écrit depuis
    // une fermeture, et le flux de contrôle ne la suit pas jusque-là.
    const derniereFile: { sortie: SortieDessinChamp | null } = { sortie: null }
    // T-0065 — une seule `Date`, réécrite par image. `cielInstantane` la lit sans la
    // garder : rien ne survit à l'appel, donc rien ne justifie d'en allouer une neuve.
    const instantDate = new Date(0)

    const image = (ts: number): void => {
      if (!actif) return
      if (dernierTs !== null && ts - dernierTs < INTERVALLE_MIN_MS) {
        // Plafond 24 im/s : on saute ce tick, la prochaine frame réévaluera.
        requestAnimationFrame(image)
        return
      }
      const courant = etat.current
      const dt = dernierTs === null ? 0 : ts - dernierTs
      dernierTs = ts

      if (courant.modeTemps === 'MAINTENANT') {
        // Resynchronisation continue : aucune dérive ne s'accumule sur plusieurs heures.
        instant.ms = Date.now()
      } else if (courant.anime) {
        instant.ms += dt * courant.facteur
      }

      instantDate.setTime(instant.ms)
      const ciel = cielInstantane(courant.site, instantDate)
      ephemerides.current = avanceEphemerides(
        ephemerides.current,
        courant.site,
        instant.ms,
        pasEphemeridesMs(courant.anime ? courant.facteur : 1),
      )
      const corps = ciel.corpsMasques
        ? []
        : positionsInterpolees(ephemerides.current, instant.ms)

      const vue = courant.vue
      // §3.5 — le boîtier tourne, la vue non : c'est ce qui rend le contour du cadre mobile
      // à l'écran au lieu de faire tourner tout le ciel derrière un cadre immobile (T-0084).
      const vueSansRoulis = vuePlanetarium(vue)
      const cadres = courant.couches.cadre
        ? courant.profils.map(
            (profil): Cadre => ({
              profil,
              azimutDeg: vue.azimutDeg,
              hauteurDeg: vue.hauteurDeg,
              rotationDeg: vue.rotationCadreDeg,
            }),
          )
        : []
      // §9.3 / T-0116 — le filé couvre tout le planétarium, pas le seul cadre : il se calcule
      // ici, avec la vue de CETTE image, et se peint sous les repères et les noms. Le contour
      // du cadre reste tracé par-dessus, en fin de passe : c'est lui, et lui seul, qui dit ce
      // que le capteur enregistrerait quand tout le ciel file.
      const params = parametresFile.current
      // Ce qui reste alloué par image — le projecteur et sa fermeture, le littéral d'entrée
      // de `dessineCiel`, la fermeture `passeFile`, les cadres — dépend de la vue de cette
      // image et ne se hisse donc pas. C'est une poignée d'objets, contre les milliers que
      // la boucle par étoile n'alloue plus (T-0065).
      const sortie = dessineCiel({
        ctx: contexte,
        projecteur: projecteur(vueSansRoulis, ciel.matrice),
        matriceCiel: ciel.matrice,
        index: courant.index,
        etoiles: courant.etoiles,
        objets: courant.objets,
        figures: courant.figures,
        asterismes: courant.asterismes,
        frontieres: courant.frontieres,
        etoilesNommees: courant.constellations.etoilesNommees,
        corps,
        nomsCorps: NOMS_CORPS,
        cadres,
        couches: courant.couches,
        magLimite: courant.magLimite,
        sbCiel: courant.sbCiel,
        vueRealiste: courant.vueRealiste,
        // §3.1 — corps masqués : la Lune n'est ni dessinée ni comptée, donc pas de halo.
        ...(courant.lune === null || ciel.corpsMasques ? {} : { lune: courant.lune }),
        latitudeDeg: courant.site.latitudeDeg,
        masque: courant.masque,
        modeNuit: courant.modeNuit,
        survol: survol.current ?? undefined,
        passeFile:
          params === null
            ? undefined
            : (ctx, proj) => {
                derniereFile.sortie = dessineChamp({
                  ...params,
                  ctx,
                  // Le projecteur de la scène, filtré du sol : les arcs tombent sur les
                  // mêmes étoiles que le ciel qui les entoure, et rien ne se peint sous
                  // l'horizon (§4.1).
                  projecteur: proj,
                  axePoleNord: axePoleDeDate(ciel.epoqueAnnee),
                  latitudeDeg: courant.site.latitudeDeg,
                  sbCiel: courant.sbCiel,
                  vueRealiste: courant.vueRealiste,
                  modeNuit: courant.modeNuit,
                })
              },
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
        // `params` fait foi sur l'extinction : la boîte, elle, garde la dernière passe.
        const rendu = params === null ? null : derniereFile.sortie
        publieFile(
          rendu === null
            ? null
            : {
                reelles: rendu.etoilesReelles,
                generees: rendu.etoilesGenerees,
                tronques: rendu.arcsTronques,
              },
        )
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
  }, [canevas, etat, instant, parametresFile, survol])

  return cibles
}
