/**
 * §6.3 — Détectabilité et quatre verdicts.
 *
 * La magnitude intégrée ment : c'est la brillance de surface qui décide. M57, cinq
 * magnitudes plus faible que M31, est dix-huit fois plus brillante par seconde d'arc au
 * carré qu'un ciel Bortle 4,5 ; M33, plus brillante que M57 en magnitude intégrée, est sept
 * fois plus faible que ce même fond de ciel.
 *
 * Et un instrument N'AUGMENTE JAMAIS la brillance de surface d'un objet étendu : il
 * augmente sa taille apparente. C'est par la taille, via la table de contraste, que le
 * grossissement joue — jamais par un gain de contraste qui n'existe pas.
 *
 * PHOTO_SEULE n'est pas un refus : c'est une durée. Le débutant qui lit « invisible »
 * abandonne, celui qui lit « une heure d'intégration » sort son intervallomètre.
 */

import { K } from '../registry/constants.ts'
import { seuilContraste } from '../registry/contrast.ts'
import type { FormulaId } from '../registry/formulas.ts'
import type { TypeObjet } from '../data/deepsky.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

const ARCSEC_PAR_ARCMIN = 60

export type VerdictDetectabilite = 'OEIL_NU' | 'JUMELLES' | 'TELESCOPE' | 'PHOTO_SEULE'
export type ToleranceLune = 'FORTE' | 'MOYENNE' | 'FAIBLE'

export interface ModulationType {
  readonly toleranceLune: ToleranceLune
  readonly conseil: string
}

/** §6.3 — modulation par type d'objet, conséquence directe du socle. */
const MODULATIONS: Readonly<Record<TypeObjet, ModulationType>> = Object.freeze({
  EMISSION: {
    toleranceLune: 'FORTE',
    conseil:
      'Nébuleuse en émission : un filtre bi-bande Hα/OIII lui fait tolérer la Lune et un ' +
      'ciel Bortle 5 à 6. En large bande, la même cible devient non recommandée.',
  },
  RESTE_SUPERNOVA: {
    toleranceLune: 'FORTE',
    conseil:
      'Reste de supernova : émission en raies, donc même tolérance qu’une nébuleuse en ' +
      'émission avec un filtre bi-bande.',
  },
  NEB_PLANETAIRE: {
    toleranceLune: 'FORTE',
    conseil: 'Nébuleuse planétaire : tolère la Lune et récompense la focale longue.',
  },
  AMAS_OUVERT: {
    toleranceLune: 'MOYENNE',
    conseil: 'Amas : peu sensible à la pollution lumineuse, les étoiles restent ponctuelles.',
  },
  AMAS_GLOB: {
    toleranceLune: 'MOYENNE',
    conseil: 'Amas : peu sensible à la pollution lumineuse, les étoiles restent ponctuelles.',
  },
  GALAXIE: {
    toleranceLune: 'FAIBLE',
    conseil:
      'Galaxie : large bande obligatoire, aucun filtre n’aide. Elle exige un ciel noir ET ' +
      'la Lune couchée.',
  },
  REFLEXION: {
    toleranceLune: 'FAIBLE',
    conseil:
      'Nébuleuse par réflexion : large bande obligatoire, et plus exigeante encore qu’une ' +
      'galaxie sur la noirceur du ciel.',
  },
  NEB_OBSCURE: {
    toleranceLune: 'FAIBLE',
    conseil:
      'Nébuleuse obscure : elle se lit en contraste sur le fond, donc exige le ciel le plus ' +
      'noir. Aucun filtre n’aide.',
  },
  INCONNU: {
    toleranceLune: 'MOYENNE',
    conseil: 'Type absent du catalogue : aucune modulation par type n’est appliquée.',
  },
  AUTRE: {
    toleranceLune: 'MOYENNE',
    conseil: 'Type non modélisé : aucune modulation par type n’est appliquée.',
  },
})

export interface EtatLune {
  /** Hauteur de la Lune au moment évalué. Négative : elle n'entre pas dans le calcul. */
  readonly altitudeDeg: number
  readonly separationDeg?: number
}

export interface EntreeDetectabilite {
  /** `null` quand le catalogue ne donne pas la magnitude : aucun verdict n'est produit. */
  readonly mInt: number | null
  readonly aArcmin: number | null
  /** Absent : l'objet est supposé rond, `b = a`. */
  readonly bArcmin?: number | null
  readonly typeObjet: TypeObjet
  readonly sbCiel: number
  /** `null` hors du domaine de la table Bortle : les verdicts visuels ne sont pas évalués. */
  readonly mLimOeil: number | null
  /** Diamètre de l'instrument de l'utilisateur, mm. */
  readonly dMm: number
  readonly lune?: EtatLune
}

