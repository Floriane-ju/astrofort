/**
 * La barre haute : la marque, le matériel en une ligne, et ce qui ouvre le reste.
 *
 * T-0113 — elle ne porte plus de réglage, seulement des bascules : des tiroirs de terrain et
 * des boutons de panneau. L'ordre est un contrat : le mode nuit d'abord parce qu'il se cherche
 * dans le noir, les panneaux ensuite, puis la vérification et les réglages en dernier (T-0047).
 *
 * T-0153 — le tiroir des lectures est démonté. Il portait une phrase utile et quatre lectures
 * d'atelier ; la phrase est descendue au centre de la barre basse, où elle se lit sans un clic,
 * et la mention « az · h · champ » qui la répétait ici part avec elle.
 */

import type { EtatDemarrage } from '../data/bootstrap.ts'
import type { CapteurMode } from '../data/equipment.ts'
import { MenuReglages } from './MenuReglages.tsx'
import type { SaisiePoids } from './app-saisie.ts'
import { Verification } from './Verification.tsx'
import { ModeNuit, type EtatModeNuit } from './ModeNuit.tsx'
import { Inconnu } from './Inconnu.tsx'
import { Icone } from './Icone.tsx'
import type { Persistance } from './app-donnees.ts'
import { TITRES_PANNEAU } from './PanneauLateral.tsx'
import { basculePanneau, useCoque, type PanneauLateral } from './coque-etat.ts'

export interface BarreHautProps {
  readonly focale: string
  readonly ouverture: string
  readonly capteurMode: CapteurMode
  readonly modeNuit: EtatModeNuit
  readonly surModeNuit: (etat: EtatModeNuit) => void
  readonly etat: EtatDemarrage | null
  readonly modeReseau: string
  readonly persistance: Persistance
  /** §8.3 — les poids de scoring, réglés depuis le tiroir des réglages. */
  readonly poids: SaisiePoids
}

/**
 * Les panneaux que la barre commande, dans l'ordre où ils s'ouvrent. L'ordre est un
 * contrat : on choisit une cible avant de lire le plan qui l'ordonne.
 */
const PANNEAUX: readonly PanneauLateral[] = ['CIBLES', 'NUIT', 'FILE']

export function BarreHaut(props: BarreHautProps) {
  const { panneau } = useCoque()

  return (
    <>
      <h1>Astrofort</h1>
      {/* T-0145 / T-0153 — seule lecture de la barre : c'est elle qui cale le bloc de
          commandes à droite, et la bande se soude à partir d'elle. */}
      <p className="etat barrehaut-lectures-fin">
        {/* T-0149 — un champ vidé pour être retapé n'efface pas la lecture : il la marque. */}
        {props.focale.trim() === '' ? <Inconnu /> : props.focale} mm f/
        {props.ouverture.trim() === '' ? <Inconnu /> : props.ouverture} ·{' '}
        {props.capteurMode === 'FULL_FRAME' ? 'plein format' : 'APS-C'}
      </p>

      {/* §11.1 — le mode nuit est un geste de terrain : il reste à portée, dans la barre. */}
      <details className="tiroir tiroir-nuit">
        <summary>
          <Icone
            nom={props.modeNuit.actif ? 'dark_mode' : 'light_mode'}
            libelle={props.modeNuit.actif ? 'actif' : 'inactif'}
          />
          mode nuit
        </summary>
        <div className="tiroir-contenu">
          <ModeNuit etat={props.modeNuit} surChangement={props.surModeNuit} />
        </div>
      </details>

      {/* Les panneaux latéraux. Un bouton pressé rouvre le panneau qu'il a ouvert : la
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
      {/* T-0047 — ce qui se règle une fois et ne décrit pas une séance : dernier élément de
          la barre, donc le plus à droite. */}
      <MenuReglages poids={props.poids} />
    </>
  )
}
