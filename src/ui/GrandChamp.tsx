/**
 * §9 — Grand champ et filé d'étoiles.
 *
 * Une seule vue porte les quatre features : la carte de pose maximale (§9.1), la
 * prévisualisation de champ (§9.2), celle du filé (§9.3) et la logistique de séquence (§9.4).
 * Elles partagent le même pointage et le même projecteur, parce qu'elles décrivent la même
 * photographie — les séparer en trois écrans obligerait l'utilisateur à ressaisir un cadrage.
 *
 * Le rendu est statique : une image par changement de réglage, pas de boucle d'animation. Le
 * planétarium de §3 reste la vue animée.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { K } from '../registry/constants.ts'
import type { Etoile } from '../data/catalog.ts'
import { MENTION_SEMIS, semisGeneratif } from '../data/semis.ts'
import { construitIndex } from '../core/index-ciel.ts'
import { axePoleDeDate, cielInstantane } from '../core/horloges.ts'
import { cartePoseMax, traceePx, type CartePoseMax } from '../core/grand-champ.ts'
import { diagnosticFile } from '../core/file-etoiles.ts'
import { magnitudeLimitePrevisu, vignettageDiaph } from '../core/galactique.ts'
import { fluxCiel } from '../core/exposure.ts'
import { focaleEquivalente24x36 } from '../core/optics.ts'
import { sequenceFile } from '../core/sequence-file.ts'
import type { Site } from '../core/ephem.ts'
import { versSpherique } from '../core/mat3.ts'
import { projecteur, rayonProjete, type ModeProjection, type Vue } from '../core/projection.ts'
import { dessineChamp } from './dessine-champ.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette } from './Terme.tsx'

const LARGEUR_CANEVAS = 1200
const DEG = Math.PI / 180
const S_PAR_MIN = 60
const POURCENT = 100

/** §5.1 — le type d'objectif choisit la projection, il n'ajuste pas un rendu. */
type TypeObjectif = 'RECTILINEAIRE' | 'FISHEYE'
type ModeApercu = 'CHAMP' | 'FILE'

