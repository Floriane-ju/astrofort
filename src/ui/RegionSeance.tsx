/**
 * Ce que la coque pose sur la scène, et ce qu'elle ouvre à côté.
 *
 * T-0113 — le panneau droit à quatre onglets est démonté. Les quatre intentions n'avaient pas
 * la même nature : deux se règlent EN regardant le ciel — la vue et la cible — et deux se
 * lisent de haut en bas — le plan de nuit et le filé. Les premières sont devenues des cartes
 * posées sur la scène, repliables et déplaçables ; les secondes, un panneau latéral.
 *
 * Le partage n'est pas esthétique : une carte qu'on replie libère la scène sans perdre son
 * état, là où un onglet forçait à en abandonner un pour en lire un autre.
 *
 * T-0181 — le panneau ne s'ouvre plus : il est à demeure, et le mode décide de son contenu.
 */

import type { ReactNode } from 'react'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { EtatCible } from '../core/cibles-liste.ts'
import type { Etoile } from '../data/catalog.ts'
import { libelleZpSource } from '../data/equipment.ts'
import { Carte } from './Carte.tsx'
import { PanneauVue } from './PanneauVue.tsx'
import { PanneauLateral, TITRES_LATERAL } from './PanneauLateral.tsx'
import { PanneauCibles } from './PanneauCibles.tsx'
import { PanneauFile } from './PanneauFile.tsx'
import { FicheCible } from './FicheCible.tsx'
import { Pastilles } from './Pastilles.tsx'
import { Bulle } from './Bulle.tsx'
import { PlanSessionVue } from './PlanSession.tsx'
import { RegionNuit } from './RegionNuit.tsx'
import { modeObjectif } from './PanneauMateriel.tsx'
import { montreListeCibles, useSeance } from './seance-etat.ts'
import { AIDE_MATERIEL_INCOMPLET } from './Inconnu.tsx'
import type { SaisieLieu, SaisieMateriel } from './app-saisie.ts'
import type { ChaineCalcul } from './app-calcul.ts'

export interface RegionSeanceProps {
  readonly chaine: ChaineCalcul
  readonly lieu: SaisieLieu
  readonly materiel: SaisieMateriel
  readonly catalogue: readonly ObjetCielProfond[]
  readonly etoiles: readonly Etoile[]
  /** §3.4 — la cible ouverte depuis le planétarium, `null` tant qu'aucune ne l'a été. */
  readonly cibleDuCiel: ObjetCielProfond | null
  readonly gaiaCharge: boolean
  readonly epoqueAnnee: number
  readonly modeNuitActif: boolean
}

export interface CartesSeanceProps extends RegionSeanceProps {
  /** Le panneau matériel, assemblé par l'application : la carte ne fait que l'encadrer. */
  readonly materielRendu: ReactNode
}

/**
 * Les cartes de la scène.
 *
 * Le corps d'une carte repliée n'est PAS monté : replier la carte Vue ne la cache pas, elle
 * cesse d'exister — donc de s'abonner au magasin de scène et d'y recalculer une profondeur à
 * chaque geste de visée. C'est ce qui rend le repli utile et pas seulement discret.
 */
export function CartesSeance(props: CartesSeanceProps) {
  const { chaine, lieu, materiel } = props
  const { calcul, ciel } = chaine
  const sbCiel = ciel.ok ? ciel.ciel.sbCiel.value : null

  /* §11.2 — la seule région qui survit à l'impression : elle est nommée pour ça. */
  const planImprimable =
    calcul.ok && ciel.ok && chaine.plan !== null && chaine.fenetreUtile !== null ? (
      <PlanSessionVue
        plan={chaine.plan}
        fenetreUtile={chaine.fenetreUtile}
        site={chaine.site}
        fovHDeg={calcul.optique.fovHDeg.value}
        fovLDeg={calcul.optique.fovLDeg.value}
        mLimOeil={ciel.ciel.mLimOeil.value}
        etoiles={props.etoiles}
        enTete={{
          dateIso: lieu.dateIso,
          lieu: `${lieu.latitude}° / ${lieu.longitude}° — Bortle ${lieu.bortle}`,
          materiel:
            `${materiel.focale} mm f/${materiel.ouverture} — ${calcul.boitier.libelle} · ` +
            `ISO ${calcul.iso.iso} · ${libelleZpSource(calcul.zeroSysteme)}`,
        }}
      />
    ) : null

  return (
    <>
      <Carte cle="MATERIEL" titre="Matériel">
        {props.materielRendu}
      </Carte>

      <Carte cle="VUE" titre="Vue">
        <PanneauVue
          modeObjectif={modeObjectif(materiel.typeObjectif)}
          gaiaCharge={props.gaiaCharge}
          profondeurMag={chaine.index.profondeurMag}
          sbCiel={sbCiel}
          epoqueAnnee={props.epoqueAnnee}
          masque={chaine.masque}
        />
      </Carte>

      {/* T-0183 — le plan se consulte pendant qu'on regarde le ciel : vérifier l'heure du
          prochain créneau, la pose retenue, ce qui a été écarté. C'est ce qui en fait une
          carte, et non une colonne qu'on parcourt. Son corps reste monté replié — il est la
          seule région imprimable (§11.2). */}
      <Carte cle="PLAN" titre="Plan de nuit">
        {ciel.ok && (
          <RegionNuit
            nuit={ciel.nuit}
            ciel={ciel.ciel}
            offsetMidi={ciel.offsetMidi}
            planIndisponible={chaine.plan === null && props.catalogue.length === 0}
          />
        )}
        <div className="plan-session">{planImprimable}</div>
      </Carte>
    </>
  )
}

