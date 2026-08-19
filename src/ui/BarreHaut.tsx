/**
 * La barre haute : le titre, ce qui date l'image, et les gestes de terrain qui doivent
 * rester à portée sans occuper la scène.
 *
 * L'ordre y est un contrat : le mode nuit d'abord parce qu'il se cherche dans le noir, le
 * tiroir de vérification ensuite, les réglages, et les lectures en dernier — donc le plus à
 * droite, et sans hauteur tant qu'elles sont fermées (T-0038, T-0047).
 */

import type { EtatDemarrage } from '../data/bootstrap.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import type { ProfilCadre } from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import type { CapteurMode } from '../data/equipment.ts'
import { MenuInfos } from './MenuInfos.tsx'
import { MenuReglages } from './MenuReglages.tsx'
import { Verification } from './Verification.tsx'
import { ModeNuit, type EtatModeNuit } from './ModeNuit.tsx'
import type { NiveauUtilisateur } from './Terme.tsx'
import type { Persistance } from './app-donnees.ts'

export interface BarreHautProps {
  readonly niveau: NiveauUtilisateur
  readonly surNiveau: (niveau: NiveauUtilisateur) => void
  readonly focale: string
  readonly ouverture: string
  readonly capteurMode: CapteurMode
  readonly modeNuit: EtatModeNuit
  readonly surModeNuit: (etat: EtatModeNuit) => void
  readonly etat: EtatDemarrage | null
  readonly modeReseau: string
  readonly persistance: Persistance
  readonly catalogue: readonly ObjetCielProfond[]
  readonly site: Site
  readonly index: IndexCiel
  readonly profils: readonly ProfilCadre[]
  readonly mLimOeil: number | null
}

export function BarreHaut(props: BarreHautProps) {
  return (
    <>
      <h1>Astrofort</h1>
      <p className="etat">
        {props.focale} mm f/{props.ouverture} ·{' '}
        {props.capteurMode === 'FULL_FRAME' ? 'plein format' : 'APS-C'}
      </p>
      <p className="niveau">
        {/* §10.1 — le niveau ne change QUE la densité d'explication, jamais un calcul. */}
        Niveau d’explication :{' '}
        <select
          value={props.niveau}
          onChange={(e) => props.surNiveau(e.target.value as NiveauUtilisateur)}
        >
          <option value="DEBUTANT">Débutant — gloses visibles</option>
          <option value="CONFIRME">Confirmé — gloses au survol</option>
        </select>
      </p>
      {/* §11.1 — le mode nuit est un geste de terrain : il reste à portée, dans la barre. */}
      <details className="tiroir tiroir-nuit">
        <summary>{props.modeNuit.actif ? '☾ nuit — actif' : '☾ nuit'}</summary>
        <div className="tiroir-contenu">
          <ModeNuit etat={props.modeNuit} surChangement={props.surModeNuit} />
        </div>
      </details>
      <Verification
        etat={props.etat}
        modeReseau={props.modeReseau}
        messagePersistance={props.persistance.message}
        surExport={props.persistance.surExport}
        surImport={props.persistance.surImport}
      />
      {/* T-0047 — le choix brut dans le catalogue, hors du chemin principal. Avant le menu
          des lectures, qui reste le dernier élément. */}
      <MenuReglages catalogue={props.catalogue} />
      {/* T-0038 — les lectures qui datent l'image : dernier élément de la barre, donc le
          plus à droite, et sans hauteur tant qu'il est fermé. */}
      <MenuInfos
        site={props.site}
        index={props.index}
        objets={props.catalogue}
        profils={props.profils}
        mLimOeil={props.mLimOeil}
      />
    </>
  )
}
