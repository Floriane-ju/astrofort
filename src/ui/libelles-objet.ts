/**
 * Ce qu'on peut dire d'un objet du ciel profond sans rien savoir du ciel : sa désignation,
 * son nom commun, son type, sa magnitude.
 *
 * Un seul endroit où traduire un type — le tiroir de réglages, la liste des visibles, son
 * filtre (T-0050) et le champ « Type d'objet » de la fiche y puisent tous.
 */

import type { ObjetCielProfond, TypeObjet } from '../data/deepsky.ts'
import type { CibleVisible } from '../core/visibles.ts'

/**
 * T-0049 — les types de §6.3 en français. Le `Record` complet fait refuser par le
 * compilateur un type ajouté sans libellé.
 */
export const LIBELLE_TYPE_OBJET: Readonly<Record<TypeObjet, string>> = {
  INCONNU: 'type inconnu',
  GALAXIE: 'galaxie',
  AMAS_OUVERT: 'amas ouvert',
  AMAS_GLOB: 'amas globulaire',
  NEB_PLANETAIRE: 'nébuleuse planétaire',
  EMISSION: 'nébuleuse en émission',
  REFLEXION: 'nébuleuse par réflexion',
  NEB_OBSCURE: 'nébuleuse obscure',
  RESTE_SUPERNOVA: 'reste de supernova',
  AUTRE: 'autre type',
}

export function libelleObjet(objet: ObjetCielProfond): string {
  const nom = objet.nomsCommuns === '' ? '' : ` — ${objet.nomsCommuns.split('|')[0]}`
  const mag = objet.vMag === null ? '' : ` · mag ${objet.vMag.toFixed(1)}`
  return `${objet.designation}${nom} · ${LIBELLE_TYPE_OBJET[objet.type]}${mag}`
}

/** La hauteur, elle, n'existe que pour une cible levée : elle reste à la liste des visibles. */
export function libelleCible(cible: CibleVisible): string {
  return `${libelleObjet(cible.objet)} · ${cible.hauteurDeg.toFixed(0)}° de hauteur`
}
