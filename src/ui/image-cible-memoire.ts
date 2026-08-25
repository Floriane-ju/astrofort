/**
 * §6.4 — la mémoire de session des images de cibles, et le crochet qui la lit.
 *
 * Elle existe pour une raison de coût, pas de confort. La liste du catalogue rend jusqu'à
 * deux cents lignes et se refiltre à chaque frappe : une lecture d'IndexedDB par ligne et par
 * rendu rendrait la recherche inutilisable. Une image lue une fois reste donc adressable en
 * mémoire pour la durée de la session, et le rendu d'une ligne redevient synchrone.
 *
 * Les adresses `blob:` ne sont pas révoquées : elles vivent aussi longtemps que la session, et
 * c'est ce qui rend instantané le retour sur une cible déjà vue. Le volume est borné par le
 * nombre de cibles CONSULTÉES, pas par la taille du catalogue.
 *
 * ponytail: mémoire non bornée, à la vue près. Un plafond LRU s'imposerait le jour où une
 * session consulterait des milliers de cibles — ce n'est pas le geste d'un préparateur de
 * séance, qui en ouvre quelques dizaines.
 */

import { useEffect, useState } from 'react'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { ImageStockee } from '../data/db.ts'
import {
  champApercuCadreDeg,
  cleApercuCadre,
  imageEnCache,
  resoudApercuCadre,
  resoudImage,
} from '../data/imagerie-cible.ts'

export interface ImageAffichable {
  readonly image: ImageStockee
  /** Adresse `blob:` — c'est elle qui dispense `img-src` de nommer un hôte tiers. */
  readonly url: string
}

/**
 * `CACHE` ne touche jamais au réseau : c'est la portée de la liste, où le défilement ne doit
 * rien demander. `RESEAU` est celle de la fiche, où la cible a été choisie.
 */
export type PorteeImage = 'CACHE' | 'RESEAU'

/** Les images trouvées. Positives seulement : une absence n'a pas la même durée de validité. */
const trouvees = new Map<string, ImageAffichable>()

/** Les cibles dont on sait qu'elles ne sont pas en cache. Ne concerne que la portée `CACHE`. */
const absentesDuCache = new Set<string>()

function retient(image: ImageStockee): ImageAffichable {
  const connue = trouvees.get(image.designation)
  if (connue !== undefined) return connue
  const affichable: ImageAffichable = { image, url: URL.createObjectURL(image.octets) }
  trouvees.set(image.designation, affichable)
  absentesDuCache.delete(image.designation)
  return affichable
}

/** Ce que la mémoire sait déjà, sans rien demander. `undefined` : elle ne sait pas encore. */
function dejaSu(designation: string, portee: PorteeImage): ImageAffichable | null | undefined {
  const trouvee = trouvees.get(designation)
  if (trouvee !== undefined) return trouvee
  if (portee === 'CACHE' && absentesDuCache.has(designation)) return null
  return undefined
}

/**
 * L'image d'une cible, ou `null` tant qu'il n'y en a pas — et il se peut qu'il n'y en ait
 * jamais. Aucun état d'erreur n'est exposé : une cible sans image est une cible complète
 * (§12.5), et distinguer « pas encore » de « jamais » à l'écran ferait passer un agrément
 * visuel manquant pour une panne.
 */
export function useImageCible(
  objet: ObjetCielProfond | null,
  portee: PorteeImage,
): ImageAffichable | null {
  const designation = objet?.designation ?? ''
  const [affichable, setAffichable] = useState<ImageAffichable | null>(
    () => dejaSu(designation, portee) ?? null,
  )

  useEffect(() => {
    if (objet === null) {
      setAffichable(null)
      return
    }

    const su = dejaSu(objet.designation, portee)
    if (su !== undefined) {
      setAffichable(su)
      return
    }

    let vivant = true
    setAffichable(null)
    const demande = portee === 'CACHE' ? imageEnCache(objet.designation) : resoudImage(objet)
    void demande.then((image) => {
      if (image === null) {
        if (portee === 'CACHE') absentesDuCache.add(objet.designation)
        return
      }
      const retenue = retient(image)
      if (vivant) setAffichable(retenue)
    })
    return () => {
      vivant = false
    }
  }, [objet, designation, portee])

  return affichable
}

/**
 * §6.2 — l'aperçu de cadrage. Même mémoire, autre clé : elle porte le champ, donc le matériel.
 * Changer de focale redemande la vue, et la vignette de §6.4 — rangée sous la désignation nue —
 * n'en est pas affectée.
 */
export function useApercuCadre(
  objet: ObjetCielProfond | null,
  fovLDeg: number,
): ImageAffichable | null {
  const cle = objet === null ? '' : cleApercuCadre(objet.designation, champApercuCadreDeg(fovLDeg))
  const [affichable, setAffichable] = useState<ImageAffichable | null>(
    () => trouvees.get(cle) ?? null,
  )

  useEffect(() => {
    if (objet === null) {
      setAffichable(null)
      return
    }
    const connue = trouvees.get(cle)
    if (connue !== undefined) {
      setAffichable(connue)
      return
    }

    let vivant = true
    setAffichable(null)
    void resoudApercuCadre(objet, fovLDeg).then((image) => {
      if (image === null) return
      const retenue = retient(image)
      if (vivant) setAffichable(retenue)
    })
    return () => {
      vivant = false
    }
  }, [objet, fovLDeg, cle])

  return affichable
}

/** Vide la mémoire — réservé aux tests, qui partagent le module d'une assertion à l'autre. */
export function oublieImages(): void {
  for (const { url } of trouvees.values()) URL.revokeObjectURL(url)
  trouvees.clear()
  absentesDuCache.clear()
}
