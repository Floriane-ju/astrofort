/**
 * §5.1 + §5.2 — le panneau matériel : ce qu'on a, et ce que ça donne.
 *
 * La colonne de gauche ne porte que des propriétés de l'équipement — boîtier, focale,
 * ouverture, recadrage de capteur, type d'objectif, suivi — et, sous elles, la lecture
 * directe de ce que cet équipement produit. Le lieu et la date n'y sont pas : ils décrivent
 * la séance, pas le matériel, et vivent dans la colonne de droite.
 *
 * T-0234 — deux cartes, plus trois. L'appareil et sa monture décrivent le même poste et
 * tiennent dans la carte « Boîtier » ; ne reste ici que l'objectif, avec ses deux nombres
 * côte à côte — focale et ouverture se règlent ensemble et se relisent ensemble (`f/`).
 *
 * Le type d'objectif était perdu dans la vue grand champ. C'est pourtant une propriété du
 * matériel, et §5.1 lui donne une conséquence physique : rectilinéaire ou fisheye choisit la
 * projection de la scène, il n'ajuste pas un rendu.
 *
 * Chaque nombre reste dépliable jusqu'à sa formule (§1.5.2) : les lectures sont des
 * `TracedValue`, jamais des chiffres nus.
 */

import type { ProfilOptique } from '../core/optics.ts'
import type { ProfilSuivi, QualiteMiseEnStation, TypeMonture } from '../core/tracking.ts'
import type { ModeProjection } from '../core/projection.ts'
import type { Traced } from '../core/traced.ts'
import type {
  CapteurMode,
  IsoRetenu,
  PointZeroSysteme,
  SaisieBoitier,
} from '../data/equipment.ts'
import { TracedValue } from './TracedValue.tsx'
import { PanneauBoitier } from './PanneauBoitier.tsx'
import { ChampChoix } from './ChampChoix.tsx'
import { ChampDomaine } from './ChampDomaine.tsx'
import { Interrupteur } from './Interrupteur.tsx'
import { LectureInconnue } from './Inconnu.tsx'
import { Mention } from './Mention.tsx'

/** §5.1 — le type d'objectif choisit la projection, il n'ajuste pas un rendu. */
export type TypeObjectif = 'RECTILINEAIRE' | 'FISHEYE'

/** La projection que cet objectif impose à la scène quand on veut voir comme lui. */
export function modeObjectif(type: TypeObjectif): ModeProjection {
  return type === 'FISHEYE' ? 'MODE_FISHEYE' : 'MODE_CADRE'
}

/** §5.2 — ce que la saisie décrit d'une monture : ce qu'elle suit, et comment elle est posée. */
export type ChoixMonture =
  | 'AUCUN'
  | 'TRACKER_SOIGNE'
  | 'TRACKER_APPROX'
  | 'GEM_SOIGNE'
  | 'GEM_APPROX'

interface ProfilMonture {
  readonly suiviActif: boolean
  readonly qualiteMes: QualiteMiseEnStation
  readonly typeMonture: TypeMonture
}

/**
 * T-0236 — sans suivi, le type de monture n'a plus de conséquence : celui retenu est celui qui
 * n'impose rien, pas de retournement au méridien (§8.2), et la mise en station reste non
 * renseignée. `APPROX` et `INCONNUE` ne sont plus deux réponses : `modeSuivi` (core/tracking.ts)
 * les traite déjà comme une seule mise en station approximative, et `INCONNUE` ne survit que
 * dans les profils déjà enregistrés.
 */
export const PROFILS_MONTURE: Readonly<Record<ChoixMonture, ProfilMonture>> = Object.freeze({
  AUCUN: { suiviActif: false, qualiteMes: 'INCONNUE', typeMonture: 'TRACKER' },
  TRACKER_SOIGNE: { suiviActif: true, qualiteMes: 'SOIGNEE', typeMonture: 'TRACKER' },
  TRACKER_APPROX: { suiviActif: true, qualiteMes: 'APPROX', typeMonture: 'TRACKER' },
  GEM_SOIGNE: { suiviActif: true, qualiteMes: 'SOIGNEE', typeMonture: 'GEM' },
  GEM_APPROX: { suiviActif: true, qualiteMes: 'APPROX', typeMonture: 'GEM' },
})

