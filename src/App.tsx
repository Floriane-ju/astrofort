/**
 * L'application : un lieu, un matériel, une intention, et la scène au centre.
 *
 * Ce fichier ne dessine plus rien. Il tient l'état de saisie (§4, §5), fait tourner la chaîne
 * de calcul (§7, §8) et distribue ses sorties aux trois régions de la coque : le matériel à
 * gauche, la scène au centre, la séance à droite. Tout le reste est dans les panneaux.
 *
 * Chaque nombre affiché reste dépliable jusqu'à sa formule, et chaque terme technique porte
 * sa définition au contact (§1.5.2, §10.1) — c'est le contrat, pas la mise en page.
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
import { fluxCiel } from './core/exposure.ts'
import { construitIndex } from './core/index-ciel.ts'
import { epoqueAnnee } from './core/horloges.ts'
import type { EntreeProfondeur } from './core/galactique.ts'
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
import { abonneModeReseau, modeReseauCourant } from './data/degradation.ts'
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
import { Coque } from './ui/Coque.tsx'
import { Planetarium } from './ui/Planetarium.tsx'
import { PanneauFile } from './ui/PanneauFile.tsx'
import { PanneauExplorer } from './ui/PanneauExplorer.tsx'
import { PanneauSeance } from './ui/PanneauSeance.tsx'
import { PanneauMateriel, modeObjectif, type TypeObjectif } from './ui/PanneauMateriel.tsx'
import { Verification } from './ui/Verification.tsx'
import { etatScene, majVue, useScene } from './ui/scene-etat.ts'
import { ouvreCible, useSeance } from './ui/seance-etat.ts'
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
import { K } from './registry/constants.ts'
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
import { NiveauContext, Terme, type NiveauUtilisateur } from './ui/Terme.tsx'

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
  const [typeObjectif, setTypeObjectif] = useState<TypeObjectif>('RECTILINEAIRE')

  const [suiviActif, setSuiviActif] = useState(false)
  const [qualiteMes, setQualiteMes] = useState<QualiteMiseEnStation>('INCONNUE')
  const [typeMonture, setTypeMonture] = useState<TypeMonture>('TRACKER')

  const [etat, setEtat] = useState<EtatDemarrage | null>(null)
  const [catalogue, setCatalogue] = useState<readonly ObjetCielProfond[]>([])
  const [etoiles, setEtoiles] = useState<readonly Etoile[]>([])
  const [constellations, setConstellations] = useState<PaquetConstellations>(PAQUET_VIDE)
  const [modeNuit, setModeNuit] = useState<EtatModeNuit>(litEtatPersiste)
  const [messagePersistance, setMessagePersistance] = useState<string | null>(null)
  // §12.5 — l'état affiché suit les bascules, il n'est pas figé au démarrage.
  const modeReseau = useSyncExternalStore(abonneModeReseau, modeReseauCourant, () => 'EN_LIGNE')

  // Pointage, temps et intention : les deux magasins que la scène et les panneaux partagent.
  const { msAffiche } = useScene()
  const { cible: cibleDuCiel, file } = useSeance()

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

  /** Index de sélection : construit une fois, lu par la scène et par l'onglet Explorer. */
  const index = useMemo(() => construitIndex(etoiles), [etoiles])

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
   * §9.2 — profondeur atteinte par la pose unitaire. Assemblée ici parce que deux régions en
   * dépendent : le panneau du filé, qui la chiffre, et la scène, qui l'incruste dans le cadre.
   */
  const profondeurFile: EntreeProfondeur | null = useMemo(() => {
    if (!calcul.ok) return null
    return {
      tPoseS: file.tPoseS,
      dMm: calcul.optique.dMm.value,
      zpSys: zeroSysteme.valeur,
      eCielPxS: fluxCiel({
        sbMagArcsec2: calcul.ciel.sbCiel.value,
        zpSys: zeroSysteme.valeur,
        pitchUm: calcul.capteur.pitchUm,
        ouvertureN: calcul.ouvertureN,
        zpEstime: zeroSysteme.estime,
      }).value,
      readNoiseE: iso.readNoiseE ?? K('READ_NOISE_DEFAUT_E'),
      zpEstime: zeroSysteme.estime,
    }
  }, [calcul, file.tPoseS, zeroSysteme.valeur, zeroSysteme.estime, iso.readNoiseE])

  /**
   * Ce que la scène doit savoir du filé pour l'incruster dans le cadre.
   *
   * Mémoïsée, et pas assemblée dans le JSX : l'incrustation republie ses compteurs de rendu
   * dans le magasin de séance, ce qui rend l'application. Une identité neuve à chaque rendu
   * relancerait donc l'incrustation, qui republierait, sans fin.
   */
  const materielFile = useMemo(() => {
    if (!calcul.ok || profondeurFile === null) return null
    return {
      profondeur: profondeurFile,
      echApx: calcul.optique.echApx.value,
      sbCiel: calcul.ciel.sbCiel.value,
      tMaxSuiviS: calcul.suivi.tMaxSuiviS.value,
    }
  }, [calcul, profondeurFile])

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

  /**
   * §5.1 — changer d'objectif change la projection, pas un réglage de rendu. Si la scène
   * regarde déjà « comme l'objectif », elle suit ; si elle est en planétarium, elle y reste.
   */
  function changeTypeObjectif(type: TypeObjectif) {
    setTypeObjectif(type)
    if (etatScene().vue.mode !== 'MODE_PLANETARIUM') majVue({ mode: modeObjectif(type) })
  }

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

  const topbar = (
    <>
      <h1>Astrofort</h1>
      <p className="etat">
        {focale} mm f/{ouverture} · {capteurMode === 'FULL_FRAME' ? 'plein format' : 'APS-C'}
      </p>
      <p className="niveau">
        {/* §10.1 — le niveau ne change QUE la densité d'explication, jamais un calcul. */}
        Niveau d’explication :{' '}
        <select value={niveau} onChange={(e) => setNiveau(e.target.value as NiveauUtilisateur)}>
          <option value="DEBUTANT">Débutant — gloses visibles</option>
          <option value="CONFIRME">Confirmé — gloses au survol</option>
        </select>
      </p>
      {/* §11.1 — le mode nuit est un geste de terrain : il reste à portée, dans la barre. */}
      <details className="tiroir tiroir-nuit">
        <summary>{modeNuit.actif ? '☾ nuit — actif' : '☾ nuit'}</summary>
        <div className="tiroir-contenu">
          <ModeNuit etat={modeNuit} surChangement={setModeNuit} />
        </div>
      </details>
      <Verification
        etat={etat}
        modeReseau={modeReseau}
        messagePersistance={messagePersistance}
        surExport={() => void surExport()}
        surImport={(fichier) => void surImport(fichier)}
      />
    </>
  )

  const materiel = (
    <PanneauMateriel
      focale={focale}
      surFocale={setFocale}
      ouverture={ouverture}
      surOuverture={setOuverture}
      capteurMode={capteurMode}
      surCapteurMode={setCapteurMode}
      comparerRecadrage={comparerRecadrage}
      surComparerRecadrage={setComparerRecadrage}
      typeObjectif={typeObjectif}
      surTypeObjectif={changeTypeObjectif}
      suiviActif={suiviActif}
      surSuiviActif={setSuiviActif}
      qualiteMes={qualiteMes}
      surQualiteMes={setQualiteMes}
      typeMonture={typeMonture}
      surTypeMonture={setTypeMonture}
      {...(calcul.ok
        ? {
            lectures: {
              optique: calcul.optique,
              suivi: calcul.suivi,
              poseNpf: calcul.poseNpf,
              ...(calcul.noteRecadrage === undefined
                ? {}
                : { noteRecadrage: calcul.noteRecadrage }),
            },
          }
        : { erreur: calcul.erreur })}
    />
  )

  const scene =
    calcul.ok ? (
      <Planetarium
        site={site}
        etoiles={etoiles}
        index={index}
        objets={catalogue}
        constellations={constellations}
        profils={profilsCadre}
        mLimOeil={calcul.ciel.mLimOeil.value}
        gaiaCharge={etat === null ? false : gaiaCharge(etat.catalogues)}
        modeObjectif={modeObjectif(typeObjectif)}
        modeNuit={modeNuit.actif}
        {...(materielFile === null ? {} : { file: materielFile })}
        surSelectionObjet={ouvreCible}
      />
    ) : (
      <p className="erreur">{calcul.erreur}</p>
    )

  const explorer = (
    <PanneauExplorer
      modeObjectif={modeObjectif(typeObjectif)}
      gaiaCharge={etat === null ? false : gaiaCharge(etat.catalogues)}
      profondeurMag={index.profondeurMag}
      mLimOeil={calcul.ok ? calcul.ciel.mLimOeil.value : null}
      epoqueAnnee={epoqueAnnee(new Date(msAffiche))}
      modeNuit={modeNuit.actif}
    />
  )

  const fiche = calcul.ok ? (
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
  ) : null

  const nuit = calcul.ok ? (
    <>
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
        <TracedValue terme="magnitude_limite_oeil" trace={calcul.ciel.mLimOeil} unite="mag" />
      </section>

      {plan === null && catalogue.length === 0 && (
        <section>
          <h2>Plan de session — §8.3</h2>
          <p className="cause">
            Les catalogues ne sont pas encore vérifiés : aucun plan n’est produit tant qu’un
            binaire non validé pourrait l’alimenter. Les moteurs de cadrage, de pose et
            d’intégration restent utilisables sur une cible saisie à la main.
          </p>
        </section>
      )}
    </>
  ) : null

  const file_ =
    calcul.ok && profondeurFile !== null ? (
      <PanneauFile
        site={site}
        focaleMm={Number(focale)}
        ouvertureN={calcul.ouvertureN}
        pitchUm={calcul.capteur.pitchUm}
        capteurLMm={calcul.capteur.capteurLMm}
        capteurHMm={calcul.capteur.capteurHMm}
        fovLDeg={calcul.optique.fovLDeg.value}
        fovHDeg={calcul.optique.fovHDeg.value}
        echApx={calcul.optique.echApx.value}
        tailleRawMo={BOITIER_REFERENCE.tailleRawMo}
        profondeur={profondeurFile}
        tMaxSuiviS={calcul.suivi.tMaxSuiviS.value}
        autonomieCipa={BOITIER_REFERENCE.autonomieCipa ?? null}
        modeObjectif={modeObjectif(typeObjectif)}
      />
    ) : null

  /* §11.2 — la seule région qui survit à l'impression : elle est nommée pour ça. */
  const planImprimable =
    calcul.ok && plan !== null && fenetreUtile !== null ? (
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
    ) : null

  const seance = (
    <PanneauSeance
      latitude={latitude}
      surLatitude={setLatitude}
      longitude={longitude}
      surLongitude={setLongitude}
      altitude={altitude}
      surAltitude={setAltitude}
      dateIso={dateIso}
      surDateIso={setDateIso}
      bortle={bortle}
      surBortle={setBortle}
      sqm={sqm}
      surSqm={setSqm}
      masque={masque}
      {...(calcul.ok ? { seuils: calcul.seuils } : {})}
      contenus={{ EXPLORER: explorer, CIBLE: fiche, NUIT: nuit, FILE: file_ }}
      plan={planImprimable}
    />
  )

  return (
    <NiveauContext value={niveau}>
      <Coque topbar={topbar} materiel={materiel} scene={scene} seance={seance} />
    </NiveauContext>
  )
}