/**
 * §6.4 — le rappel de facilité, et la glose qui dit de quoi on parle.
 *
 * « Facilité » seul est ambigu — facilité de quoi, à trouver, à cadrer, à traiter ? La bulle
 * le ferme en une phrase, et la cause d'écart s'y ajoute sur une note 0 : un zéro qui ne dit
 * pas ce qui bloque n'indique aucun levier à tirer.
 *
 * `Bulle` plutôt qu'un `title` : T-0147 — l'infobulle native est la seule surface que la
 * palette de §11.1 ne peut pas atteindre, donc une lampe blanche en pleine interface de nuit.
 */
function RappelFacilite({ etat }: { readonly etat: EtatCible }) {
  const glose =
    etat.cause === null
      ? 'Facilité de prise de vue avec ce matériel, cette nuit.'
      : `Facilité de prise de vue avec ce matériel, cette nuit. ${etat.cause}`
  return (
    <Bulle texte={glose} place="bas">
      <span className="carte-rappel-glose">
        {/* §10.1 — le pointillé d'`Etiquette`, réemployé tel quel : c'est le signe que l'app
            emploie partout pour dire « une glose attend ici ». Le redessiner ailleurs en ferait
            une seconde convention, donc un mot souligné que l'utilisateur n'a plus à survoler. */}
        <span className="terme">
          <abbr>Facilité</abbr>
        </span>
        <Pastilles note={etat.note} libelle={etat.libelle} />
      </span>
    </Bulle>
  )
}

/**
 * Le panneau latéral et son plan imprimable.
 *
 * T-0181 — il n'y a plus de panneau à choisir : le mode le dit. En Ciel profond on choisit une
 * cible dans le catalogue, en Panorama on règle le panorama, et rien d'autre n'est monté.
 */
export function LateralSeance(props: RegionSeanceProps) {
  const { chaine, catalogue } = props
  const { calcul, ciel } = chaine
  const { mode, vueCibles } = useSeance()

  /* §3.4 — la fiche n'existe que sur une cible désignée : `ouvreCible` pose les deux d'un
     coup, et rien d'autre ne mène ici. */
  const fiche = mode === 'CIEL_PROFOND' && vueCibles === 'FICHE' && props.cibleDuCiel !== null

  /**
   * §6.4 — la note se LIT dans la map de la chaîne, elle ne se recalcule pas ici : c'est la
   * même entrée que la ligne de la liste du catalogue montre pour cette cible. Deux appels au
   * moteur, même identiques, étaient deux couvertures à garder d'accord — et elles ne
   * l'étaient pas.
   *
   * Elle ne vit QUE dans l'en-tête : la fiche détaille déjà cadrage, pose et intégration, et
   * une note qui agrège ces trois-là n'y ajoutait qu'une ligne à faire défiler.
   */
  const facilite =
    props.cibleDuCiel === null
      ? null
      : chaine.etatsCibles.get(props.cibleDuCiel.designation) ?? null

  return (
    <PanneauLateral
      titre={fiche && props.cibleDuCiel !== null ? props.cibleDuCiel.designation : TITRES_LATERAL[mode]}
      retour={fiche ? montreListeCibles : null}
      rappel={fiche && facilite !== null ? <RappelFacilite etat={facilite} /> : null}
    >
      {fiche && props.cibleDuCiel !== null ? (
        /* T-0149 — sans optique chiffrable, la fiche dit ce qui manque plutôt que de meubler. */
        chaine.contexteFiche === null ? (
          <p className="etat">{AIDE_MATERIEL_INCOMPLET}</p>
        ) : (
          <FicheCible {...chaine.contexteFiche} objet={props.cibleDuCiel} site={chaine.site} />
        )
      ) : mode === 'PANORAMA' ? (
        chaine.panneauFile === null ? (
          <p className="etat">{AIDE_MATERIEL_INCOMPLET}</p>
        ) : (
          <PanneauFile {...chaine.panneauFile} />
        )
      ) : /* T-0149 — la liste chiffre un cadrage : sans optique, elle dit ce qui manque. */
      calcul.ok && ciel.ok ? (
        <PanneauCibles
          catalogue={catalogue}
          site={chaine.site}
          sbCiel={ciel.ciel.sbCiel.value}
          mLimOeil={ciel.ciel.mLimOeil.value}
          dMm={calcul.optique.dMm.value}
          fovHDeg={calcul.optique.fovHDeg.value}
          echApx={calcul.optique.echApx.value}
          capteurHMm={calcul.capteur.capteurHMm}
          contexteSession={chaine.contexteSession}
          etats={chaine.etatsCibles}
        />
      ) : (
        <p className="etat">{AIDE_MATERIEL_INCOMPLET}</p>
      )}
    </PanneauLateral>
  )
}
