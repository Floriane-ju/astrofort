/**
 * §3.3 — Moteur de rendu unifié.
 *
 * UN MOTEUR, TROIS MODES. Le planétarium (§3), la prévisualisation de champ (§9.2) et le
 * filé (§9.3) passent tous par `projecteur()`. Le mode ne change qu'une chose : la fonction
 * radiale R(θ). Si ces trois modes divergeaient en deux bases de code, le cadre affiché
 * dans le planétarium ne correspondrait pas à la prévisualisation — défaut invisible en
 * développement, fatal sur le terrain.
 *
 *   MODE_PLANETARIUM  stéréographique   R = 2·tan(θ/2)   conforme, champ 1° à 180°
 *   MODE_CADRE        gnomonique        R = tan(θ)       projection d'un objectif rectilinéaire
 *   MODE_FISHEYE      équidistante      R = θ            objectifs fisheye (§5.1)
 *
 * Les deux premiers modes s'écrivent sans une seule fonction transcendante : à partir du
 * vecteur unitaire (X, Y, Z) exprimé dans le repère de la vue, R/sin(θ) vaut 1/Z en
 * gnomonique et 2/(1 + Z) en stéréographique. C'est ce qui rend le coût par étoile constant.
 */

import { K } from '../registry/constants.ts'
import { mLimOeilBorne } from '../registry/bortle.ts'
import { DEG, multiplie, transpose, type Mat3, type Vec3 } from './mat3.ts'
import { trace, type Traced } from './traced.ts'

export type ModeProjection = 'MODE_PLANETARIUM' | 'MODE_CADRE' | 'MODE_FISHEYE'

export interface Vue {
  readonly mode: ModeProjection
  /** Champ horizontal, en degrés. */
  readonly fovDeg: number
  readonly largeurPx: number
  readonly hauteurPx: number
  /** Centre de visée, en coordonnées horizontales du site. */
  readonly azimutDeg: number
  readonly hauteurDeg: number
  /** Roulis de la vue, en degrés. */
  readonly rotationDeg: number
}

export interface PointEcran {
  readonly xPx: number
  readonly yPx: number
  /** Distance angulaire au centre de visée, en degrés. */
  readonly thetaDeg: number
}

/**
 * T-0065 — le même point, écrit en place. Une passe de rendu en réutilise un seul pour
 * toute une image : sans lui, `projette` alloue un objet par étoile et par polyligne, et le
 * ramasse-miettes rend l'addition sous forme de saccades pendant un panoramique — invisible
 * sur une moyenne d'images par seconde, visible à l'œil.
 */
export interface PointEcranMut {
  xPx: number
  yPx: number
  thetaDeg: number
}

/** Point de travail d'une passe de rendu, à hisser hors de la boucle qui le remplit. */
export function pointEcran(): PointEcranMut {
  return { xPx: 0, yPx: 0, thetaDeg: 0 }
}

/**
 * Repère de la vue : x vers la droite de l'écran, y vers le haut, z vers le centre de visée.
 * Aucune singularité au zénith — l'azimut y tient lieu de roulis, ce qu'il est réellement.
 */
export function matriceVue(azimutDeg: number, hauteurDeg: number, rotationDeg: number): Mat3 {
  const a = azimutDeg * DEG
  const h = hauteurDeg * DEG
  const r = rotationDeg * DEG
  const cosR = Math.cos(r)
  const sinR = Math.sin(r)

  const droite: Vec3 = { x: -Math.sin(a), y: Math.cos(a), z: 0 }
  const haut: Vec3 = {
    x: -Math.sin(h) * Math.cos(a),
    y: -Math.sin(h) * Math.sin(a),
    z: Math.cos(h),
  }
  const centre: Vec3 = {
    x: Math.cos(h) * Math.cos(a),
    y: Math.cos(h) * Math.sin(a),
    z: Math.sin(h),
  }
  return [
    droite.x * cosR + haut.x * sinR,
    droite.y * cosR + haut.y * sinR,
    droite.z * cosR + haut.z * sinR,
    -droite.x * sinR + haut.x * cosR,
    -droite.y * sinR + haut.y * cosR,
    -droite.z * sinR + haut.z * cosR,
    centre.x,
    centre.y,
    centre.z,
  ]
}

/** Rayon projeté d'un angle au centre, en unités de projection (θ en radians). */
export function rayonProjete(mode: ModeProjection, thetaRad: number): number {
  if (mode === 'MODE_CADRE') return Math.tan(thetaRad)
  if (mode === 'MODE_FISHEYE') return thetaRad
  return 2 * Math.tan(thetaRad / 2)
}

