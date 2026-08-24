/**
 * L'état de saisie de la fiche : les six champs de la cible, et le verrou qui les ferme
 * quand la cible vient du catalogue plutôt que de la main de l'utilisateur (T-0051).
 */

import { useEffect, useState } from 'react'
import type { ObjetCielProfond, TypeObjet } from '../data/deepsky.ts'
import type { SaisieCible } from './fiche-cible-calcul.ts'

/**
 * Cible par défaut : les valeurs de §6.3, pour que la chaîne de référence du PRD soit
 * lisible à l'ouverture. Le catalogue embarqué donne des dimensions légèrement différentes
 * — choisir M33 dans la liste remplace ces valeurs par celles d'OpenNGC.
 */
const CIBLE_REFERENCE = {
  designation: 'M33 (valeurs de référence)',
  typeObjet: 'GALAXIE' as TypeObjet,
  mInt: '5.7',
  aArcmin: '71',
  bArcmin: '42',
  posAngDeg: '23',
}

/**
 * Les six champs de la fiche, garnis depuis un objet du catalogue — ou la chaîne de référence
 * §6.3 quand il n'y en a pas. `CIBLE_REFERENCE` est une saisie à la main, pas une entrée
 * d'OpenNGC : l'application s'ouvre donc en personnalisé (T-0051).
 */
function valeursDe(objet: ObjetCielProfond | null): typeof CIBLE_REFERENCE {
  if (objet === null) return CIBLE_REFERENCE
  return {
    designation: objet.designation,
    typeObjet: objet.type,
    mInt: objet.vMag === null ? '' : String(objet.vMag),
    aArcmin: objet.majAxArcmin === null ? '' : String(objet.majAxArcmin),
    bArcmin: objet.minAxArcmin === null ? '' : String(objet.minAxArcmin),
    posAngDeg: objet.posAngDeg === null ? '' : String(objet.posAngDeg),
  }
}

export interface EtatSaisieCible {
  readonly designation: string
  readonly surDesignation: (valeur: string) => void
  readonly typeObjet: TypeObjet
  readonly surTypeObjet: (valeur: TypeObjet) => void
  readonly mInt: string
  readonly surMInt: (valeur: string) => void
  readonly aArcmin: string
  readonly surAArcmin: (valeur: string) => void
  readonly bArcmin: string
  readonly surBArcmin: (valeur: string) => void
  readonly posAngDeg: string
  readonly surPosAngDeg: (valeur: string) => void
  /**
   * T-0051 — l'objet du catalogue retenu tel quel, `null` valant « personnalisé ». Le verrou
   * de la saisie est cet état, pas une déduction : le retrouver dans la liste des visibles le
   * lèverait dès qu'un objet passe sous l'horizon, ou qu'un filtre l'écarte.
   */
  readonly objetCatalogue: ObjetCielProfond | null
  /** `null` — « Personnalisé » — garde les valeurs affichées et rouvre la saisie. */
  readonly appliqueObjet: (objet: ObjetCielProfond | null) => void
  readonly verrouille: boolean
  /** Ce que la chaîne de calcul lit : les champs numériques, encore sous forme de texte. */
  readonly saisie: SaisieCible
}

export function useSaisieCible(objetSelectionne: ObjetCielProfond | null): EtatSaisieCible {
  const initiale = valeursDe(objetSelectionne)
  const [designation, setDesignation] = useState(initiale.designation)
  const [typeObjet, setTypeObjet] = useState<TypeObjet>(initiale.typeObjet)
  const [mInt, setMInt] = useState(initiale.mInt)
  const [aArcmin, setAArcmin] = useState(initiale.aArcmin)
  const [bArcmin, setBArcmin] = useState(initiale.bArcmin)
  const [posAngDeg, setPosAngDeg] = useState(initiale.posAngDeg)
  const [objetCatalogue, setObjetCatalogue] = useState<ObjetCielProfond | null>(objetSelectionne)

  function appliqueObjet(objet: ObjetCielProfond | null) {
    setObjetCatalogue(objet)
    if (objet === null) return
    const valeurs = valeursDe(objet)
    setDesignation(valeurs.designation)
    setTypeObjet(valeurs.typeObjet)
    setMInt(valeurs.mInt)
    setAArcmin(valeurs.aArcmin)
    setBArcmin(valeurs.bArcmin)
    setPosAngDeg(valeurs.posAngDeg)
  }

  useEffect(() => {
    if (objetSelectionne !== null) appliqueObjet(objetSelectionne)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetSelectionne])

  return {
    designation,
    surDesignation: setDesignation,
    typeObjet,
    surTypeObjet: setTypeObjet,
    mInt,
    surMInt: setMInt,
    aArcmin,
    surAArcmin: setAArcmin,
    bArcmin,
    surBArcmin: setBArcmin,
    posAngDeg,
    surPosAngDeg: setPosAngDeg,
    objetCatalogue,
    appliqueObjet,
    verrouille: objetCatalogue !== null,
    saisie: { typeObjet, mInt, aArcmin, bArcmin, posAngDeg },
  }
}
