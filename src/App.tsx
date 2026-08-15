/**
 * Contrat d'entrée (§4, §5.1, §5.2) posé sur l'écran de vérification du socle (§14).
 *
 * Un lieu et un matériel saisis produisent champ, échantillonnage, pose maximale et seuils
 * de déclinaison du site. Chaque nombre reste dépliable jusqu'à sa formule, et chaque terme
 * technique porte sa définition au contact (§10.1).
 *
 * Ce n'est toujours pas un écran conçu : la direction visuelle et le mode nuit viennent au
 * lot 3. Ce qui est vérifiable ici, c'est le contrat, pas la mise en page.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { fenetreNocturne, offsetMidiSolaireMin, type FenetreNocturne } from './core/night.ts'
import { fenetreUtile as calculeFenetreUtile } from './core/moon.ts'
import { planSession } from './core/session.ts'
import {
  masquePlat,
  seuilsDeclinaison,
  type MasqueHorizon,
  type SeuilsSite,
} from './core/site.ts'
import { fondDeCiel, type FondDeCiel } from './core/sky-background.ts'
import { profilOptique, type ProfilOptique } from './core/optics.ts'
import {
  npf,
  profilSuivi,
  type QualiteMiseEnStation,
  type ProfilSuivi,
  type TypeMonture,
} from './core/tracking.ts'
import { BortleHorsTableError } from './registry/bortle.ts'
import { SaisieRefuseeError } from './registry/domains.ts'
import { HorsDomaineSeriesError } from './core/ephem.ts'
import { MATRICE_DEGRADATION, abonneModeReseau, modeReseauCourant } from './data/degradation.ts'
import {
  chargeConstellations,
  chargeEtoiles,
  chargeObjetsCielProfond,
  demarre,
  gaiaCharge,
  type EtatDemarrage,
} from './data/bootstrap.ts'
import { PAQUET_VIDE, type PaquetConstellations } from './data/constellations.ts'
import type { ProfilCadre } from './core/cadre.ts'
import { Planetarium } from './ui/Planetarium.tsx'
import { GrandChamp } from './ui/GrandChamp.tsx'
import type { ObjetCielProfond } from './data/deepsky.ts'
import type { Etoile } from './data/catalog.ts'
import {
  BOITIER_REFERENCE,
  capteurEffectif,
  isoRecommande,
  pointZeroSysteme,
  type CapteurEffectif,
  type CapteurMode,
} from './data/equipment.ts'
import {
  demandePersistance,
  exporteDonneesUtilisateur,
  importeDonneesUtilisateur,
} from './data/persistence.ts'
import { REGISTRE } from './registry/constants.ts'
import type { Traced } from './core/traced.ts'
import { TracedValue } from './ui/TracedValue.tsx'
import { FicheCible } from './ui/FicheCible.tsx'
import { PlanSessionVue } from './ui/PlanSession.tsx'
import {
  ModeNuit,
  appliqueModeNuit,
  doitSActiver,
  litEtatPersiste,
  type EtatModeNuit,
} from './ui/ModeNuit.tsx'
import { Etiquette, NiveauContext, Terme, type NiveauUtilisateur } from './ui/Terme.tsx'

/** Objectif de qualité retenu pour le plan de la nuit : « correct » au sens de §7.3. */
const PRESET_SNR_PLAN = 10

/** Site et configuration ciel profond de l'Annexe A. */
const DEFAUT = {
  latitude: '46.391',
  longitude: '6.697',
  altitude: '500',
  bortle: '4.5',
  focale: '120',
  ouverture: '2.8',
}

function heure(date: Date | null): string {
  return date === null ? '—' : date.toLocaleString('fr-FR')
}

type Calcul =
  | {
      readonly ok: true
      readonly nuit: FenetreNocturne
      readonly ciel: FondDeCiel
      readonly seuils: SeuilsSite
      readonly offsetMidi: Traced<number>
      readonly optique: ProfilOptique
      readonly suivi: ProfilSuivi
      readonly poseNpf: Traced<number | null>
      readonly capteur: CapteurEffectif
      readonly ouvertureN: number
      readonly noteRecadrage?: string
    }
  | { readonly ok: false; readonly erreur: string }

