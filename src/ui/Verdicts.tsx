/**
 * Ce que la chaîne de calcul répond, région par région : §6.2 cadrage,
 * §6.3 détectabilité, §7 pose, intégration et calibration, §10.2 explication dépliable.
 *
 * Aucune de ces régions ne calcule quoi que ce soit : elles lisent le `Resultat` produit par
 * `fiche-cible-calcul.ts`, et chaque nombre reste dépliable jusqu'à sa formule.
 */

import { dureeLisible } from '../core/exposure.ts'
import { PRESETS_SNR } from '../registry/verdicts.ts'
import { SOURCE_TABLE_CONTRASTE } from '../registry/contrast.ts'
import { SOURCE_TABLE_FILTRES } from '../registry/filters.ts'
import { libelleZpSource, type PointZeroSysteme } from '../data/equipment.ts'
import { MANQUANTE } from './ChampsCible.tsx'
import { TracedValue } from './TracedValue.tsx'
import { Etiquette, Terme } from './Terme.tsx'
import { heure } from './horaire.ts'
import type { Conseils, Resultat } from './fiche-cible-calcul.ts'

export interface VerdictsProps {
  readonly r: Resultat
  readonly snrCible: number
  readonly surSnr: (valeur: number) => void
  readonly isoLibelle: string
  /** §7.1 — `zp_source` accompagne toute pose affichée. */
  readonly zeroSysteme: PointZeroSysteme
  readonly conseils: Conseils | null
  /** §7.2 — mode permissif C-03 : demandé, jamais déduit. */
  readonly permissif: boolean
  readonly surPermissif: (valeur: boolean) => void
  readonly filtreDualBand: boolean
  readonly surFiltre: (valeur: boolean) => void
  readonly surDeplie: (valeur: boolean) => void
}

export function Verdicts(props: VerdictsProps) {
  const { r } = props
  return (
    <>
      <CadrageDeLaCible r={r} />
      <Detectabilite r={r} />
      {/* Sans donnée de détectabilité, aucune pose n'est chiffrable : la région n'aurait plus
          que le point zéro du boîtier et le fond de ciel à montrer, deux grandeurs du setup
          qui ne disent rien de cette cible-là. */}
      {r.detect.verdict !== null && (
        <PoseUnitaire
          r={r}
          isoLibelle={props.isoLibelle}
          zeroSysteme={props.zeroSysteme}
          permissif={props.permissif}
          surPermissif={props.surPermissif}
        />
      )}
      <CombienDePhotos r={r} snrCible={props.snrCible} surSnr={props.surSnr} />
      <PlanDeCalibration r={r} />
      <PourquoiCeVerdict
        r={r}
        conseils={props.conseils}
        filtreDualBand={props.filtreDualBand}
        surFiltre={props.surFiltre}
        surDeplie={props.surDeplie}
      />
    </>
  )
}

/** §6.2 — comment la cible tombe dans le cadre : remplissage, diamètre, orientation. */
function CadrageDeLaCible({ r }: { readonly r: Resultat }) {
  // Pas de dimensions au catalogue, donc pas de cadrage calculé (§6.2) : la région entière
  // disparaît, et l'image de tête de fiche perd son cadre pour la même raison. Un remplissage
  // ou un diamètre en pixels tirés d'une taille absente décriraient une autre cible.
  const cadrage = r.cadrage
  if (cadrage === null) return null

  return (
    <section>
      <h2>Cadrage de la cible</h2>
      <p className="etat">verdict : {cadrage.verdict}</p>
      <TracedValue terme="remplissage" trace={cadrage.remplissage} decimales={3} />
      <TracedValue terme="diametre_pixels" trace={cadrage.diamPx} decimales={0} unite="px" />
      {cadrage.nTuiles !== undefined && (
        <TracedValue terme="mosaique" trace={cadrage.nTuiles} decimales={0} unite="tuiles" />
      )}
      {/* La ligne « Mosaïque » porte déjà le message du verdict dans sa glose : le répéter
          en clair sous elle ferait lire deux fois la même phrase. */}
      {cadrage.nTuiles === undefined && (
        <p className={cadrage.faisable ? 'etat' : 'cause'}>{cadrage.message}</p>
      )}
      <p className="etat">{cadrage.noteOrientation}</p>
      {cadrage.cause !== undefined && <p className="cause">{cadrage.cause}</p>}
      {cadrage.focaleIdealeMm !== undefined && (
        <TracedValue terme="focale_ideale" trace={cadrage.focaleIdealeMm} decimales={0} unite="mm" />
      )}
    </section>
  )
}

