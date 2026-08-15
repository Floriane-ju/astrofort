/**
 * Tables énumérées du PRD — §6.1 domaines, §6.2 verdicts de cadrage, §7.2 valeurs
 * d'obturateur, §7.3 objectifs de qualité, §7.4 prescriptions de calibration.
 *
 * Ce sont des tables déclarées, au même titre que la table Bortle : elles vivent dans le
 * registre et non dans les moteurs, pour la raison de §2.1 — une borne de classification
 * écrite en dur dans un moteur devient invérifiable et se met à diverger de sa source.
 *
 * Les bornes de remplissage 0,33 et 0,5 sont les mêmes que C-05 ; elles sont citées ici
 * depuis le registre plutôt que recopiées.
 */

import { K } from './constants.ts'

// ---------------------------------------------------------------------------
// §6.1 — verdict de domaine
// ---------------------------------------------------------------------------

export type Domaine =
  | 'DOMAINE_LONGUE_FOCALE'
  | 'DOMAINE_CLASSIQUE'
  | 'DOMAINE_GRAND_CHAMP'
  | 'DOMAINE_TRES_GRAND_CHAMP'

export interface LigneDomaine {
  readonly domaine: Domaine
  /** Borne haute, exclue, sur `taille_min_deg`. `Infinity` pour la dernière ligne. */
  readonly borneHauteDeg: number
  readonly libelle: string
  /** La phrase de verdict de §6.1 : ce que ce setup fait bien, et ce qu'il ne fait pas. */
  readonly phrase: string
}

export const TABLE_DOMAINES: readonly LigneDomaine[] = Object.freeze(
  [
    {
      domaine: 'DOMAINE_LONGUE_FOCALE',
      borneHauteDeg: 0.05,
      libelle: 'longue focale',
      phrase:
        'Excellent pour les galaxies lointaines et les nébuleuses planétaires, hors domaine ' +
        'pour les grands complexes nébuleux, qui déborderont largement du champ.',
    },
    {
      domaine: 'DOMAINE_CLASSIQUE',
      borneHauteDeg: 0.5,
      libelle: 'classique',
      phrase:
        'Excellent pour le Messier standard, les amas et les galaxies proches, hors domaine ' +
        'pour les régions entières de la Voie lactée.',
    },
    {
      domaine: 'DOMAINE_GRAND_CHAMP',
      borneHauteDeg: 2.0,
      libelle: 'grand champ',
      phrase:
        'Excellent pour les grandes nébuleuses, M31, M42 et les Pléiades, hors domaine pour ' +
        'les galaxies lointaines, qui ne feront que quelques dizaines de pixels.',
    },
    {
      domaine: 'DOMAINE_TRES_GRAND_CHAMP',
      borneHauteDeg: Number.POSITIVE_INFINITY,
      libelle: 'très grand champ',
      phrase:
        'Excellent pour la Voie lactée et les grands complexes nébuleux, hors domaine pour ' +
        'les galaxies, qui resteront des taches de quelques pixels.',
    },
  ].map(Object.freeze) as LigneDomaine[],
)

/** Nombre de cibles d'exemple proposées à la validation du profil (§6.1). */
export const CIBLES_EXEMPLES = Object.freeze({ min: 5, max: 8 })

// ---------------------------------------------------------------------------
// §6.2 — verdict de cadrage par cible
// ---------------------------------------------------------------------------

export type VerdictCadrage =
  | 'MOSAIQUE_REQUISE'
  | 'CADRAGE_SERRE'
  | 'CADRAGE_OPTIMAL'
  | 'CADRAGE_LARGE'
  | 'CADRAGE_PERDU'
  | 'HORS_DOMAINE'

export interface LigneCadrage {
  readonly verdict: VerdictCadrage
  /** Borne basse, incluse, sur le remplissage du champ. */
  readonly remplissageMin: number
  /**
   * Faux quand le verdict interdit de présenter la cible comme cadrable. La cause est
   * toujours nommée, et aucun recadrage logiciel n'est proposé en compensation (§6.1).
   */
  readonly faisable: boolean
  readonly message: string
}

