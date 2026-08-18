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
  /** T-0033 — plan galactique : rose en vue normale, rouge pur en mode nuit comme le reste. */
  readonly voieLactee: string
  readonly texte: string
}

export function palette(modeNuit: boolean): PaletteCiel {
  if (modeNuit) {
    return {
      fond: '#000000',
      figures: 'rgb(90 0 0)',
      frontieres: 'rgb(55 0 0)',
      asterismes: 'rgb(140 0 0)',
      objets: 'rgb(120 0 0)',
      corps: 'rgb(190 0 0)',
      cadre: 'rgb(200 0 0)',
      horizon: 'rgb(70 0 0)',
      voieLactee: 'rgb(110 0 0)',
      texte: 'rgb(170 0 0)',
    }
  }
  return {
    fond: '#05070d',
    figures: 'rgb(90 120 170)',
    frontieres: 'rgb(60 70 95)',
    asterismes: 'rgb(150 190 120)',
    objets: 'rgb(150 190 230)',
    corps: 'rgb(255 226 150)',
    cadre: 'rgb(255 170 60)',
    horizon: 'rgb(90 80 70)',
    voieLactee: 'rgb(205 125 175)',
    texte: 'rgb(200 210 230)',
  }
}