export interface Detectabilite {
  readonly sbObj: Traced<number | null>
  readonly deltaSb: Traced<number | null>
  /** `null` quand la donnée source manque : aucune estimation n'est produite. */
  readonly verdict: VerdictDetectabilite | null
  readonly toleranceLune: ToleranceLune
  readonly conseilType: string
  /** Une phrase : pourquoi cette magnitude n'implique pas cette visibilité. */
  readonly explication: string
  readonly noteLune?: string
  /** Magnitude limite atteinte par l'instrument de l'utilisateur. */
  readonly mLimInstr: Traced<number | null>
}

/** Aire d'une ellipse donnée par ses deux axes, en secondes d'arc au carré. */
export function aireEllipseArcsec2(aArcmin: number, bArcmin: number): number {
  return (
    (Math.PI / K('AIRE_ELLIPSE_DIAMETRES')) *
    ARCSEC_PAR_ARCMIN *
    ARCSEC_PAR_ARCMIN *
    aArcmin *
    bArcmin
  )
}

/** Gain en magnitude limite apporté par un diamètre, contre l'œil adapté (C-11). */
export function gainInstrumental(dMm: number): number {
  return 2 * K('POGSON') * Math.log10(dMm / K('PUPILLE_OEIL_ADAPTE_MM'))
}

/** Grossissement à pupille de sortie pleine : le réglage qui favorise la détection. */
export function grossissement(dMm: number): number {
  return dMm / K('PUPILLE_OEIL_ADAPTE_MM')
}

/**
 * Détection visuelle d'un objet étendu : magnitude limite ET contraste suffisant à la
 * taille apparente. Un objet ponctuel échappe au second critère — il n'a pas de brillance
 * de surface exploitable.
 */
function detecteVisuellement(
  mInt: number,
  mLim: number,
  deltaSb: number,
  tailleApparenteArcmin: number,
): boolean {
  if (mInt > mLim) return false
  const seuil = seuilContraste(tailleApparenteArcmin)
  return seuil === null || deltaSb >= seuil
}

function manquant(champ: string, formula: FormulaId): Traced<number | null> {
  return trace({
    value: null,
    formula,
    flags: ['DONNEE_MANQUANTE'],
    note:
      `${champ} absente du catalogue : ni brillance de surface, ni verdict, ni estimation de ` +
      'temps de pose ne sont produits.',
  })
}

export function detectabilite(entree: EntreeDetectabilite): Detectabilite {
  const { mInt, aArcmin, typeObjet, sbCiel, mLimOeil, dMm } = entree
  const bArcmin = entree.bArcmin ?? aArcmin
  const modulation = MODULATIONS[typeObjet]
  const noteLune = messageLune(entree.lune, modulation)

  if (mInt === null || aArcmin === null || bArcmin === null) {
    const champ = mInt === null ? 'Magnitude intégrée' : 'Dimensions'
    return {
      sbObj: manquant(champ, 'BRILLANCE_SURFACE'),
      deltaSb: manquant(champ, 'CONTRASTE'),
      verdict: null,
      toleranceLune: modulation.toleranceLune,
      conseilType: modulation.conseil,
      explication:
        `${champ} absente du catalogue pour cette cible. Aucun verdict n’est produit : une ` +
        'estimation inventée serait pire qu’une absence annoncée.',
      mLimInstr: manquant(champ, 'MAGNITUDE_LIMITE_INSTRUMENT'),
      ...(noteLune === undefined ? {} : { noteLune }),
    }
  }

  const aire = aireEllipseArcsec2(aArcmin, bArcmin)
  const sbObjValeur = mInt + K('POGSON') * Math.log10(aire)
  const deltaSbValeur = sbCiel - sbObjValeur
  const tailleReelleArcmin = Math.sqrt(aArcmin * bArcmin)
  const gain = gainInstrumental(dMm)

  const sbObj = trace({
    value: sbObjValeur,
    formula: 'BRILLANCE_SURFACE',
    inputs: { m_int: mInt, a_arcmin: aArcmin, b_arcmin: bArcmin, aire_arcsec2: aire },
    constants: ['POGSON', 'AIRE_ELLIPSE_DIAMETRES'],
  })
  const deltaSb = trace({
    value: deltaSbValeur,
    formula: 'CONTRASTE',
    inputs: { sb_ciel: sbCiel, sb_obj: sbObjValeur },
  })
  const mLimInstr = trace({
    value: mLimOeil === null ? null : mLimOeil + gain,
    formula: 'MAGNITUDE_LIMITE_INSTRUMENT',
    inputs: { m_lim_oeil: mLimOeil ?? Number.NaN, gain_mag: gain, d_mm: dMm },
    constants: ['PUPILLE_OEIL_ADAPTE_MM', 'POGSON'],
    ...(mLimOeil === null
      ? {
          flags: ['DONNEE_MANQUANTE' as const],
          note:
            'Le fond de ciel sort du domaine de la table Bortle : la magnitude limite à l’œil ' +
            'nu n’est pas extrapolée, donc les verdicts visuels ne sont pas évalués.',
        }
      : {}),
  })

  const verdict = verdictVisuel({
    mInt,
    mLimOeil,
    deltaSb: deltaSbValeur,
    tailleReelleArcmin,
    dMm,
  })

  return {
    sbObj,
    deltaSb,
    verdict,
    toleranceLune: modulation.toleranceLune,
    conseilType: modulation.conseil,
    explication: explique(verdict, mInt, sbObjValeur, sbCiel, deltaSbValeur, mLimOeil),
    mLimInstr,
    ...(noteLune === undefined ? {} : { noteLune }),
  }
}

