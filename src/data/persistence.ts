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