/**
 * §8.1 — sous quel ciel la cible est évaluée. T-0089 : la fiche n'a pas de créneau, donc
 * l'instant de la Lune est un choix, et un choix s'annonce. Sans cette ligne, deux écrans
 * annonceraient deux poses sans que rien ne dise laquelle porte quelle nuit.
 */
function CielSousLaLune({ r }: { readonly r: Resultat }) {
  if (!r.lune.evaluee) return <p className="cause">{r.lune.cause}</p>
  return (
    <>
      <p className="etat">
        Lune évaluée à {heure(r.lune.instant)}, l’instant affiché par le planétarium, avec la
        cible prise à sa culmination — la convention du plan de séance.
      </p>
      <TracedValue terme="degradation_lunaire" trace={r.lune.ciel.delta} unite="mag/as²" />
    </>
  )
}

/** §6.3 — ce qui verra la cible : l'œil, des jumelles, un télescope, ou la photo seule. */
function Detectabilite({ r }: { readonly r: Resultat }) {
  // Verdict nul = magnitude ou dimensions absentes du catalogue. Tout ce que la région
  // porterait alors — brillance de surface, contraste, magnitude limite — vaut lui aussi
  // « donnée manquante », et quatre fois la même absence n'en apprend pas plus qu'une. La
  // région se nomme une fois vide, comme les dimensions de « À propos ».
  if (r.detect.verdict === null) {
    return (
      <section>
        <h2>Détectabilité</h2>
        <p className="etat">{MANQUANTE}</p>
      </section>
    )
  }

  return (
    <section>
      <h2>Détectabilité</h2>
      <p className="etat">verdict : {r.detect.verdict}</p>
      <CielSousLaLune r={r} />
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
  )
}

/** §7.1 et §7.2 — combien de temps dure une photo, et pourquoi pas davantage. */
function PoseUnitaire({
  r,
  isoLibelle,
  zeroSysteme,
  permissif,
  surPermissif,
}: {
  readonly r: Resultat
  readonly isoLibelle: string
  readonly zeroSysteme: PointZeroSysteme
  readonly permissif: boolean
  readonly surPermissif: (valeur: boolean) => void
}) {
  return (
    <section>
      <h2>Pose</h2>
      {/* §7.1 — zp_source doit être affiché partout où une pose l'est. */}
      <p className={zeroSysteme.estime ? 'cause' : 'etat'}>{libelleZpSource(zeroSysteme)}</p>
      {zeroSysteme.note !== undefined && <p className="cause">{zeroSysteme.note}</p>}
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
          {/* §7.2 — le mode permissif se demande, et s'annonce avec son coût chiffré. */}
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={permissif}
              onChange={(e) => surPermissif(e.target.checked)}
            />
            <Etiquette cle="mode_permissif" /> — ciel pollué, suivi imprécis, vent
          </label>
          {r.pose.notePermissif !== undefined && (
            <p className="cause">{r.pose.notePermissif}</p>
          )}
        </>
      )}
    </section>
  )
}

/**
 * §7.6 — l'atténuation atmosphérique du flux de l'objet, avec la hauteur qui la produit.
 *
 * Rendue avec l'intégration et non avec la pose : c'est la durée totale que ce terme dose,
 * et la pose unitaire n'en dépend pas — elle ne tient qu'au fond de ciel.
 *
 * La hauteur d'évaluation est écrite en clair : sans elle, la masse d'air est un nombre
 * orphelin, et l'utilisateur ne peut pas savoir que c'est le meilleur instant de la nuit qui
 * est chiffré. La précision reste au centième, celle du modèle (§12.4).
 */
function Extinction({ r }: { readonly r: Resultat }) {
  const extinction = r.extinction
  if (extinction === null) return null
  return (
    <>
      <p className="etat">
        Hauteur d’évaluation :{' '}
        {r.hauteurEvaluationDeg === null
          ? 'inconnue — cible sans coordonnées, aucune extinction appliquée'
          : `culmination à ${r.hauteurEvaluationDeg.toFixed(1)}° depuis ce site`}
      </p>
      <TracedValue terme="masse_air" trace={extinction.masseAir} />
      <TracedValue terme="extinction_atmospherique" trace={extinction.attenuation} decimales={3} />
      <TracedValue
        terme="flux_objet"
        suffixe="reçu au capteur, après atténuation"
        trace={extinction.eObjReel}
        decimales={3}
        unite="e⁻/s/px"
      />
    </>
  )
}