export const TABLE_CADRAGE: readonly LigneCadrage[] = Object.freeze(
  [
    {
      verdict: 'MOSAIQUE_REQUISE',
      remplissageMin: 1.0,
      faisable: true,
      message:
        'La cible déborde du champ : elle demande une mosaïque, donc autant de sessions ' +
        'partielles que de tuiles.',
    },
    {
      verdict: 'CADRAGE_SERRE',
      remplissageMin: K('REMPLISSAGE_CADRE_MAX'),
      faisable: true,
      message:
        'Cadrage serré : la marge est faible, le centrage et la mise en station deviennent ' +
        'critiques.',
    },
    {
      verdict: 'CADRAGE_OPTIMAL',
      remplissageMin: K('REMPLISSAGE_CADRE_MIN'),
      faisable: true,
      message: 'Cadrage optimal : la cible occupe la fenêtre visée par C-05.',
    },
    {
      verdict: 'CADRAGE_LARGE',
      remplissageMin: 0.15,
      faisable: true,
      message: 'Cadrage large : acceptable, la cible est montrée dans son contexte de champ.',
    },
    {
      verdict: 'CADRAGE_PERDU',
      remplissageMin: 0.02,
      faisable: false,
      message: 'Objet noyé dans le champ : il n’occupe qu’une fraction marginale de l’image.',
    },
    {
      verdict: 'HORS_DOMAINE',
      remplissageMin: 0,
      faisable: false,
      message: 'Hors domaine de ce setup : la cible est trop petite pour cette focale.',
    },
  ].map(Object.freeze) as LigneCadrage[],
)

/** Le rapport d'axes au-delà duquel une orientation du boîtier est suggérée (§6.2). */
export const RAPPORT_AXES_ORIENTATION = 1.3

/**
 * §8.3 — verdicts de cadrage admis au pré-filtrage du plan de session. La mosaïque en est
 * exclue : elle demande autant de sessions partielles que de tuiles, ce qui n'est pas un
 * créneau d'une nuit.
 */
export const VERDICTS_PLANIFIABLES: readonly VerdictCadrage[] = Object.freeze([
  'CADRAGE_SERRE',
  'CADRAGE_OPTIMAL',
  'CADRAGE_LARGE',
])

/** Remplissage minimal d'une cible planifiable : la borne basse de CADRAGE_LARGE. */
export const REMPLISSAGE_MIN_PLANIFIABLE = Math.min(
  ...TABLE_CADRAGE.filter((l) => VERDICTS_PLANIFIABLES.includes(l.verdict)).map(
    (l) => l.remplissageMin,
  ),
)

// ---------------------------------------------------------------------------
// §7.2 — valeurs d'obturateur usuelles
// ---------------------------------------------------------------------------

/**
 * La pose retenue est arrondie à une valeur d'obturateur usuelle (§2.3) : un boîtier ne
 * propose pas 13,43 s, il propose 13 s.
 */
export const VALEURS_OBTURATEUR_S: readonly number[] = Object.freeze([
  1, 1.3, 1.6, 2, 2.5, 3.2, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 40, 50, 60, 90, 120, 180, 240,
])

// ---------------------------------------------------------------------------
// §7.3 — objectifs de qualité
// ---------------------------------------------------------------------------

export interface PresetSnr {
  readonly cle: string
  readonly libelle: string
  readonly valeur: number
}

export const PRESETS_SNR: readonly PresetSnr[] = Object.freeze(
  [
    { cle: 'APERCU', libelle: 'Aperçu', valeur: 5 },
    { cle: 'CORRECT', libelle: 'Correct', valeur: 10 },
    { cle: 'BON', libelle: 'Bon', valeur: 20 },
    { cle: 'EXCELLENT', libelle: 'Excellent', valeur: 30 },
  ].map(Object.freeze) as PresetSnr[],
)

// ---------------------------------------------------------------------------
// §7.4 — prescriptions de calibration
// ---------------------------------------------------------------------------

