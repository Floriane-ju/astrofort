/**
 * §12.1, §12.3 — Persistance locale sur IndexedDB.
 *
 * Deux natures de données, à ne pas confondre :
 *   - les paquets de catalogues sont retéléchargeables ;
 *   - les profils, sites, masques d'horizon édités et plans de session ne le sont pas.
 * C'est cette seconde catégorie que l'export JSON de `persistence.ts` doit protéger.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const NOM_BASE = 'astrofort'
export const VERSION_BASE = 1

export interface SiteEnregistre {
  readonly id: string
  readonly nom: string
  readonly latitudeDeg: number
  readonly longitudeDeg: number
  readonly altitudeM: number
  readonly fuseau: string
  readonly sqmMesure?: number
  readonly bortleDeclare?: number
  /** 360 valeurs, une par degré d'azimut. Absent tant que le relief n'est pas connu. */
  readonly masqueHorizon?: readonly number[]
  /** Vrai quand le masque est le repli plat à 0°, faute de donnée de relief (§4.1). */
  readonly masqueEstHypothese?: boolean
  /**
   * Les relevés dont les 360 valeurs sont interpolées (§4.1). Ils sont conservés à côté du
   * masque parce qu'eux seuls se ré-éditent : reconstruire les crêtes depuis le profil
   * interpolé rendrait une liste que l'utilisateur n'a pas saisie.
   */
  readonly masquePoints?: readonly { readonly azimutDeg: number; readonly altitudeDeg: number }[]
}

export interface ProfilMateriel {
  readonly id: string
  readonly nom: string
  readonly focaleMm: number
  readonly ouvertureN: number
  readonly typeObjectif: 'RECTILINEAIRE' | 'FISHEYE'
  /** Identifiant de la base matériel, ou `custom` quand le boîtier est saisi (§5.1). */
  readonly boitierId: string
  /**
   * Grandeurs du boîtier saisi à la main. Elles ne se retéléchargent pas : sans elles dans
   * l'export, un profil `custom` réimporté décrirait le capteur d'un autre appareil (§12.3).
   */
  readonly capteurLMm?: number
  readonly capteurHMm?: number
  readonly pitchUm?: number
  readonly readNoiseE?: number
  readonly seuilDoubleGainIso?: number
  readonly fullWellE?: number
  readonly zpSys?: number
  readonly tailleRawMo?: number
  readonly autonomieCipa?: number
  /** §7.2 — ISO de capture retenu, quand il n'est pas celui du seuil de double gain. */
  readonly isoCapture?: number
  readonly capteurMode: 'FULL_FRAME' | 'APSC_CROP'
  readonly suiviActif: boolean
  readonly qualiteMes?: 'SOIGNEE' | 'APPROX' | 'INCONNUE'
  readonly typeMonture?: 'GEM' | 'TRACKER' | 'ALTAZ'
}

export interface PlanEnregistre {
  readonly id: string
  readonly nom: string
  readonly dateIso: string
  readonly siteId: string
  readonly profilId: string
  /**
   * Version du registre §2.1 ayant produit ce plan. Une mise à jour du registre déclenche
   * un recalcul, jamais une conservation avec les anciennes valeurs (§2.1).
   */
  readonly versionRegistre: string
  readonly contenu: unknown
}

export interface PaquetStocke {
  readonly nom: string
  readonly version: string
  readonly donnees: ArrayBuffer
}

interface AstrofortDB extends DBSchema {
  sites: { key: string; value: SiteEnregistre }
  profils: { key: string; value: ProfilMateriel }
  plans: { key: string; value: PlanEnregistre }
  paquets: { key: string; value: PaquetStocke }
  reglages: { key: string; value: unknown }
}

let instance: Promise<IDBPDatabase<AstrofortDB>> | null = null

export function db(): Promise<IDBPDatabase<AstrofortDB>> {
  instance ??= openDB<AstrofortDB>(NOM_BASE, VERSION_BASE, {
    upgrade(base) {
      base.createObjectStore('sites', { keyPath: 'id' })
      base.createObjectStore('profils', { keyPath: 'id' })
      base.createObjectStore('plans', { keyPath: 'id' })
      base.createObjectStore('paquets', { keyPath: 'nom' })
      base.createObjectStore('reglages')
    },
  })
  return instance
}

export async function litPaquet(nom: string): Promise<ArrayBuffer | null> {
  const enregistrement = await (await db()).get('paquets', nom)
  return enregistrement?.donnees ?? null
}

export async function ecritPaquet(paquet: PaquetStocke): Promise<void> {
  await (await db()).put('paquets', paquet)
}
