/**
 * §9.2 et §9.3 — passe de rendu de la prévisualisation de champ et du filé.
 *
 * TROIS COUCHES, un seul moteur de projection : celui de §3.3. La couche 1 vient du catalogue
 * réel, la couche 2 du semis génératif, la couche 3 du masque procédural de la Voie lactée en
 * coordonnées galactiques.
 *
 * Une seule primitive dessine les étoiles, ponctuelles ou filées : l'arc de §9.3, balayé
 * pendant la durée d'accumulation demandée. Une pose unitaire trop longue produit donc
 * naturellement une étoile ovalisée — c'est le même code que le filé de quatre heures, à la
 * durée près.
 *
 * ponytail: rendu statique, une image par changement de réglage. Les étoiles sont tracées une
 * par une, sans regroupement par teinte comme au planétarium : l'économie de changements
 * d'état ne vaut que dans une boucle à 60 Hz. Si cette vue s'anime un jour, regrouper ici.
 */

import { K } from '../registry/constants.ts'
import {
  arcEtoile,
  filtreArcCadre,
  poseParPixelS,
  positionPole,
  type PositionPole,
} from '../core/file-etoiles.ts'
import {
  depuisGalactique,
  magnitudeLimitePrevisu,
  opaciteEtoile,
  vignettageDiaph,
  type EntreeProfondeur,
} from '../core/galactique.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import { selectionne } from '../core/index-ciel.ts'
import type { EtendueCadre } from '../core/cadre.ts'
import { rayonEtoilePx, type PointEcran, type Projecteur } from '../core/projection.ts'
import { separationDeg, type Vec3 } from '../core/mat3.ts'
import { bandeRealiste, couleurTeinte, fondRealiste, paletteScene, teinte } from './couleurs.ts'
import { brillanceVoieLacteeNl } from '../core/fond-ciel-rendu.ts'
import { nanolamberts } from '../core/moon.ts'

const S_PAR_MIN = 60
const MIN_PAR_H = 60
/** Sous ce rayon, l'antialiasing efface le disque : la plus faible étoile reste un point. */
const RAYON_MIN_ETOILE_PX = 0.7
/** Pas du maillage de la bande galactique, en degrés. */
const PAS_BANDE_L_DEG = 6
const PAS_BANDE_B_DEG = 2
/** Du plan galactique au pôle : seule borne de l'échantillonnage en latitude. */
const QUART_TOUR_DEG = 90
const TOUR_RAD = 2 * Math.PI
const MARQUEUR_POLE_PX = 14
/**
 * Sous cette opacité, l'étoile est trop loin sous le seuil d'enregistrement pour laisser une
 * trace : elle n'est pas tracée du tout. Sans ce plancher, des milliers de traces
 * sous-liminaires s'additionnent et blanchissent une image qui, en vrai, resterait noire.
 */
const OPACITE_MIN = 0.2
const DEMI_TOUR = 180
/** Flou appliqué au masque de la Voie lactée, en pixels de rendu. */
const FLOU_BANDE_PX = 32

