/**
 * T-0188 — où va le focus quand le panneau change de contenu sans que rien ne bouge à l'écran.
 *
 * Le panneau latéral est à demeure (T-0181) : ouvrir une fiche ou revenir à la liste remplace
 * son corps en place. Au clavier, ces deux transitions sont invisibles — pire, le retour
 * DÉTRUIT le bouton qui portait le focus, qui retombe alors sur `<body>` et fait repartir la
 * tabulation du début du document.
 *
 * Motif « détail puis retour » de l'APG : on va DANS le détail, on revient D'OÙ l'on est parti.
 * D'où les deux décisions, et le repli :
 *
 * - LISTE → FICHE : le focus entre dans la fiche, sur son titre. Ouvrir une fiche est une
 *   demande délibérée — un clic sur une ligne, ou Entrée sur un objet de la scène ; la
 *   navigation du ciel aux flèches n'appelle pas `ouvreCible`, elle ne peut donc pas piéger
 *   le focus dans le panneau (`planetarium-gestes.ts`).
 * - FICHE → LISTE : le focus revient sur la LIGNE de la cible qu'on vient de consulter.
 * - Repli : cette ligne peut avoir disparu — les filtres ou la minute ont bougé pendant la
 *   consultation. Le focus va alors au champ de recherche, en tête du panneau, jamais nulle
 *   part.
 *
 * La bascule de mode ne figure pas ici : elle laisse le focus sur le bouton qui l'a déclenchée,
 * qui survit au changement. Rien à faire est aussi une décision.
 */

import type { VueCibles } from './seance-etat.ts'

export type CibleFocus = 'TITRE_FICHE' | 'LIGNE_CIBLE' | 'CHAMP_RECHERCHE' | null

/**
 * Décidé sans DOM : `lignePresente` dit si la ligne de la cible consultée est encore rendue.
 * `null` veut dire « ne touche pas au focus » — l'immense majorité des rendus.
 */
export function cibleFocus(
  precedente: VueCibles,
  courante: VueCibles,
  lignePresente: boolean,
): CibleFocus {
  if (precedente === courante) return null
  if (courante === 'FICHE') return 'TITRE_FICHE'
  return lignePresente ? 'LIGNE_CIBLE' : 'CHAMP_RECHERCHE'
}

/**
 * L'identifiant du bouton d'une ligne. Une désignation porte des espaces et des points
 * (« NGC 7000 », « IC 1396A ») : ce qui n'est ni lettre ni chiffre devient un tiret, faute de
 * quoi `getElementById` reçoit un identifiant que le document n'écrira jamais tel quel.
 */
export function idLigneCible(designation: string): string {
  return `cible-${designation.replace(/[^A-Za-z0-9-]/g, '-')}`
}