/** Réciproque de `rayonProjete`. Un clic la traverse une fois, jamais une étoile. */
export function angleProjete(mode: ModeProjection, rayon: number): number {
  if (mode === 'MODE_CADRE') return Math.atan(rayon)
  if (mode === 'MODE_FISHEYE') return rayon
  return 2 * Math.atan(rayon / 2)
}

/** Échelle pixel : le champ horizontal demandé remplit exactement la largeur du canevas. */
export function echelleProjection(vue: Vue): number {
  return vue.largeurPx / 2 / rayonProjete(vue.mode, (vue.fovDeg / 2) * DEG)
}

/**
 * Portée utile d'un point projeté, en diagonales de canevas.
 *
 * Au-delà, une position n'est plus une position : c'est le voisinage de la singularité de la
 * projection, où le facteur radial diverge. Deux sommets voisins d'une polyligne s'y retrouvent
 * à des dizaines de milliers de pixels de part et d'autre du canevas, et la corde qui les relie
 * TRAVERSE l'image — une droite fantôme en travers du ciel, un maillage qui recouvre ce qu'il
 * devait border. Ces points sont donc déclarés non projetables, au même titre que ceux que la
 * formule refuse : ils sont hors du champ affiché de plusieurs écrans, et rien de ce qui s'y
 * appuie n'était visible autrement que par accident.
 */
/** Portée utile, en pixels, pour une vue donnée. */
export function porteeUtilePx(vue: Vue): number {
  return K('PORTEE_PROJECTION_DIAGONALES') * Math.hypot(vue.largeurPx, vue.hauteurPx)
}

export interface Projecteur {
  readonly vue: Vue
  /** J2000 équatorial → repère de la vue. Une seule matrice pour toute l'image (§3.1). */
  readonly matrice: Mat3
  readonly echelle: number
  /** `null` quand la direction n'est pas projetable : jamais un point à l'infini. */
  projette(v: Vec3): PointEcran | null
  /**
   * Même projection, sans rien allouer : la direction entre en scalaires, le résultat
   * s'écrit dans `out`. `false` quand la direction n'est pas projetable. C'est la forme
   * que prennent les boucles chaudes ; `projette` n'en est que l'emballage, pour que les
   * deux ne puissent pas diverger (§3.3).
   */
  projetteEn(x: number, y: number, z: number, out: PointEcranMut): boolean
  /** Direction J2000 sous un point de l'écran, pour le pointage à la souris. */
  inverse(xPx: number, yPx: number): Vec3
}

/**
 * Compose la matrice de l'image et retourne le projecteur. `matriceCiel` va du repère
 * équatorial J2000 au repère horizontal du site ; la matrice de vue enchaîne vers l'écran.
 */