export interface EntreeDessinChamp {
  readonly ctx: CanvasRenderingContext2D
  readonly projecteur: Projecteur
  /** Catalogue réel : couche 1, positions exactes jusqu'au seuil catalographié. */
  readonly indexReel: IndexCiel
  /** Semis génératif : couche 2, au-delà du seuil. */
  readonly indexSemis: IndexCiel
  /** Profondeur atteinte par la pose unitaire (§9.2) : borne de sélection du catalogue. */
  readonly magLimite: number
  /** Entrées de profondeur, réévaluées par étoile avec sa pose par pixel réelle (§9.3). */
  readonly profondeur: EntreeProfondeur
  /** Échantillonnage du capteur, en secondes d'arc par pixel : il fixe la pose par pixel. */
  readonly echApx: number
  /** Suivi actif (§5.2) : les étoiles restent ponctuelles et le pixel reçoit toute la pose. */
  readonly suiviActif: boolean
  readonly sbCiel: number
  /**
   * T-0097 — vue réaliste : le fond de l'aperçu prend la même teinte que le planétarium.
   * Deux fonds différents dans une même image se verraient comme un rectangle.
   */
  readonly vueRealiste: boolean
  /**
   * Fond de ciel EFFECTIF de la direction du cadre — halo d'horizon et Lune compris. Absent :
   * le fond du site sert de repli. Il ne pilote que la teinte du fond, jamais la profondeur ni
   * le contraste de la bande, qui restent ceux du site.
   */
  readonly sbFond?: number | undefined
  /** Durée d'accumulation dessinée : pose unitaire en prévisualisation, durée totale en filé. */
  readonly dureeS: number
  readonly latitudeDeg: number
  /** Direction J2000 du pôle céleste nord de l'époque : centre exact des arcs (§9.3). */
  readonly axePoleNord: Vec3
  readonly voieLactee: boolean
  readonly vignettage: boolean
  readonly modeNuit: boolean
  /**
   * T-0023 — étendue du cadre dans lequel l'image sera clippée. Absente : la passe couvre
   * tout le champ de la scène, comme une prévisualisation en canevas propre.
   */
  readonly cadreSelection?: EtendueCadre
}

export interface SortieDessinChamp {
  readonly etoilesReelles: number
  readonly etoilesGenerees: number
  readonly arcsTronques: number
  /**
   * Étoiles lues par la sélection, tracées ou non. C'est ce compteur, et pas le nombre
   * d'étoiles dessinées, qui dit ce que la passe a coûté : sans lui, un gain de sélection se
   * raconte au lieu de se chiffrer (T-0021).
   */
  readonly etoilesVisitees: number
  readonly pole: PositionPole
}

/**
 * T-0105 — longitude galactique du plan la plus proche du centre de visée.
 *
 * C'est elle qui porte la brillance de toute la bande dans cet aperçu. Elle se cherche sur le
 * plan `b = 0`, au même pas que le tracé : la direction visée n'est pas disponible en
 * coordonnées galactiques, mais le point du plan le plus proche du centre de l'écran l'est, et
 * c'est la même information.
 *
 * Aucun point projeté — le plan galactique est hors du champ : la bande visible est alors loin
 * du plan, donc quasi éteinte. On rend l'anticentre, la moitié la moins brillante : une
 * approximation ne doit pas inventer de lumière.
 */
function longitudeGalactiqueVisee(projecteur: Projecteur): number {
  const ANTICENTRE_DEG = 180
  let meilleure = ANTICENTRE_DEG
  let plusProche = Infinity
  for (let l = 0; l < 360; l += PAS_BANDE_L_DEG) {
    const point = projecteur.projette(depuisGalactique(l, 0))
    if (point === null || point.thetaDeg >= plusProche) continue
    plusProche = point.thetaDeg
    meilleure = l
  }
  return meilleure
}

