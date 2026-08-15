/**
 * §7.5 — Conseil filtre contextuel, et §10.3 — recommandation d'équipement.
 *
 * Une seule règle gouverne tout le module : L'APPLICATION NE VEND RIEN. Elle nomme une
 * CATÉGORIE d'équipement et chiffre le gain par les moteurs existants. Jamais de marque,
 * jamais de modèle, jamais de prix, jamais de bandeau, jamais de suggestion spontanée en
 * liste de cibles.
 *
 * Quatre conditions cumulatives, sans exception (§10.3) :
 *   1. un verdict est défavorable ;
 *   2. l'équipement absent est le facteur dominant identifié en §10.2 ;
 *   3. les leviers de coût inférieur ont été présentés d'abord ;
 *   4. l'utilisateur a déplié l'explication.
 *
 * Et une interdiction : un équipement dont le gain n'est pas calculable par les moteurs
 * existants n'est JAMAIS recommandé. Pas de « un meilleur capteur donnerait de plus belles
 * images » — non chiffrable, donc hors périmètre.
 */

import { K } from '../registry/constants.ts'
import { ligneFiltre, TYPES_EN_EMISSION, type FamilleFiltre } from '../registry/filters.ts'
import type { VerdictCadrage } from '../registry/verdicts.ts'
import type { TypeObjet } from '../data/deepsky.ts'
import { dureeLisible, integrationRequiseS } from './exposure.ts'
import type { Traced } from './traced.ts'
import { trace } from './traced.ts'

export type CategorieEquipement =
  | 'FILTRE_DUAL_BAND'
  | 'FOCALE_PLUS_LONGUE'
  | 'FOCALE_PLUS_COURTE'
  | 'MONTURE_SUIVI'
  | 'AUTOGUIDAGE'

export interface Recommandation {
  readonly categorie: CategorieEquipement
  readonly libelle: string
  /** Différentiel calculé, jamais un gain qualitatif : « sans X — avec Y — rapport Z ». */
  readonly sans: string
  readonly avec: string
  readonly rapport: number
  readonly explication: string
}

// ---------------------------------------------------------------------------
// §7.5 — conseil filtre
// ---------------------------------------------------------------------------

export interface EntreeConseilFiltre {
  readonly typeObjet: TypeObjet
  readonly filtresPossedes: readonly FamilleFiltre[]
  readonly bortle: number | null
  /** Dégradation du fond de ciel par la Lune (§8.1), en mag/arcsec². */
  readonly deltaSbLuneMag: number
  readonly cadragePlanifiable: boolean
  readonly explicationDepliee: boolean
  readonly eObj: number
  readonly eCiel: number
  readonly tPoseS: number
  readonly readNoiseE: number
  readonly snrCible: number
  readonly tailleRawMo: number
}

export interface ConseilFiltre {
  readonly declenche: boolean
  readonly tRequisSansS: number
  readonly tRequisAvecS: number | null
  readonly gainSnr: number | null
  readonly fractionTransmise: Traced<number> | null
  readonly message: string
}

/** Part du fond de ciel que laisse passer une famille de filtres. */
export function fractionFondDeCielTransmise(famille: FamilleFiltre): Traced<number> {
  const ligne = ligneFiltre(famille)
  const somme = ligne.bandesNm.reduce((total, bande) => total + bande, 0)
  const fraction = somme === 0 ? 1 : somme / K('LARGEUR_BANDE_LARGE_NM')
  return trace({
    value: fraction,
    formula: 'TRANSMISSION_FOND_DE_CIEL',
    inputs: { bandes_nm: somme },
    constants: ['LARGEUR_BANDE_LARGE_NM'],
    note: ligne.note,
  })
}

/**
 * Déclenchement conditionnel strict, jamais de bandeau. Sur une galaxie, une nébuleuse par
 * réflexion, un amas ou une nébuleuse obscure, le conseil n'est jamais émis : ces objets
 * émettent en spectre continu, et le filtre à bande étroite coupe leur signal aussi.
 */
