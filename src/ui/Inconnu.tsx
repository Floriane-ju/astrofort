/**
 * T-0149 — la grandeur qu'un matériel incomplet ne permet pas de calculer.
 *
 * Ce n'est PAS `[DONNÉE MANQUANTE]` de §6.3 : cette formulation-là dit qu'un catalogue ne
 * porte pas la donnée, et qu'aucune saisie n'y changera rien. Ici la donnée s'attend de
 * l'utilisateur — « ? » dit qu'elle est à saisir, et la bulle dit quoi saisir. Une lecture
 * qui disparaît, elle, ne dit rien du tout : la ligne reste, seule sa valeur change.
 *
 * Le « ? » est focalisable : la bulle s'ouvre au `:focus-within`, donc au clavier aussi.
 */

import type { TermeGlossaire } from '../registry/glossaire.ts'
import { Bulle } from './Bulle.tsx'
import { Etiquette } from './Terme.tsx'

/** §5.1 — les trois grandeurs sans lesquelles ni champ, ni échantillonnage, ni pose n'existent. */
export const AIDE_MATERIEL_INCOMPLET =
  'Non calculable : complétez le matériel — résolution du capteur, focale, ouverture — dans ' +
  'la carte Matériel.'

export function Inconnu() {
  return (
    <Bulle texte={AIDE_MATERIEL_INCOMPLET}>
      <span className="aide" tabIndex={0}>
        ?
      </span>
    </Bulle>
  )
}

/**
 * La ligne d'une lecture qui ne se calcule pas encore. Elle emprunte la mise en page de
 * `TracedValue` sans en être une : il n'y a ni formule ni entrée à déplier, seulement une
 * saisie à compléter.
 */
export function LectureInconnue({
  terme,
  suffixe,
}: {
  readonly terme: TermeGlossaire
  readonly suffixe?: string
}) {
  return (
    <p className="tracee tracee-vide">
      <span>
        <Etiquette cle={terme} />
        {suffixe !== undefined && <span className="tracee-suffixe"> — {suffixe}</span>}
      </span>
      <span className="tracee-valeur">
        <Inconnu />
      </span>
    </p>
  )
}
