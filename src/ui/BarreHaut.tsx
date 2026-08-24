/**
 * La barre haute : la marque, où pointe la vue, et ce qui ouvre le reste.
 *
 * T-0113 — elle ne porte plus de réglage, seulement des bascules. Le niveau d'explication est
 * descendu dans le tiroir des réglages ; ce qui reste sont quatre tiroirs de terrain et deux
 * boutons de panneau. L'ordre est un contrat : le mode nuit d'abord parce qu'il se cherche
 * dans le noir, les panneaux ensuite, puis la vérification, les réglages, et les lectures en
 * dernier — donc le plus à droite, et sans hauteur tant qu'elles sont fermées (T-0038,
 * T-0047).
 */

import type { EtatDemarrage } from '../data/bootstrap.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import type { ProfilCadre } from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import type { CapteurMode } from '../data/equipment.ts'
import { MenuInfos } from './MenuInfos.tsx'
import { MenuReglages } from './MenuReglages.tsx'
import type { SaisiePoids } from './app-saisie.ts'
import { Verification } from './Verification.tsx'
import { ModeNuit, type EtatModeNuit } from './ModeNuit.tsx'
import type { NiveauUtilisateur } from './Terme.tsx'
import type { Persistance } from './app-donnees.ts'
import { TITRES_PANNEAU } from './PanneauLateral.tsx'
import { basculePanneau, useCoque, type PanneauLateral } from './coque-etat.ts'
import { useTrancheScene, type EtatScene } from './scene-etat.ts'

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
  /** §8.3 — les poids de scoring, réglés depuis le tiroir des réglages. */
  readonly poids: SaisiePoids
  readonly site: Site
  readonly index: IndexCiel
  readonly profils: readonly ProfilCadre[]
  /** §2.2 — fond de ciel du site, relayé au menu d'informations pour §3.3. */
  readonly sbCiel: number | null
}

/** Les deux panneaux que la barre commande, dans l'ordre où ils s'ouvrent. */
const PANNEAUX: readonly PanneauLateral[] = ['NUIT', 'FILE']

/**
 * Où pointe la vue, au degré.
 *
 * T-0113 — la scène occupe tout l'écran et n'a plus de bandeau sous elle : sans cette
 * mention, rien ne dit vers quoi on regarde tant qu'on n'ouvre pas les lectures. Le sélecteur
 * arrondit AVANT de comparer — s'abonner aux degrés décimaux ferait rendre la barre à chaque
 * image du geste de visée, ce que T-0056 a corrigé partout ailleurs.
 */
function viseeAffichee(etat: EtatScene): string {
  const { azimutDeg, hauteurDeg, fovDeg } = etat.vue
  return `az ${azimutDeg.toFixed(0)}° · h ${hauteurDeg.toFixed(0)}° · champ ${fovDeg.toFixed(0)}°`
}

function Visee() {
  return <p className="etat barrehaut-visee">{useTrancheScene(viseeAffichee)}</p>
}

export function BarreHaut(props: BarreHautProps) {
  const { panneau } = useCoque()

  return (
    <>
      <h1>Astrofort</h1>
      <Visee />
      <p className="etat">
        {props.focale} mm f/{props.ouverture} ·{' '}
        {props.capteurMode === 'FULL_FRAME' ? 'plein format' : 'APS-C'}
      </p>

      {/* §11.1 — le mode nuit est un geste de terrain : il reste à portée, dans la barre. */}
      <details className="tiroir tiroir-nuit">
        <summary>{props.modeNuit.actif ? 'nuit — actif' : 'nuit'}</summary>
        <div className="tiroir-contenu">
          <ModeNuit etat={props.modeNuit} surChangement={props.surModeNuit} />
        </div>
      </details>

      {/* Les deux panneaux latéraux. Un bouton pressé rouvre le panneau qu'il a ouvert : la
          bascule referme, elle ne rouvre pas un autre panneau par surprise. */}
      <div className="barrehaut-panneaux">
        {PANNEAUX.map((cle) => (
          <button
            key={cle}
            type="button"
            className={panneau === cle ? 'onglet actif' : 'onglet'}
            aria-expanded={panneau === cle}
            aria-controls="panneau-lateral"
            onClick={() => basculePanneau(cle)}
          >
            {TITRES_PANNEAU[cle]}
          </button>
        ))}
      </div>

      <Verification
        etat={props.etat}
        modeReseau={props.modeReseau}
        messagePersistance={props.persistance.message}
        echecPersistance={props.persistance.echec}
        surExport={props.persistance.surExport}
        surImport={props.persistance.surImport}
      />
      {/* T-0047 — le choix brut dans le catalogue, hors du chemin principal. Avant le menu
          des lectures, qui reste le dernier élément. */}
      <MenuReglages
        catalogue={props.catalogue}
        poids={props.poids}
        niveau={props.niveau}
        surNiveau={props.surNiveau}
      />
      {/* T-0038 — les lectures qui datent l'image : dernier élément de la barre, donc le
          plus à droite, et sans hauteur tant qu'il est fermé. */}
      <MenuInfos
        site={props.site}
        index={props.index}
        objets={props.catalogue}
        profils={props.profils}
        sbCiel={props.sbCiel}
      />
    </>
  )
}