/**
 * Le choix qui décrit un profil. L'altazimutale retombe sur la rotule, comme au rechargement
 * d'un profil qui la porte encore (T-0207) : le sélecteur ne la propose pas, et la reprendre
 * telle quelle laisserait le champ sur une valeur sans option.
 */
export function choixMonture(profil: ProfilMonture): ChoixMonture {
  if (!profil.suiviActif) return 'AUCUN'
  const soignee = profil.qualiteMes === 'SOIGNEE'
  if (profil.typeMonture === 'GEM') return soignee ? 'GEM_SOIGNE' : 'GEM_APPROX'
  return soignee ? 'TRACKER_SOIGNE' : 'TRACKER_APPROX'
}

/** Ce que le matériel saisi produit. Absent tant que la saisie est refusée. */
export interface LecturesMateriel {
  readonly optique: ProfilOptique
  readonly suivi: ProfilSuivi
  readonly poseNpf: Traced<number | null>
  /** §7.1 — `zp_source` du boîtier retenu, affiché avec toute pose. */
  readonly zeroSysteme: PointZeroSysteme
  /** §7.2 — l'ISO retenu et la raison qui le justifie. */
  readonly iso: IsoRetenu
  /** §5.1 — le recadrage resserre le cadre sans toucher à l'échantillonnage. */
  readonly noteRecadrage?: string
}

export interface PanneauMaterielProps {
  /** T-0204 — ligne de la base `boitiers.md`, ou `''` pour décrire le capteur à la main. */
  readonly boitierId: string
  readonly surBoitierId: (v: string) => void
  /** §5.1 — le boîtier retenu, et ses grandeurs capteur quand il est saisi à la main. */
  readonly boitier: SaisieBoitier
  readonly surBoitier: (v: SaisieBoitier) => void
  /** §7.2 — ISO de capture ; vide = celui que le seuil de double gain recommande. */
  readonly iso: string
  readonly surIso: (v: string) => void
  readonly focale: string
  readonly surFocale: (v: string) => void
  readonly ouverture: string
  readonly surOuverture: (v: string) => void
  readonly capteurMode: CapteurMode
  readonly surCapteurMode: (v: CapteurMode) => void
  readonly typeObjectif: TypeObjectif
  readonly surTypeObjectif: (v: TypeObjectif) => void
  readonly suiviActif: boolean
  readonly surSuiviActif: (v: boolean) => void
  readonly qualiteMes: QualiteMiseEnStation
  readonly surQualiteMes: (v: QualiteMiseEnStation) => void
  readonly typeMonture: TypeMonture
  readonly surTypeMonture: (v: TypeMonture) => void
  /** Lectures du matériel courant, ou la cause du refus de saisie. */
  readonly lectures?: LecturesMateriel
  readonly erreur?: string
}

/**
 * §5.2 — le suivi : ce que la monture permet, et ce qu'elle interdit.
 *
 * T-0234 — il ferme la carte « Boîtier » au lieu d'en tenir une. Pas de titre : le champ nomme
 * déjà le sujet, et un `h3` sous un `h2` de carte n'aurait annoncé que lui.
 *
 * T-0236 — un champ, pas trois. L'interrupteur et les deux sélecteurs posaient trois questions
 * dont deux sans objet tant que la première n'était pas cochée, pour cinq réponses réellement
 * distinctes. Le moteur et le profil enregistré gardent leurs trois champs — c'est le contrat
 * §5.2 et le format d'export §12.3 — mais la saisie n'en montre qu'un.
 */
