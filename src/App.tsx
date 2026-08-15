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
import { demarre, type EtatDemarrage } from './data/bootstrap.ts'
import {
  BOITIER_REFERENCE,
  capteurEffectif,
  pointZeroSysteme,
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
import { Etiquette, NiveauContext, Terme, type NiveauUtilisateur } from './ui/Terme.tsx'

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

  const [suiviActif, setSuiviActif] = useState(false)
  const [qualiteMes, setQualiteMes] = useState<QualiteMiseEnStation>('INCONNUE')
  const [typeMonture, setTypeMonture] = useState<TypeMonture>('TRACKER')

  const [etat, setEtat] = useState<EtatDemarrage | null>(null)
  const [messagePersistance, setMessagePersistance] = useState<string | null>(null)
  // §12.5 — l'état affiché suit les bascules, il n'est pas figé au démarrage.
  const modeReseau = useSyncExternalStore(abonneModeReseau, modeReseauCourant, () => 'EN_LIGNE')

  useEffect(() => {
    void demarre().then(setEtat)
  }, [])

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
          </>
        )}

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
