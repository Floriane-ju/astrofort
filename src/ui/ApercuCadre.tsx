/**
 * §6.2 — l'aperçu du cadre sur imagerie de fond : ce que le capteur verra, et ce qui déborde.
 *
 * C'est la vue que §6.2 spécifie depuis le début et que §12.5 déclare `tombe` hors réseau. Elle
 * ne réutilise PAS la vignette de §6.4, et ce n'est pas une économie manquée : la vignette est
 * cadrée sur l'objet, celle-ci sur le capteur. Champ différent, rapport de forme différent,
 * orientation différente — redimensionner l'une ne produit pas l'autre.
 *
 * Le rectangle est posé en surimpression plutôt que demandé au service. C'est aussi ce qui est
 * physiquement juste : quand on tourne le boîtier, c'est le cadre qui tourne, pas le ciel.
 *
 * La marge du registre est ce qui rend le verdict VISIBLE. Sans elle, l'image serait le cadre,
 * et un objet en MOSAIQUE_REQUISE serait rogné par le bord — donc indistinguable d'un objet qui
 * tient tout juste.
 */

import type { ObjetCielProfond } from '../data/deepsky.ts'
import { champApercuCadreDeg } from '../data/imagerie-cible.ts'
import { useApercuCadre } from './image-cible-memoire.ts'

const POURCENT = 100
const DECIMALES_DEG = 1

export interface ApercuCadreProps {
  readonly objet: ObjetCielProfond | null
  readonly fovLDeg: number
  readonly fovHDeg: number
  /** §6.2 — l'angle suggéré par le grand axe de l'objet. `null` : le catalogue ne le donne pas. */
  readonly angleBoitierDeg: number | null
}

export function ApercuCadre(props: ApercuCadreProps) {
  const { objet, fovLDeg, fovHDeg, angleBoitierDeg } = props
  const apercu = useApercuCadre(objet, fovLDeg)
  if (objet === null || apercu === null) return null

  // La fraction se lit sur le champ RÉELLEMENT demandé, jamais sur la marge : celle-ci est
  // bornée par le plafond gnomonique, et calculer le rectangle depuis la marge dessinerait un
  // cadre faux dès que le plafond mord. La hauteur suit le rapport des deux champs, c'est-à-dire
  // la forme réelle du capteur.
  const champDeg = champApercuCadreDeg(fovLDeg)
  const partLargeur = (fovLDeg / champDeg) * POURCENT
  const partHauteur = partLargeur * (fovHDeg / fovLDeg)
  const angle = angleBoitierDeg ?? 0

  return (
    <figure className="apercu-cadre">
      <span className="image-cible-vue">
        {/* Le verdict, le remplissage et le diamètre en pixels sont déjà en texte juste
            au-dessus : redécrire l'image ici ne ferait que les annoncer deux fois. */}
        <img src={apercu.url} alt="" />
        <span
          className="apercu-cadre-rectangle"
          style={{
            width: `${partLargeur}%`,
            height: `${partHauteur}%`,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          }}
        />
      </span>
      <figcaption>
        Cadre {fovLDeg.toFixed(DECIMALES_DEG)}° × {fovHDeg.toFixed(DECIMALES_DEG)}°
        {angleBoitierDeg === null ? '' : `, boîtier à ${angleBoitierDeg.toFixed(0)}°`} ·{' '}
        {apercu.image.credit.auteur} · {apercu.image.credit.licence}{' '}
        <a href={apercu.image.credit.lien} target="_blank" rel="noreferrer">
          source
        </a>
      </figcaption>
    </figure>
  )
}
