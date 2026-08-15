/**
 * Fiche d'une cible : §6.1 domaine, §6.2 cadrage, §6.3 détectabilité, §7 pose, intégration
 * et calibration, §10.2 explication dépliable.
 *
 * Toute la valeur de l'application tient dans cet écran, et il se livre avant le
 * planétarium. Ce qui est vérifiable ici, c'est la chaîne complète : d'un lieu et d'un
 * matériel jusqu'à « pose 13 s, 252 images, 8,3 Go », chaque nombre dépliable jusqu'à sa
 * formule et sa constante source.
 */

import { useEffect, useMemo, useState } from 'react'
import { ficheCadrage, verdictDomaine, type FicheCadrage, type VerdictDomaine } from '../core/framing.ts'
import { detectabilite, type Detectabilite } from '../core/detectability.ts'
import {
  dureeLisible,
  fluxCiel,
  fluxE,
  fluxObjet,
  integrationRequiseS,
  planIntegration,
  poseUnitaire,
  type PlanIntegration,
  type PoseUnitaire,
} from '../core/exposure.ts'
import { planCalibration, type PlanCalibration } from '../core/calibration.ts'
import { explication, type Explication } from '../core/explain.ts'
import {
  conseilFiltre,
  recommandationsEquipement,
  type ConseilFiltre,
  type SortieRecommandations,
} from '../core/recommandations.ts'
import type { FamilleFiltre } from '../registry/filters.ts'
import type { ProfilOptique } from '../core/optics.ts'
import type { Traced } from '../core/traced.ts'
import { SaisieRefuseeError } from '../registry/domains.ts'
import { PRESETS_SNR } from '../registry/verdicts.ts'
import { SOURCE_TABLE_CONTRASTE } from '../registry/contrast.ts'
import { TYPES_OBJET, type ObjetCielProfond, type TypeObjet } from '../data/deepsky.ts'
import {
  isoRecommande,
  type Boitier,
  type IsoRetenu,
  type PointZeroSysteme,
} from '../data/equipment.ts'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette, Terme } from './Terme.tsx'

/**
 * Cible par défaut : les valeurs de §6.3, pour que la chaîne de référence du PRD soit
 * lisible à l'ouverture. Le catalogue embarqué donne des dimensions légèrement différentes
 * — choisir M33 dans la liste remplace ces valeurs par celles d'OpenNGC.
 */
const CIBLE_REFERENCE = {
  designation: 'M33 (valeurs de référence §6.3)',
  typeObjet: 'GALAXIE' as TypeObjet,
  mInt: '5.7',
  aArcmin: '71',
  bArcmin: '42',
  posAngDeg: '23',
}

export interface FicheCibleProps {
  /**
   * §3.4 — cible ouverte depuis le planétarium. Un clic sur un objet du ciel profond charge
   * ici son verdict de cadrage, de détectabilité et son plan de capture : le planétarium
   * n'est pas décoratif, c'est le point d'entrée vers les moteurs.
   */
  readonly objetSelectionne?: ObjetCielProfond | null
  readonly optique: ProfilOptique
  readonly capteurHMm: number
  readonly pitchUm: number
  readonly ouvertureN: number
  readonly boitier: Boitier
  readonly zeroSysteme: PointZeroSysteme
  readonly sbCiel: number
  readonly mLimOeil: number | null
  /** Plafond de pose : monture avec suivi (§5.2), ou pose NPF sans suivi (§9.1). */
  readonly tMaxS: number | null
  readonly catalogue: readonly ObjetCielProfond[]
  /** Classe Bortle déclarée, quand elle l'est : elle conditionne le conseil filtre (§7.5). */
  readonly bortle: number | null
  readonly suiviActif: boolean
  readonly focaleMm: number
}

interface Conseils {
  readonly filtre: ConseilFiltre
  readonly recommandations: SortieRecommandations
}

interface Resultat {
  readonly domaine: VerdictDomaine
  readonly cadrage: FicheCadrage
  readonly detect: Detectabilite
  readonly eCiel: Traced<number>
  readonly eObj: Traced<number> | null
  readonly pose: PoseUnitaire | null
  readonly integration: PlanIntegration | null
  readonly calibration: PlanCalibration | null
  readonly explique: Explication | null
}

function nombreOuNull(texte: string): number | null {
  const valeur = Number(texte)
  return texte.trim() === '' || !Number.isFinite(valeur) ? null : valeur
}

