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
import {
  BASE_BOITIERS,
  ID_BOITIER_CUSTOM,
  libelleZpSource,
  type CapteurMode,
  type IsoRetenu,
  type PointZeroSysteme,
  type SaisieBoitier,
} from '../data/equipment.ts'
import { DOMAINES, type DomaineId } from '../registry/domains.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette, useNiveau } from './Terme.tsx'

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
  /** §5.1 — grandeurs remplacées par un générique du registre, donc [ESTIMÉ]. */
  readonly estimations: readonly string[]
  /** §5.1 — le recadrage resserre le cadre sans toucher à l'échantillonnage. */
  readonly noteRecadrage?: string
}

export interface PanneauMaterielProps {
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

/**
 * §5.1 — un champ du mode avancé : sa borne vient du registre, jamais du composant, et le
 * laisser vide n'est pas une erreur — c'est déclarer la grandeur inconnue.
 */
function ChampCapteur({
  domaine,
  valeur,
  surValeur,
  requis,
  nom,
}: {
  readonly domaine: DomaineId
  readonly valeur: string
  readonly surValeur: (v: string) => void
  readonly requis?: boolean
  /** Deux champs peuvent partager un domaine — largeur et hauteur de capteur. */
  readonly nom?: string
}) {
  const d = DOMAINES[domaine]
  return (
    <label>
      {nom ?? d.champ.replace(/^l[ea’]s? ?/u, '')} ({d.unite})
      <input
        value={valeur}
        inputMode="decimal"
        placeholder={requis === true ? `${d.min} à ${d.max}` : 'inconnu'}
        onChange={(e) => surValeur(e.target.value)}
      />
    </label>
  )
}

/** §5.1 — les six grandeurs du mode avancé, invisibles au débutant. */
function ChampsAvances({
  boitier,
  surChamp,
}: {
  readonly boitier: SaisieBoitier
  readonly surChamp: (champ: keyof SaisieBoitier) => (v: string) => void
}) {
  return (
    <div className="champs">
      <ChampCapteur
        domaine="read_noise_e"
        valeur={boitier.readNoiseE}
        surValeur={surChamp('readNoiseE')}
      />
      <ChampCapteur
        domaine="seuil_double_gain_iso"
        valeur={boitier.seuilDoubleGainIso}
        surValeur={surChamp('seuilDoubleGainIso')}
      />
      <ChampCapteur
        domaine="full_well_e"
        valeur={boitier.fullWellE}
        surValeur={surChamp('fullWellE')}
      />
      <ChampCapteur domaine="zp_sys" valeur={boitier.zpSys} surValeur={surChamp('zpSys')} />
      <ChampCapteur
        domaine="taille_raw_mo"
        valeur={boitier.tailleRawMo}
        surValeur={surChamp('tailleRawMo')}
      />
      <ChampCapteur
        domaine="autonomie_cipa"
        valeur={boitier.autonomieCipa}
        surValeur={surChamp('autonomieCipa')}
      />
    </div>
  )
}

export function PanneauMateriel(props: PanneauMaterielProps) {
  const lectures = props.lectures
  const niveau = useNiveau()
  const custom = props.boitier.boitierId === ID_BOITIER_CUSTOM
  const surChamp = (champ: keyof SaisieBoitier) => (v: string) =>
    props.surBoitier({ ...props.boitier, [champ]: v })

  return (
    <>
      <section>
        <h2>Boîtier</h2>
        <div className="champs">
          <label>
            Boîtier
            <select value={props.boitier.boitierId} onChange={(e) => surChamp('boitierId')(e.target.value)}>
              {BASE_BOITIERS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.libelle}
                </option>
              ))}
              <option value={ID_BOITIER_CUSTOM}>Autre boîtier — je saisis mon capteur</option>
            </select>
          </label>
        </div>
        {custom && (
          <>
            <p className="etat">
              Dimensions et pitch sont exigés : sans eux, ni champ ni échantillonnage
              n’existent. Le reste peut rester vide — le registre fournit son repli, et les
              sorties qui en dépendent portent [ESTIMÉ] (§2.3).
            </p>
            <div className="champs">
              <ChampCapteur
                domaine="capteur_mm"
                nom="largeur du capteur"
                valeur={props.boitier.capteurLMm}
                surValeur={surChamp('capteurLMm')}
                requis
              />
              <ChampCapteur
                domaine="capteur_mm"
                nom="hauteur du capteur"
                valeur={props.boitier.capteurHMm}
                surValeur={surChamp('capteurHMm')}
                requis
              />
              <ChampCapteur
                domaine="pitch_um"
                valeur={props.boitier.pitchUm}
                surValeur={surChamp('pitchUm')}
                requis
              />
            </div>
            {niveau === 'DEBUTANT' ? (
              <details>
                <summary>Grandeurs du capteur — mode avancé</summary>
                <ChampsAvances boitier={props.boitier} surChamp={surChamp} />
              </details>
            ) : (
              <ChampsAvances boitier={props.boitier} surChamp={surChamp} />
            )}
          </>
        )}
        {/* §7.1 — zp_source est affiché avec toute pose, donc aussi à sa source. */}
        {lectures !== undefined && (
          <p className={lectures.zeroSysteme.estime ? 'cause' : 'etat'}>
            {libelleZpSource(lectures.zeroSysteme)}
          </p>
        )}
        {lectures?.estimations.map((note) => (
          <p key={note} className="cause">
            [ESTIMÉ] {note}
          </p>
        ))}
        {/* §7.2 — l'ISO retenu se voit et se change ; le seuil de double gain le justifie. */}
        <div className="champs">
          <label>
            <Etiquette cle="iso_recommande" />
            <input
              value={props.iso}
              inputMode="numeric"
              placeholder={
                lectures === undefined ? 'recommandé' : `recommandé : ${lectures.iso.iso}`
              }
              onChange={(e) => props.surIso(e.target.value)}
            />
          </label>
        </div>
        {lectures !== undefined && (
          <p className={lectures.iso.readNoiseE === null ? 'cause' : 'etat'}>
            {lectures.iso.message}
          </p>
        )}
      </section>

      <section>
        <h2>Optique</h2>
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
              <option value="FULL_FRAME">Capteur entier — {props.boitier.boitierId === ID_BOITIER_CUSTOM ? 'boîtier saisi' : (BASE_BOITIERS.find((b) => b.id === props.boitier.boitierId)?.libelle ?? '')}</option>
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