export function projecteur(vue: Vue, matriceCiel: Mat3): Projecteur {
  const matrice = multiplie(matriceVue(vue.azimutDeg, vue.hauteurDeg, vue.rotationDeg), matriceCiel)
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = matrice
  const inverseMatrice = transpose(matrice)
  const k = echelleProjection(vue)
  const centreX = vue.largeurPx / 2
  const centreY = vue.hauteurPx / 2
  const mode = vue.mode
  // Comparée au carré : une racine par étoile pour une borne, alors que la borne se compare
  // aussi bien au carré (T-0065).
  const porteeCarree = porteeUtilePx(vue) ** 2

  // Fermeture nommée plutôt que méthode : `projette` l'appelle sans passer par `this`, et
  // un projecteur déstructuré garde donc le même comportement.
  const projetteEn = (vx: number, vy: number, vz: number, out: PointEcranMut): boolean => {
    const x = m11 * vx + m12 * vy + m13 * vz
    const y = m21 * vx + m22 * vy + m23 * vz
    const z = m31 * vx + m32 * vy + m33 * vz

    // Facteur R/sin(θ), écrit sous la forme qui ne divise jamais par zéro dans son
    // domaine. Hors domaine, la direction n'est pas projetable : on répond false
    // plutôt que d'écrire un point à l'infini (§3.3, dernier critère).
    let facteur: number
    if (mode === 'MODE_CADRE') {
      if (z <= Number.EPSILON) return false
      facteur = 1 / z
    } else if (mode === 'MODE_PLANETARIUM') {
      if (1 + z <= Number.EPSILON) return false
      facteur = 2 / (1 + z)
    } else {
      const s = Math.hypot(x, y)
      if (s <= Number.EPSILON) {
        out.xPx = centreX
        out.yPx = centreY
        out.thetaDeg = 0
        return true
      }
      facteur = Math.atan2(s, z) / s
    }
    const xPx = centreX + k * facteur * x
    const yPx = centreY - k * facteur * y
    if ((xPx - centreX) ** 2 + (yPx - centreY) ** 2 > porteeCarree) return false
    out.xPx = xPx
    out.yPx = yPx
    out.thetaDeg = Math.atan2(Math.hypot(x, y), z) / DEG
    return true
  }

  return {
    vue,
    matrice,
    echelle: k,
    projetteEn,
    projette(v: Vec3): PointEcran | null {
      const out = pointEcran()
      return projetteEn(v.x, v.y, v.z, out) ? out : null
    },
    inverse(xPx: number, yPx: number): Vec3 {
      const u = (xPx - centreX) / k
      const v = (centreY - yPx) / k
      const rayon = Math.hypot(u, v)
      const theta = angleProjete(mode, rayon)
      const sin = Math.sin(theta)
      const vueVec: Vec3 =
        rayon <= Number.EPSILON
          ? { x: 0, y: 0, z: 1 }
          : { x: (sin * u) / rayon, y: (sin * v) / rayon, z: Math.cos(theta) }
      const [i11, i12, i13, i21, i22, i23, i31, i32, i33] = inverseMatrice
      return {
        x: i11 * vueVec.x + i12 * vueVec.y + i13 * vueVec.z,
        y: i21 * vueVec.x + i22 * vueVec.y + i23 * vueVec.z,
        z: i31 * vueVec.x + i32 * vueVec.y + i33 * vueVec.z,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Profondeur du catalogue asservie au zoom
// ---------------------------------------------------------------------------

/**
 * §3.3 — mag_limite = mag_base + 5 × log10(fov_ref / fov_courant), à pente réduite au dézoom.
 *
 * ESSAI — la formule de §3.3 vide le ciel au dézoom : à 180° de champ elle tombe à la
 * magnitude 4,1, soit 212 étoiles à l'écran, au moment même où l'on dézoome pour se repérer.
 * Un plancher à mag_base en garde 3 335 et coûte trop cher à tracer. Au-delà du champ de
 * référence la pente passe donc à UN coefficient de Pogson au lieu de deux — 2,5 magnitudes
 * par décade de champ plutôt que 5 : magnitude 5,3 et 850 étoiles à 180°, quatre fois plus
 * qu'au PRD, quatre fois moins qu'au plancher. Le zoom, lui, garde la pente de §3.3.
 *
 * Écart assumé au PRD, à valider avant d'être gardé.
 */
export function magnitudeLimite(fovDeg: number): Traced<number> {
  // Le « 5 » du PRD est le double du coefficient de Pogson : cinq magnitudes pour un
  // rapport de flux de cent. Il se dérive, il ne s'écrit pas en dur (§2.1).
  const decades = Math.log10(K('FOV_REFERENCE_RENDU_DEG') / fovDeg)
  const coefficients = decades < 0 ? 1 : 2
  return trace({
    value: K('MAG_BASE_RENDU') + coefficients * K('POGSON') * decades,
    formula: 'MAGNITUDE_LIMITE_ZOOM',
    inputs: { fov_deg: fovDeg },
    constants: ['MAG_BASE_RENDU', 'FOV_REFERENCE_RENDU_DEG', 'POGSON'],
  })
}

/**
 * Vue réaliste : le fond de ciel EFFECTIF plafonne la profondeur affichée. Le rendu montre
 * alors le ciel tel qu'il serait vu, non le catalogue complet (§3.3).
 *
 * T-0100 — le paramètre est la brillance du fond de ciel, pas la magnitude limite à l'œil nu.
 * Cette fonction plafonnait auparavant sur un `mLimOeil` déjà résolu, et ne plafonnait donc
 * plus rien dès qu'il valait `null`. Or `null` veut dire « hors table » : sous la Lune, un
 * ciel PLUS CLAIR que Bortle 9 montrait alors plus d'étoiles qu'un ciel de banlieue. La
 * brillance, elle, dit de quel côté de la table on est sorti, et `mLimOeilBorne` borne au bord
 * en le déclarant.
 */
export function magnitudeRendue(
  fovDeg: number,
  sbEffectif: number | null,
  vueRealiste: boolean,
): Traced<number> {
  const zoom = magnitudeLimite(fovDeg)
  if (!vueRealiste || sbEffectif === null) return zoom
  const oeil = mLimOeilBorne(sbEffectif)
  const horsTable =
    oeil.borne === 'AUCUNE'
      ? ''
      : ' Le fond de ciel effectif sort de la table Bortle : la magnitude limite est bornée ' +
        `au bord de table (${oeil.value.toFixed(1)}), jamais extrapolée — ciel ` +
        `${oeil.borne === 'CIEL_PLUS_CLAIR' ? 'plus clair que Bortle 9' : 'plus sombre que Bortle 1'}.`
  return trace({
    value: Math.min(zoom.value, oeil.value),
    formula: 'MAGNITUDE_LIMITE_RENDUE',
    inputs: { mag_limite_zoom: zoom.value, sb_effectif: sbEffectif, m_lim_oeil: oeil.value },
    ...(oeil.borne === 'AUCUNE' ? {} : { flags: ['HORS_DOMAINE'] as const }),
    note:
      'Vue réaliste : la magnitude affichée est plafonnée par le fond de ciel du site. ' +
      'Désactiver la vue réaliste montre le catalogue complet, qui n’est pas ce que l’œil voit.' +
      horsTable,
  })
}

export interface BornesZoom {
  readonly fovMinDeg: number
  readonly fovMaxDeg: number
  /** Renseignée quand le plancher de zoom vient de l'absence du paquet Gaia (§3.3). */
  readonly cause?: string
}

/**
 * T-0095 — le plafond de champ appartient à la projection, pas à la vue.
 *
 * En gnomonique, R = tan(θ) : l'échelle pixel est (largeur/2) / R(fov/2), donc elle tend vers
 * zéro quand fov tend vers 180° et tout le ciel s'effondre sur le pixel central. Rien ne
 * plante — c'est exactement ce qui rend le défaut coûteux. Stéréographique (2·tan(θ/2)) et
 * équidistante (θ) restent finies à 180° et gardent le plafond de §3.3.
 */
export function fovMaxSelonMode(mode: ModeProjection): number {
  return mode === 'MODE_CADRE' ? K('FOV_MAX_GNOMONIQUE_DEG') : K('FOV_MAX_DEG')
}

/** §3.3 — sans le paquet Gaia, l'application plafonne à 15° de champ et le déclare. */
export function bornesZoom(gaiaCharge: boolean, mode: ModeProjection): BornesZoom {
  const fovMaxDeg = fovMaxSelonMode(mode)
  if (gaiaCharge) return { fovMinDeg: K('FOV_MIN_AVEC_GAIA_DEG'), fovMaxDeg }
  return {
    fovMinDeg: K('FOV_MIN_SANS_GAIA_DEG'),
    fovMaxDeg,
    cause:
      `Zoom limité à ${K('FOV_MIN_SANS_GAIA_DEG')}° de champ : sans le paquet Gaia, le ` +
      'catalogue HYG donne environ 48 étoiles sur un champ de 5°, et le ciel paraîtrait vide. ' +
      'Le paquet Gaia (≈ 12 Mo) descend le zoom utile à ' +
      `${K('FOV_MIN_AVEC_GAIA_DEG')}°.`,
  }
}

export interface EtatProfondeur {
  readonly magLimite: Traced<number>
  /** Magnitude la plus faible réellement présente dans le catalogue chargé. */
  readonly profondeurCatalogue: number
  readonly catalogueEpuise: boolean
  readonly cause?: string
}

/**
 * §3.3 — `catalogue_epuise` doit être affiché. Sous la borne du catalogue chargé, le semis
 * génératif de §9.2 complèterait le rendu, TOUJOURS en le déclarant : tant qu'il n'existe
 * pas, l'application déclare le manque plutôt que d'inventer des étoiles.
 */
export function etatProfondeur(
  fovDeg: number,
  profondeurCatalogue: number,
  sbEffectif: number | null,
  vueRealiste: boolean,
): EtatProfondeur {
  const magLimite = magnitudeRendue(fovDeg, sbEffectif, vueRealiste)
  const epuise = magLimite.value > profondeurCatalogue
  return {
    magLimite,
    profondeurCatalogue,
    catalogueEpuise: epuise,
    ...(epuise
      ? {
          cause:
            `À ${fovDeg.toFixed(1)}° de champ, la profondeur utile atteint la magnitude ` +
            `${magLimite.value.toFixed(1)}, au-delà de la magnitude ${profondeurCatalogue.toFixed(1)} ` +
            'du catalogue chargé. Les étoiles plus faibles ne sont pas affichées : elles ne ' +
            'sont pas générées non plus, et le champ paraît donc plus pauvre qu’il ne l’est. ' +
            'Charger le paquet Gaia (≈ 12 Mo) comble l’écart.',
        }
      : {}),
  }
}

/** §3.3 — rayon de rendu d'une étoile, modèle commun avec la prévisualisation §9.2. */
export function rayonEtoilePx(magV: number): number {
  return (
    K('RAYON_ETOILE_R0_PX') *
    K('BASE_MAGNITUDE') ** (-K('COEF_RAYON_MAGNITUDE') * (magV - K('MAG_REFERENCE_RAYON')))
  )
}

// Le rayon n'a pas de trace §10.2 : il s'applique à des étoiles dessinées au canevas, où
// rien ne se déplie. La formule `RAYON_ETOILE` reste au formulaire de l'Annexe B (T-0063).