interface EntreeVerdict {
  readonly mInt: number
  readonly mLimOeil: number | null
  readonly deltaSb: number
  readonly tailleReelleArcmin: number
  readonly dMm: number
}

/** Les quatre verdicts, évalués dans l'ordre : le premier satisfait gagne. */
function verdictVisuel(e: EntreeVerdict): VerdictDetectabilite {
  if (e.mLimOeil === null) return 'PHOTO_SEULE'

  if (detecteVisuellement(e.mInt, e.mLimOeil, e.deltaSb, e.tailleReelleArcmin)) return 'OEIL_NU'

  const dJumelles = K('PUPILLE_JUMELLES_MM')
  const mLimJumelles = e.mLimOeil + gainInstrumental(dJumelles)
  if (
    detecteVisuellement(
      e.mInt,
      mLimJumelles,
      e.deltaSb,
      e.tailleReelleArcmin * grossissement(dJumelles),
    )
  ) {
    return 'JUMELLES'
  }

  const mLimInstr = e.mLimOeil + gainInstrumental(e.dMm)
  if (
    detecteVisuellement(e.mInt, mLimInstr, e.deltaSb, e.tailleReelleArcmin * grossissement(e.dMm))
  ) {
    return 'TELESCOPE'
  }

  return 'PHOTO_SEULE'
}

/** Combien de fois le fond de ciel est plus brillant que l'objet, par arcsec². */
export function rapportAuFondDeCiel(deltaSb: number): number {
  return K('BASE_MAGNITUDE') ** (-deltaSb / K('POGSON'))
}

function explique(
  verdict: VerdictDetectabilite,
  mInt: number,
  sbObj: number,
  sbCiel: number,
  deltaSb: number,
  mLimOeil: number | null,
): string {
  if (verdict === 'PHOTO_SEULE' && deltaSb < 0) {
    return (
      `Sa brillance de surface (${sbObj.toFixed(2)}) est sous le fond de ciel ` +
      `(${sbCiel.toFixed(2)}) : par seconde d’arc au carré, le signal est ` +
      `${rapportAuFondDeCiel(deltaSb).toFixed(0)} fois plus faible que le ciel. Une magnitude ` +
      `intégrée de ${mInt.toFixed(1)} n’implique donc aucune visibilité : elle additionne toute ` +
      'la lumière de l’objet sur toute sa surface, alors que l’œil ne compare que point à ' +
      'point. Ce n’est pas un refus — c’est une durée d’intégration.'
    )
  }
  if (verdict === 'PHOTO_SEULE') {
    return (
      `Objet trop faible pour ${mLimOeil === null ? 'être évalué en visuel' : 'le visuel depuis ce site'}` +
      ` : magnitude ${mInt.toFixed(1)}. L’intégration franchit tout contraste, la question ` +
      'devient combien d’heures.'
    )
  }
  return (
    `Contraste suffisant à sa taille apparente : ΔSB = ${deltaSb.toFixed(2)} mag/arcsec². ` +
    'L’instrument n’augmente pas la brillance de surface, il agrandit l’objet — et c’est ' +
    'l’agrandissement qui abaisse le seuil de détection.'
  )
}

function messageLune(lune: EtatLune | undefined, modulation: ModulationType): string | undefined {
  if (lune === undefined) return undefined
  if (lune.altitudeDeg <= 0) {
    return (
      `La Lune est sous l’horizon (${lune.altitudeDeg.toFixed(0)}°) : elle n’entre pas dans le ` +
      'calcul du fond de ciel, et la cible n’est pénalisée d’aucune façon.'
    )
  }
  return (
    `Lune levée à ${lune.altitudeDeg.toFixed(0)}° de hauteur` +
    `${lune.separationDeg === undefined ? '' : `, à ${lune.separationDeg.toFixed(0)}° de la cible`}` +
    `. Tolérance de ce type d’objet : ${modulation.toleranceLune}. ${modulation.conseil}`
  )
}
