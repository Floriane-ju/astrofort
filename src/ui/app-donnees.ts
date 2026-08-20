/**
 * §12 — les catalogues vérifiés et le sort de ce que l'utilisateur a saisi.
 *
 * Le catalogue n'est décodé qu'une fois les paquets vérifiés : un binaire corrompu ne doit
 * jamais alimenter un verdict (§12.2). L'export et l'import, eux, disent toujours ce qu'ils
 * ont fait — un rejet muet aurait l'air de ne rien faire (§12.3).
 */

import { useEffect, useState } from 'react'
import {
  chargeConstellations,
  chargeEtoiles,
  chargeObjetsCielProfond,
  demarre,
  type EtatDemarrage,
} from '../data/bootstrap.ts'
import { PAQUET_VIDE, type PaquetConstellations } from '../data/constellations.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Etoile } from '../data/catalog.ts'
import {
  demandePersistance,
  enregistreSiteActif,
  exporteDonneesUtilisateur,
  importeFichierUtilisateur,
  litPointsMasqueActif,
  type SiteAExporter,
} from '../data/persistence.ts'
import type { PointMasque } from '../core/site.ts'
import { CRITERES_SCORING, type SaisiePoids } from './app-saisie.ts'

export interface Catalogues {
  readonly etat: EtatDemarrage | null
  readonly objets: readonly ObjetCielProfond[]
  readonly etoiles: readonly Etoile[]
  readonly constellations: PaquetConstellations
}

export function useCatalogues(): Catalogues {
  const [etat, setEtat] = useState<EtatDemarrage | null>(null)
  const [objets, setObjets] = useState<readonly ObjetCielProfond[]>([])
  const [etoiles, setEtoiles] = useState<readonly Etoile[]>([])
  const [constellations, setConstellations] = useState<PaquetConstellations>(PAQUET_VIDE)

  useEffect(() => {
    void demarre()
      .then(setEtat)
      .then(chargeObjetsCielProfond)
      .then(setObjets)
      .then(chargeEtoiles)
      .then(setEtoiles)
      .then(chargeConstellations)
      .then(setConstellations)
  }, [])

  return { etat, objets, etoiles, constellations }
}

export interface Persistance {
  readonly message: string | null
  readonly surExport: () => void
  readonly surImport: (fichier: File) => void
}

/**
 * Le site n'est enregistré qu'au moment de l'export, pas à chaque frappe : c'est là que
 * l'utilisateur demande à protéger sa saisie, et l'échec y a un endroit pour s'afficher.
 */
export function usePersistance(
  siteActif: SiteAExporter,
  surMasqueImporte: (points: readonly PointMasque[]) => void,
  poids: SaisiePoids,
): Persistance {
  const [message, setMessage] = useState<string | null>(null)

  async function exporte(): Promise<void> {
    await enregistreSiteActif(siteActif)
    const donnees = await exporteDonneesUtilisateur(poids.poids)
    const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(blob)
    lien.download = `astrofort-${donnees.exporteLe.slice(0, 10)}.json`
    lien.click()
    URL.revokeObjectURL(lien.href)
    // Première action utile accomplie : c'est le moment de demander la persistance (§12.3).
    const accorde = await demandePersistance()
    setMessage(
      accorde
        ? 'Stockage persistant accordé : les données résistent désormais à la pression disque.'
        : 'Stockage persistant refusé. Installer l’application améliore les chances de l’obtenir ; ' +
            'en attendant, conserver l’export.',
    )
  }

  async function importe(fichier: File): Promise<void> {
    // Un fichier retouché ou illisible doit dire pourquoi il est refusé, pas disparaître
    // en rejet non géré : sans message, l'import a l'air de ne rien faire (§12.3).
    try {
      const poidsImportes = await importeFichierUtilisateur(await fichier.text())
      // Le masque restauré doit revenir à l'écran : il commande les créneaux (§8.1).
      surMasqueImporte(await litPointsMasqueActif())
      // Les poids ne vivent pas en base : sans cette remise, un plan réimporté serait
      // réordonné par les valeurs C-15 plutôt que par celles du fichier (§8.3).
      if (poidsImportes !== null) {
        for (const critere of CRITERES_SCORING) poids.surPoids(critere, poidsImportes[critere])
      }
      setMessage('Import terminé : les sites, profils et plans ont été restaurés.')
    } catch (erreur) {
      setMessage(
        erreur instanceof Error
          ? `Import abandonné, rien n’a été modifié. ${erreur.message}`
          : 'Import abandonné, rien n’a été modifié : cause inconnue.',
      )
    }
  }

  return {
    message,
    surExport: () => void exporte(),
    surImport: (fichier) => void importe(fichier),
  }
}