export function FicheCible(props: FicheCibleProps) {
  const [filtreDualBand, setFiltreDualBand] = useState(false)
  const [explicationDepliee, setExplicationDepliee] = useState(false)
  const [designation, setDesignation] = useState(CIBLE_REFERENCE.designation)
  const [typeObjet, setTypeObjet] = useState<TypeObjet>(CIBLE_REFERENCE.typeObjet)
  const [mInt, setMInt] = useState(CIBLE_REFERENCE.mInt)
  const [aArcmin, setAArcmin] = useState(CIBLE_REFERENCE.aArcmin)
  const [bArcmin, setBArcmin] = useState(CIBLE_REFERENCE.bArcmin)
  const [posAngDeg, setPosAngDeg] = useState(CIBLE_REFERENCE.posAngDeg)
  const [snrCible, setSnrCible] = useState(PRESETS_SNR[1]!.valeur)

  const iso = isoRecommande(props.boitier)

  function appliqueObjet(objet: ObjetCielProfond) {
    setDesignation(objet.designation)
    setTypeObjet(objet.type)
    setMInt(objet.vMag === null ? '' : String(objet.vMag))
    setAArcmin(objet.majAxArcmin === null ? '' : String(objet.majAxArcmin))
    setBArcmin(objet.minAxArcmin === null ? '' : String(objet.minAxArcmin))
    setPosAngDeg(objet.posAngDeg === null ? '' : String(objet.posAngDeg))
  }

  function choisitDansCatalogue(designationChoisie: string) {
    const objet = props.catalogue.find((o) => o.designation === designationChoisie)
    if (objet !== undefined) appliqueObjet(objet)
  }

  const objetSelectionne = props.objetSelectionne ?? null
  useEffect(() => {
    if (objetSelectionne !== null) appliqueObjet(objetSelectionne)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetSelectionne])

  const calcul = useMemo<{ ok: true; r: Resultat } | { ok: false; erreur: string }>(() => {
    try {
      return {
        ok: true,
        r: evalue(props, { typeObjet, mInt, aArcmin, bArcmin, posAngDeg }, snrCible, iso),
      }
    } catch (erreur) {
      if (erreur instanceof SaisieRefuseeError) return { ok: false, erreur: erreur.message }
      throw erreur
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, typeObjet, mInt, aArcmin, bArcmin, posAngDeg, snrCible, iso.iso])

  /**
   * §7.5 et §10.3 — le conseil filtre et la recommandation d'équipement ne sont calculés
   * qu'à l'ouverture de l'explication. Jamais de bandeau, jamais de suggestion spontanée.
   */
  const conseils = useMemo<Conseils | null>(() => {
    if (!calcul.ok) return null
    const { r } = calcul
    if (r.pose === null || r.integration === null || r.eObj === null) return null
    const filtres: readonly FamilleFiltre[] = filtreDualBand ? ['DUAL_BAND'] : []
    const filtre = conseilFiltre({
      typeObjet,
      filtresPossedes: filtres,
      bortle: props.bortle,
      // La fiche évalue une cible hors contexte de nuit : la Lune est portée par le plan
      // de session (§8.1), pas ici. Seul le fond de ciel déclaré déclenche le conseil.
      deltaSbLuneMag: 0,
      cadragePlanifiable: r.cadrage.faisable,
      explicationDepliee,
      eObj: r.eObj.value,
      eCiel: r.eCiel.value,
      tPoseS: r.pose.tRecommandeS.value,
      readNoiseE: r.pose.readNoiseUtiliseE,
      snrCible,
      tailleRawMo: props.boitier.tailleRawMo,
    })
    return {
      filtre,
      recommandations: recommandationsEquipement({
        conseilFiltre: filtre,
        verdictDefavorable: r.detect.verdict === 'PHOTO_SEULE' || !r.cadrage.faisable,
        explicationDepliee,
        leviersPresentes: (r.explique?.leviers ?? []).map((l) => l.code),
        verdictCadrage: r.cadrage.verdict,
        focaleActuelleMm: props.focaleMm,
        focaleIdealeMm: r.cadrage.focaleIdealeMm?.value ?? null,
        nTuiles: r.cadrage.nTuiles?.value ?? null,
        regimeLimiteSuivi: r.pose.regime === 'LIMITE_SUIVI',
        suiviActif: props.suiviActif,
        tOptS: r.pose.tOptS.value,
        tMaxSuiviS: props.tMaxS,
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcul, filtreDualBand, explicationDepliee, typeObjet, snrCible, props])

  return (
    <>
      <section>
        <h2>Cible</h2>
        <div className="champs">
          <label>
            Désignation
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </label>
          {props.catalogue.length > 0 && (
            <label>
              Choisir dans le catalogue
              <select value="" onChange={(e) => choisitDansCatalogue(e.target.value)}>
                <option value="">—</option>
                {props.catalogue.slice(0, 400).map((o) => (
                  <option key={o.designation} value={o.designation}>
                    {o.designation}
                    {o.nomsCommuns === '' ? '' : ` — ${o.nomsCommuns.split('|')[0]}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Type d’objet
            <select value={typeObjet} onChange={(e) => setTypeObjet(e.target.value as TypeObjet)}>
              {TYPES_OBJET.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Etiquette cle="magnitude_integree" />
            <input value={mInt} onChange={(e) => setMInt(e.target.value)} placeholder="absente" />
          </label>
          <label>
            Grand axe (’)
            <input value={aArcmin} onChange={(e) => setAArcmin(e.target.value)} />
          </label>
          <label>
            Petit axe (’)
            <input value={bArcmin} onChange={(e) => setBArcmin(e.target.value)} />
          </label>
          <label>
            Angle de position (°)
            <input
              value={posAngDeg}
              onChange={(e) => setPosAngDeg(e.target.value)}
              placeholder="absent du catalogue"
            />
          </label>
        </div>
      </section>

      {!calcul.ok && <p className="erreur">{calcul.erreur}</p>}
      {calcul.ok && (
        <Verdicts
          r={calcul.r}
          snrCible={snrCible}
          surSnr={setSnrCible}
          isoLibelle={iso.message}
          conseils={conseils}
          filtreDualBand={filtreDualBand}
          surFiltre={setFiltreDualBand}
          surDeplie={setExplicationDepliee}
        />
      )}
    </>
  )
}

interface SaisieCible {
  readonly typeObjet: TypeObjet
  readonly mInt: string
  readonly aArcmin: string
  readonly bArcmin: string
  readonly posAngDeg: string
}

function evalue(
  props: FicheCibleProps,
  saisie: SaisieCible,
  snrCible: number,
  iso: IsoRetenu,
): Resultat {
  const fovHDeg = props.optique.fovHDeg.value
  const domaine = verdictDomaine(fovHDeg, props.catalogue)
  const a = nombreOuNull(saisie.aArcmin)
  const b = nombreOuNull(saisie.bArcmin)
  const m = nombreOuNull(saisie.mInt)

  const cadrage = ficheCadrage({
    fovHDeg,
    echApx: props.optique.echApx.value,
    capteurHMm: props.capteurHMm,
    tailleMajArcmin: a ?? 0,
    tailleMinArcmin: b,
    posAngDeg: nombreOuNull(saisie.posAngDeg),
  })

  const detect = detectabilite({
    mInt: m,
    aArcmin: a,
    bArcmin: b,
    typeObjet: saisie.typeObjet,
    sbCiel: props.sbCiel,
    mLimOeil: props.mLimOeil,
    dMm: props.optique.dMm.value,
  })

  const zpEstime = props.zeroSysteme.estime
  const eCiel = fluxCiel({
    sbMagArcsec2: props.sbCiel,
    zpSys: props.zeroSysteme.valeur,
    pitchUm: props.pitchUm,
    ouvertureN: props.ouvertureN,
    zpEstime,
  })

  const sbObj = detect.sbObj.value
  if (sbObj === null) {
    return { domaine, cadrage, detect, eCiel, eObj: null, pose: null, integration: null, calibration: null, explique: null }
  }

  const eObj = fluxObjet({
    sbMagArcsec2: sbObj,
    zpSys: props.zeroSysteme.valeur,
    pitchUm: props.pitchUm,
    ouvertureN: props.ouvertureN,
    zpEstime,
  })

  const pose = poseUnitaire({
    eCiel: eCiel.value,
    readNoiseE: iso.readNoiseE,
    tMaxS: props.tMaxS,
    zpEstime,
  })

  const entreeIntegration = {
    eObj: eObj.value,
    eCiel: eCiel.value,
    tPoseS: pose.tRecommandeS.value,
    readNoiseE: pose.readNoiseUtiliseE,
    snrCible,
    tailleRawMo: props.boitier.tailleRawMo,
  }
  const integration = planIntegration(entreeIntegration)

  const calibration = planCalibration({
    tPoseS: pose.tAfficheeS,
    iso: iso.iso,
    nPoses: integration.nPoses.value,
    autoguidage: false,
  })

  // §10.2 — la sensibilité est calculée sur la sortie qui porte le verdict : la durée
  // d'intégration requise. Les fluxes sont recalculés sans garde de domaine, pour que la
  // perturbation d'une entrée ne bute pas sur une borne de saisie.
  const point = {
    sb_obj: sbObj,
    sb_ciel: props.sbCiel,
    t_pose_s: pose.tRecommandeS.value,
    read_noise_e: pose.readNoiseUtiliseE,
    snr_cible: snrCible,
  }
  const sortie = (v: Readonly<Record<string, number>>): number =>
    integrationRequiseS(
      {
        eObj: fluxE(v.sb_obj!, props.zeroSysteme.valeur, props.pitchUm, props.ouvertureN),
        eCiel: fluxE(v.sb_ciel!, props.zeroSysteme.valeur, props.pitchUm, props.ouvertureN),
        tPoseS: v.t_pose_s!,
        readNoiseE: v.read_noise_e!,
        snrCible: v.snr_cible!,
        tailleRawMo: props.boitier.tailleRawMo,
      },
      v.snr_cible!,
    )

  const explique = explication({
    verdictN1: `${detect.verdict} — environ ${dureeLisible(integration.tRequisS.value)} d’intégration pour la qualité visée.`,
    phraseFacteur: detect.explication,
    etapes: [
      { libelle: 'Brillance de surface de l’objet', trace: detect.sbObj },
      { libelle: 'Contraste sur le fond de ciel', trace: detect.deltaSb },
      { libelle: 'Flux du fond de ciel', trace: eCiel },
      { libelle: 'Flux de l’objet', trace: eObj },
      { libelle: 'Pose optimale', trace: pose.tOptS },
      { libelle: 'Pose retenue', trace: pose.tRecommandeS },
      { libelle: 'Intégration requise', trace: integration.tRequisS },
      { libelle: 'Nombre de poses', trace: integration.nPoses },
      { libelle: 'Volume de stockage', trace: integration.volumeGo },
    ],
    sortie,
    point,
    contexte: {
      verdict: detect.verdict,
      typeObjet: saisie.typeObjet,
      cibleImposee: true,
      cadrageRefuse: !cadrage.faisable,
    },
  })

  return { domaine, cadrage, detect, eCiel, eObj, pose, integration, calibration, explique }
}

interface VerdictsProps {
  readonly r: Resultat
  readonly snrCible: number
  readonly surSnr: (valeur: number) => void
  readonly isoLibelle: string
  readonly conseils: Conseils | null
  readonly filtreDualBand: boolean
  readonly surFiltre: (valeur: boolean) => void
  readonly surDeplie: (valeur: boolean) => void
}

function Verdicts({
  r,
  snrCible,
  surSnr,
  isoLibelle,
  conseils,
  filtreDualBand,
  surFiltre,
  surDeplie,
}: VerdictsProps) {
  return (
    <>
      <section>
        <h2>Ce que ce setup cadre — §6.1</h2>
        <p className="etat">domaine : {r.domaine.domaine}</p>
        <p>{r.domaine.phrase}</p>
        <TracedValue terme="fenetre_cadrage" suffixe="taille minimale" trace={r.domaine.tailleMinDeg} unite="°" />
        <TracedValue terme="fenetre_cadrage" suffixe="taille maximale" trace={r.domaine.tailleMaxDeg} unite="°" />
        {r.domaine.causeAbsence !== undefined && <p className="cause">{r.domaine.causeAbsence}</p>}
        {r.domaine.cibles.length > 0 && (
          <ul>
            {r.domaine.cibles.map((o) => (
              <li key={o.designation}>
                {o.designation}
                {o.nomsCommuns === '' ? '' : ` — ${o.nomsCommuns.split('|')[0]}`} ·{' '}
                {o.majAxArcmin?.toFixed(0)}’ · mag {o.vMag ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Cadrage de la cible — §6.2</h2>
        <p className="etat">verdict : {r.cadrage.verdict}</p>
        <TracedValue terme="remplissage" trace={r.cadrage.remplissage} decimales={3} />
        <TracedValue terme="diametre_pixels" trace={r.cadrage.diamPx} decimales={0} unite="px" />
        {r.cadrage.nTuiles !== undefined && (
          <TracedValue terme="mosaique" trace={r.cadrage.nTuiles} decimales={0} unite="tuiles" />
        )}
        <p className={r.cadrage.faisable ? 'etat' : 'cause'}>{r.cadrage.message}</p>
        <p className="etat">{r.cadrage.noteOrientation}</p>
        {r.cadrage.cause !== undefined && <p className="cause">{r.cadrage.cause}</p>}
        {r.cadrage.focaleIdealeMm !== undefined && (
          <TracedValue terme="focale_ideale" trace={r.cadrage.focaleIdealeMm} decimales={0} unite="mm" />
        )}
      </section>

      <section>
        <h2>Détectabilité — §6.3</h2>
        <p className="etat">verdict : {r.detect.verdict ?? '[DONNÉE MANQUANTE]'}</p>
        <TracedValue terme="brillance_surface" trace={r.detect.sbObj} unite="mag/as²" />
        <TracedValue terme="contraste_ciel" trace={r.detect.deltaSb} unite="mag/as²" />
        <TracedValue terme="magnitude_limite_instrument" trace={r.detect.mLimInstr} unite="mag" />
        <p>{r.detect.explication}</p>
        <p className="etat">
          <Etiquette cle="tolerance_lune" /> : {r.detect.toleranceLune} — {r.detect.conseilType}
        </p>
        {r.detect.noteLune !== undefined && <p className="etat">{r.detect.noteLune}</p>}
        <p className="tracee-source">Seuils de contraste : {SOURCE_TABLE_CONTRASTE}</p>
      </section>

      <section>
        <h2>Pose — §7.1 et §7.2</h2>
        <TracedValue terme="flux_ciel" trace={r.eCiel} unite="e⁻/s/px" />
        {r.eObj !== null && <TracedValue terme="flux_objet" trace={r.eObj} decimales={3} unite="e⁻/s/px" />}
        {r.pose === null && (
          <p className="cause">
            Aucune pose n’est chiffrée : la donnée source manque pour cette cible.
          </p>
        )}
        {r.pose !== null && (
          <>
            <TracedValue terme="pose_unitaire" trace={r.pose.tOptS} decimales={1} unite="s" />
            <p className="etat">
              <Etiquette cle="plage_utile" /> : poser {r.pose.tAfficheeS} s — de{' '}
              {r.pose.plageUtileS.value[0]} à {r.pose.plageUtileS.value[1]} s, c’est équivalent.
            </p>
            <p className="etat">
              <Etiquette cle="regime_pose" /> : {r.pose.regime}
            </p>
            <p className={r.pose.regime === 'NOMINAL' ? 'etat' : 'cause'}>{r.pose.message}</p>
            <p className="etat">
              <Etiquette cle="iso_recommande" /> : {isoLibelle}
            </p>
            {r.pose.readNoiseEstime && (
              <p className="cause">
                [ESTIMÉ] Bruit de lecture inconnu : {r.pose.readNoiseUtiliseE} e⁻ appliqué et affiché.
              </p>
            )}
          </>
        )}
      </section>

      {r.integration !== null && (
        <section>
          <h2>Combien de photos — §7.3</h2>
          <label>
            <Etiquette cle="snr_cible" />
            <select value={snrCible} onChange={(e) => surSnr(Number(e.target.value))}>
              {PRESETS_SNR.map((p) => (
                <option key={p.cle} value={p.valeur}>
                  {p.libelle} — {p.valeur}
                </option>
              ))}
            </select>
          </label>
          <TracedValue
            terme="integration_totale"
            trace={r.integration.tRequisS}
            decimales={0}
            unite="s"
          />
          <p className="etat">soit {dureeLisible(r.integration.tRequisS.value)}</p>
          <TracedValue terme="nombre_poses" trace={r.integration.nPoses} decimales={0} unite="poses" />
          <TracedValue terme="volume_stockage" trace={r.integration.volumeGo} decimales={1} unite="Go" />
          {r.integration.nNuits !== undefined && (
            <TracedValue terme="nombre_nuits" trace={r.integration.nNuits} decimales={0} unite="nuits" />
          )}
          <p className="etat">{r.integration.loiFondamentale}</p>
          {r.integration.messages.map((m) => (
            <p key={m} className={r.integration!.horsDePortee ? 'cause' : 'etat'}>
              {m}
            </p>
          ))}
        </section>
      )}

      {r.calibration !== null && (
        <section>
          <h2>Plan de calibration — §7.4</h2>
          <Terme cle="plan_calibration" />
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Nombre</th>
                <th>Plage</th>
                <th>Consigne</th>
              </tr>
            </thead>
            <tbody>
              {r.calibration.lots.map((lot) => (
                <tr key={lot.type}>
                  <td>{lot.type}</td>
                  <td>{lot.nombre}</td>
                  <td>
                    {lot.plage[0]} à {lot.plage[1]}
                  </td>
                  <td>{lot.consigne}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TracedValue
            terme="plan_calibration"
            suffixe="surcoût de temps"
            trace={r.calibration.surcoutTempsMin}
            decimales={0}
            unite="min"
          />
          <p className="etat">
            <Etiquette cle="dithering" /> : {r.calibration.dithering}
          </p>
          {r.calibration.causeInvalidation !== undefined && (
            <p className="cause">{r.calibration.causeInvalidation}</p>
          )}
          {r.calibration.avertissements.map((a) => (
            <p key={a} className="cause">
              {a}
            </p>
          ))}
        </section>
      )}

      {r.explique !== null && (
        <section>
          <h2>Pourquoi ce verdict — §10.2</h2>
          <p className="etat">{r.explique.n1}</p>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={filtreDualBand}
              onChange={(e) => surFiltre(e.target.checked)}
            />
            Je possède un filtre bi-bande Hα / OIII
          </label>
          <details
            className="tracee"
            onToggle={(e) => surDeplie((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary>
              <span>
                <Etiquette cle="facteur_dominant" />
              </span>
              <span className="tracee-valeur">{r.explique.facteurs.join(' et ')}</span>
            </summary>
            <div className="tracee-detail">
              <p>{r.explique.n2}</p>
              <dl className="tracee-entrees">
                {Object.entries(r.explique.sensibilites).map(([nom, valeur]) => (
                  <div key={nom}>
                    <dt>{nom}</dt>
                    <dd>{valeur.toFixed(2)}</dd>
                  </div>
                ))}
              </dl>
              <ul className="tracee-constantes">
                {r.explique.leviers.map((l) => (
                  <li key={l.code}>
                    <strong>{l.libelle}</strong> — gain {l.gain}, coût {l.cout}
                  </li>
                ))}
              </ul>

              {conseils !== null && (
                <>
                  {/* §7.5 — le conseil filtre vient APRÈS les leviers gratuits ci-dessus. */}
                  <p className={conseils.filtre.declenche ? 'cause' : 'etat'}>
                    {conseils.filtre.message}
                  </p>
                  {/* §10.3 — recommandation d'équipement : catégorie et gain chiffré, rien d'autre. */}
                  <p className="etat">{conseils.recommandations.message}</p>
                  {conseils.recommandations.recommandations.length > 0 && (
                    <table>
                      <thead>
                        <tr>
                          <th>Catégorie</th>
                          <th>Sans</th>
                          <th>Avec</th>
                          <th>Rapport</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conseils.recommandations.recommandations.map((reco) => (
                          <tr key={reco.categorie}>
                            <td>{reco.libelle}</td>
                            <td>{reco.sans}</td>
                            <td>{reco.avec}</td>
                            <td>× {reco.rapport.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              <details className="tracee">
                <summary>
                  <span>Chaîne de calcul complète</span>
                </summary>
                <div className="tracee-detail">
                  {r.explique.n3.map((etape) => (
                    <p key={etape.libelle} className="tracee-formule">
                      <strong>{etape.libelle}</strong> = {etape.valeur?.toFixed(3) ?? '—'}{' '}
                      {etape.unite}
                      <br />
                      <code>{etape.expression}</code>
                      <span className="tracee-section"> — §{etape.section}</span>
                      {etape.constantes.length > 0 && (
                        <span className="tracee-source">
                          {' '}
                          · constantes : {etape.constantes.map((c) => `${c.ref} = ${c.valeur}`).join(', ')}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          </details>
        </section>
      )}
    </>
  )
}
