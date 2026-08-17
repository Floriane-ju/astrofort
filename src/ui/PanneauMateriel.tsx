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
import { BOITIER_REFERENCE, pointZeroSysteme, type CapteurMode } from '../data/equipment.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette } from './Terme.tsx'

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
  /** §5.1 — le recadrage resserre le cadre sans toucher à l'échantillonnage. */
  readonly noteRecadrage?: string
}

export interface PanneauMaterielProps {
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
  const zeroSysteme = pointZeroSysteme(BOITIER_REFERENCE)
  const lectures = props.lectures

  return (
    <>
      <section>
        <h2>Optique</h2>
        {/* ponytail: un seul boîtier en base — la ligne devient un select le jour où
            BASE_BOITIERS en porte plusieurs. */}
        <p className="etat">
          boîtier : {BOITIER_REFERENCE.libelle} · point zéro système {zeroSysteme.valeur} mag
          {zeroSysteme.estime ? ' [ESTIMÉ]' : ''}
        </p>
        <div className="champs">
          <label>
            <Etiquette cle="focale" />
            <input value={props.focale} onChange={(e) => props.surFocale(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="ouverture" />
            <input value={props.ouverture} onChange={(e) => props.surOuverture(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="recadrage_capteur" />
            <select
              value={props.capteurMode}
              onChange={(e) => props.surCapteurMode(e.target.value as CapteurMode)}
            >
              <option value="FULL_FRAME">Plein format — {BOITIER_REFERENCE.libelle}</option>
              <option value="APSC_CROP">Recadrage APS-C</option>
            </select>
          </label>
          <label>
            <Etiquette cle="type_objectif" />
            <select
              value={props.typeObjectif}
              onChange={(e) => props.surTypeObjectif(e.target.value as TypeObjectif)}
            >
              <option value="RECTILINEAIRE">Rectilinéaire — projection gnomonique</option>
              <option value="FISHEYE">Fisheye — projection équidistante</option>
            </select>
          </label>
        </div>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={props.comparerRecadrage}
            onChange={(e) => props.surComparerRecadrage(e.target.checked)}
          />
          Superposer les deux cadres, plein format et recadrage APS-C (§3.5)
        </label>
        {lectures?.noteRecadrage !== undefined && (
          <p className="cause">{lectures.noteRecadrage}</p>
        )}
      </section>

      <section>
        <h2>Suivi</h2>
        <div className="champs">
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={props.suiviActif}
              onChange={(e) => props.surSuiviActif(e.target.checked)}
            />
            Ma monture suit les étoiles
          </label>
          {props.suiviActif && (
            <label>
              <Etiquette cle="mise_en_station" />
              <select
                value={props.qualiteMes}
                onChange={(e) => props.surQualiteMes(e.target.value as QualiteMiseEnStation)}
              >
                <option value="SOIGNEE">Oui — viseur polaire réglé</option>
                <option value="APPROX">Non — mise en station à la boussole</option>
                <option value="INCONNUE">Je ne sais pas</option>
              </select>
            </label>
          )}
          <label>
            <Etiquette cle="type_monture" />
            <select
              value={props.typeMonture}
              onChange={(e) => props.surTypeMonture(e.target.value as TypeMonture)}
            >
              <option value="TRACKER">Monture sur rotule (tracker)</option>
              <option value="GEM">Équatoriale allemande</option>
              <option value="ALTAZ">Altazimutale</option>
            </select>
          </label>
        </div>
      </section>

      {props.erreur !== undefined && <p className="erreur">{props.erreur}</p>}

      {lectures !== undefined && (
        <section>
          <h2>Ce que ce matériel donne</h2>
          <TracedValue terme="champ" suffixe="largeur" trace={lectures.optique.fovLDeg} unite="°" />
          <TracedValue terme="champ" suffixe="hauteur" trace={lectures.optique.fovHDeg} unite="°" />
          <TracedValue terme="echantillonnage" trace={lectures.optique.echApx} unite="&quot;/px" />
          <p className={lectures.optique.alerte ? 'cause' : 'etat'}>
            {lectures.optique.messageDiag}
          </p>
          <TracedValue terme="diametre_pupille" trace={lectures.optique.dMm} unite="mm" />
          <TracedValue terme="pouvoir_separateur" trace={lectures.optique.dawesAs} unite="&quot;" />
          <TracedValue terme="npf" trace={lectures.poseNpf} unite="s" />
          <TracedValue terme="pose_max_suivi" trace={lectures.suivi.tMaxSuiviS} unite="s" />
          {lectures.suivi.cause !== undefined && <p className="cause">{lectures.suivi.cause}</p>}
          {lectures.suivi.gainMiseEnStation !== undefined && (
            <p className="cause">{lectures.suivi.gainMiseEnStation}</p>
          )}
        </section>
      )}
    </>
  )
}
