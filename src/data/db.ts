/**
 * §12.1, §12.3 — Persistance locale sur IndexedDB.
 *
 * Deux natures de données, à ne pas confondre :
 *   - les paquets de catalogues et les vignettes d'objets sont retéléchargeables ;
 *   - les profils, sites, masques d'horizon édités et plans de session ne le sont pas.
 * C'est cette seconde catégorie que l'export JSON de `persistence.ts` doit protéger.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const NOM_BASE = 'astrofort'
/**
 * 2 — ajout du magasin `images` (§6.4). Une montée de version ne détruit rien : les magasins
 * existants traversent la mise à niveau, seul le nouveau est créé.
 */
export const VERSION_BASE = 2

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
  /**
   * Format de capteur et résolution saisis (§5.1, aucun boîtier ne se choisit dans une
   * liste) — le pitch s'en déduit, il ne se persiste pas séparément. Ne se retéléchargent
   * pas : sans eux dans l'export, un profil réimporté décrirait le capteur d'un autre
   * appareil (§12.3).
   */
  readonly formatCapteur: string
  readonly resolutionMpx?: number
  readonly readNoiseE?: number
  readonly seuilDoubleGainIso?: number
  readonly fullWellE?: number
  readonly zpSys?: number
  readonly tailleRawMo?: number
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

/**
 * §6.4 — l'image d'une cible, rangée par sa désignation.
 *
 * Les octets sont stockés, pas l'adresse : c'est ce qui rend l'image visible après la
 * coupure réseau (§12.5). `origine` et `credit` voyagent avec eux, sans quoi une image
 * relue du cache s'afficherait sans son attribution — donc sans le droit de s'afficher.
 *
 * Le crédit n'est jamais absent : une image encyclopédique dont l'auteur ou la licence n'a
 * pas pu être lu n'est pas rangée, et une découpe de relevé porte le crédit fixe du registre.
 * Une image relue sans crédit serait une image qu'on n'a pas le droit d'afficher.
 */
export interface ImageStockee {
  readonly designation: string
  readonly origine: 'ENCYCLOPEDIE' | 'RELEVE'
  readonly octets: Blob
  readonly credit: CreditImage
  /** Adresse d'où les octets viennent, pour pouvoir remonter à la source affichée. */
  readonly source: string
  readonly obtenueIso: string
}

export interface CreditImage {
  readonly auteur: string
  readonly licence: string
  readonly lien: string
}

interface AstrofortDB extends DBSchema {
  sites: { key: string; value: SiteEnregistre }
  profils: { key: string; value: ProfilMateriel }
  plans: { key: string; value: PlanEnregistre }
  paquets: { key: string; value: PaquetStocke }
  images: { key: string; value: ImageStockee }
  reglages: { key: string; value: unknown }
}

let instance: Promise<IDBPDatabase<AstrofortDB>> | null = null

export function db(): Promise<IDBPDatabase<AstrofortDB>> {
  instance ??= openDB<AstrofortDB>(NOM_BASE, VERSION_BASE, {
    upgrade(base) {
      // Chaque magasin est créé s'il manque : la mise à niveau depuis une base en version 1
      // doit ajouter `images` sans toucher aux profils, sites et plans déjà rangés (§12.3).
      const cree = (nom: 'sites' | 'profils' | 'plans' | 'paquets' | 'images', cle?: string) => {
        if (base.objectStoreNames.contains(nom)) return
        base.createObjectStore(nom, cle === undefined ? undefined : { keyPath: cle })
      }
      cree('sites', 'id')
      cree('profils', 'id')
      cree('plans', 'id')
      cree('paquets', 'nom')
      cree('images', 'designation')
      if (!base.objectStoreNames.contains('reglages')) base.createObjectStore('reglages')
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

export async function litImage(designation: string): Promise<ImageStockee | null> {
  return (await (await db()).get('images', designation)) ?? null
}

export async function ecritImage(image: ImageStockee): Promise<void> {
  await (await db()).put('images', image)
}
