/**
 * T-0052 — chercher un objet du catalogue par son nom.
 *
 * Un catalogue de ~14 000 entrées ne se parcourt pas, il s'interroge : dérouler ses 400
 * premières entrées ne montre que des IC et met M45 hors d'atteinte. Ce module répond à la
 * question ; T-0053 lui donne son champ.
 *
 * Ce qui se cherche est ce que `libelleObjet` affiche déjà : la désignation et chacun des
 * noms communs. Ni horizon ni verdict n'entrent ici — c'est la question de `ciblesVisibles`,
 * et elle a son chemin dans l'onglet Cible. Chercher dans le catalogue, c'est chercher dans
 * le catalogue entier, y compris sous l'horizon.
 *
 * La portée n'est jamais plafonnée : `maxRendus` borne le nombre de résultats rendus, pas
 * l'étendue de la recherche. Aucun objet du catalogue n'est hors d'atteinte.
 */

import type { ObjetCielProfond } from '../data/deepsky.ts'

/** Casse et accents ignorés : « pleiades » trouve « Pléiades ». Aucune dépendance. */
function normalise(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Un préfixe passe devant une occurrence interne ; rien du tout ne passe pas. */
const RANG_PREFIXE = 0
const RANG_INTERNE = 1
const ABSENT = -1

function rangDe(objet: ObjetCielProfond, recherche: string): number {
  let rang = ABSENT
  for (const nom of [objet.designation, ...objet.nomsCommuns.split('|')]) {
    if (nom === '') continue
    const position = normalise(nom).indexOf(recherche)
    if (position === 0) return RANG_PREFIXE
    if (position > 0) rang = RANG_INTERNE
  }
  return rang
}

/**
 * Les objets du catalogue dont la désignation ou l'un des noms communs contient la saisie :
 * les préfixes d'abord, puis du plus brillant au plus faible — l'ordre dans lequel un
 * observateur pense au ciel, le même que celui de `ciblesVisibles`.
 *
 * Une saisie vide ne rend rien : proposer 14 000 entrées avant la première frappe est le
 * défaut qu'on corrige, pas un état par défaut.
 */
export function chercheCatalogue(
  catalogue: readonly ObjetCielProfond[],
  saisie: string,
  maxRendus: number,
): readonly ObjetCielProfond[] {
  const recherche = normalise(saisie.trim())
  if (recherche === '') return []

  const trouves: { objet: ObjetCielProfond; rang: number }[] = []
  for (const objet of catalogue) {
    const rang = rangDe(objet, recherche)
    if (rang !== ABSENT) trouves.push({ objet, rang })
  }

  // Un objet sans magnitude ne passe pas devant un objet qui en a une : l'absence part au
  // bout du tri plutôt que de valoir zéro (§6.3).
  trouves.sort(
    (a, b) =>
      a.rang - b.rang || (a.objet.vMag ?? Number.POSITIVE_INFINITY) - (b.objet.vMag ?? Number.POSITIVE_INFINITY),
  )
  return trouves.slice(0, maxRendus).map((t) => t.objet)
}
