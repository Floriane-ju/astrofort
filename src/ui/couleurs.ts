/**
 * Couleur de rendu d'une étoile d'après son indice B−V (§3.3).
 *
 * Table d'ancrage classique de la conversion indice de couleur → RVB, interpolée
 * linéairement. C'est une correspondance d'apparence, pas un calcul de physique : elle ne
 * nourrit aucun verdict et n'a donc pas sa place au registre §2.1, qui ne porte que les
 * valeurs consommées par une formule.
 *
 * Les couleurs sont quantifiées en quelques teintes : le rendu regroupe les étoiles par
 * teinte pour ne changer la couleur du contexte que quelques fois par image, au lieu de
 * plusieurs milliers.
 */

import { composantesFond } from '../core/fond-ciel-rendu.ts'

const ANCRES: readonly (readonly [number, number, number, number])[] = [
  [-0.4, 155, 176, 255],
  [0.0, 202, 215, 255],
  [0.4, 248, 247, 255],
  [0.8, 255, 244, 234],
  [1.2, 255, 210, 161],
  [1.6, 255, 204, 111],
  [2.0, 255, 180, 80],
]

/** Nombre de teintes distinctes utilisées au rendu. */
export const TEINTES = 8

export function teinte(bv: number): number {
  const min = ANCRES[0]![0]
  const max = ANCRES[ANCRES.length - 1]![0]
  const borne = Math.max(min, Math.min(max, bv))
  const index = Math.round(((borne - min) / (max - min)) * (TEINTES - 1))
  return Math.max(0, Math.min(TEINTES - 1, index))
}

function interpole(bv: number): readonly [number, number, number] {
  const min = ANCRES[0]!
  const max = ANCRES[ANCRES.length - 1]!
  if (bv <= min[0]) return [min[1], min[2], min[3]]
  if (bv >= max[0]) return [max[1], max[2], max[3]]
  for (let i = 0; i + 1 < ANCRES.length; i++) {
    const a = ANCRES[i]!
    const b = ANCRES[i + 1]!
    if (bv <= b[0]) {
      const f = (bv - a[0]) / (b[0] - a[0])
      return [
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
        Math.round(a[3] + (b[3] - a[3]) * f),
      ]
    }
  }
  return [max[1], max[2], max[3]]
}

/**
 * Couleur d'une teinte. En mode nuit, les canaux vert et bleu sont strictement nuls : la
 * même règle que la palette de §11.1, appliquée au canevas que la feuille de style
 * n'atteint pas.
 */
export function couleurTeinte(index: number, modeNuit: boolean): string {
  const min = ANCRES[0]![0]
  const max = ANCRES[ANCRES.length - 1]![0]
  const bv = min + ((max - min) * index) / (TEINTES - 1)
  const [r, v, b] = interpole(bv)
  if (!modeNuit) return `rgb(${r} ${v} ${b})`
  // Luminance perçue ramenée sur le seul canal rouge.
  const luminance = Math.round(0.299 * r + 0.587 * v + 0.114 * b)
  return `rgb(${luminance} 0 0)`
}

export interface PaletteCiel {
  readonly fond: string
  readonly figures: string
  readonly frontieres: string
  readonly asterismes: string
  readonly objets: string
  readonly corps: string
  readonly cadre: string
  readonly horizon: string
  /** §4.1 — le sol : opaque et très foncé, il se distingue du fond de ciel sans l'éclairer. */
  readonly sol: string
  /** T-0033 — plan galactique : rose en vue normale, rouge pur en mode nuit comme le reste. */
  readonly voieLactee: string
  readonly texte: string
}

/**
 * T-0065 — deux palettes gelées, pas deux littéraux par image. Elles ne dépendent que du
 * mode nuit : les reconstruire à chaque passe de rendu n'apporte rien et alloue.
 */
const PALETTE_NUIT: PaletteCiel = Object.freeze({
  fond: '#000000',
  figures: 'rgb(90 0 0)',
  frontieres: 'rgb(55 0 0)',
  asterismes: 'rgb(140 0 0)',
  objets: 'rgb(120 0 0)',
  corps: 'rgb(190 0 0)',
  cadre: 'rgb(200 0 0)',
  horizon: 'rgb(70 0 0)',
  sol: 'rgb(18 0 0)',
  voieLactee: 'rgb(110 0 0)',
  texte: 'rgb(170 0 0)',
})