/**
 * Couche 3 — la Voie lactée, en coordonnées galactiques (T-0104).
 *
 * Même moteur que le planétarium : la bande est un CONTRIBUTEUR DE BRILLANCE, et chaque tranche
 * se compose en part de la brillance totale avec la couleur de cette totale. Deux rendus du même
 * objet avec deux paramétrages différents finissaient par se contredire à l'écran — l'aperçu
 * incrusté se superpose au planétarium (§9.5), et deux bandes de teintes différentes au même
 * endroit se liraient comme un défaut de rendu.
 *
 * Ce qui reste propre à cet aperçu : les polygones remplis, et le flou. Le champ est étroit, une
 * bande n'en sort pas par un côté pour y rentrer par un autre — le problème qui impose le trait
 * au planétarium ne se pose pas ici. Le flou, lui, reste nécessaire : le pas de latitude est
 * grossier devant la taille de l'aperçu, et l'escalier s'y verrait.
 *
 * T-0105 — la brillance dépend maintenant de la longitude, et l'aperçu l'évalue en UNE longitude
 * par image, celle de la visée. Le planétarium, lui, découpe ses tranches en longitude : il
 * montre jusqu'à un demi-ciel, où le contraste bulbe/anticentre est justement ce qu'on regarde.
 * Ici le champ est celui d'un objectif, la modulation vaut au plus 0,0044 mag par degré, et
 * découper ces polygones en longitude rouvrirait la couture que ce rendu évite depuis T-0104 :
 * le flou s'applique par ordre de peinture, donc deux polygones voisins se fondraient chacun de
 * son côté et laisseraient une raie claire sur leur arête commune.
 *
 * ponytail: un objectif très grand angle couvre assez de longitude pour que l'écart aux bords
 * atteigne quelques dixièmes de magnitude. Le jour où l'aperçu doit le rendre, c'est le découpage
 * en longitude du planétarium à porter ici, avec une passe de flou unique hors écran.
 */
function dessineVoieLactee(entree: EntreeDessinChamp): void {
  const { ctx, projecteur } = entree
  const brillanceCiel = nanolamberts(entree.sbCiel)
  // Couleur du fond seul : la tranche qui la reproduit n'ajoute rien de visible, à un 255e
  // près. C'est la borne de peinture, et elle se déduit — elle ne se règle pas.
  const fondSeul = fondRealiste(entree.sbCiel)
  const lVisee = longitudeGalactiqueVisee(projecteur)
  ctx.filter = `blur(${FLOU_BANDE_PX}px)`

  for (let b = -QUART_TOUR_DEG; b < QUART_TOUR_DEG; b += PAS_BANDE_B_DEG) {
    const milieu = b + PAS_BANDE_B_DEG / 2
    const rendu = bandeRealiste(
      brillanceCiel,
      brillanceVoieLacteeNl(lVisee, milieu),
      entree.modeNuit,
    )
    if (rendu.couleur === fondSeul) continue
    const rvb = rendu.couleur.slice(rendu.couleur.indexOf('(') + 1, rendu.couleur.indexOf(')'))
    ctx.fillStyle = `rgb(${rvb} / ${rendu.part})`
    // Une bande de latitude se remplit d'un seul tenant, jamais en carreaux juxtaposés :
    // deux surfaces translucides voisines laissent une couture claire sur leur arête
    // commune, et la bande se lirait alors comme une grille.
    let basse: PointEcran[] = []
    let haute: PointEcran[] = []
    const remplit = (): void => {
      if (basse.length < 2) return
      ctx.beginPath()
      basse.forEach((p, i) => (i === 0 ? ctx.moveTo(p.xPx, p.yPx) : ctx.lineTo(p.xPx, p.yPx)))
      for (let i = haute.length - 1; i >= 0; i--) ctx.lineTo(haute[i]!.xPx, haute[i]!.yPx)
      ctx.closePath()
      ctx.fill()
    }
    for (let l = 0; l <= 360; l += PAS_BANDE_L_DEG) {
      const bas = projecteur.projette(depuisGalactique(l, b))
      const haut = projecteur.projette(depuisGalactique(l, b + PAS_BANDE_B_DEG))
      if (bas === null || haut === null) {
        remplit()
        basse = []
        haute = []
        continue
      }
      basse.push(bas)
      haute.push(haut)
    }
    remplit()
  }
  ctx.filter = 'none'
}

interface Compteur {
  dessinees: number
  tronques: number
  /** Étoiles lues par `selectionne`, avant tout tri : le coût de la passe se lit ici. */
  visitees: number
}

