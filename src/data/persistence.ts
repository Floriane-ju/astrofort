/**
 * §12.3 — Persistance du stockage et résistance à l'éviction.
 *
 * LE VOLUME N'EST PAS LE RISQUE. L'ÉVICTION EST LE RISQUE. Par défaut le stockage
 * navigateur est en « meilleur effort » : il peut être effacé sans avertissement sous
 * pression disque. Neuf mégaoctets de catalogues effacés en silence, c'est une application
 * vide au prochain démarrage hors réseau, sur le terrain, sans moyen de la recharger.
 *
 * Stratégie à trois étages :
 *   1. demander persist() dès la première visite, APRÈS la première action utile ;
 *   2. vérifier persisted() à chaque démarrage et avertir si le mode n'est pas accordé ;
 *   3. vérifier l'intégrité des catalogues au démarrage.
 */

import { db } from './db.ts'
import type { PlanEnregistre, ProfilMateriel, SiteEnregistre } from './db.ts'
import { type DomaineId, valide as valideDomaine } from '../registry/domains.ts'

export interface EtatStockage {
  readonly persistant: boolean
  readonly supporte: boolean
  readonly quotaMo: number | null
  readonly usageMo: number | null
  /** Renseigné quand le mode persistant n'est pas accordé. */
  readonly avertissement?: string
}

const OCTETS_PAR_MO = 1024 * 1024

const AVERTISSEMENT_NON_PERSISTANT =
  'Le stockage n’est pas en mode persistant : le navigateur peut effacer les catalogues ' +
  'et les données saisies sous pression disque, sans avertissement. Installer ' +
  'l’application améliore les chances d’obtenir ce mode. En attendant, exporter ses ' +
  'données protège ce qui ne se retélécharge pas.'

export async function etatStockage(): Promise<EtatStockage> {
  if (typeof navigator === 'undefined' || navigator.storage === undefined) {
    return {
      persistant: false,
      supporte: false,
      quotaMo: null,
      usageMo: null,
      avertissement:
        'Ce navigateur n’expose pas l’API de stockage persistant : l’état d’éviction ne ' +
        'peut pas être connu. Exporter ses données régulièrement.',
    }
  }
  const persistant = (await navigator.storage.persisted?.()) ?? false
  const estimation = (await navigator.storage.estimate?.()) ?? {}
  return {
    persistant,
    supporte: true,
    quotaMo: estimation.quota === undefined ? null : estimation.quota / OCTETS_PAR_MO,
    usageMo: estimation.usage === undefined ? null : estimation.usage / OCTETS_PAR_MO,
    ...(persistant ? {} : { avertissement: AVERTISSEMENT_NON_PERSISTANT }),
  }
}

/**
 * À n'appeler qu'après une première action utile de l'utilisateur : une demande non
 * motivée au chargement est refusée par réflexe (§12.3).
 */
export async function demandePersistance(): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) {
    return false
  }
  return navigator.storage.persist()
}

export interface ExportUtilisateur {
  readonly format: 'astrofort-export'
  readonly version: number
  readonly exporteLe: string
  readonly sites: readonly SiteEnregistre[]
  readonly profils: readonly ProfilMateriel[]
  readonly plans: readonly PlanEnregistre[]
}

export const VERSION_EXPORT = 1

/**
 * Export JSON manuel — obligatoire au MVP. Une éviction ne doit jamais détruire une donnée
 * que l'utilisateur a produite. Les paquets de catalogues en sont exclus : ils se
 * retéléchargent.
 */
export async function exporteDonneesUtilisateur(): Promise<ExportUtilisateur> {
  const base = await db()
  const [sites, profils, plans] = await Promise.all([
    base.getAll('sites'),
    base.getAll('profils'),
    base.getAll('plans'),
  ])
  return {
    format: 'astrofort-export',
    version: VERSION_EXPORT,
    exporteLe: new Date().toISOString(),
    sites,
    profils,
    plans,
  }
}