export function conseilFiltre(entree: EntreeConseilFiltre): ConseilFiltre {
  const base = {
    eObj: entree.eObj,
    eCiel: entree.eCiel,
    tPoseS: entree.tPoseS,
    readNoiseE: entree.readNoiseE,
    snrCible: entree.snrCible,
    tailleRawMo: entree.tailleRawMo,
  }
  const tSans = integrationRequiseS(base, entree.snrCible)
  const rien = {
    declenche: false,
    tRequisSansS: tSans,
    tRequisAvecS: null,
    gainSnr: null,
    fractionTransmise: null,
  }

  if (!TYPES_EN_EMISSION.includes(entree.typeObjet)) {
    return {
      ...rien,
      message:
        'Aucun conseil filtre sur cet objet : il émet en spectre continu, et un filtre à ' +
        'bande étroite couperait son signal autant que le fond de ciel. Seuls un ciel plus ' +
        'noir ou plus de temps d’intégration aideront ici.',
    }
  }
  if (entree.filtresPossedes.includes('DUAL_BAND')) {
    return {
      ...rien,
      message:
        'Filtre bi-bande déjà déclaré au profil : il est intégré au calcul du fond de ciel, ' +
        'et n’est plus proposé.',
    }
  }
  const cielDegrade =
    entree.deltaSbLuneMag > 0 ||
    (entree.bortle !== null && entree.bortle >= K('BORTLE_SEUIL_CONSEIL_FILTRE'))
  if (!cielDegrade || !entree.cadragePlanifiable) {
    return {
      ...rien,
      message:
        'Le fond de ciel n’est pas le facteur limitant ici : aucun conseil filtre n’est émis.',
    }
  }
  if (!entree.explicationDepliee) {
    return {
      ...rien,
      message:
        'Conseil disponible dans l’explication du verdict : rien n’est affiché tant qu’elle ' +
        'n’est pas dépliée.',
    }
  }

  const fraction = fractionFondDeCielTransmise('DUAL_BAND')
  const tAvec = integrationRequiseS({ ...base, eCiel: entree.eCiel * fraction.value }, entree.snrCible)
  const gain = Math.sqrt(entree.eCiel / (entree.eCiel * fraction.value))

  return {
    declenche: true,
    tRequisSansS: tSans,
    tRequisAvecS: tAvec,
    gainSnr: gain,
    fractionTransmise: fraction,
    message:
      'Un filtre bi-bande ne transmet que Hα et OIII, deux raies d’émission étroites. Il ' +
      'rejette l’essentiel du fond de ciel — pollution lumineuse comme Lune — tout en ' +
      `conservant le signal de la nébuleuse. Sans filtre : ${dureeLisible(tSans)} ` +
      `d’intégration. Avec : ${dureeLisible(tAvec)}, soit un rapport de ` +
      `${(tSans / tAvec).toFixed(1)} sur le temps et de ${gain.toFixed(1)} sur le rapport ` +
      'signal sur bruit. La cible reste planifiable sans filtre : dégradée, pas refusée.',
  }
}

// ---------------------------------------------------------------------------
// §10.3 — recommandation d'équipement
// ---------------------------------------------------------------------------

export interface EntreeRecommandations {
  readonly conseilFiltre: ConseilFiltre
  readonly verdictDefavorable: boolean
  readonly explicationDepliee: boolean
  /** Leviers de coût inférieur déjà présentés à l'utilisateur (§10.3, condition 3). */
  readonly leviersPresentes: readonly string[]
  readonly verdictCadrage: VerdictCadrage
  readonly focaleActuelleMm: number
  readonly focaleIdealeMm: number | null
  readonly nTuiles: number | null
  /** Vrai quand la monture bride la pose avant la physique (§7.2). */
  readonly regimeLimiteSuivi: boolean
  readonly suiviActif: boolean
  readonly tOptS: number
  readonly tMaxSuiviS: number | null
}

export interface SortieRecommandations {
  readonly recommandations: readonly Recommandation[]
  readonly message: string
  /** Vrai tant que les conditions cumulatives ne sont pas réunies : rien n'est affiché. */
  readonly silencieux: boolean
}

