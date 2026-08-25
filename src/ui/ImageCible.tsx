/**
 * §6.4 — l'image d'une cible : la vue de la fiche, et la vignette de la liste.
 *
 * Deux composants pour deux portées, et la différence n'est pas cosmétique. La fiche a le
 * droit de demander l'image au réseau : la cible y a été choisie. La liste ne l'a pas — deux
 * cents lignes qui se refiltrent à chaque frappe feraient du défilement une rafale de
 * requêtes, et le service répondrait 429. La vignette de liste ne montre donc que ce qui est
 * déjà là.
 *
 * L'attribution n'est pas une mention légale posée en petit : c'est la condition d'usage d'un
 * fichier sous licence libre. Elle est visible sans interaction, et une image dont l'auteur
 * n'a pas pu être lu n'arrive jamais jusqu'ici — le résolveur l'a écartée (§6.4).
 *
 * Aucune absence n'est signalée. Une cible sans image reste une cible complète : sa
 * désignation et son type sont déjà à l'écran, et §12.5 dit que l'imagerie qui tombe se
 * signale sans être présentée comme une erreur.
 */

import type { ObjetCielProfond } from '../data/deepsky.ts'
import { useImageCible } from './image-cible-memoire.ts'
import { LIBELLE_TYPE_OBJET, nomCommun } from './libelles-objet.ts'

/**
 * L'alternative textuelle décrit l'OBJET, pas le média : « image de M31 » n'apprend rien à qui
 * ne voit pas l'image, alors que « M31, galaxie d'Andromède — galaxie » dit ce qui est là.
 */
export function alternativeCible(objet: ObjetCielProfond): string {
  const commun = nomCommun(objet)
  const nom = commun === '' ? objet.designation : `${objet.designation}, ${commun}`
  return `${nom} — ${LIBELLE_TYPE_OBJET[objet.type]}`
}

export interface ImageCibleProps {
  readonly objet: ObjetCielProfond | null
}

export function ImageCible({ objet }: ImageCibleProps) {
  const affichable = useImageCible(objet, 'RESEAU')
  if (objet === null || affichable === null) return null

  const { credit } = affichable.image
  return (
    <figure className="image-cible">
      <span className="image-cible-vue">
        <img src={affichable.url} alt={alternativeCible(objet)} />
      </span>
      {/* Auteur et licence en clair, jamais repliés : c'est ce qui autorise l'affichage. */}
      <figcaption>
        {credit.auteur} · {credit.licence}{' '}
        <a href={credit.lien} target="_blank" rel="noreferrer">
          source
        </a>
      </figcaption>
    </figure>
  )
}

/**
 * La vignette d'une ligne de liste. Elle n'occupe la place que lorsqu'elle a quelque chose à
 * montrer : une case vide sur deux cents lignes serait un gabarit, pas une information.
 */
export function VignetteCible({ objet }: { readonly objet: ObjetCielProfond }) {
  const affichable = useImageCible(objet, 'CACHE')
  if (affichable === null) return null
  return (
    <span className="image-cible-vue cible-vignette">
      <img src={affichable.url} alt="" />
    </span>
  )
}