export class ExportInvalideError extends Error {
  constructor(raison: string) {
    super(`Fichier d’export inexploitable : ${raison}`)
    this.name = 'ExportInvalideError'
  }
}

/**
 * Un fichier d'export est une donnée étrangère, au même titre qu'une saisie : il a pu être
 * retouché à la main entre deux machines. Sans contrôle champ par champ, un
 * `latitudeDeg: "abc"` entre en base et ressort en `NaN` à chaque démarrage — persisté,
 * donc rejoué. Les plages sont celles du registre §2.1, jamais réécrites ici.
 *
 * Un vérificateur rend `null` quand le champ passe, sinon la raison du refus.
 */
type Verificateur = (valeur: unknown) => string | null

const texte: Verificateur = (v) =>
  typeof v === 'string' && v !== '' ? null : 'doit être une chaîne non vide'

const booleen: Verificateur = (v) => (typeof v === 'boolean' ? null : 'doit être un booléen')

/** `contenu` d'un plan : structure libre, produite et relue par l'application elle-même. */
const quelconque: Verificateur = (v) => (v === undefined ? 'est absent' : null)

function nombre(domaine?: DomaineId): Verificateur {
  return (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'doit être un nombre fini'
    if (domaine === undefined) return null
    try {
      valideDomaine(domaine, v)
      return null
    } catch (erreur) {
      return erreur instanceof Error ? erreur.message : 'est hors du domaine attendu'
    }
  }
}

function parmi(...valeurs: readonly string[]): Verificateur {
  return (v) =>
    typeof v === 'string' && valeurs.includes(v)
      ? null
      : `doit valoir ${valeurs.map((x) => `« ${x} »`).join(', ')}`
}

function optionnel(verifie: Verificateur): Verificateur {
  return (v) => (v === undefined ? null : verifie(v))
}

/** Le masque d'horizon est un tableau de 360 hauteurs, une par degré d'azimut (§4.1). */
const masqueHorizon: Verificateur = (v) => {
  if (!Array.isArray(v) || v.length !== 360) return 'doit être un tableau de 360 hauteurs'
  const hauteur = nombre('masque_horizon_deg')
  for (const [azimut, valeur] of v.entries()) {
    const raison = hauteur(valeur)
    if (raison !== null) return `à l’azimut ${azimut} : ${raison}`
  }
  return null
}

type Forme = Readonly<Record<string, Verificateur>>

const FORME_SITE: Forme = {
  id: texte,
  nom: texte,
  latitudeDeg: nombre('latitude_deg'),
  longitudeDeg: nombre('longitude_deg'),
  altitudeM: nombre('altitude_m'),
  fuseau: texte,
  sqmMesure: optionnel(nombre('sqm_mesure')),
  bortleDeclare: optionnel(nombre('bortle_declare')),
  masqueHorizon: optionnel(masqueHorizon),
  masqueEstHypothese: optionnel(booleen),
}

const FORME_PROFIL: Forme = {
  id: texte,
  nom: texte,
  focaleMm: nombre('focale_mm'),
  ouvertureN: nombre('ouverture_N'),
  typeObjectif: parmi('RECTILINEAIRE', 'FISHEYE'),
  boitierId: texte,
  capteurLMm: optionnel(nombre('capteur_mm')),
  capteurHMm: optionnel(nombre('capteur_mm')),
  pitchUm: optionnel(nombre('pitch_um')),
  readNoiseE: optionnel(nombre('read_noise_e')),
  seuilDoubleGainIso: optionnel(nombre('seuil_double_gain_iso')),
  fullWellE: optionnel(nombre('full_well_e')),
  zpSys: optionnel(nombre('zp_sys')),
  tailleRawMo: optionnel(nombre('taille_raw_mo')),
  autonomieCipa: optionnel(nombre('autonomie_cipa')),
  isoCapture: optionnel(nombre('iso_capture')),
  capteurMode: parmi('FULL_FRAME', 'APSC_CROP'),
  suiviActif: booleen,
  qualiteMes: optionnel(parmi('SOIGNEE', 'APPROX', 'INCONNUE')),
  typeMonture: optionnel(parmi('GEM', 'TRACKER', 'ALTAZ')),
}