/** Une étoile : un arc balayé pendant la durée d'accumulation, ponctuel quand elle est brève. */
function dessineCouche(
  entree: EntreeDessinChamp,
  index: IndexCiel,
  magMin: number,
  magMax: number,
  compteur: Compteur,
): void {
  const { ctx, projecteur } = entree
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const centreJ2000 = projecteur.inverse(largeur / 2, hauteur / 2)
  const rayonSceneDeg = Math.min(
    K('FOV_MAX_DEG') / 2,
    (projecteur.vue.fovDeg / 2) * Math.hypot(1, hauteur / largeur),
  )
  // Avec suivi, l'étoile ne se déplace pas sur le capteur : ni trace, ni étalement du flux.
  const dureeMin = entree.suiviActif ? 0 : entree.dureeS / S_PAR_MIN

  // T-0023 — incrustée, l'image est clippée sur le cadre : sélectionner sur le champ de la
  // scène revient à calculer, trier et tracer tout ce qui sera jeté. Le disque est ramené
  // autour du cadre, MAJORÉ DU BALAYAGE de la durée demandée — sans cette marge, une étoile
  // hors cadre dont la trace y entre disparaîtrait et les bords se videraient en filé long.
  // Il n'est jamais élargi au-delà du champ de la scène : ce qui n'était pas dessiné avant
  // ne doit pas apparaître, l'image du cadre reste celle d'avant.
  const cadre = entree.cadreSelection
  const balayageDeg = K('ROTATION_CIEL_DEG_H') * (dureeMin / MIN_PAR_H)
  // Le disque ne suffit pas : élargi du balayage, il couvre un tiers du ciel à 480 min. Le
  // tri fin se fait étoile par étoile, sur le cercle de déclinaison, avant tout arc.
  const toucheLeCadre =
    cadre === undefined
      ? null
      : filtreArcCadre(cadre.centre, cadre.rayonDeg, entree.axePoleNord, balayageDeg)
  const rayonChampDeg =
    cadre === undefined
      ? rayonSceneDeg
      : Math.min(
          rayonSceneDeg,
          separationDeg(centreJ2000, cadre.centre) + cadre.rayonDeg + balayageDeg,
        )

  const stats = selectionne(index, centreJ2000, rayonChampDeg, magMax, (x, y, z, magV, bv) => {
    if (magV < magMin) return
    // Le tri géométrique passe en premier : quelques produits scalaires écartent l'étoile
    // avant même le calcul de profondeur, qui alloue une valeur tracée par appel.
    if (toucheLeCadre !== null && !toucheLeCadre(x, y, z)) return
    const rayon = Math.max(RAYON_MIN_ETOILE_PX, rayonEtoilePx(magV))

    // La brillance d'une trace se juge sur la pose vue PAR PIXEL, pas sur la durée totale :
    // c'est pour cela qu'un filé de deux heures ne montre que les étoiles brillantes, là où
    // la même durée en poses fixes empilées en montrerait des milliers.
    //
    // Ce tri passe AVANT l'arc (T-0022) : il ne dépend que de la déclinaison, lue dans `z`,
    // et l'arc est le calcul le plus cher de la passe. Une étoile écartée ici ne doit pas
    // l'avoir payé.
    const profondeurTrace = magnitudeLimitePrevisu({
      ...entree.profondeur,
      tPoseS: entree.suiviActif
        ? entree.dureeS
        : poseParPixelS(
            entree.dureeS,
            entree.echApx,
            (Math.asin(Math.max(-1, Math.min(1, z))) * DEMI_TOUR) / Math.PI,
          ),
    }).value
    const opacite = opaciteEtoile(magV, profondeurTrace)
    if (opacite < OPACITE_MIN) return

    const arc = arcEtoile(projecteur, { x, y, z }, dureeMin, entree.axePoleNord)
    if (arc.segments.length === 0) return
    const couleur = couleurTeinte(teinte(bv), entree.modeNuit)
    ctx.globalAlpha = opacite

    if (arc.longueurPx <= rayon) {
      // Trace plus courte que l'étoile elle-même : elle reste un disque.
      const point = arc.segments[0]![0]!
      ctx.fillStyle = couleur
      ctx.beginPath()
      ctx.arc(point.xPx, point.yPx, rayon, 0, TOUR_RAD)
      ctx.fill()
    } else {
      ctx.strokeStyle = couleur
      ctx.lineWidth = rayon * 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const segment of arc.segments) {
        segment.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.xPx, p.yPx)
          else ctx.lineTo(p.xPx, p.yPx)
        })
      }
      ctx.stroke()
    }
    compteur.dessinees++
    if (arc.tronque) compteur.tronques++
  })
  compteur.visitees += stats.etoilesExaminees
  ctx.globalAlpha = 1
  // Rendus à leurs valeurs par défaut, comme la passe du ciel le fait de la bande : le
  // marqueur du pôle est tracé après, et un bout de trait laissé arrondi lui arrondissait
  // aussi les branches.
  ctx.lineWidth = 1
  ctx.lineCap = 'butt'
}