export function recommandationsEquipement(
  entree: EntreeRecommandations,
): SortieRecommandations {
  if (!entree.explicationDepliee) {
    return {
      recommandations: [],
      silencieux: true,
      message:
        'Aucune recommandation d’équipement tant que l’explication du verdict n’est pas ' +
        'dépliée : jamais de bandeau, jamais de suggestion en liste de cibles.',
    }
  }
  if (!entree.verdictDefavorable) {
    return {
      recommandations: [],
      silencieux: true,
      message: 'Le verdict est favorable : aucun équipement n’est recommandé.',
    }
  }
  if (entree.leviersPresentes.length === 0) {
    return {
      recommandations: [],
      silencieux: true,
      message:
        'Les leviers de coût inférieur — changer de cible, attendre un meilleur créneau, un ' +
        'site plus sombre, plus de temps — sont présentés avant toute recommandation d’achat.',
    }
  }

  const recommandations: Recommandation[] = []

  const filtre = entree.conseilFiltre
  if (filtre.declenche && filtre.tRequisAvecS !== null && filtre.gainSnr !== null) {
    recommandations.push({
      categorie: 'FILTRE_DUAL_BAND',
      libelle: 'Filtre bi-bande Hα / OIII',
      sans: dureeLisible(filtre.tRequisSansS),
      avec: dureeLisible(filtre.tRequisAvecS),
      rapport: filtre.tRequisSansS / filtre.tRequisAvecS,
      explication: filtre.message,
    })
  }

  if (
    (entree.verdictCadrage === 'CADRAGE_PERDU' || entree.verdictCadrage === 'HORS_DOMAINE') &&
    entree.focaleIdealeMm !== null
  ) {
    recommandations.push({
      categorie: 'FOCALE_PLUS_LONGUE',
      libelle: 'Focale plus longue',
      sans: `${entree.focaleActuelleMm.toFixed(0)} mm`,
      avec: `${entree.focaleIdealeMm.toFixed(0)} mm`,
      rapport: entree.focaleIdealeMm / entree.focaleActuelleMm,
      explication:
        `À ${entree.focaleActuelleMm.toFixed(0)} mm la cible est noyée dans le champ. La focale ` +
        `qui la cadrerait au remplissage visé est de ${entree.focaleIdealeMm.toFixed(0)} mm. ` +
        'Recadrer au traitement n’ajoute aucun pixel : seule la focale change le diamètre en ' +
        'pixels.',
    })
  }

  if (
    entree.verdictCadrage === 'MOSAIQUE_REQUISE' &&
    entree.nTuiles !== null &&
    entree.nTuiles > K('TUILES_SEUIL_FOCALE_COURTE')
  ) {
    recommandations.push({
      categorie: 'FOCALE_PLUS_COURTE',
      libelle: 'Focale plus courte',
      sans: `${entree.nTuiles} tuiles`,
      avec: '1 tuile',
      rapport: entree.nTuiles,
      explication:
        `La mosaïque demande ${entree.nTuiles} tuiles, donc ${entree.nTuiles} fois le temps ` +
        'de session d’une cible unique. Une focale plus courte ramène la cible dans un seul ' +
        'cadre.',
    })
  }

  if (!entree.suiviActif && entree.tMaxSuiviS !== null && entree.tOptS > entree.tMaxSuiviS) {
    recommandations.push({
      categorie: 'MONTURE_SUIVI',
      libelle: 'Monture de suivi',
      sans: `${entree.tMaxSuiviS.toFixed(1)} s de pose`,
      avec: `${entree.tOptS.toFixed(1)} s de pose`,
      rapport: entree.tOptS / entree.tMaxSuiviS,
      explication:
        'Sans suivi, la pose est bridée par la rotation du ciel bien avant l’optimum ' +
        'photométrique : le bruit de lecture domine. Une monture de suivi rend accessible la ' +
        'pose optimale, et avec elle les cibles faibles aujourd’hui hors de portée.',
    })
  }

  if (
    entree.suiviActif &&
    entree.regimeLimiteSuivi &&
    entree.tMaxSuiviS !== null &&
    entree.tMaxSuiviS >= K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S')
  ) {
    recommandations.push({
      categorie: 'AUTOGUIDAGE',
      libelle: 'Autoguidage',
      sans: `${entree.tMaxSuiviS.toFixed(0)} s de pose`,
      avec: `au-delà de ${K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S')} s`,
      rapport: entree.tOptS / entree.tMaxSuiviS,
      explication:
        `La pose est au plafond de ${K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S')} s tenable sans ` +
        'autoguidage, malgré une mise en station soignée. C’est l’autoguidage, et lui seul, ' +
        'qui lève ce plafond.',
    })
  }

  return {
    recommandations,
    silencieux: recommandations.length === 0,
    message:
      recommandations.length === 0
        ? 'Aucun équipement dont le gain soit calculable par les moteurs existants ne ' +
          'changerait ce verdict. Rien n’est recommandé : un gain non chiffrable est hors ' +
          'périmètre.'
        : 'Chaque recommandation nomme une catégorie et chiffre son gain par un différentiel ' +
          'calculé. Aucune marque, aucun modèle, aucun prix.',
  }
}
