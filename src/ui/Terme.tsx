/**
 * §10.1 — Glossaire contextuel, rendu au contact du terme.
 *
 * L'interface ne rend jamais un libellé littéral : elle rend une clé du glossaire. C'est ce
 * qui tient la règle « aucun terme affiché ne peut être absent du glossaire » — un libellé
 * sans entrée ne compile pas, et le compilateur nomme la clé manquante.
 *
 * Le niveau d'affichage ne change QUE la densité d'explication. Aucun calcul, aucune valeur
 * numérique n'en dépend.
 */

import { createContext, useContext } from 'react'
import type { TermeGlossaire } from '../registry/glossaire.ts'
import { GLOSSAIRE } from '../registry/glossaire.ts'

export type NiveauUtilisateur = 'DEBUTANT' | 'CONFIRME'

export const NiveauContext = createContext<NiveauUtilisateur>('DEBUTANT')

export function useNiveau(): NiveauUtilisateur {
  return useContext(NiveauContext)
}

interface EtiquetteProps {
  readonly cle: TermeGlossaire
}

/**
 * Libellé d'un terme, glose au survol. En mode débutant la glose est aussi visible sans
 * survol : le jargon est accompagné systématiquement, l'interface reste dense en CONFIRME.
 */
export function Etiquette({ cle }: EtiquetteProps) {
  const entree = GLOSSAIRE[cle]
  const niveau = useNiveau()
  return (
    <span className="terme">
      <abbr title={entree.glose}>{entree.libelle}</abbr>
      {niveau === 'DEBUTANT' && <span className="terme-glose">{entree.glose}</span>}
    </span>
  )
}

interface GloseProps {
  readonly cle: TermeGlossaire
  /**
   * Valeur courante de l'utilisateur pour ce terme. Absente, le champ dit ce qu'il faut
   * renseigner pour l'obtenir — jamais un exemple abstrait, jamais une valeur inventée.
   */
  readonly contexte?: string | undefined
}

/** Explication, valeur en contexte et conséquence : les trois champs de §10.1 après la glose. */
export function Glose({ cle, contexte }: GloseProps) {
  const entree = GLOSSAIRE[cle]
  return (
    <div className="glossaire">
      <p>{entree.explication}</p>
      <p className="glossaire-contexte">
        {contexte === undefined
          ? 'Valeur non calculée : compléter le profil pour l’obtenir.'
          : `Ta valeur : ${contexte}`}
      </p>
      <p className="glossaire-consequence">{entree.consequence}</p>
    </div>
  )
}

/** Terme affiché seul, hors valeur tracée : la définition complète s'ouvre au clic. */
export function Terme({ cle, contexte }: GloseProps) {
  return (
    <details className="terme-detail">
      <summary>
        <Etiquette cle={cle} />
      </summary>
      <Glose cle={cle} contexte={contexte} />
    </details>
  )
}
