/**
 * Onglet « Filé » — §9.1 pose maximale, §9.2 prévisualisation, §9.3 filé, §9.4 séquence.
 *
 * Les quatre features partagent le même pointage et le même projecteur, parce qu'elles
 * décrivent la même photographie. Ce qui a changé au lot 6 : ce panneau n'a plus de canevas.
 * Le rendu se voit dans le cadre matériel, sur la scène (§3.5), avec le projecteur de la
 * scène — ici ne restent que les réglages et les nombres qu'ils produisent.
 *
 * Le rendu reste statique : une image par changement de réglage, jamais une boucle. Le
 * planétarium de §3 reste la vue animée, et activer l'incrustation fige d'ailleurs le temps.
 */

import { useMemo } from 'react'
import { K } from '../registry/constants.ts'
import { MENTION_SEMIS } from '../data/semis.ts'
import { axePoleDeDate, cielInstantane } from '../core/horloges.ts'
import { cartePoseMax, traceePx, type CartePoseMax } from '../core/grand-champ.ts'
import { diagnosticFile } from '../core/file-etoiles.ts'
import { magnitudeLimitePrevisu, vignettageDiaph, type EntreeProfondeur } from '../core/galactique.ts'
import { focaleEquivalente24x36 } from '../core/optics.ts'
import { sequenceFile } from '../core/sequence-file.ts'
import type { Site } from '../core/ephem.ts'
import { versSpherique } from '../core/mat3.ts'
import { projecteur, rayonProjete, type ModeProjection, type Vue } from '../core/projection.ts'
import { useScene } from './scene-etat.ts'
import { activeIncrustation, majFile, useSeance, type ModeApercu } from './seance-etat.ts'
import { MENTION_VIGNETTAGE_INCRUSTATION, mentionProjection } from './scene-overlay.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette } from './Terme.tsx'

/**
 * Définition de référence du cadre pour les diagnostics. Elle ne décrit aucun canevas :
 * c'est l'échelle en pixels sur laquelle §9.3 chiffre longueurs d'arcs et position du pôle.
 */
const LARGEUR_CADRE_PX = 1200
const DEG = Math.PI / 180
const S_PAR_MIN = 60
const POURCENT = 100

export interface PanneauFileProps {
  readonly site: Site
  readonly focaleMm: number
  readonly ouvertureN: number
  readonly pitchUm: number
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly fovLDeg: number
  readonly fovHDeg: number
  readonly echApx: number
  readonly tailleRawMo: number
  /** Profondeur atteinte par la pose unitaire (§9.2), assemblée une fois par l'application. */
  readonly profondeur: EntreeProfondeur
  /** §5.2 — plafond de la monture quand le suivi est actif, `null` sinon. */
  readonly tMaxSuiviS: number | null
  /** Autonomie CIPA du boîtier, absente de la base tant qu'elle n'est pas sourcée. */
  readonly autonomieCipa: number | null
  /** §5.1 — la projection imposée par le type d'objectif, réglé au panneau matériel. */
  readonly modeObjectif: ModeProjection
}

/** Une pose courte se lit à la dizaine de seconde près : l'arrondi à l'unité l'écraserait. */
function formatePose(tS: number): string {
  return tS < 10 ? tS.toFixed(1) : tS.toFixed(0)
}

function celluleClasse(tNpfS: number | null, tLimite: number | null): string {
  if (tNpfS === null) return 'pose-pole'
  if (tLimite === null) return 'pose-cellule'
  return tNpfS <= tLimite * K('ECART_POSE_CADRE_SIGNIFICATIF') ? 'pose-courte' : 'pose-longue'
}

