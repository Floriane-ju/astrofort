/**
 * §12.1, §12.2, §12.3 — Démarrage de l'application.
 *
 * Trois vérifications, dans cet ordre : capacités de rendu, intégrité des catalogues,
 * état du stockage. Aucune ne doit produire un écran blanc ni une erreur technique brute :
 * chaque échec a une cause nommée et une conduite à tenir.
 */

import { ecritPaquet, litPaquet } from './db.ts'
import type { IntegritePaquet, ManifestePaquet } from './catalog.ts'
import { verifieIntegrite } from './catalog.ts'
import { decodeObjets, type ObjetCielProfond } from './deepsky.ts'
import { modeReseauCourant, type ModeReseau } from './degradation.ts'
import { etatStockage, type EtatStockage } from './persistence.ts'

export const CHEMIN_MANIFESTE = '/data/manifest.json'

export interface CapacitesRendu {
  readonly webgl2: boolean
  /** Renseigné quand WebGL 2 manque : les fonctions concernées et la cause. */
  readonly cause?: string
}

const CAUSE_SANS_WEBGL2 =
  'WebGL 2 n’est pas disponible sur ce navigateur : le planétarium (§3) et les ' +
  'prévisualisations de champ et de filé (§9) sont désactivés. Les moteurs de ' +
  'faisabilité, de pose et de planification (§6, §7, §8) restent pleinement utilisables.'

export function detecteWebGL2(): CapacitesRendu {
  if (typeof document === 'undefined') return { webgl2: false, cause: CAUSE_SANS_WEBGL2 }
  try {
    const canvas = document.createElement('canvas')
    const contexte = canvas.getContext('webgl2')
    return contexte === null ? { webgl2: false, cause: CAUSE_SANS_WEBGL2 } : { webgl2: true }
  } catch {
    return { webgl2: false, cause: CAUSE_SANS_WEBGL2 }
  }
}

export interface EtatPaquet {
  readonly manifeste: ManifestePaquet
  readonly integrite: IntegritePaquet
}

export interface EtatCatalogues {
  readonly paquets: readonly EtatPaquet[]
  readonly manifesteLu: boolean
  /** Conduite à tenir quand un paquet obligatoire manque ou est corrompu. */
  readonly cause?: string
}

async function chargeManifeste(): Promise<readonly ManifestePaquet[] | null> {
  try {
    const reponse = await fetch(CHEMIN_MANIFESTE)
    if (!reponse.ok) return null
    return (await reponse.json()) as ManifestePaquet[]
  } catch {
    return null
  }
}

/**
 * Récupère un paquet depuis IndexedDB ; à défaut le télécharge, vérifie sa somme de
 * contrôle et le range. Un paquet dont l'empreinte ne correspond pas n'est jamais servi.
 */
async function resoudPaquet(manifeste: ManifestePaquet): Promise<EtatPaquet> {
  const local = await litPaquet(manifeste.nom)
  const integriteLocale = await verifieIntegrite(local, manifeste)
  if (integriteLocale === 'OK') return { manifeste, integrite: 'OK' }

  if (modeReseauCourant() === 'HORS_LIGNE') {
    return { manifeste, integrite: integriteLocale }
  }

  try {
    const reponse = await fetch(`/data/${manifeste.nom}-${manifeste.version}.bin`)
    if (!reponse.ok) return { manifeste, integrite: integriteLocale }
    const donnees = await reponse.arrayBuffer()
    const integrite = await verifieIntegrite(donnees, manifeste)
    if (integrite !== 'OK') return { manifeste, integrite: 'CORROMPU' }
    await ecritPaquet({ nom: manifeste.nom, version: manifeste.version, donnees })
    return { manifeste, integrite: 'OK' }
  } catch {
    return { manifeste, integrite: integriteLocale }
  }
}

export async function verifieCatalogues(): Promise<EtatCatalogues> {
  const manifestes = await chargeManifeste()
  if (manifestes === null) {
    return {
      paquets: [],
      manifesteLu: false,
      cause:
        'Le manifeste des paquets de données est introuvable. Exécuter `pnpm data:build` ' +
        'pour générer les catalogues, ou recharger la page une fois le réseau revenu.',
    }
  }

  const paquets = await Promise.all(manifestes.map(resoudPaquet))
  const manquants = paquets.filter(
    (p) => p.manifeste.obligatoire && p.integrite !== 'OK',
  )
  if (manquants.length === 0) return { paquets, manifesteLu: true }

  const noms = manquants.map((p) => p.manifeste.nom).join(', ')
  const horsLigne = modeReseauCourant() === 'HORS_LIGNE'
  return {
    paquets,
    manifesteLu: true,
    cause: horsLigne
      ? `Catalogues absents ou corrompus (${noms}) et aucun réseau disponible. Les ` +
        'fonctions qui en dépendent sont indisponibles ; elles seront rechargées dès le ' +
        'retour du réseau. Les calculs de temps et de fond de ciel restent utilisables.'
      : `Catalogues absents ou corrompus (${noms}). Le rechargement a échoué : réessayer, ` +
        'ou régénérer les paquets avec `pnpm data:build`.',
  }
}

export const PAQUET_OBJETS = 'openngc'
export const PAQUET_NOMS_OBJETS = 'openngc-noms'

/**
 * Catalogue d'objets du ciel profond décodé depuis les paquets rangés par `demarre()`.
 * Retourne une liste vide quand les paquets manquent : la cause est déjà nommée par
 * `verifieCatalogues()`, et les moteurs §6 et §7 restent utilisables sur une cible saisie
 * à la main (§12.5).
 */
export async function chargeObjetsCielProfond(): Promise<readonly ObjetCielProfond[]> {
  const [enregistrements, chaines] = await Promise.all([
    litPaquet(PAQUET_OBJETS),
    litPaquet(PAQUET_NOMS_OBJETS),
  ])
  if (enregistrements === null || chaines === null) return []
  return decodeObjets({ enregistrements, chaines })
}

export interface EtatDemarrage {
  readonly modeReseau: ModeReseau
  readonly rendu: CapacitesRendu
  readonly catalogues: EtatCatalogues
  readonly stockage: EtatStockage
}

export async function demarre(): Promise<EtatDemarrage> {
  const [catalogues, stockage] = await Promise.all([verifieCatalogues(), etatStockage()])
  return {
    modeReseau: modeReseauCourant(),
    rendu: detecteWebGL2(),
    catalogues,
    stockage,
  }
}