const PALETTE_JOUR: PaletteCiel = Object.freeze({
  fond: '#05070d',
  figures: 'rgb(90 120 170)',
  frontieres: 'rgb(60 70 95)',
  asterismes: 'rgb(150 190 120)',
  objets: 'rgb(150 190 230)',
  corps: 'rgb(255 226 150)',
  cadre: 'rgb(255 170 60)',
  horizon: 'rgb(90 80 70)',
  sol: 'rgb(14 13 12)',
  voieLactee: 'rgb(205 125 175)',
  texte: 'rgb(200 210 230)',
})

export function palette(modeNuit: boolean): PaletteCiel {
  return modeNuit ? PALETTE_NUIT : PALETTE_JOUR
}

// ---------------------------------------------------------------------------
// T-0097 — fond de ciel réaliste et compensation de contraste
// ---------------------------------------------------------------------------

/**
 * Les coefficients qui suivent sont des DÉFINITIONS de l'espace sRGB et du calcul de
 * contraste WCAG 2.1, au même titre que 180° est un demi-tour. Ce ne sont ni des seuils de
 * projet ni des valeurs mesurées : le registre §2.1 ne porte que les grandeurs consommées par
 * une formule d'astronomie, et les y ranger laisserait croire qu'elles se règlent.
 */
const SRGB_SEUIL_LINEAIRE = 0.0031308
const SRGB_SEUIL_ENCODE = 0.04045
const SRGB_PENTE = 12.92
const SRGB_ALPHA = 0.055
const SRGB_GAMMA = 2.4
const WCAG_R = 0.2126
const WCAG_V = 0.7152
const WCAG_B = 0.0722
/** Le 0,05 du rapport WCAG : la réflexion d'ambiance ajoutée aux deux luminances. */
const WCAG_AMBIANCE = 0.05
const OCTET_MAX = 255

type Composantes = readonly [number, number, number]

function versLineaire(octet: number): number {
  const encode = octet / OCTET_MAX
  return encode <= SRGB_SEUIL_ENCODE
    ? encode / SRGB_PENTE
    : ((encode + SRGB_ALPHA) / (1 + SRGB_ALPHA)) ** SRGB_GAMMA
}

function versOctet(lineaire: number): number {
  const borne = Math.min(1, Math.max(0, lineaire))
  const encode =
    borne <= SRGB_SEUIL_LINEAIRE
      ? borne * SRGB_PENTE
      : (1 + SRGB_ALPHA) * borne ** (1 / SRGB_GAMMA) - SRGB_ALPHA
  return Math.round(encode * OCTET_MAX)
}

const HEXA = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RVB = /^rgb\((\d+) (\d+) (\d+)\)$/

/** Composantes linéaires d'une couleur CSS de la palette — `#rrggbb` ou `rgb(r v b)`. */
function composantesDeCss(css: string): Composantes {
  const hexa = HEXA.exec(css)
  if (hexa !== null) {
    return [
      versLineaire(parseInt(hexa[1]!, 16)),
      versLineaire(parseInt(hexa[2]!, 16)),
      versLineaire(parseInt(hexa[3]!, 16)),
    ]
  }
  const rvb = RVB.exec(css)
  if (rvb === null) throw new Error(`Couleur de palette non reconnue : ${css}`)
  return [
    versLineaire(Number(rvb[1])),
    versLineaire(Number(rvb[2])),
    versLineaire(Number(rvb[3])),
  ]
}

function css(composantes: Composantes): string {
  return `rgb(${versOctet(composantes[0])} ${versOctet(composantes[1])} ${versOctet(composantes[2])})`
}

/** Luminance relative WCAG d'une couleur donnée en lumière linéaire. */
export function luminanceRelative(composantes: Composantes): number {
  return WCAG_R * composantes[0] + WCAG_V * composantes[1] + WCAG_B * composantes[2]
}

/** Rapport de contraste WCAG entre deux luminances relatives. */
export function rapportContraste(claire: number, sombre: number): number {
  return (claire + WCAG_AMBIANCE) / (sombre + WCAG_AMBIANCE)
}

/** Luminance du fond de référence : celui sur lequel la palette de jour a été choisie. */
export const LUMINANCE_FOND_REFERENCE = luminanceRelative(composantesDeCss(PALETTE_JOUR.fond))