const FORME_PLAN: Forme = {
  id: texte,
  nom: texte,
  dateIso: texte,
  siteId: texte,
  profilId: texte,
  versionRegistre: texte,
  contenu: quelconque,
}

/** Le refus nomme l'enregistrement fautif — par identifiant s'il en a un — et le champ. */
function valideEnregistrements(section: string, forme: Forme, elements: readonly unknown[]): void {
  for (const [index, element] of elements.entries()) {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) {
      throw new ExportInvalideError(`${section} n°${index + 1} n’est pas un objet`)
    }
    const enregistrement = element as Record<string, unknown>
    const identite =
      typeof enregistrement.id === 'string' && enregistrement.id !== ''
        ? `« ${enregistrement.id} »`
        : `n°${index + 1}`
    for (const [champ, verifie] of Object.entries(forme)) {
      const raison = verifie(enregistrement[champ])
      if (raison !== null) {
        throw new ExportInvalideError(`${section} ${identite}, champ « ${champ} » : ${raison}`)
      }
    }
  }
}

function valide(donnees: unknown): asserts donnees is ExportUtilisateur {
  if (typeof donnees !== 'object' || donnees === null) {
    throw new ExportInvalideError('le contenu n’est pas un objet JSON')
  }
  const candidat = donnees as Partial<ExportUtilisateur>
  if (candidat.format !== 'astrofort-export') {
    throw new ExportInvalideError('ce n’est pas un export Astrofort')
  }
  if (candidat.version !== VERSION_EXPORT) {
    throw new ExportInvalideError(
      `version ${String(candidat.version)} non prise en charge (attendu ${VERSION_EXPORT})`,
    )
  }
  for (const champ of ['sites', 'profils', 'plans'] as const) {
    if (!Array.isArray(candidat[champ])) {
      throw new ExportInvalideError(`la section « ${champ} » est absente ou malformée`)
    }
  }
  // Tout est vérifié AVANT la transaction : un fichier abîmé n'écrit rien, pas même à moitié.
  valideEnregistrements('le site', FORME_SITE, candidat.sites as readonly unknown[])
  valideEnregistrements('le profil', FORME_PROFIL, candidat.profils as readonly unknown[])
  valideEnregistrements('le plan', FORME_PLAN, candidat.plans as readonly unknown[])
}

/**
 * Point d'entrée du réimport depuis un fichier. Tout échec — JSON illisible compris — sort
 * en `ExportInvalideError`, dont le texte est rédigé pour être affiché tel quel.
 */
export async function importeFichierUtilisateur(texte: string): Promise<void> {
  let donnees: unknown
  try {
    donnees = JSON.parse(texte)
  } catch (erreur) {
    throw new ExportInvalideError(
      `le fichier n’est pas du JSON lisible (${erreur instanceof Error ? erreur.message : String(erreur)})`,
    )
  }
  await importeDonneesUtilisateur(donnees)
}

/** Réimport sans perte. Les entrées de même identifiant sont remplacées. */
export async function importeDonneesUtilisateur(donnees: unknown): Promise<void> {
  valide(donnees)
  const base = await db()
  const tx = base.transaction(['sites', 'profils', 'plans'], 'readwrite')
  await Promise.all([
    ...donnees.sites.map((site) => tx.objectStore('sites').put(site)),
    ...donnees.profils.map((profil) => tx.objectStore('profils').put(profil)),
    ...donnees.plans.map((plan) => tx.objectStore('plans').put(plan)),
    tx.done,
  ])
}
