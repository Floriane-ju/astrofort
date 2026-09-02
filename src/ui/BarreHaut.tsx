/**
 * La barre haute : la marque, le matériel en une ligne, et le commutateur de mode.
 *
 * T-0113 — elle ne porte plus de réglage, seulement des bascules. L'ordre est un contrat : le
 * mode nuit d'abord parce qu'il se cherche dans le noir, la bascule de mode ensuite, puis la
 * vérification et les réglages en dernier (§11.3, T-0047).
 *
 * T-0153 — le tiroir des lectures est démonté. Il portait une phrase utile et quatre lectures
 * d'atelier ; la phrase est descendue au centre de la barre basse, où elle se lit sans un clic,
 * et la mention « az · h · champ » qui la répétait ici part avec elle.
 *
 * T-0180 — les trois boutons de panneau sont partis avec le tiroir qu'ils ouvraient : le mode
 * décide seul de ce que le panneau porte. Ne reste qu'une bascule à deux positions, et elle
 * tient le centre — c'est l'état le plus lourd de l'écran, il ne se cherche pas dans un coin.
 *
 * T-0184 — Vérification et Réglages ne font plus qu'un tiroir. Ils répondaient au même geste,
 * « ce qui sort du chemin principal », et l'enveloppe est donc unique : deux sections dedans,
 * la vérification d'abord parce qu'elle seule porte une conduite à tenir. L'alerte de
 * persistance remonte sur le tiroir fermé et NOMME sa section — une information qui n'existe
 * que pour qui pense à ouvrir un menu n'existe pas (§11.3).
 */

import type { EtatDemarrage } from '../data/bootstrap.ts'
import type { CapteurMode } from '../data/equipment.ts'
import { MenuReglages } from './MenuReglages.tsx'
import type { SaisiePoids } from './app-saisie.ts'
import { ALERTE_VERIFICATION, Verification } from './Verification.tsx'
import { ModeNuit, type EtatModeNuit } from './ModeNuit.tsx'
import { Inconnu } from './Inconnu.tsx'
import { Icone } from './Icone.tsx'
import type { Persistance } from './app-donnees.ts'
import { poseMode, useSeance, type ModeInterface } from './seance-etat.ts'

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
 * Les deux positions de la bascule, dans l'ordre du segment. L'ordre est un contrat : le
 * défaut d'abord, à gauche — la position dit laquelle est active autant que le fond.
 */
const MODES: readonly (readonly [ModeInterface, string])[] = [
  ['CIEL_PROFOND', 'Ciel profond'],
  ['PANORAMA', 'Panorama'],
]

export function BarreHaut(props: BarreHautProps) {
  const { mode } = useSeance()

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

      {/* §11.3 — le commutateur de premier rang. `aria-pressed` plutôt qu'`aria-expanded` :
          ces deux boutons ne déplient rien, ils choisissent lequel des deux états l'écran
          tient — et l'un des deux est toujours vrai. */}
      <div className="barrehaut-mode" role="group" aria-label="Mode d’interface">
        {MODES.map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            className={mode === cle ? 'onglet actif' : 'onglet'}
            aria-pressed={mode === cle}
            onClick={() => poseMode(cle)}
          >
            {libelle}
          </button>
        ))}
      </div>

      {/* T-0047 / T-0184 — ce qui sort du chemin principal : dernier élément de la barre,
          donc le plus à droite. T-0189 — le tiroir n'a plus AUCUN JavaScript : Échap vient de
          l'écoute unique du document, la même pour les trois tiroirs, et elle ramène le focus
          sur le `<summary>`. `<details>` porte le reste, ouverture, clavier et annonce. */}
      <details className="tiroir tiroir-outils" data-alerte={props.persistance.echec}>
        {/* T-0041 — le libellé porte l'alerte en mots, et dit de quelle section elle vient :
            le rouge ne l'annonce jamais seul (§11.1). */}
        <summary>
          <Icone nom="settings" />
          {props.persistance.echec ? ALERTE_VERIFICATION : 'réglages'}
        </summary>
        <div className="tiroir-contenu">
          <Verification
            etat={props.etat}
            modeReseau={props.modeReseau}
            messagePersistance={props.persistance.message}
            echecPersistance={props.persistance.echec}
            surExport={props.persistance.surExport}
            surImport={props.persistance.surImport}
          />
          <MenuReglages poids={props.poids} />
        </div>
      </details>
    </>
  )
}