export interface GrandChampProps {
  readonly site: Site
  readonly etoiles: readonly Etoile[]
  readonly focaleMm: number
  readonly ouvertureN: number
  readonly pitchUm: number
  readonly capteurLMm: number
  readonly capteurHMm: number
  readonly fovLDeg: number
  readonly fovHDeg: number
  readonly echApx: number
  readonly dMm: number
  readonly zpSys: number
  readonly zpEstime: boolean
  readonly readNoiseE: number | null
  readonly sbCiel: number
  readonly tailleRawMo: number
  /** §5.2 — plafond de la monture quand le suivi est actif, `null` sinon. */
  readonly tMaxSuiviS: number | null
  /** Autonomie CIPA du boîtier, absente de la base tant qu'elle n'est pas sourcée. */
  readonly autonomieCipa: number | null
  readonly modeNuit: boolean
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

export function GrandChamp(props: GrandChampProps) {
  const canevas = useRef<HTMLCanvasElement>(null)

  const [typeObjectif, setTypeObjectif] = useState<TypeObjectif>('RECTILINEAIRE')
  const [apercu, setApercu] = useState<ModeApercu>('CHAMP')
  const [azimutDeg, setAzimutDeg] = useState(180)
  const [hauteurDeg, setHauteurDeg] = useState(K('SEUIL_HAUTEUR_IMAGERIE_DEG'))
  const [rotationDeg, setRotationDeg] = useState(0)
  const [tPoseS, setTPoseS] = useState(K('T_POSE_FILE_MAX_S'))
  const [dureeTotaleMin, setDureeTotaleMin] = useState(K('DUREE_FILE_SPECTACULAIRE_MIN'))
  const [intervalleS, setIntervalleS] = useState(K('INTERVALLE_INTER_POSE_FILE_MAX_S'))
  const [temperatureC, setTemperatureC] = useState('5')
  const [autonomieSaisie, setAutonomieSaisie] = useState('')
  const [espaceLibreGo, setEspaceLibreGo] = useState('')
  const [reductionBruit, setReductionBruit] = useState(false)
  const [voieLactee, setVoieLactee] = useState(true)
  const [vignettage, setVignettage] = useState(true)
  const [rendu, setRendu] = useState({ reelles: 0, generees: 0, tronques: 0 })

  const mode: ModeProjection = typeObjectif === 'FISHEYE' ? 'MODE_FISHEYE' : 'MODE_CADRE'
  const hauteurCanevas = Math.round(
    (LARGEUR_CANEVAS * rayonProjete(mode, (props.fovHDeg / 2) * DEG)) /
      rayonProjete(mode, (props.fovLDeg / 2) * DEG),
  )

  // §9.2 couche 1 — seules les étoiles catalographiées jusqu'au seuil sont réelles ; au-delà,
  // c'est le semis qui prend le relais, et l'écran le déclare.
  const indexReel = useMemo(
    () => construitIndex(props.etoiles.filter((e) => e.magV <= K('SEUIL_MAG_ETOILES_REELLES'))),
    [props.etoiles],
  )
  const indexSemis = useMemo(() => construitIndex(semisGeneratif()), [])

  const ciel = useMemo(() => cielInstantane(props.site, new Date()), [props.site])
  // Les arcs tournent autour du pôle DE L'ÉPOQUE, pas de l'axe z du repère J2000 (§3.1).
  const axePoleNord = useMemo(() => axePoleDeDate(ciel.epoqueAnnee), [ciel.epoqueAnnee])

  const proj = useMemo(() => {
    const vue: Vue = {
      mode,
      fovDeg: props.fovLDeg,
      largeurPx: LARGEUR_CANEVAS,
      hauteurPx: hauteurCanevas,
      azimutDeg,
      hauteurDeg,
      rotationDeg,
    }
    return projecteur(vue, ciel.matrice)
  }, [mode, props.fovLDeg, hauteurCanevas, azimutDeg, hauteurDeg, rotationDeg, ciel])
  const visee = useMemo(
    () => versSpherique(proj.inverse(LARGEUR_CANEVAS / 2, hauteurCanevas / 2)),
    [proj, hauteurCanevas],
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

  const readNoiseE = props.readNoiseE ?? K('READ_NOISE_DEFAUT_E')
  const eCiel = fluxCiel({
    sbMagArcsec2: props.sbCiel,
    zpSys: props.zpSys,
    pitchUm: props.pitchUm,
    ouvertureN: props.ouvertureN,
    zpEstime: props.zpEstime,
  })
  // Mémoïsée : l'objet part en dépendance de l'effet de rendu, et une identité neuve à
  // chaque rendu y relancerait une image sans fin.
  const entreeProfondeur = useMemo(
    () => ({
      tPoseS,
      dMm: props.dMm,
      zpSys: props.zpSys,
      eCielPxS: eCiel.value,
      readNoiseE,
      zpEstime: props.zpEstime,
    }),
    [tPoseS, props.dMm, props.zpSys, eCiel.value, readNoiseE, props.zpEstime],
  )
  const profondeur = magnitudeLimitePrevisu(entreeProfondeur)

  const dureeDessineeS = apercu === 'FILE' ? dureeTotaleMin * S_PAR_MIN : tPoseS
  const trainee = traceePx(tPoseS, carte.decMinAbsDeg, props.echApx)
  const poseDepassee = carte.poseOperanteS !== null && tPoseS > carte.poseOperanteS

  useEffect(() => {
    const contexte = canevas.current?.getContext('2d') ?? null
    if (contexte === null) return
    const sortie = dessineChamp({
      ctx: contexte,
      projecteur: proj,
      indexReel,
      indexSemis,
      magLimite: profondeur.value,
      profondeur: entreeProfondeur,
      echApx: props.echApx,
      // Un filé se fait sans suivi par construction : la bascule ne vaut que pour l'aperçu
      // de champ, où une monture qui suit rend les étoiles ponctuelles.
      suiviActif: apercu === 'CHAMP' && props.tMaxSuiviS !== null,
      sbCiel: props.sbCiel,
      dureeS: dureeDessineeS,
      latitudeDeg: props.site.latitudeDeg,
      axePoleNord,
      voieLactee,
      vignettage,
      modeNuit: props.modeNuit,
    })
    setRendu({
      reelles: sortie.etoilesReelles,
      generees: sortie.etoilesGenerees,
      tronques: sortie.arcsTronques,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    proj,
    indexReel,
    indexSemis,
    profondeur.value,
    props.sbCiel,
    props.site.latitudeDeg,
    axePoleNord,
    props.modeNuit,
    dureeDessineeS,
    voieLactee,
    vignettage,
    apercu,
    props.echApx,
    props.tMaxSuiviS,
    entreeProfondeur,
  ])

  const diagnostic = useMemo(
    () =>
      diagnosticFile({
        projecteur: proj,
        latitudeDeg: props.site.latitudeDeg,
        axePoleNord,
        dureeMin: dureeTotaleMin,
        decMinAbsDeg: carte.decMinAbsDeg,
        decMaxAbsDeg: carte.decMaxAbsDeg,
        hauteurCadreDeg: props.fovHDeg,
        arcsTronques: rendu.tronques,
      }),
    [proj, props.site.latitudeDeg, axePoleNord, props.fovHDeg, dureeTotaleMin, carte, rendu.tronques],
  )

  const sequence = useMemo(
    () =>
      sequenceFile({
        dureeTotaleMin,
        tPoseS,
        intervalleS,
        temperatureC: Number(temperatureC),
        tailleRawMo: props.tailleRawMo,
        autonomieCipa:
          autonomieSaisie.trim() === '' ? props.autonomieCipa : Number(autonomieSaisie),
        espaceLibreGo: espaceLibreGo.trim() === '' ? null : Number(espaceLibreGo),
        decDeg: carte.decMinAbsDeg,
        reductionBruitActive: reductionBruit,
      }),
    [
      dureeTotaleMin,
      tPoseS,
      intervalleS,
      temperatureC,
      props.tailleRawMo,
      props.autonomieCipa,
      autonomieSaisie,
      espaceLibreGo,
      carte.decMinAbsDeg,
      reductionBruit,
    ],
  )

  return (
    <section>
      <h2>Grand champ et filé — §9</h2>

      <canvas
        ref={canevas}
        className="previsu-champ"
        width={LARGEUR_CANEVAS}
        height={hauteurCanevas}
      />

      <p className="etat">
        visée {visee.longitudeDeg.toFixed(2)}° AD / {visee.latitudeDeg.toFixed(2)}° δ · cadre{' '}
        {props.fovLDeg.toFixed(1)}° × {props.fovHDeg.toFixed(1)}° ·{' '}
        {rendu.reelles} étoiles réelles et {rendu.generees} générées tracées
      </p>
      <p className="etat">{MENTION_SEMIS}</p>

      <div className="champs">
        <label>
          <Etiquette cle="type_objectif" />
          <select
            value={typeObjectif}
            onChange={(e) => setTypeObjectif(e.target.value as TypeObjectif)}
          >
            <option value="RECTILINEAIRE">Rectilinéaire — projection gnomonique</option>
            <option value="FISHEYE">Fisheye — projection équidistante</option>
          </select>
        </label>
        <label>
          Aperçu
          <select value={apercu} onChange={(e) => setApercu(e.target.value as ModeApercu)}>
            <option value="CHAMP">Champ à étoiles fixes — une pose</option>
            <option value="FILE">Filé — durée totale accumulée</option>
          </select>
        </label>
        <label>
          Azimut de visée : {azimutDeg.toFixed(0)}°
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={azimutDeg}
            onChange={(e) => setAzimutDeg(Number(e.target.value))}
          />
        </label>
        <label>
          Hauteur de visée : {hauteurDeg.toFixed(0)}°
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={hauteurDeg}
            onChange={(e) => setHauteurDeg(Number(e.target.value))}
          />
        </label>
        <label>
          Rotation du boîtier : {rotationDeg.toFixed(0)}°
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotationDeg}
            onChange={(e) => setRotationDeg(Number(e.target.value))}
          />
        </label>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={voieLactee}
            onChange={(e) => setVoieLactee(e.target.checked)}
          />
          <Etiquette cle="voie_lactee" />
        </label>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={vignettage}
            onChange={(e) => setVignettage(e.target.checked)}
          />
          <Etiquette cle="vignettage" />
        </label>
      </div>

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
            Pose unitaire : {tPoseS.toFixed(0)} s
            <input
              type="range"
              min={1}
              max={K('PLAFOND_POSE_SANS_AUTOGUIDAGE_S')}
              step={1}
              value={tPoseS}
              onChange={(e) => setTPoseS(Number(e.target.value))}
            />
          </label>
        </div>
        <TracedValue terme="profondeur_previsu" trace={profondeur} decimales={1} unite="mag" />
        <TracedValue terme="trainee" trace={trainee} decimales={1} unite="px" />
        <TracedValue
          terme="vignettage"
          suffixe="coins du cadre"
          trace={vignettageDiaph(1)}
          decimales={1}
          unite="diaph"
        />
        {poseDepassee && carte.poseOperanteS !== null && (
          <p className="cause">
            Pose de {tPoseS.toFixed(0)} s au-delà de la pose max du cadre (
            {carte.poseOperanteS.toFixed(1)} s) : les étoiles sont rendues ovalisées, avec une
            traînée de {trainee.value.toFixed(1)} px. Ramener la pose à{' '}
            {carte.poseOperanteS.toFixed(0)} s les rend ponctuelles.
          </p>
        )}
        {poseDepassee && carte.poseOperanteS !== null && (
          <button type="button" onClick={() => setTPoseS(Math.max(1, Math.floor(carte.poseOperanteS!)))}>
            Corriger la pose à {formatePose(carte.poseOperanteS)} s
          </button>
        )}
        {rendu.reelles === 0 && (
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
            <Etiquette cle="duree_file" /> : {dureeTotaleMin.toFixed(0)} min
            <input
              type="range"
              min={5}
              max={480}
              step={5}
              value={dureeTotaleMin}
              onChange={(e) => setDureeTotaleMin(Number(e.target.value))}
            />
          </label>
        </div>
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
              value={intervalleS}
              onChange={(e) => setIntervalleS(Number(e.target.value))}
            />
          </label>
          <label>
            Température prévue (°C)
            <input value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} />
          </label>
          <label>
            <Etiquette cle="autonomie_cipa" />
            <input
              value={autonomieSaisie}
              placeholder="images par charge"
              onChange={(e) => setAutonomieSaisie(e.target.value)}
            />
          </label>
          <label>
            <Etiquette cle="espace_carte" />
            <input
              value={espaceLibreGo}
              placeholder="Go libres"
              onChange={(e) => setEspaceLibreGo(e.target.value)}
            />
          </label>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={reductionBruit}
              onChange={(e) => setReductionBruit(e.target.checked)}
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
    </section>
  )
}
