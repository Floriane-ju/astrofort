/**
 * §11.2 — la coque : la scène occupe tout, le reste se pose dessus.
 *
 * T-0113 remplace les trois colonnes du lot 6. Les colonnes tenaient la promesse « la scène
 * au centre » mais lui laissaient la moitié de l'écran : sur une fenêtre de 1440 px, deux
 * panneaux de 20 et 24 rem prenaient 700 px, et un cadre de 0,8° se jugeait dans ce qui
 * restait. La scène prend maintenant toute la surface, et ce qui la commande vient dessus :
 *
 *   - la barre HAUTE nomme l'application, dit où pointe la vue et ouvre les panneaux ;
 *   - la barre BASSE porte le lieu et le temps — les deux entrées qui datent toute la nuit ;
 *   - le RAIL borde la scène à gauche et porte les bascules de la vue (T-0213) ;
 *   - les cartes du MATÉRIEL, Boîtier et Optique, se posent en haut à droite (T-0245) : c'est la
 *     saisie qu'on relit le plus, dépliée au démarrage, mais repliable quand elle est réglée ;
 *   - les CARTES portent le plan de nuit, repliable ;
 *   - le PANNEAU latéral porte ce qui se lit en longueur : le catalogue, le filé.
 *
 * La coque ne connaît aucun contenu : elle reçoit six régions et les place. C'est ce qui
 * permet de remplir, vider et redécouper les panneaux sans toucher à la mise en page.
 *
 * L'ordre du DOM est l'ordre de tabulation : barre haute, scène, matériel, cartes, panneau,
 * barre basse. Il suit la lecture, pas la position à l'écran — un panneau ouvert au clavier depuis
 * la barre haute est le nœud suivant, pas le dernier de la page.
 *
 * Sous le repli, tout redevient un flux vertical : les cartes se dépilent sous la scène et le
 * panneau derrière elles. Aucune media query en JavaScript — la feuille de style suffit,
 * puisque la position est la seule chose qui change.
 */

import { useEffect, type ReactNode } from 'react'

import { ancreTiroirs } from './tiroir-ancrage.ts'

export interface CoqueProps {
  /** Barre haute : identité, visée, bascules de panneau. */
  readonly topbar: ReactNode
  /** La scène. Elle occupe toute la coque, les autres régions se posent dessus. */
  readonly scene: ReactNode
  /** Les cartes du matériel, posées sur la scène contre le rail. */
  readonly materiel: ReactNode
  /** Ce qui se pose sur la scène : le rail de la vue, puis la carte du plan de nuit. */
  readonly cartes: ReactNode
  /** Panneau latéral, ou `null` quand aucun n'est ouvert. */
  readonly lateral: ReactNode
  /** Barre basse : le lieu, la date, le temps. */
  readonly barrebas: ReactNode
}

export function Coque(props: CoqueProps) {
  // T-0121 — les fenêtres de tiroir s'ouvrent sous leur bouton et se recalent sur l'écran.
  // C'est de la mise en page, donc de la coque ; l'écoute est unique et couvre les deux barres.
  useEffect(ancreTiroirs, [])

  return (
    <div className="coque">
      <header className="coque-topbar">{props.topbar}</header>
      <main className="coque-scene">{props.scene}</main>
      {props.materiel}
      <div className="coque-cartes">{props.cartes}</div>
      {props.lateral}
      <footer className="coque-barrebas">{props.barrebas}</footer>
    </div>
  )
}