/** §7.3 — l'intégration requise pour la qualité visée, en heures, en poses et en gigaoctets. */
function CombienDePhotos({
  r,
  snrCible,
  surSnr,
}: {
  readonly r: Resultat
  readonly snrCible: number
  readonly surSnr: (valeur: number) => void
}) {
  const integration = r.integration
  if (integration === null) {
    const refus = r.extinction?.attenuation.note
    // §7.6 — un refus se lit. Faire disparaître la section laisserait croire que le calcul
    // n'a pas été demandé, alors qu'il a été refusé, et pour une raison nommable.
    return refus === undefined ? null : (
      <section>
        <h2>Combien de photos</h2>
        <p className="cause">{refus}</p>
      </section>
    )
  }
  return (
    <section>
      <h2>Combien de photos</h2>
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
      <Extinction r={r} />
      <TracedValue terme="integration_totale" trace={integration.tRequisS} decimales={0} unite="s" />
      <p className="etat">soit {dureeLisible(integration.tRequisS.value)}</p>
      <TracedValue terme="nombre_poses" trace={integration.nPoses} decimales={0} unite="poses" />
      <TracedValue terme="volume_stockage" trace={integration.volumeGo} decimales={1} unite="Go" />
      {integration.nNuits !== undefined && (
        <TracedValue terme="nombre_nuits" trace={integration.nNuits} decimales={0} unite="nuits" />
      )}
      <p className="etat">{integration.loiFondamentale}</p>
      {integration.messages.map((m) => (
        <p key={m} className={integration.horsDePortee ? 'cause' : 'etat'}>
          {m}
        </p>
      ))}
    </section>
  )
}

/** §7.4 — les lots de calibration que la session exige, et ce qu'ils coûtent en temps. */
function PlanDeCalibration({ r }: { readonly r: Resultat }) {
  const calibration = r.calibration
  if (calibration === null) return null
  return (
    <section>
      <h2>Plan de calibration</h2>
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
          {calibration.lots.map((lot) => (
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
        trace={calibration.surcoutTempsMin}
        decimales={0}
        unite="min"
      />
      <p className="etat">
        <Etiquette cle="dithering" /> : {calibration.dithering}
      </p>
      {calibration.avertissements.map((a) => (
        <p key={a} className="cause">
          {a}
        </p>
      ))}
    </section>
  )
}

/** §10.2 — le facteur dominant, les leviers, puis §7.5 et §10.3 s'ils se déclenchent. */
function PourquoiCeVerdict({
  r,
  conseils,
  filtreDualBand,
  surFiltre,
  surDeplie,
}: {
  readonly r: Resultat
  readonly conseils: Conseils | null
  readonly filtreDualBand: boolean
  readonly surFiltre: (valeur: boolean) => void
  readonly surDeplie: (valeur: boolean) => void
}) {
  const explique = r.explique
  if (explique === null) return null
  return (
    <section>
      <h2>Pourquoi ce verdict</h2>
      <p className="etat">{explique.n1}</p>
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
          <span className="tracee-valeur">{explique.facteurs.join(' et ')}</span>
        </summary>
        <div className="tracee-detail">
          <p>{explique.n2}</p>
          <dl className="tracee-entrees">
            {Object.entries(explique.sensibilites).map(([nom, valeur]) => (
              <div key={nom}>
                <dt>{nom}</dt>
                <dd>{valeur.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
          <ul className="tracee-constantes">
            {explique.leviers.map((l) => (
              <li key={l.code}>
                <strong>{l.libelle}</strong> — gain {l.gain}, coût {l.cout}
              </li>
            ))}
          </ul>

          {conseils !== null && <ConseilsEtRecommandations conseils={conseils} />}
          <ChaineDeCalcul etapes={explique.n3} />
        </div>
      </details>
    </section>
  )
}

/** §7.5 puis §10.3 — le conseil filtre vient APRÈS les leviers gratuits, jamais avant. */
function ConseilsEtRecommandations({ conseils }: { readonly conseils: Conseils }) {
  return (
    <>
      <p className={conseils.filtre.declenche ? 'cause' : 'etat'}>{conseils.filtre.message}</p>
      <p className="tracee-source">Familles de filtres : {SOURCE_TABLE_FILTRES}</p>
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
  )
}

/** §10.2 niveau 3 — chaque étape avec sa formule, sa section et ses constantes sources. */
function ChaineDeCalcul({
  etapes,
}: {
  readonly etapes: NonNullable<Resultat['explique']>['n3']
}) {
  return (
    <details className="tracee">
      <summary>
        <span>Chaîne de calcul complète</span>
      </summary>
      <div className="tracee-detail">
        {etapes.map((etape) => (
          <p key={etape.libelle} className="tracee-formule">
            <strong>{etape.libelle}</strong> = {etape.valeur?.toFixed(3) ?? '—'} {etape.unite}
            <br />
            <code>{etape.expression}</code>
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
  )
}
