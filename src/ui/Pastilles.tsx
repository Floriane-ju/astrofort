/**
 * §6.4 — la note de facilité, lue d'un coup d'œil : autant de pastilles que l'échelle porte.
 *
 * Le glyphe passe par `Icone` et la police Material Symbols, jamais par « ● » : un caractère
 * Unicode décoratif ne suit pas le style commun des icônes, et c'est `.icone` qui décide de
 * leur épaisseur et de leur taille pour toute l'application.
 *
 * Le nom accessible vit sur l'ENVELOPPE, et les glyphes restent `aria-hidden` — c'est le
 * défaut d'`Icone`. Les nommer un par un ferait annoncer cinq fois « circle » en anglais au
 * milieu d'une phrase française.
 *
 * Une seule ligature pour les deux états, et un seul axe de la police pour les distinguer :
 * `FILL`, plein contre cerclé. Deux ligatures différentes changeaient la GÉOMÉTRIE en même
 * temps que le remplissage, et à cette taille les deux cercles se lisaient pareil — c'est
 * exactement le défaut que ce composant doit éviter, puisqu'il n'existe que pour se compter
 * d'un coup d'œil.
 */

import { K } from '../registry/constants.ts'
import { Icone } from './Icone.tsx'

export interface PastillesProps {
  readonly note: number
  /** Le libellé de l'échelle : il entre dans le nom accessible, jamais dans un glyphe. */
  readonly libelle: string
  /**
   * §8.3 — la cause d'écart, sur une note 0 seulement. Un zéro muet est le pire des deux :
   * l'utilisateur voit que c'est refusé sans savoir quel levier tirer.
   */
  readonly cause?: string | null
}

export function Pastilles({ note, libelle, cause = null }: PastillesProps) {
  const max = K('FACILITE_NOTE_MAX')
  const rangs = Array.from({ length: max }, (_, i) => i)
  return (
    <span
      className="facilite"
      role="img"
      aria-label={
        cause === null
          ? `facilité ${note} sur ${max}, ${libelle}`
          : `facilité ${note} sur ${max}, ${libelle} — ${cause}`
      }
      {...(cause === null ? {} : { title: cause })}
    >
      {rangs.map((rang) => (
        <Icone key={rang} nom="circle" classe={rang < note ? 'facilite-pleine' : 'facilite-vide'} />
      ))}
    </span>
  )
}
