/**
 * §3.4 — Ce qu'un clic sur la scène a désigné, mis en mots.
 *
 * La géométrie a déjà tranché : `cibleSousLeCurseur` a rendu la cible la plus proche. Ne
 * reste qu'à la décrire pour le magasin de scène — et à ne jamais inventer ce que le
 * catalogue ne porte pas.
 */

import { K } from '../registry/constants.ts'
import type { SelectionScene } from './scene-etat.ts'
import type { CibleEcran } from './dessine-ciel.ts'

export function decritCible(cible: CibleEcran): SelectionScene {
  if (cible.type === 'OBJET' && cible.objet !== undefined) {
    const o = cible.objet
    return {
      titre: o.designation + (o.nomsCommuns === '' ? '' : ` — ${o.nomsCommuns.split('|')[0]}`),
      lignes: [
        `type ${o.type}`,
        o.vMag === null ? 'magnitude intégrée absente du catalogue' : `magnitude ${o.vMag}`,
        o.majAxArcmin === null ? 'dimensions absentes' : `grand axe ${o.majAxArcmin}’`,
      ],
      objet: o,
    }
  }
  if (cible.type === 'CORPS' && cible.corps !== undefined) {
    const c = cible.corps
    return {
      titre: cible.nom,
      lignes: [
        `ascension droite ${c.adH.toFixed(3)} h · déclinaison ${c.decDeg.toFixed(2)}°`,
        `azimut ${c.azimutDeg.toFixed(1)}° · hauteur ${c.hauteurDeg.toFixed(1)}°`,
        'Position interpolée entre deux échantillons d’éphémérides (§3.1).',
      ],
      objet: null,
    }
  }
  const nommee = cible.etoileNommee
  if (nommee !== undefined) {
    return {
      titre: nommee.nomPropre === '' ? nommee.designation : `${nommee.nomPropre} — ${nommee.designation}`,
      lignes: [
        `magnitude ${nommee.magV.toFixed(2)} · constellation ${nommee.constellation}`,
        nommee.spectre === '' ? 'type spectral absent du catalogue' : `type spectral ${nommee.spectre}`,
        nommee.distancePc === null
          ? 'distance non fiable : la parallaxe manque, aucune valeur n’est estimée'
          : `distance ${nommee.distancePc.toFixed(1)} pc`,
      ],
      objet: null,
    }
  }
  const etoile = cible.etoile
  return {
    titre: 'Étoile sans désignation dans le paquet chargé',
    lignes: [
      etoile === undefined
        ? ''
        : `magnitude ${etoile.magV.toFixed(2)} · indice B−V ${etoile.bv.toFixed(2)}`,
      'Le paquet des étoiles nommées ne porte que les désignations Bayer sous magnitude ' +
        `${K('MAG_LABEL_BAYER_MAX')} et les noms propres. Aucune désignation n’est inventée.`,
    ].filter((l) => l !== ''),
    objet: null,
  }
}
