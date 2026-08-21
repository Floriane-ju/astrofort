/**
 * §8.1 côté fiche — l'état du ciel sous la Lune pour la cible ouverte (T-0089).
 *
 * La fiche n'a pas de créneau : l'instant d'évaluation doit donc être choisi, et nommé à
 * l'écran. Celui retenu est l'instant affiché par le planétarium — la seule horloge de
 * l'application, celle qui garnit déjà la liste des visibles. Un second instant implicite,
 * milieu de nuit ou « maintenant », donnerait deux ciels sur un même écran.
 *
 * La hauteur de cible passée au modèle est la culmination, exactement comme le plan de
 * séance (`instantLune` + `altCulminationDeg`) : c'est ce qui garantit que les deux écrans
 * annoncent la même pose pour la même cible au même instant.
 * ponytail: Lune à l'instant affiché, cible à sa culmination — les deux instants diffèrent,
 * et l'écart ne joue que sur l'extinction du trajet de la cible, un terme du second ordre.
 * Le jour où le plan évaluera la cible à l'instant de la Lune, cette fonction suivra.
 */

import { cielSousLaLune } from '../core/moon.ts'
import { HorsDomaineSeriesError, type Site } from '../core/ephem.ts'
import { altitudeCulmination } from '../core/site.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import { minuteAffichee, MS_PAR_MINUTE, useTrancheScene } from './scene-etat.ts'
import type { LuneFiche } from './fiche-cible-calcul.ts'

const HEURES_PAR_TOUR = 24
const DEG_PAR_HEURE = 360 / HEURES_PAR_TOUR

export interface EntreeLuneCible {
  readonly site: Site
  readonly instant: Date
  /** La cible du catalogue : sans ses coordonnées, il n'y a ni séparation ni hauteur. */
  readonly objet: ObjetCielProfond | null
  readonly sbCielNoirMag: number
}

export function lunePourCible(entree: EntreeLuneCible): LuneFiche {
  const objet = entree.objet
  if (objet === null) {
    return {
      evaluee: false,
      cause:
        'Cible personnalisée : sans coordonnées, ni la séparation à la Lune ni la hauteur de ' +
        'la cible ne se calculent. Le fond de ciel reste celui du site, et la Lune n’est pas ' +
        'chiffrée plutôt que devinée. Choisir la cible dans la liste des visibles l’évalue.',
    }
  }
  try {
    return {
      evaluee: true,
      instant: entree.instant,
      ciel: cielSousLaLune({
        site: entree.site,
        instant: entree.instant,
        adH: objet.adDeg / DEG_PAR_HEURE,
        decDeg: objet.decDeg,
        altitudeCibleDeg: altitudeCulmination(entree.site.latitudeDeg, objet.decDeg).value,
        sbCielNoirMag: entree.sbCielNoirMag,
      }),
    }
  } catch (erreur) {
    // §12.5 — un instant hors du domaine des séries ne fait pas tomber la fiche : le reste
    // de la chaîne vaut encore, seule la Lune manque, et elle nomme sa cause.
    if (erreur instanceof HorsDomaineSeriesError) {
      return { evaluee: false, cause: erreur.message }
    }
    throw erreur
  }
}

/**
 * La Lune de la cible ouverte, recalculée à la minute affichée. La minute suffit : une
 * seconde de plus ne déplace ni la hauteur de la Lune ni sa séparation de façon lisible, et
 * la scène republie son horloge deux fois par seconde.
 */
export function useLuneCible(
  site: Site,
  sbCielNoirMag: number,
  objet: ObjetCielProfond | null,
): LuneFiche {
  const minute = useTrancheScene(minuteAffichee)
  return lunePourCible({
    site,
    instant: new Date(minute * MS_PAR_MINUTE),
    objet,
    sbCielNoirMag,
  })
}
