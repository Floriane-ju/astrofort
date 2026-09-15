/**
 * §5.1 + §5.2 — le panneau matériel : ce qu'on a, et ce que ça donne.
 *
 * La colonne de gauche ne porte que des propriétés de l'équipement — boîtier, focale,
 * ouverture, recadrage de capteur, type d'objectif, suivi — et, sous elles, la lecture
 * directe de ce que cet équipement produit. Le lieu et la date n'y sont pas : ils décrivent
 * la séance, pas le matériel, et vivent dans la colonne de droite.
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
import { ligneBoitier } from '../data/boitiers.ts'
import {
  ligneFormatCapteur,
  type FormatCapteur,
} from '../registry/capteur-formats.ts'
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
  readonly comparerRecadrage: boolean
  readonly surComparerRecadrage: (v: boolean) => void
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

export function PanneauMateriel(props: PanneauMaterielProps) {
  const lectures = props.lectures
  // Le format du capteur entier : celui du boîtier choisi quand il y en a un, sinon celui qui
  // vient d'être saisi. Sans cela, l'option nommerait le format de l'autre mode.
  const formatCapteur = (ligneBoitier(props.boitierId)?.saisie.formatCapteur ??
    props.boitier.formatCapteur) as FormatCapteur

  return (
    <>
      <PanneauBoitier
        boitierId={props.boitierId}
        surBoitierId={props.surBoitierId}
        boitier={props.boitier}
        surBoitier={props.surBoitier}
        iso={props.iso}
        surIso={props.surIso}
        lectureIso={lectures?.iso}
      />

      <section>
        <h2>Optique</h2>
        <div className="champs">
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
          <ChampChoix
            cle="recadrage_capteur"
            valeur={props.capteurMode}
            surChangement={props.surCapteurMode}
          >
            <option value="FULL_FRAME">
              Capteur entier — {ligneFormatCapteur(formatCapteur).libelle}
            </option>
            <option value="APSC_CROP">Recadrage APS-C</option>
          </ChampChoix>
        </div>
        <Interrupteur
          actif={props.typeObjectif === 'FISHEYE'}
          surChangement={(fisheye) =>
            props.surTypeObjectif(fisheye ? 'FISHEYE' : 'RECTILINEAIRE')
          }
        >
          Objectif fisheye
        </Interrupteur>
        <Interrupteur
          actif={props.comparerRecadrage}
          surChangement={props.surComparerRecadrage}
        >
          Superposer les deux cadres, plein format et recadrage APS-C
        </Interrupteur>
        {lectures?.noteRecadrage !== undefined && (
          <Mention ton="cause">{lectures.noteRecadrage}</Mention>
        )}
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

      <section>
        <h2>Suivi</h2>
        <div className="champs">
          <Interrupteur actif={props.suiviActif} surChangement={props.surSuiviActif}>
            Ma monture suit les étoiles
          </Interrupteur>
          {props.suiviActif && (
            <ChampChoix
              cle="mise_en_station"
              valeur={props.qualiteMes}
              surChangement={props.surQualiteMes}
            >
              <option value="SOIGNEE">Oui — viseur polaire réglé</option>
              <option value="APPROX">Non — mise en station à la boussole</option>
              <option value="INCONNUE">Je ne sais pas</option>
            </ChampChoix>
          )}
          {props.suiviActif && (
            <ChampChoix
              cle="type_monture"
              valeur={props.typeMonture}
              surChangement={props.surTypeMonture}
            >
              <option value="TRACKER">Monture sur rotule (tracker)</option>
              <option value="GEM">Équatoriale allemande</option>
            </ChampChoix>
          )}
          {/* T-0207 — l'altazimutale n'est pas un choix tant que la rotation de champ n'est pas
              modélisée (§5.2) : la proposer ne menait qu'à un refus. `etat` et non `cause` :
              rien n'est en défaut dans la saisie, c'est le périmètre de l'app qui se dit. */}
          {props.suiviActif && (
            <p className="etat">Les montures altazimutales ne sont pas encore gérées.</p>
          )}
          {/* §5.2 — fermer le ciel profond et le justifier sont un seul geste (core/tracking.ts) :
              cette cause doit rester visible sans naviguer, qu'on suive ou non. */}
          {lectures?.suivi.cause !== null && lectures?.suivi.cause !== undefined && (
            <Mention ton="cause">{lectures.suivi.cause}</Mention>
          )}
          {lectures?.suivi.gainMiseEnStation !== undefined && (
            <Mention ton="cause">{lectures.suivi.gainMiseEnStation}</Mention>
          )}
        </div>
      </section>

      {props.erreur !== undefined && <Mention ton="erreur">{props.erreur}</Mention>}
    </>
  )
}