/** Couleur du fond de ciel pour cette brillance de surface, en vue réaliste. */
export function fondRealiste(sbCiel: number): string {
  return css(composantesFond(sbCiel) as Composantes)
}

/**
 * Retient une teinte de repère à SON rapport de contraste actuel contre `#05070d`.
 *
 * Sans cela, `frontieres` passe de 2,14:1 à 1,15:1 sur un fond de Bortle 9 et disparaît —
 * exactement ce que §3.7 interdit. Préserver le rapport que chaque teinte a déjà évite
 * d'introduire un seuil arbitraire et de re-litiger la palette.
 *
 * ponytail: la luminance est relevée par une homothétie sur les trois canaux, donc à
 * chromaticité constante, puis chaque canal est écrêté à 1. Une teinte déjà proche du blanc —
 * `cadre`, `corps`, `texte` — ne PEUT pas garder un rapport de 10:1 ou 16:1 sur un fond de
 * Bortle 9 : le maximum atteignable y est 8,2:1, blanc pur compris. Elle sature donc, et
 * `saturee` le dit. C'est une limite du gamut de l'écran, pas un défaut du modèle.
 */
export function ajusteContrasteSurFond(
  teinte: string,
  luminanceFond: number,
): { readonly couleur: string; readonly saturee: boolean } {
  const base = composantesDeCss(teinte)
  const luminance = luminanceRelative(base)
  if (luminance <= 0) return { couleur: teinte, saturee: false }
  const rapport = rapportContraste(luminance, LUMINANCE_FOND_REFERENCE)
  const cible = rapport * (luminanceFond + WCAG_AMBIANCE) - WCAG_AMBIANCE
  if (cible <= luminance) return { couleur: teinte, saturee: false }
  const facteur = cible / luminance
  const etendues: Composantes = [base[0] * facteur, base[1] * facteur, base[2] * facteur]
  return { couleur: css(etendues), saturee: etendues.some((c) => c > 1) }
}

/**
 * Palette de vue réaliste : le fond prend la luminance du site, les repères la compensent.
 *
 * `sol` n'est pas compensé — le sol masque, il n'oriente pas, et l'éclaircir défait T-0094.
 * Le fond n'est pas compensé non plus : c'est lui la référence.
 *
 * ponytail: un seul résultat gardé en cache. La boucle de rendu appelle cette fonction par
 * image avec le même `sbCiel` pendant des milliers d'images ; recomposer neuf teintes à
 * chaque fois allouerait pour rien, et un cache par valeur n'aurait jamais plus d'une entrée.
 */
let cacheRealiste: { sb: number; palette: PaletteCiel } | null = null

export function paletteRealiste(sbCiel: number): PaletteCiel {
  if (cacheRealiste !== null && cacheRealiste.sb === sbCiel) return cacheRealiste.palette
  const fond = fondRealiste(sbCiel)
  const luminanceFond = luminanceRelative(composantesFond(sbCiel) as Composantes)
  const compense = (teinte: string): string =>
    ajusteContrasteSurFond(teinte, luminanceFond).couleur
  const composee: PaletteCiel = Object.freeze({
    ...PALETTE_JOUR,
    fond,
    figures: compense(PALETTE_JOUR.figures),
    frontieres: compense(PALETTE_JOUR.frontieres),
    asterismes: compense(PALETTE_JOUR.asterismes),
    objets: compense(PALETTE_JOUR.objets),
    corps: compense(PALETTE_JOUR.corps),
    cadre: compense(PALETTE_JOUR.cadre),
    horizon: compense(PALETTE_JOUR.horizon),
    voieLactee: compense(PALETTE_JOUR.voieLactee),
    texte: compense(PALETTE_JOUR.texte),
  })
  cacheRealiste = { sb: sbCiel, palette: composee }
  return composee
}

/**
 * La palette de la scène : mode nuit d'abord — il protège l'adaptation à l'obscurité, et
 * éclaircir tout le canevas le rendrait inutile. En mode nuit, la vue réaliste ne change donc
 * que la magnitude limite (§11.1).
 */
export function paletteScene(modeNuit: boolean, vueRealiste: boolean, sbCiel: number): PaletteCiel {
  if (modeNuit || !vueRealiste) return palette(modeNuit)
  return paletteRealiste(sbCiel)
}