export function App() {
  const [niveau, setNiveau] = useState<NiveauUtilisateur>('DEBUTANT')

  const [latitude, setLatitude] = useState(DEFAUT.latitude)
  const [longitude, setLongitude] = useState(DEFAUT.longitude)
  const [altitude, setAltitude] = useState(DEFAUT.altitude)
  const [bortle, setBortle] = useState(DEFAUT.bortle)
  const [sqm, setSqm] = useState('')
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10))

  const [focale, setFocale] = useState(DEFAUT.focale)
  const [ouverture, setOuverture] = useState(DEFAUT.ouverture)
  const [capteurMode, setCapteurMode] = useState<CapteurMode>('FULL_FRAME')
  const [comparerRecadrage, setComparerRecadrage] = useState(false)

  const [suiviActif, setSuiviActif] = useState(false)
  const [qualiteMes, setQualiteMes] = useState<QualiteMiseEnStation>('INCONNUE')
  const [typeMonture, setTypeMonture] = useState<TypeMonture>('TRACKER')

  const [etat, setEtat] = useState<EtatDemarrage | null>(null)
  const [catalogue, setCatalogue] = useState<readonly ObjetCielProfond[]>([])
  const [etoiles, setEtoiles] = useState<readonly Etoile[]>([])
  const [constellations, setConstellations] = useState<PaquetConstellations>(PAQUET_VIDE)
  const [cibleDuCiel, setCibleDuCiel] = useState<ObjetCielProfond | null>(null)
  const [modeNuit, setModeNuit] = useState<EtatModeNuit>(litEtatPersiste)
  const [messagePersistance, setMessagePersistance] = useState<string | null>(null)
  // §12.5 — l'état affiché suit les bascules, il n'est pas figé au démarrage.
  const modeReseau = useSyncExternalStore(abonneModeReseau, modeReseauCourant, () => 'EN_LIGNE')

  useEffect(() => {
    // Le catalogue n'est décodé qu'une fois les paquets vérifiés : un binaire corrompu ne
    // doit jamais alimenter un verdict (§12.2).
    void demarre()
      .then(setEtat)
      .then(chargeObjetsCielProfond)
      .then(setCatalogue)
      .then(chargeEtoiles)
      .then(setEtoiles)
      .then(chargeConstellations)
      .then(setConstellations)
  }, [])

  // §11.1 — le mode nuit reste actif au redémarrage et entre les vues.
  useEffect(() => appliqueModeNuit(modeNuit), [modeNuit])

  /**
   * §4.1 — aucune source de relief n'est disponible hors réseau ni au premier démarrage :
   * le masque plat [HYP] est le repli documenté de la matrice de dégradation §12.5.
   */
  const masque: MasqueHorizon = useMemo(() => masquePlat(), [])

  const zeroSysteme = pointZeroSysteme(BOITIER_REFERENCE)

  const calcul = useMemo((): Calcul => {
    try {
      // Départ à midi UTC : la recherche du coucher part de là.
      const depart = new Date(`${dateIso}T12:00:00Z`)
      const offsetFuseauH = -new Date().getTimezoneOffset() / 60
      const site = {
        latitudeDeg: Number(latitude),
        longitudeDeg: Number(longitude),
        altitudeM: Number(altitude),
      }
      const capteur = capteurEffectif(BOITIER_REFERENCE, capteurMode)
      const focaleMm = Number(focale)
      const ouvertureN = Number(ouverture)
      return {
        ok: true,
        nuit: fenetreNocturne(site, depart),
        ciel: fondDeCiel({
          ...(sqm.trim() === '' ? {} : { sqmMesure: Number(sqm) }),
          ...(bortle.trim() === '' ? {} : { bortleDeclare: Number(bortle) }),
        }),
        seuils: seuilsDeclinaison(site.latitudeDeg),
        offsetMidi: offsetMidiSolaireMin(site.longitudeDeg, offsetFuseauH),
        optique: profilOptique({ focaleMm, ouvertureN, ...capteur }),
        suivi: profilSuivi({ suiviActif, qualiteMes, typeMonture, focaleMm }),
        // §9.1 — la NPF reste affichée même avec suivi, à titre informatif. Déclinaison 0 :
        // c'est la zone la plus contraignante du ciel, la carte par cellule vient au lot 5.
        poseNpf: npf({ focaleMm, ouvertureN, pitchUm: capteur.pitchUm, decDeg: 0 }),
        capteur,
        ouvertureN,
        ...(capteur.noteRecadrage === undefined
          ? {}
          : { noteRecadrage: capteur.noteRecadrage }),
      }
    } catch (erreur) {
      // Saisie refusée ou domaine dépassé : la cause est nommée, pas avalée.
      if (
        erreur instanceof BortleHorsTableError ||
        erreur instanceof HorsDomaineSeriesError ||
        erreur instanceof SaisieRefuseeError
      ) {
        return { ok: false, erreur: erreur.message }
      }
      throw erreur
    }
  }, [
    latitude,
    longitude,
    altitude,
    bortle,
    sqm,
    dateIso,
    focale,
    ouverture,
    capteurMode,
    suiviActif,
    qualiteMes,
    typeMonture,
  ])

  // §11.1 — auto-activation au crépuscule nautique, quand l'utilisateur l'a demandée.
  useEffect(() => {
    if (!calcul.ok || modeNuit.actif) return
    if (doitSActiver(modeNuit, calcul.nuit.debutNautique, new Date())) {
      setModeNuit({ ...modeNuit, actif: true })
    }
  }, [calcul, modeNuit])

  const site = useMemo(
    () => ({
      latitudeDeg: Number(latitude),
      longitudeDeg: Number(longitude),
      altitudeM: Number(altitude),
    }),
    [latitude, longitude, altitude],
  )

  const fenetreUtile = useMemo(
    () => (calcul.ok ? calculeFenetreUtile(site, calcul.nuit) : null),
    [calcul, site],
  )

  const iso = isoRecommande(BOITIER_REFERENCE)

  /**
   * §3.5 — profils de cadre superposés. Le second profil matérialise l'effet du recadrage
   * de capteur, que §5.1 explique en mots : cadre plus serré, échantillonnage inchangé.
   */
  const profilsCadre = useMemo((): readonly ProfilCadre[] => {
    if (!calcul.ok) return []
    const focaleMm = Number(focale)
    const ouvertureN = Number(ouverture)
    const autre: CapteurMode = capteurMode === 'FULL_FRAME' ? 'APSC_CROP' : 'FULL_FRAME'
    const modes: readonly CapteurMode[] = comparerRecadrage ? [capteurMode, autre] : [capteurMode]
    const tPoseS = calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value
    return modes.map((m) => {
      const capteur = capteurEffectif(BOITIER_REFERENCE, m)
      const optique = profilOptique({ focaleMm, ouvertureN, ...capteur })
      return {
        libelle: `${focaleMm} mm f/${ouvertureN} — ${m === 'FULL_FRAME' ? 'plein format' : 'recadrage APS-C'}`,
        fovLDeg: optique.fovLDeg.value,
        fovHDeg: optique.fovHDeg.value,
        echApx: optique.echApx.value,
        tPoseS,
      }
    })
  }, [calcul, focale, ouverture, capteurMode, comparerRecadrage])

  /**
   * §8.3 — le plan complet. Il n'est calculé qu'une fois les catalogues vérifiés.
   *
   * ponytail: calcul sur le thread de rendu. §12.1 le veut en Web Worker ; il tient
   * aujourd'hui sous la centaine de millisecondes parce que le pré-filtrage dur limite à
   * quelques dizaines de candidates. Le jour où le catalogue ou le nombre de candidates
   * grossit, c'est ce point-là qu'il faut déporter, pas le rendu.
   */
  const plan = useMemo(() => {
    if (!calcul.ok || catalogue.length === 0) return null
    return planSession(
      {
        site,
        nuit: calcul.nuit,
        fenetreUtile: calculeFenetreUtile(site, calcul.nuit),
        masque,
        fovHDeg: calcul.optique.fovHDeg.value,
        echApx: calcul.optique.echApx.value,
        dMm: calcul.optique.dMm.value,
        capteurHMm: calcul.capteur.capteurHMm,
        pitchUm: calcul.capteur.pitchUm,
        ouvertureN: calcul.ouvertureN,
        zpSys: zeroSysteme.valeur,
        zpEstime: zeroSysteme.estime,
        readNoiseE: iso.readNoiseE,
        tailleRawMo: BOITIER_REFERENCE.tailleRawMo,
        isoSession: iso.iso,
        sbCielNoir: calcul.ciel.sbCiel.value,
        mLimOeil: calcul.ciel.mLimOeil.value,
        tMaxS: calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value,
        snrCible: PRESET_SNR_PLAN,
        typeMonture,
        niveau,
      },
      catalogue,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcul, catalogue, masque, niveau, typeMonture, site, iso.iso])

  async function surExport() {
    const donnees = await exporteDonneesUtilisateur()
    const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(blob)
    lien.download = `astrofort-${donnees.exporteLe.slice(0, 10)}.json`
    lien.click()
    URL.revokeObjectURL(lien.href)
    // Première action utile accomplie : c'est le moment de demander la persistance (§12.3).
    const accorde = await demandePersistance()
    setMessagePersistance(
      accorde
        ? 'Stockage persistant accordé : les données résistent désormais à la pression disque.'
        : 'Stockage persistant refusé. Installer l’application améliore les chances de l’obtenir ; ' +
            'en attendant, conserver l’export.',
    )
  }

  async function surImport(fichier: File) {
    await importeDonneesUtilisateur(JSON.parse(await fichier.text()))
    setMessagePersistance('Import terminé : les sites, profils et plans ont été restaurés.')
  }

  return (
    <NiveauContext value={niveau}>
      <main>
        <h1>Astrofort — contrat d’entrée</h1>

        <p className="niveau">
          {/* §10.1 — le niveau ne change QUE la densité d'explication, jamais un calcul. */}
          Niveau d’explication :{' '}
          <select value={niveau} onChange={(e) => setNiveau(e.target.value as NiveauUtilisateur)}>
            <option value="DEBUTANT">Débutant — gloses visibles</option>
            <option value="CONFIRME">Confirmé — gloses au survol</option>
          </select>
        </p>

        <section>
          <h2>Lieu</h2>
          <div className="champs">
            <label>
              <Etiquette cle="latitude" />
              <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="longitude" />
              <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="altitude_site" />
              <input value={altitude} onChange={(e) => setAltitude(e.target.value)} />
            </label>
            <label>
              Date
              <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="bortle" />
              <input value={bortle} onChange={(e) => setBortle(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="sqm" />
              <input
                value={sqm}
                placeholder="prioritaire si renseigné"
                onChange={(e) => setSqm(e.target.value)}
              />
            </label>
          </div>

          <Terme
            cle="masque_horizon"
            contexte={`horizon plat à 0° sur les ${masque.altitudesDeg.length} azimuts ${
              masque.estHypothese ? '— [HYP]' : ''
            }`}
          />
          {masque.note !== undefined && (
            <p className="cause">
              {masque.flags?.map((f) => `[${f}] `).join('')}
              {masque.note}
            </p>
          )}
        </section>

        <section>
          <h2>Optique</h2>
          <div className="champs">
            <label>
              <Etiquette cle="focale" />
              <input value={focale} onChange={(e) => setFocale(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="ouverture" />
              <input value={ouverture} onChange={(e) => setOuverture(e.target.value)} />
            </label>
            <label>
              <Etiquette cle="recadrage_capteur" />
              <select
                value={capteurMode}
                onChange={(e) => setCapteurMode(e.target.value as CapteurMode)}
              >
                <option value="FULL_FRAME">Plein format — {BOITIER_REFERENCE.libelle}</option>
                <option value="APSC_CROP">Recadrage APS-C</option>
              </select>
            </label>
          </div>
          <label className="interrupteur">
            <input
              type="checkbox"
              checked={comparerRecadrage}
              onChange={(e) => setComparerRecadrage(e.target.checked)}
            />
            Superposer les deux cadres, plein format et recadrage APS-C (§3.5)
          </label>
          {calcul.ok && calcul.noteRecadrage !== undefined && (
            <p className="cause">{calcul.noteRecadrage}</p>
          )}
          <p className="etat">
            point zéro système : {zeroSysteme.valeur} mag{zeroSysteme.estime ? ' [ESTIMÉ]' : ''}
          </p>
        </section>

        <section>
          <h2>Suivi</h2>
          <div className="champs">
            <label className="interrupteur">
              <input
                type="checkbox"
                checked={suiviActif}
                onChange={(e) => setSuiviActif(e.target.checked)}
              />
              Ma monture suit les étoiles
            </label>
            {suiviActif && (
              <label>
                <Etiquette cle="mise_en_station" />
                <select
                  value={qualiteMes}
                  onChange={(e) => setQualiteMes(e.target.value as QualiteMiseEnStation)}
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
                value={typeMonture}
                onChange={(e) => setTypeMonture(e.target.value as TypeMonture)}
              >
                <option value="TRACKER">Monture sur rotule (tracker)</option>
                <option value="GEM">Équatoriale allemande</option>
                <option value="ALTAZ">Altazimutale</option>
              </select>
            </label>
          </div>
        </section>

        {!calcul.ok && <p className="erreur">{calcul.erreur}</p>}

        {calcul.ok && (
          <>
            <section>
              <h2>Ce que ce matériel donne depuis ce lieu</h2>
              <TracedValue terme="champ" suffixe="largeur" trace={calcul.optique.fovLDeg} unite="°" />
              <TracedValue terme="champ" suffixe="hauteur" trace={calcul.optique.fovHDeg} unite="°" />
              <TracedValue terme="echantillonnage" trace={calcul.optique.echApx} unite="&quot;/px" />
              <p className={calcul.optique.alerte ? 'cause' : 'etat'}>
                {calcul.optique.messageDiag}
              </p>
              <TracedValue terme="diametre_pupille" trace={calcul.optique.dMm} unite="mm" />
              <TracedValue
                terme="pouvoir_separateur"
                trace={calcul.optique.dawesAs}
                unite="&quot;"
              />
              <TracedValue terme="npf" trace={calcul.poseNpf} unite="s" />
              <TracedValue terme="pose_max_suivi" trace={calcul.suivi.tMaxSuiviS} unite="s" />
              {calcul.suivi.cause !== undefined && <p className="cause">{calcul.suivi.cause}</p>}
              {calcul.suivi.gainMiseEnStation !== undefined && (
                <p className="cause">{calcul.suivi.gainMiseEnStation}</p>
              )}
              <TracedValue
                terme="seuil_imagerie"
                trace={calcul.seuils.decMinImagerie}
                decimales={1}
                unite="°"
              />
              <TracedValue
                terme="seuil_visuel"
                trace={calcul.seuils.decMinVisuel}
                decimales={1}
                unite="°"
              />
              <TracedValue
                terme="circumpolaire"
                trace={calcul.seuils.decCircumpolaire}
                decimales={1}
                unite="°"
              />
            </section>

            <section>
              <h2>Fenêtre nocturne</h2>
              <p className="etat">état : {calcul.nuit.etat}</p>
              <Terme
                cle={calcul.nuit.modeDegrade ? 'mode_degrade_nuit' : 'nuit_astronomique'}
                contexte={`${calcul.nuit.dureeReferenceH.toFixed(2)} h exploitables`}
              />
              {calcul.nuit.cause !== undefined && <p className="cause">{calcul.nuit.cause}</p>}
              <table>
                <tbody>
                  <tr>
                    <th>Coucher du Soleil</th>
                    <td>{heure(calcul.nuit.coucherSoleil)}</td>
                  </tr>
                  <tr>
                    <th>Début de nuit astronomique (−18°)</th>
                    <td>{heure(calcul.nuit.debutNuitAstronomique)}</td>
                  </tr>
                  <tr>
                    <th>Milieu de nuit vrai</th>
                    <td>{heure(calcul.nuit.milieuNuitVrai)}</td>
                  </tr>
                  <tr>
                    <th>Fin de nuit astronomique</th>
                    <td>{heure(calcul.nuit.finNuitAstronomique)}</td>
                  </tr>
                  <tr>
                    <th>Lever du Soleil</th>
                    <td>{heure(calcul.nuit.leverSoleil)}</td>
                  </tr>
                  <tr>
                    <th>Durée de nuit astronomique</th>
                    <td>{calcul.nuit.dureeNuitH.toFixed(2)} h</td>
                  </tr>
                </tbody>
              </table>
              <TracedValue
                terme="midi_solaire_vrai"
                trace={calcul.offsetMidi}
                decimales={1}
                unite="min"
              />
            </section>

            <section>
              <h2>Fond de ciel</h2>
              <p className="etat">source : {calcul.ciel.sourceSb}</p>
              {calcul.ciel.confirmationRequise !== undefined && (
                <p className="cause">{calcul.ciel.confirmationRequise}</p>
              )}
              <TracedValue terme="fond_de_ciel" trace={calcul.ciel.sbCiel} unite="mag/as²" />
              <TracedValue
                terme="magnitude_limite_oeil"
                trace={calcul.ciel.mLimOeil}
                unite="mag"
              />
            </section>

            <Planetarium
              site={site}
              etoiles={etoiles}
              objets={catalogue}
              constellations={constellations}
              profils={profilsCadre}
              mLimOeil={calcul.ciel.mLimOeil.value}
              gaiaCharge={etat === null ? false : gaiaCharge(etat.catalogues)}
              modeNuit={modeNuit.actif}
              surSelectionObjet={setCibleDuCiel}
            />

            <GrandChamp
              site={site}
              etoiles={etoiles}
              focaleMm={Number(focale)}
              ouvertureN={calcul.ouvertureN}
              pitchUm={calcul.capteur.pitchUm}
              capteurLMm={calcul.capteur.capteurLMm}
              capteurHMm={calcul.capteur.capteurHMm}
              fovLDeg={calcul.optique.fovLDeg.value}
              fovHDeg={calcul.optique.fovHDeg.value}
              echApx={calcul.optique.echApx.value}
              dMm={calcul.optique.dMm.value}
              zpSys={zeroSysteme.valeur}
              zpEstime={zeroSysteme.estime}
              readNoiseE={iso.readNoiseE}
              sbCiel={calcul.ciel.sbCiel.value}
              tailleRawMo={BOITIER_REFERENCE.tailleRawMo}
              tMaxSuiviS={calcul.suivi.tMaxSuiviS.value}
              autonomieCipa={BOITIER_REFERENCE.autonomieCipa ?? null}
              modeNuit={modeNuit.actif}
            />

            <FicheCible
              objetSelectionne={cibleDuCiel}
              optique={calcul.optique}
              capteurHMm={calcul.capteur.capteurHMm}
              pitchUm={calcul.capteur.pitchUm}
              ouvertureN={calcul.ouvertureN}
              boitier={BOITIER_REFERENCE}
              zeroSysteme={zeroSysteme}
              sbCiel={calcul.ciel.sbCiel.value}
              mLimOeil={calcul.ciel.mLimOeil.value}
              // Sans suivi, c'est la NPF qui plafonne la pose (§9.1) — jamais rien.
              tMaxS={calcul.suivi.tMaxSuiviS.value ?? calcul.poseNpf.value}
              catalogue={catalogue}
              bortle={bortle.trim() === '' ? null : Number(bortle)}
              suiviActif={suiviActif}
              focaleMm={Number(focale)}
            />

            {plan !== null && fenetreUtile !== null && (
              <PlanSessionVue
                plan={plan}
                fenetreUtile={fenetreUtile}
                site={site}
                fovHDeg={calcul.optique.fovHDeg.value}
                fovLDeg={calcul.optique.fovLDeg.value}
                mLimOeil={calcul.ciel.mLimOeil.value}
                etoiles={etoiles}
                enTete={{
                  dateIso,
                  lieu: `${latitude}° / ${longitude}° — Bortle ${bortle}`,
                  materiel: `${focale} mm f/${ouverture} — ${BOITIER_REFERENCE.libelle}`,
                }}
              />
            )}
            {plan === null && catalogue.length === 0 && (
              <section>
                <h2>Plan de session — §8.3</h2>
                <p className="cause">
                  Les catalogues ne sont pas encore vérifiés : aucun plan n’est produit tant
                  qu’un binaire non validé pourrait l’alimenter. Les moteurs de cadrage, de
                  pose et d’intégration restent utilisables sur une cible saisie à la main.
                </p>
              </section>
            )}
          </>
        )}

        <ModeNuit etat={modeNuit} surChangement={setModeNuit} />

        <section>
          <h2>État du socle</h2>
          {etat === null && <p>Vérification en cours…</p>}
          {etat !== null && (
            <>
              <p className="etat">réseau : {modeReseau}</p>
              <p className="etat">
                WebGL 2 : {etat.rendu.webgl2 ? 'disponible' : 'indisponible'}
              </p>
              {etat.rendu.cause !== undefined && <p className="cause">{etat.rendu.cause}</p>}
              <p className="etat">
                stockage persistant : {etat.stockage.persistant ? 'accordé' : 'non accordé'}
                {etat.stockage.usageMo !== null &&
                  ` · ${etat.stockage.usageMo.toFixed(1)} Mo utilisés`}
              </p>
              {etat.stockage.avertissement !== undefined && (
                <p className="cause">{etat.stockage.avertissement}</p>
              )}
              {etat.catalogues.cause !== undefined && (
                <p className="cause">{etat.catalogues.cause}</p>
              )}
              <ul>
                {etat.catalogues.paquets.map((p) => (
                  <li key={p.manifeste.nom}>
                    {p.manifeste.nom} v{p.manifeste.version} — {p.integrite} (
                    {(p.manifeste.octets / (1024 * 1024)).toFixed(2)} Mo)
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="actions">
            <button type="button" onClick={() => void surExport()}>
              Exporter mes données (JSON)
            </button>
            <label className="bouton-fichier">
              Réimporter
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const fichier = e.target.files?.[0]
                  if (fichier !== undefined) void surImport(fichier)
                }}
              />
            </label>
          </div>
          {messagePersistance !== null && <p className="cause">{messagePersistance}</p>}
        </section>

        <section>
          <h2>Matrice de dégradation hors-ligne</h2>
          <table>
            <thead>
              <tr>
                <th>Fonction</th>
                <th>Sections</th>
                <th>Hors réseau</th>
                <th>Dégradation</th>
              </tr>
            </thead>
            <tbody>
              {MATRICE_DEGRADATION.map((ligne) => (
                <tr key={ligne.fonction}>
                  <td>{ligne.fonction}</td>
                  <td>{ligne.sections}</td>
                  <td>{ligne.horsReseau}</td>
                  <td>{ligne.degradation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Registre de constantes</h2>
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Libellé</th>
                <th>Valeur</th>
                <th>Source</th>
                <th>Tolérance</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(REGISTRE).map(([id, c]) => (
                <tr key={id} className={c.deprecie !== undefined ? 'depreciee' : undefined}>
                  <td>{c.ref}</td>
                  <td>{c.libelle}</td>
                  <td>
                    {c.valeur} {c.unite}
                  </td>
                  <td>{c.source}</td>
                  <td>{c.deprecie ?? c.tolerance ?? 'valeur exacte'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </NiveauContext>
  )
}