/** Carte de pose maximale : une grille, pas un nombre (§9.1). */
function CartePose({ carte }: { readonly carte: CartePoseMax }) {
  const lignes = Array.from({ length: carte.cote }, (_, ligne) =>
    carte.cellules.slice(ligne * carte.cote, (ligne + 1) * carte.cote),
  )
  const limite = carte.tMaxCadreS.value
  return (
    <table className="carte-pose">
      <tbody>
        {lignes.map((cellules, ligne) => (
          <tr key={ligne}>
            {cellules.map((cellule, colonne) => (
              <td key={colonne} className={celluleClasse(cellule.tNpfS, limite)}>
                {cellule.tNpfS === null ? '∞' : `${formatePose(cellule.tNpfS)} s`}
                <span className="carte-pose-dec">δ {cellule.decDeg.toFixed(0)}°</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PanneauFile(props: PanneauFileProps) {
  // Le pointage est celui de la scène : cadrer ici cadre le planétarium de §3, et l'inverse.
  const { vue, actions } = useScene()
  const { azimutDeg, hauteurDeg, rotationDeg } = vue
  const { file, renduFile } = useSeance()

  const mode = props.modeObjectif
  const hauteurCadrePx = Math.round(
    (LARGEUR_CADRE_PX * rayonProjete(mode, (props.fovHDeg / 2) * DEG)) /
      rayonProjete(mode, (props.fovLDeg / 2) * DEG),
  )

  const ciel = useMemo(() => cielInstantane(props.site, new Date()), [props.site])
  // Les arcs tournent autour du pôle DE L'ÉPOQUE, pas de l'axe z du repère J2000 (§3.1).
  const axePoleNord = useMemo(() => axePoleDeDate(ciel.epoqueAnnee), [ciel.epoqueAnnee])

  const proj = useMemo(() => {
    const vueCadre: Vue = {
      mode,
      fovDeg: props.fovLDeg,
      largeurPx: LARGEUR_CADRE_PX,
      hauteurPx: hauteurCadrePx,
      azimutDeg,
      hauteurDeg,
      rotationDeg,
    }
    return projecteur(vueCadre, ciel.matrice)
  }, [mode, props.fovLDeg, hauteurCadrePx, azimutDeg, hauteurDeg, rotationDeg, ciel])
  const visee = useMemo(
    () => versSpherique(proj.inverse(LARGEUR_CADRE_PX / 2, hauteurCadrePx / 2)),
    [proj, hauteurCadrePx],
  )

  const focaleEquivalente = focaleEquivalente24x36(
    props.focaleMm,
    props.capteurLMm,
    props.capteurHMm,
  )

  const carte = useMemo(
    () =>
      cartePoseMax({
        focaleMm: props.focaleMm,
        ouvertureN: props.ouvertureN,
        pitchUm: props.pitchUm,
        fovLDeg: props.fovLDeg,
        fovHDeg: props.fovHDeg,
        centreAdDeg: visee.longitudeDeg,
        centreDecDeg: visee.latitudeDeg,
        rotationDeg,
        focaleEquivalenteMm: focaleEquivalente.value,
        tMaxSuiviS: props.tMaxSuiviS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, visee, rotationDeg, focaleEquivalente.value],
  )

  const profondeur = magnitudeLimitePrevisu(props.profondeur)
  const trainee = traceePx(file.tPoseS, carte.decMinAbsDeg, props.echApx)
  const poseDepassee = carte.poseOperanteS !== null && file.tPoseS > carte.poseOperanteS
  const mentionProj = mentionProjection(vue.mode, mode)

  const diagnostic = useMemo(
    () =>
      diagnosticFile({
        projecteur: proj,
        latitudeDeg: props.site.latitudeDeg,
        axePoleNord,
        dureeMin: file.dureeTotaleMin,
        decMinAbsDeg: carte.decMinAbsDeg,
        decMaxAbsDeg: carte.decMaxAbsDeg,
        hauteurCadreDeg: props.fovHDeg,
        arcsTronques: renduFile?.tronques ?? 0,
      }),
    [
      proj,
      props.site.latitudeDeg,
      axePoleNord,
      props.fovHDeg,
      file.dureeTotaleMin,
      carte,
      renduFile,
    ],
  )

  const sequence = useMemo(
    () =>
      sequenceFile({
        dureeTotaleMin: file.dureeTotaleMin,
        tPoseS: file.tPoseS,
        intervalleS: file.intervalleS,
        temperatureC: Number(file.temperatureC),
        tailleRawMo: props.tailleRawMo,
        autonomieCipa:
          file.autonomieSaisie.trim() === '' ? props.autonomieCipa : Number(file.autonomieSaisie),
        espaceLibreGo: file.espaceLibreGo.trim() === '' ? null : Number(file.espaceLibreGo),
        decDeg: carte.decMinAbsDeg,
        reductionBruitActive: file.reductionBruit,
      }),
    [file, props.tailleRawMo, props.autonomieCipa, carte.decMinAbsDeg],
  )

  return (
    <>
      <section>
        <h2>Grand champ et filé — §9</h2>

        <p className="etat">
          visée {visee.longitudeDeg.toFixed(2)}° AD / {visee.latitudeDeg.toFixed(2)}° δ · cadre{' '}
          {props.fovLDeg.toFixed(1)}° × {props.fovHDeg.toFixed(1)}°
          {renduFile !== null &&
            ` · ${renduFile.reelles} étoiles réelles et ${renduFile.generees} générées tracées`}
        </p>
        <p className="etat">{MENTION_SEMIS}</p>

        <div className="champs">
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={file.incrustation}
              onChange={(e) => activeIncrustation(e.target.checked)}
            />
            Incruster dans le cadre, sur la scène
          </label>
          <label>
            Aperçu
            <select
              value={file.apercu}
              onChange={(e) => majFile({ apercu: e.target.value as ModeApercu })}
            >
              <option value="CHAMP">Champ à étoiles fixes — une pose</option>
              <option value="FILE">Filé — durée totale accumulée</option>
            </select>
          </label>
          {/* Azimut et hauteur n'ont pas de curseur ici : le pointage se fait à la scène,
              en faisant glisser le planétarium (§3). Ce panneau les lit, il ne les commande
              pas — la visée courante se relit en tête de section. */}
          <label>
            Rotation du boîtier : {rotationDeg.toFixed(0)}°
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotationDeg}
              onChange={(e) => actions.majVue({ rotationDeg: Number(e.target.value) })}
            />
          </label>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={file.voieLactee}
              onChange={(e) => majFile({ voieLactee: e.target.checked })}
            />
            <Etiquette cle="voie_lactee" />
          </label>
        </div>

        {file.incrustation && (
          <>
            <p className="etat">
              Le temps de la scène est figé : un filé est une composition fixe, la vue animée
              reste le planétarium de §3.
            </p>
            <p className="cause">{MENTION_VIGNETTAGE_INCRUSTATION}</p>
            {mentionProj !== null && (
              <>
                <p className="cause">{mentionProj}</p>
                <button
                  type="button"
                  onClick={() => actions.majVue({ mode, fovDeg: props.fovLDeg })}
                >
                  Voir comme l’objectif
                </button>
              </>
            )}
          </>
        )}
      </section>

      <section>
        <h3>Pose maximale par déclinaison — §9.1</h3>
        <CartePose carte={carte} />
        <TracedValue terme="pose_max_cadre" trace={carte.tMaxCadreS} decimales={1} unite="s" />
        <TracedValue terme="regle_500" trace={carte.t500S} decimales={1} unite="s" />
        <TracedValue
          terme="focale_equivalente"
          trace={focaleEquivalente}
          decimales={1}
          unite="mm"
        />
        {carte.messages.map((message) => (
          <p className="cause" key={message}>
            {message}
          </p>
        ))}
      </section>

      <section>
        <h3>Prévisualisation de champ — §9.2</h3>
        <div className="champs">
          <label>
            Pose unitaire : {file.tPoseS.toFixed(0)} s
            <input
              type="range"
              min={1}
              max={K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S')}
              step={1}
              value={file.tPoseS}
              onChange={(e) => majFile({ tPoseS: Number(e.target.value) })}
            />
          </label>
        </div>
        <TracedValue terme="profondeur_previsu" trace={profondeur} decimales={1} unite="mag" />
        <TracedValue terme="trainee" trace={trainee} decimales={1} unite="px" />
        {/* Le vignettage n'a plus d'interrupteur : il se centre sur le canevas et non sur le
            cadre, donc il n'est jamais incrusté. Son chiffre, lui, reste une lecture du
            matériel — et il vaut pour l'image que le capteur enregistrera (§9.2). */}
        <TracedValue
          terme="vignettage"
          suffixe="coins du cadre"
          trace={vignettageDiaph(1)}
          decimales={1}
          unite="diaph"
        />
        {poseDepassee && carte.poseOperanteS !== null && (
          <p className="cause">
            Pose de {file.tPoseS.toFixed(0)} s au-delà de la pose max du cadre (
            {carte.poseOperanteS.toFixed(1)} s) : les étoiles sont rendues ovalisées, avec une
            traînée de {trainee.value.toFixed(1)} px. Ramener la pose à{' '}
            {carte.poseOperanteS.toFixed(0)} s les rend ponctuelles.
          </p>
        )}
        {poseDepassee && carte.poseOperanteS !== null && (
          <button
            type="button"
            onClick={() => majFile({ tPoseS: Math.max(1, Math.floor(carte.poseOperanteS!)) })}
          >
            Corriger la pose à {formatePose(carte.poseOperanteS)} s
          </button>
        )}
        {renduFile !== null && renduFile.reelles === 0 && (
          <p className="cause">
            Aucun repère brillant dans ce champ : aucune étoile catalographiée n’y tombe. En
            pointage manuel, ce cadre sera difficile à retrouver dans le viseur.
          </p>
        )}
      </section>

      <section>
        <h3>Filé d’étoiles — §9.3</h3>
        <div className="champs">
          <label>
            <Etiquette cle="duree_file" /> : {file.dureeTotaleMin.toFixed(0)} min
            <input
              type="range"
              min={5}
              max={480}
              step={5}
              value={file.dureeTotaleMin}
              onChange={(e) => majFile({ dureeTotaleMin: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="etat">
          durée dessinée dans le cadre :{' '}
          {file.apercu === 'FILE'
            ? `${(file.dureeTotaleMin * S_PAR_MIN).toFixed(0)} s accumulées`
            : `${file.tPoseS.toFixed(0)} s de pose unitaire`}
        </p>
        <TracedValue
          terme="longueur_arc"
          suffixe="arc le plus long du cadre"
          trace={diagnostic.longueurArcMaxDeg}
          decimales={2}
          unite="°"
        />
        <TracedValue
          terme="longueur_arc"
          suffixe="arc le plus court du cadre"
          trace={diagnostic.longueurArcMinDeg}
          decimales={2}
          unite="°"
        />
        <p className="etat">
          <Etiquette cle="pole_celeste" /> :{' '}
          {diagnostic.pole.dansCadre ? 'dans le cadre' : 'hors du cadre'} · hauteur{' '}
          {diagnostic.pole.altitudeDeg.toFixed(1)}° · azimut {diagnostic.pole.azimutDeg}° ·{' '}
          {(diagnostic.fractionHauteurCadre * POURCENT).toFixed(0)} % de la hauteur du cadre
        </p>
        {diagnostic.messages.map((message) => (
          <p className="cause" key={message}>
            {message}
          </p>
        ))}
      </section>

      <section>
        <h3>Séquence de filé — §9.4</h3>
        <div className="champs">
          <label>
            <Etiquette cle="intervalle_file" />
            <input
              type="number"
              min={0}
              step={1}
              value={file.intervalleS}
              onChange={(e) => majFile({ intervalleS: Number(e.target.value) })}
            />
          </label>
          <label>
            Température prévue (°C)
            <input
              value={file.temperatureC}
              onChange={(e) => majFile({ temperatureC: e.target.value })}
            />
          </label>
          <label>
            <Etiquette cle="autonomie_cipa" />
            <input
              value={file.autonomieSaisie}
              placeholder="images par charge"
              onChange={(e) => majFile({ autonomieSaisie: e.target.value })}
            />
          </label>
          <label>
            <Etiquette cle="espace_carte" />
            <input
              value={file.espaceLibreGo}
              placeholder="Go libres"
              onChange={(e) => majFile({ espaceLibreGo: e.target.value })}
            />
          </label>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={file.reductionBruit}
              onChange={(e) => majFile({ reductionBruit: e.target.checked })}
            />
            Réduction de bruit longue exposition active sur le boîtier
          </label>
        </div>

        {sequence.intervalleRefuse !== null && (
          <p className="erreur">{sequence.intervalleRefuse}</p>
        )}
        <TracedValue terme="n_poses_file" trace={sequence.nPoses} decimales={0} />
        <TracedValue terme="volume_stockage" trace={sequence.volumeGo} decimales={1} unite="Go" />
        <TracedValue terme="batteries" trace={sequence.nBatteries} decimales={0} />
        <p className="etat">
          <Etiquette cle="facteur_froid" /> : {sequence.facteurFroid.valeur} —{' '}
          {sequence.facteurFroid.libelle}
        </p>
        {sequence.interruptionStockage !== null && (
          <p className="cause">{sequence.interruptionStockage.message}</p>
        )}
        <ul>
          {sequence.consignesBloquantes.map((consigne) => (
            <li key={consigne}>{consigne}</li>
          ))}
        </ul>
        {sequence.messages.map((message) => (
          <p className="etat" key={message}>
            {message}
          </p>
        ))}
      </section>
    </>
  )
}
