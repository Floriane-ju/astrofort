/**
 * Écran de vérification du Lot 0 (§14).
 *
 * Livrable vérifiable : l'application démarre hors réseau, calcule un crépuscule juste à
 * 2 minutes près et expose son registre de constantes. Aucun design : cet écran sert à
 * constater que le socle tient, il sera remplacé par les parcours des lots 1 à 3.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { fenetreNocturne, offsetMidiSolaireMin, type FenetreNocturne } from './core/night.ts'
import { seuilsDeclinaison, type SeuilsSite } from './core/site.ts'
import { fondDeCiel, type FondDeCiel } from './core/sky-background.ts'
import { BortleHorsTableError } from './registry/bortle.ts'
import { HorsDomaineSeriesError } from './core/ephem.ts'
import { MATRICE_DEGRADATION, abonneModeReseau, modeReseauCourant } from './data/degradation.ts'
import { demarre, type EtatDemarrage } from './data/bootstrap.ts'
import {
  demandePersistance,
  exporteDonneesUtilisateur,
  importeDonneesUtilisateur,
} from './data/persistence.ts'
import { REGISTRE } from './registry/constants.ts'
import type { Traced } from './core/traced.ts'
import { TracedValue } from './ui/TracedValue.tsx'

/** Site de référence de l'Annexe A. */
const SITE_DEFAUT = {
  latitude: '46.391',
  longitude: '6.697',
  altitude: '500',
  bortle: '4.5',
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
    }
  | { readonly ok: false; readonly erreur: string }

export function App() {
  const [latitude, setLatitude] = useState(SITE_DEFAUT.latitude)
  const [longitude, setLongitude] = useState(SITE_DEFAUT.longitude)
  const [altitude, setAltitude] = useState(SITE_DEFAUT.altitude)
  const [bortle, setBortle] = useState(SITE_DEFAUT.bortle)
  const [sqm, setSqm] = useState('')
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [etat, setEtat] = useState<EtatDemarrage | null>(null)
  const [messagePersistance, setMessagePersistance] = useState<string | null>(null)
  // §12.5 — l'état affiché suit les bascules, il n'est pas figé au démarrage.
  const modeReseau = useSyncExternalStore(abonneModeReseau, modeReseauCourant, () => 'EN_LIGNE')

  useEffect(() => {
    void demarre().then(setEtat)
  }, [])

  const site = {
    latitudeDeg: Number(latitude),
    longitudeDeg: Number(longitude),
    altitudeM: Number(altitude),
  }

  const calcul = useMemo((): Calcul => {
    try {
      // Départ à midi UTC : la recherche du coucher part de là.
      const depart = new Date(`${dateIso}T12:00:00Z`)
      const offsetFuseauH = -new Date().getTimezoneOffset() / 60
      return {
        ok: true,
        nuit: fenetreNocturne(site, depart),
        ciel: fondDeCiel({
          ...(sqm.trim() === '' ? {} : { sqmMesure: Number(sqm) }),
          ...(bortle.trim() === '' ? {} : { bortleDeclare: Number(bortle) }),
        }),
        seuils: seuilsDeclinaison(site.latitudeDeg),
        offsetMidi: offsetMidiSolaireMin(site.longitudeDeg, offsetFuseauH),
      }
    } catch (erreur) {
      // Saisie refusée ou domaine dépassé : la cause est nommée, pas avalée.
      if (erreur instanceof BortleHorsTableError || erreur instanceof HorsDomaineSeriesError) {
        return { ok: false, erreur: erreur.message }
      }
      throw erreur
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, altitude, bortle, sqm, dateIso])

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
    <main>
      <h1>Astrofort — vérification du socle</h1>

      <section>
        <h2>Site et date</h2>
        <div className="champs">
          <label>
            Latitude (°)
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </label>
          <label>
            Longitude (°)
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </label>
          <label>
            Altitude (m)
            <input value={altitude} onChange={(e) => setAltitude(e.target.value)} />
          </label>
          <label>
            Date
            <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
          </label>
          <label>
            Bortle (1 à 9)
            <input value={bortle} onChange={(e) => setBortle(e.target.value)} />
          </label>
          <label>
            SQM mesuré (mag/as²)
            <input
              value={sqm}
              placeholder="prioritaire si renseigné"
              onChange={(e) => setSqm(e.target.value)}
            />
          </label>
        </div>
      </section>

      {!calcul.ok && <p className="erreur">{calcul.erreur}</p>}

      {calcul.ok && (
        <>
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
              libelle="Décalage du midi solaire vrai"
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
            <TracedValue
              libelle="Brillance du fond de ciel"
              trace={calcul.ciel.sbCiel}
              unite="mag/as²"
            />
            <TracedValue
              libelle="Magnitude limite à l’œil nu"
              trace={calcul.ciel.mLimOeil}
              unite="mag"
            />
          </section>

          <section>
            <h2>Seuils du site</h2>
            <TracedValue
              libelle="Circumpolaire au-delà de δ"
              trace={calcul.seuils.decCircumpolaire}
              decimales={1}
              unite="°"
            />
            <TracedValue
              libelle="Imagerie impossible sous δ"
              trace={calcul.seuils.decMinImagerie}
              decimales={1}
              unite="°"
            />
            <TracedValue
              libelle="Visuel impossible sous δ"
              trace={calcul.seuils.decMinVisuel}
              decimales={1}
              unite="°"
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
            {etat.catalogues.cause !== undefined && <p className="cause">{etat.catalogues.cause}</p>}
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
  )
}