/** Vignettage — assombrissement des coins, chiffré en diaphragmes par §9.2. */
function dessineVignettage(entree: EntreeDessinChamp): void {
  const { ctx, projecteur } = entree
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx
  const rayon = Math.hypot(largeur, hauteur) / 2
  const attenuation = vignettageDiaph(1).value
  const opacite = 1 - 2 ** -attenuation
  const degrade = ctx.createRadialGradient(largeur / 2, hauteur / 2, 0, largeur / 2, hauteur / 2, rayon)
  degrade.addColorStop(0, 'rgb(0 0 0 / 0)')
  degrade.addColorStop(1, `rgb(0 0 0 / ${opacite})`)
  ctx.fillStyle = degrade
  ctx.fillRect(0, 0, largeur, hauteur)
}

export function dessineChamp(entree: EntreeDessinChamp): SortieDessinChamp {
  const { ctx, projecteur } = entree
  const teintes = paletteScene(
    entree.modeNuit,
    entree.vueRealiste,
    entree.sbFond ?? entree.sbCiel,
  )
  const largeur = projecteur.vue.largeurPx
  const hauteur = projecteur.vue.hauteurPx

  ctx.fillStyle = teintes.fond
  ctx.fillRect(0, 0, largeur, hauteur)

  if (entree.voieLactee) dessineVoieLactee(entree)

  const seuilReel = K('SEUIL_MAG_ETOILES_REELLES')
  const reelles: Compteur = { dessinees: 0, tronques: 0, visitees: 0 }
  const generees: Compteur = { dessinees: 0, tronques: 0, visitees: 0 }
  dessineCouche(entree, entree.indexReel, -Infinity, Math.min(entree.magLimite, seuilReel), reelles)
  if (entree.magLimite > seuilReel) {
    dessineCouche(entree, entree.indexSemis, seuilReel, entree.magLimite, generees)
  }

  if (entree.vignettage) dessineVignettage(entree)

  // Centre de rotation : marqué s'il tombe dans le cadre, jamais ramené dedans s'il n'y est pas.
  const pole = positionPole(projecteur, entree.latitudeDeg, entree.axePoleNord)
  if (pole.dansCadre && pole.xPx !== null && pole.yPx !== null) {
    ctx.strokeStyle = teintes.cadre
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pole.xPx - MARQUEUR_POLE_PX, pole.yPx)
    ctx.lineTo(pole.xPx + MARQUEUR_POLE_PX, pole.yPx)
    ctx.moveTo(pole.xPx, pole.yPx - MARQUEUR_POLE_PX)
    ctx.lineTo(pole.xPx, pole.yPx + MARQUEUR_POLE_PX)
    ctx.stroke()
  }

  return {
    etoilesReelles: reelles.dessinees,
    etoilesGenerees: generees.dessinees,
    arcsTronques: reelles.tronques + generees.tronques,
    etoilesVisitees: reelles.visitees + generees.visitees,
    pole,
  }
}