export interface PrescriptionCalibration {
  readonly type: 'FLATS' | 'DARKS' | 'OFFSETS'
  readonly min: number
  readonly max: number
  /** Nombre prescrit par défaut, à l'intérieur de la plage. */
  readonly defaut: number
  readonly consigne: string
}

/**
 * Ordonnées par importance décroissante, et c'est cet ordre qui est affiché : à f/2,8 sur
 * plein format, le vignettage atteint un à deux diaphragmes dans les coins — sans flats,
 * l'image garde un halo central que rien ne rattrape ensuite (§7.4).
 */
export const PRESCRIPTIONS_CALIBRATION: readonly PrescriptionCalibration[] = Object.freeze(
  [
    {
      type: 'FLATS',
      min: 20,
      max: 30,
      defaut: 25,
      consigne:
        'Même focale, même mise au point, même orientation, sans jamais démonter l’objectif. ' +
        'Exposition visant la moitié de la saturation. Ils corrigent le vignettage.',
    },
    {
      type: 'DARKS',
      min: 20,
      max: 50,
      defaut: 30,
      consigne:
        'Même durée, même ISO, même température de capteur. Sur un boîtier non régulé, les ' +
        'prendre en fin de session, capteur encore froid.',
    },
    {
      type: 'OFFSETS',
      min: 50,
      max: 100,
      defaut: 50,
      consigne:
        'Au temps de pose minimum, à l’ISO de session, obturateur fermé. Réutilisables tant ' +
        'que l’ISO ne change pas.',
    },
  ].map(Object.freeze) as PrescriptionCalibration[],
)

/** Amplitude du décalage inter-pose (§7.4). */
export const DITHERING_PX = Object.freeze({ min: 5, max: 15 })

// ---------------------------------------------------------------------------
// §10.2 — identification du facteur dominant
// ---------------------------------------------------------------------------

/**
 * Écart relatif en deçà duquel deux sensibilités sont tenues pour équivalentes : les deux
 * variables sont alors présentées conjointement, aucune n'est désignée arbitrairement.
 */
export const TOLERANCE_EGALITE_SENSIBILITE = 0.1

export type CodeLevier =
  | 'CHANGER_CIBLE'
  | 'CRENEAU'
  | 'SITE_PLUS_SOMBRE'
  | 'PLUS_DE_TEMPS'
  | 'FILTRE_DUAL_BAND'
  | 'FOCALE_DIFFERENTE'

export interface LevierCatalogue {
  readonly code: CodeLevier
  readonly libelle: string
  readonly gain: string
  readonly cout: string
}

/**
 * §10.2 — leviers hiérarchisés par coût CROISSANT. L'ordre du tableau est l'ordre affiché,
 * et c'est lui qui tient la règle : jamais l'achat en premier.
 */
export const CATALOGUE_LEVIERS: readonly LevierCatalogue[] = Object.freeze(
  [
    {
      code: 'CHANGER_CIBLE',
      libelle: 'Changer de cible',
      gain: 'immédiat',
      cout: 'nul',
    },
    {
      code: 'CRENEAU',
      libelle: 'Attendre un meilleur créneau',
      gain: 'modéré — cible plus haute, Lune couchée',
      cout: 'report de la session',
    },
    {
      code: 'SITE_PLUS_SOMBRE',
      libelle: 'Se déplacer vers un site plus sombre',
      gain: 'fort en large bande',
      cout: 'déplacement',
    },
    {
      code: 'PLUS_DE_TEMPS',
      libelle: 'Intégrer plus longtemps',
      gain: 'en racine du temps — quadrupler le temps double le rapport signal sur bruit',
      cout: 'temps de session',
    },
    {
      code: 'FILTRE_DUAL_BAND',
      libelle: 'Ajouter un filtre bi-bande',
      gain: 'fort, mais UNIQUEMENT sur les objets en émission',
      cout: 'achat',
    },
    {
      code: 'FOCALE_DIFFERENTE',
      libelle: 'Changer de focale',
      gain: 'sur le cadrage seulement',
      cout: 'achat',
    },
  ].map(Object.freeze) as LevierCatalogue[],
)