function ChampsSuivi(props: PanneauMaterielProps) {
  const lectures = props.lectures

  function surMonture(choix: ChoixMonture) {
    const profil = PROFILS_MONTURE[choix]
    props.surSuiviActif(profil.suiviActif)
    props.surQualiteMes(profil.qualiteMes)
    props.surTypeMonture(profil.typeMonture)
  }

  return (
    <>
      <div className="champs">
        <ChampChoix cle="type_monture" valeur={choixMonture(props)} surChangement={surMonture}>
          <option value="AUCUN">Pas de suivi</option>
          <option value="TRACKER_SOIGNE">
            Monture sur rotule (tracker) — viseur polaire réglé
          </option>
          <option value="TRACKER_APPROX">
            Monture sur rotule (tracker) — mise en station à la boussole
          </option>
          <option value="GEM_SOIGNE">Équatoriale allemande — viseur polaire réglé</option>
          <option value="GEM_APPROX">
            Équatoriale allemande — mise en station à la boussole
          </option>
        </ChampChoix>
      </div>
      {/* T-0207 — l'altazimutale n'est pas un choix tant que la rotation de champ n'est pas
          modélisée (§5.2) : la proposer ne menait qu'à un refus. `etat` et non `cause` :
          rien n'est en défaut dans la saisie, c'est le périmètre de l'app qui se dit. */}
      {props.suiviActif && (
        <p className="etat">Les montures altazimutales ne sont pas encore gérées.</p>
      )}
      {/* §5.2 — fermer le ciel profond et le justifier sont un seul geste (core/tracking.ts) :
          cette cause doit rester visible sans naviguer, qu'on suive ou non. Sans suivi, ce
          n'est pas un défaut de saisie mais le régime naturel du grand champ : `etat`, pas
          de signe d'alerte. La phrase longue (grand champ, NPF) reste dans `profilSuivi` —
          `domaineCpFerme` (PanneauCibles) en a besoin pour justifier l'exclusion du ciel
          profond ; ce panneau n'affiche que le repère court. */}
      {lectures?.suivi.mode === 'AUCUN' && (
        <Mention ton="etat">Sans suivi, les poses restent courtes.</Mention>
      )}
      {lectures?.suivi.cause !== null &&
        lectures?.suivi.cause !== undefined &&
        lectures.suivi.mode !== 'AUCUN' && <Mention ton="cause">{lectures.suivi.cause}</Mention>}
      {lectures?.suivi.gainMiseEnStation !== undefined && (
        <Mention ton="cause">{lectures.suivi.gainMiseEnStation}</Mention>
      )}
    </>
  )
}

export function PanneauMateriel(props: PanneauMaterielProps) {
  const lectures = props.lectures
  return (
    <>
      <PanneauBoitier
        boitierId={props.boitierId}
        surBoitierId={props.surBoitierId}
        boitier={props.boitier}
        surBoitier={props.surBoitier}
        iso={props.iso}
        surIso={props.surIso}
        capteurMode={props.capteurMode}
        surCapteurMode={props.surCapteurMode}
        noteRecadrage={lectures?.noteRecadrage}
        lectureIso={lectures?.iso}
        suivi={<ChampsSuivi {...props} />}
      />

      <section>
        <h2>Optique</h2>
        {/* T-0234 — `paire` force deux colonnes : `.champs` n'en fait tenir qu'une dans les
            19 rem de cette colonne, et ces deux nombres-là se lisent ensemble. */}
        <div className="champs paire">
          <ChampDomaine
            domaine="focale_mm"
            cle="focale"
            valeur={props.focale}
            surValeur={props.surFocale}
            requis
          />
          <ChampDomaine
            domaine="ouverture_N"
            cle="ouverture"
            valeur={props.ouverture}
            surValeur={props.surOuverture}
            requis
          />
        </div>
        <Interrupteur
          actif={props.typeObjectif === 'FISHEYE'}
          surChangement={(fisheye) =>
            props.surTypeObjectif(fisheye ? 'FISHEYE' : 'RECTILINEAIRE')
          }
        >
          Objectif fisheye
        </Interrupteur>
        {lectures === undefined ? (
          <>
            <LectureInconnue terme="champ" suffixe="largeur" />
            <LectureInconnue terme="champ" suffixe="hauteur" />
            <LectureInconnue terme="npf" />
          </>
        ) : (
          <>
            <TracedValue terme="champ" suffixe="largeur" trace={lectures.optique.fovLDeg} unite="°" />
            <TracedValue terme="champ" suffixe="hauteur" trace={lectures.optique.fovHDeg} unite="°" />
            <TracedValue terme="npf" trace={lectures.poseNpf} unite="s" />
          </>
        )}
      </section>

      {props.erreur !== undefined && <Mention ton="erreur">{props.erreur}</Mention>}
    </>
  )
}
