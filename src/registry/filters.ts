/**
 * §7.5, §10.3 — Table de transmission par famille de filtres.
 *
 * Une famille, pas un modèle : aucune marque, aucune référence commerciale, aucun prix
 * (§10.3). Ce qui est déclaré ici, c'est la largeur de bande transmise — la seule grandeur
 * dont les moteurs §7.1 et §7.3 ont besoin pour chiffrer un gain.
 *
 * Un filtre à bande étroite ne se recommande QUE sur un objet qui émet en raies. Sur une
 * galaxie ou une nébuleuse par réflexion, il coupe le signal autant que le fond de ciel :
 * la table porte donc les types d'objets concernés, et le moteur refuse le conseil ailleurs.
 */

import type { TypeObjet } from '../data/deepsky.ts'

export type FamilleFiltre = 'AUCUN' | 'DUAL_BAND' | 'UHC' | 'OIII'

export interface LigneFiltre {
  readonly famille: FamilleFiltre
  readonly libelle: string
  /** Bandes passantes transmises, en nanomètres. Vide pour l'absence de filtre. */
  readonly bandesNm: readonly number[]
  /** Types d'objets sur lesquels le filtre conserve le signal utile. */
  readonly typesUtiles: readonly TypeObjet[]
  readonly note: string
}

/** Les objets en émission : ce sont les seuls que la bande étroite ne coupe pas. */
export const TYPES_EN_EMISSION: readonly TypeObjet[] = Object.freeze([
  'EMISSION',
  'RESTE_SUPERNOVA',
  'NEB_PLANETAIRE',
])

export const TABLE_FILTRES: readonly LigneFiltre[] = Object.freeze(
  [
    {
      famille: 'AUCUN',
      libelle: 'Sans filtre — large bande',
      bandesNm: [],
      typesUtiles: [],
      note: 'Tout le spectre visible atteint le capteur, fond de ciel compris.',
    },
    {
      famille: 'DUAL_BAND',
      libelle: 'Filtre bi-bande Hα / OIII',
      bandesNm: [7, 7],
      typesUtiles: TYPES_EN_EMISSION,
      note:
        'Deux fenêtres étroites centrées sur Hα et OIII. Il rejette l’essentiel de la ' +
        'pollution lumineuse et de la Lune tout en conservant le signal des nébuleuses en ' +
        'émission. Sur une galaxie, un amas ou une nébuleuse par réflexion, il coupe le ' +
        'signal aussi : il n’est jamais recommandé sur ces objets.',
    },
    {
      famille: 'UHC',
      libelle: 'Filtre à bande passante élargie',
      bandesNm: [25],
      typesUtiles: TYPES_EN_EMISSION,
      note:
        'Fenêtre unique plus large : gain moindre qu’un bi-bande, mais plus tolérant sur la ' +
        'mise au point et sur les optiques très ouvertes.',
    },
    {
      famille: 'OIII',
      libelle: 'Filtre OIII seul',
      bandesNm: [6],
      typesUtiles: ['NEB_PLANETAIRE', 'RESTE_SUPERNOVA'],
      note:
        'Bande unique sur l’oxygène doublement ionisé : réservé aux nébuleuses planétaires ' +
        'et aux restes de supernova, où cette raie porte l’essentiel du signal.',
    },
  ].map(Object.freeze) as LigneFiltre[],
)

export function ligneFiltre(famille: FamilleFiltre): LigneFiltre {
  return TABLE_FILTRES.find((l) => l.famille === famille) ?? TABLE_FILTRES[0]!
}

export const SOURCE_TABLE_FILTRES =
  'Largeurs de bande usuelles par famille de filtres. Aucune donnée commerciale, aucune ' +
  'marque, aucun prix (§10.3).'
