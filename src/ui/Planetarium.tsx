/**
 * §3 — Le planétarium : pipeline à deux horloges, curseur temporel, moteur unifié, trois
 * couches de tracés et superposition du cadre matériel.
 *
 * Ce n'est pas une vue décorative : c'est le point d'entrée vers les moteurs. Un clic sur
 * un objet du ciel profond charge la fiche §6.2 / §6.3 / §7, et le cadre superposé montre
 * ce que le matériel déclaré capturerait vraiment.
 *
 * Le rendu vit dans une boucle `requestAnimationFrame` qui lit un état mutable ; React ne
 * réagit qu'aux commandes et aux diagnostics, jamais à l'image. Sans cette séparation, une
 * animation à 60 Hz déclencherait soixante rendus React par seconde.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { K } from '../registry/constants.ts'
import type { Etoile } from '../data/catalog.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { PaquetConstellations } from '../data/constellations.ts'
import {
  RAPPEL_ASTERISME,
  RAPPEL_FIGURES,
  coucheAsterismes,
  coucheFigures,
  coucheFrontieres,
  ecartFrontieresDeg,
} from '../core/constellations.ts'
import { construitIndex } from '../core/index-ciel.ts'
import {
  avanceEphemerides,
  avertissementEpoque,
  cielInstantane,
  pasEphemeridesMs,
  positionsInterpolees,
  type EtatEphemerides,
} from '../core/horloges.ts'
import {
  PAS_ASTRONOMIQUES,
  pasAstronomique,
  reglageVitesse,
  type ModeTemps,
  type PasAstronomique,
  type ReglageVitesse,
} from '../core/curseur-temps.ts'
import {
  bornesZoom,
  etatProfondeur,
  projecteur,
  type ModeProjection,
  type Vue,
} from '../core/projection.ts'
import {
  REFUS_SANS_PROFIL,
  cibleDominante,
  refusAuDelaDuMaximum,
  rotationSuggeree,
  type Cadre,
  type ProfilCadre,
} from '../core/cadre.ts'
import type { Site } from '../core/ephem.ts'
import { versSpherique } from '../core/mat3.ts'
import {
  cibleSousLeCurseur,
  dessineCiel,
  type CibleEcran,
  type CouchesActives,
} from './dessine-ciel.ts'
import { TracedValue } from './TracedValue.tsx'
import { Terme } from './Terme.tsx'

/** Noms français des corps mobiles de §3.1. */
const NOMS_CORPS: Readonly<Record<string, string>> = {
  Sun: 'Soleil',
  Moon: 'Lune',
  Mercury: 'Mercure',
  Venus: 'Vénus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturne',
  Uranus: 'Uranus',
}

/**
 * Résolution de rendu fixe, celle du viewport de référence de §3.2 : c'est elle qui fixe
 * l'échelle en pixels par degré, donc le plafond de défilement. La feuille de style met le
 * canevas à la largeur disponible ; le rendu, lui, reste calculé à cette définition.
 */
const LARGEUR_CANEVAS = 1920
const HAUTEUR_CANEVAS = 1080
/** Rafraîchissement des compteurs de diagnostic : lisible sans clignoter. */
const PERIODE_DIAGNOSTIC_MS = 500
const FACTEUR_ZOOM_MOLETTE = 1.1
const HAUTEUR_MIN_DEG = -90
const HAUTEUR_MAX_DEG = 90
const MS_PAR_S = 1000
const ARCMIN_PAR_DEG = 60

export interface PlanetariumProps {
  readonly site: Site
  readonly etoiles: readonly Etoile[]
  readonly objets: readonly ObjetCielProfond[]
  readonly constellations: PaquetConstellations
  /** Profils de cadre à superposer (§3.5). Vide : l'app demande le profil, sans en inventer. */
  readonly profils: readonly ProfilCadre[]
  readonly mLimOeil: number | null
  readonly gaiaCharge: boolean
  /** §11.1 — aucune animation non sollicitée en mode nuit. */
  readonly modeNuit: boolean
  readonly surSelectionObjet: (objet: ObjetCielProfond) => void
}

interface Diagnostic {
  readonly fps: number
  readonly etoilesExaminees: number
  readonly etoilesDessinees: number
  readonly cellules: number
  readonly labels: number
}

interface Selection {
  readonly titre: string
  readonly lignes: readonly string[]
  readonly objet: ObjetCielProfond | null
}

function decritCible(cible: CibleEcran): Selection {
  if (cible.type === 'OBJET' && cible.objet !== undefined) {
    const o = cible.objet
    return {
      titre: o.designation + (o.nomsCommuns === '' ? '' : ` — ${o.nomsCommuns.split('|')[0]}`),
      lignes: [
        `type ${o.type}`,
        o.vMag === null ? 'magnitude intégrée absente du catalogue' : `magnitude ${o.vMag}`,
        o.majAxArcmin === null ? 'dimensions absentes' : `grand axe ${o.majAxArcmin}’`,
      ],
      objet: o,
    }
  }
  if (cible.type === 'CORPS' && cible.corps !== undefined) {
    const c = cible.corps
    return {
      titre: cible.nom,
      lignes: [
        `ascension droite ${c.adH.toFixed(3)} h · déclinaison ${c.decDeg.toFixed(2)}°`,
        `azimut ${c.azimutDeg.toFixed(1)}° · hauteur ${c.hauteurDeg.toFixed(1)}°`,
        'Position interpolée entre deux échantillons d’éphémérides (§3.1).',
      ],
      objet: null,
    }
  }
  const nommee = cible.etoileNommee
  if (nommee !== undefined) {
    return {
      titre: nommee.nomPropre === '' ? nommee.designation : `${nommee.nomPropre} — ${nommee.designation}`,
      lignes: [
        `magnitude ${nommee.magV.toFixed(2)} · constellation ${nommee.constellation}`,
        nommee.spectre === '' ? 'type spectral absent du catalogue' : `type spectral ${nommee.spectre}`,
        nommee.distancePc === null
          ? 'distance non fiable : la parallaxe manque, aucune valeur n’est estimée'
          : `distance ${nommee.distancePc.toFixed(1)} pc`,
      ],
      objet: null,
    }
  }
  const etoile = cible.etoile
  return {
    titre: 'Étoile sans désignation dans le paquet chargé',
    lignes: [
      etoile === undefined
        ? ''
        : `magnitude ${etoile.magV.toFixed(2)} · indice B−V ${etoile.bv.toFixed(2)}`,
      'Le paquet des étoiles nommées ne porte que les désignations Bayer sous magnitude ' +
        `${K('MAG_LABEL_BAYER_MAX')} et les noms propres. Aucune désignation n’est inventée.`,
    ].filter((l) => l !== ''),
    objet: null,
  }
}

export function Planetarium(props: PlanetariumProps) {
  const canevas = useRef<HTMLCanvasElement>(null)

  const bornes = useMemo(() => bornesZoom(props.gaiaCharge), [props.gaiaCharge])
  const [fovDeg, setFovDeg] = useState(K('FOV_REFERENCE_RENDU_DEG'))
  const [azimutDeg, setAzimutDeg] = useState(180)
  const [hauteurDeg, setHauteurDeg] = useState(K('SEUIL_HAUTEUR_IMAGERIE_DEG'))
  const [rotationDeg, setRotationDeg] = useState(0)
  const [mode, setMode] = useState<ModeProjection>('MODE_PLANETARIUM')
  const [vueRealiste, setVueRealiste] = useState(false)
  const [couches, setCouches] = useState<CouchesActives>({
    figures: true,
    frontieres: false,
    asterismes: true,
    cadre: true,
    horizon: true,
  })
  const [modeTemps, setModeTemps] = useState<ModeTemps>('MAINTENANT')
  const [facteurDemande, setFacteurDemande] = useState(60)
  const [pas, setPas] = useState<PasAstronomique>('JOUR_SIDERAL')
  const [diagnostic, setDiagnostic] = useState<Diagnostic>({
    fps: 0,
    etoilesExaminees: 0,
    etoilesDessinees: 0,
    cellules: 0,
    labels: 0,
  })
  const [dateAffichee, setDateAffichee] = useState(() => new Date())
  const [selection, setSelection] = useState<Selection | null>(null)

  const index = useMemo(() => construitIndex(props.etoiles), [props.etoiles])
  const figures = useMemo(
    () => coucheFigures(props.constellations.figures),
    [props.constellations],
  )
  const asterismes = useMemo(
    () => coucheAsterismes(props.constellations.asterismes),
    [props.constellations],
  )
  const frontieres = useMemo(() => coucheFrontieres(props.constellations), [props.constellations])

  const profondeur = useMemo(
    () => etatProfondeur(fovDeg, index.profondeurMag, props.mLimOeil, vueRealiste),
    [fovDeg, index.profondeurMag, props.mLimOeil, vueRealiste],
  )
  const reglage: ReglageVitesse = useMemo(
    () => reglageVitesse(facteurDemande, LARGEUR_CANEVAS, fovDeg),
    [facteurDemande, fovDeg],
  )

  // État mutable lu par la boucle de rendu, réécrit à chaque rendu React.
  const scene = useRef({
    props,
    index,
    figures,
    asterismes,
    frontieres,
    couches,
    magLimite: profondeur.magLimite.value,
    vue: { fovDeg, azimutDeg, hauteurDeg, rotationDeg, mode },
    modeTemps,
    facteur: reglage.facteur,
    anime: modeTemps === 'DEFILEMENT' && !props.modeNuit,
  })
  scene.current = {
    props,
    index,
    figures,
    asterismes,
    frontieres,
    couches,
    magLimite: profondeur.magLimite.value,
    vue: { fovDeg, azimutDeg, hauteurDeg, rotationDeg, mode },
    modeTemps,
    facteur: reglage.facteur,
    anime: modeTemps === 'DEFILEMENT' && !props.modeNuit,
  }

  const dateMs = useRef(Date.now())
  const cibles = useRef<readonly CibleEcran[]>([])
  const ephemerides = useRef<EtatEphemerides | null>(null)

  /** §3.2 — un pas astronomique est un saut de l'horloge d'affichage, pas un défilement. */
  function saute(secondes: number): void {
    dateMs.current += secondes * MS_PAR_S
  }

  useEffect(() => {
    const contexte = canevas.current?.getContext('2d') ?? null
    if (contexte === null) return

    let actif = true
    let dernierTs: number | null = null
    let dernierDiag = 0
    let images = 0

    const image = (ts: number): void => {
      if (!actif) return
      const etat = scene.current
      const dt = dernierTs === null ? 0 : ts - dernierTs
      dernierTs = ts

      if (etat.modeTemps === 'MAINTENANT') {
        // Resynchronisation continue : aucune dérive ne s'accumule sur plusieurs heures.
        dateMs.current = Date.now()
      } else if (etat.anime) {
        dateMs.current += dt * etat.facteur
      }
      const date = new Date(dateMs.current)

      const ciel = cielInstantane(etat.props.site, date)
      ephemerides.current = avanceEphemerides(
        ephemerides.current,
        etat.props.site,
        dateMs.current,
        pasEphemeridesMs(etat.anime ? etat.facteur : 1),
      )
      const corps = ciel.corpsMasques
        ? []
        : positionsInterpolees(ephemerides.current, dateMs.current)

      const vue: Vue = {
        mode: etat.vue.mode,
        fovDeg: etat.vue.fovDeg,
        largeurPx: LARGEUR_CANEVAS,
        hauteurPx: HAUTEUR_CANEVAS,
        azimutDeg: etat.vue.azimutDeg,
        hauteurDeg: etat.vue.hauteurDeg,
        rotationDeg: etat.vue.rotationDeg,
      }
      const proj = projecteur(vue, ciel.matrice)
      const sortie = dessineCiel({
        ctx: contexte,
        projecteur: proj,
        matriceCiel: ciel.matrice,
        index: etat.index,
        etoiles: etat.props.etoiles,
        objets: etat.props.objets,
        figures: etat.figures,
        asterismes: etat.asterismes,
        frontieres: etat.frontieres,
        etoilesNommees: etat.props.constellations.etoilesNommees,
        corps,
        nomsCorps: NOMS_CORPS,
        cadres: etat.couches.cadre
          ? etat.props.profils.map(
              (profil): Cadre => ({
                profil,
                azimutDeg: etat.vue.azimutDeg,
                hauteurDeg: etat.vue.hauteurDeg,
                rotationDeg: etat.vue.rotationDeg,
              }),
            )
          : [],
        couches: etat.couches,
        magLimite: etat.magLimite,
        modeNuit: etat.props.modeNuit,
      })
      cibles.current = sortie.cibles

      images++
      if (ts - dernierDiag >= PERIODE_DIAGNOSTIC_MS) {
        setDiagnostic({
          fps: (images * MS_PAR_S) / (ts - dernierDiag),
          etoilesExaminees: sortie.stats.etoilesExaminees,
          etoilesDessinees: sortie.etoilesDessinees,
          cellules: sortie.stats.cellulesRetenues,
          labels: sortie.labels.length,
        })
        setDateAffichee(date)
        images = 0
        dernierDiag = ts
      }
      requestAnimationFrame(image)
    }

    const id = requestAnimationFrame(image)
    return () => {
      actif = false
      cancelAnimationFrame(id)
    }
  }, [])

  const glisse = useRef<{ x: number; y: number } | null>(null)

  function surPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    glisse.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function surPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    const depart = glisse.current
    if (depart === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const echelle = LARGEUR_CANEVAS / rect.width
    const dx = (e.clientX - depart.x) * echelle
    const dy = (e.clientY - depart.y) * echelle
    const degresParPixel = fovDeg / LARGEUR_CANEVAS
    setAzimutDeg((a) => (((a - dx * degresParPixel) % 360) + 360) % 360)
    setHauteurDeg((h) =>
      Math.max(HAUTEUR_MIN_DEG, Math.min(HAUTEUR_MAX_DEG, h + dy * degresParPixel)),
    )
    glisse.current = { x: e.clientX, y: e.clientY }
  }

  function surPointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    const depart = glisse.current
    glisse.current = null
    if (depart === null) return
    if (Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const echelle = LARGEUR_CANEVAS / rect.width
    const cible = cibleSousLeCurseur(
      cibles.current,
      (e.clientX - rect.left) * echelle,
      (e.clientY - rect.top) * echelle,
    )
    setSelection(cible === null ? null : decritCible(cible))
  }

  function surMolette(e: React.WheelEvent<HTMLCanvasElement>): void {
    const facteur = e.deltaY > 0 ? FACTEUR_ZOOM_MOLETTE : 1 / FACTEUR_ZOOM_MOLETTE
    setFovDeg((f) => Math.max(bornes.fovMinDeg, Math.min(bornes.fovMaxDeg, f * facteur)))
  }

  const cadrePrincipal: Cadre | null =
    props.profils.length === 0
      ? null
      : {
          profil: props.profils[0]!,
          azimutDeg,
          hauteurDeg,
          rotationDeg,
        }
  const ciel = useMemo(
    () => cielInstantane(props.site, dateAffichee),
    [props.site, dateAffichee],
  )
  const dominante = useMemo(
    () => (cadrePrincipal === null ? null : cibleDominante(props.objets, cadrePrincipal, ciel.matrice)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.objets, ciel, azimutDeg, hauteurDeg, rotationDeg, props.profils],
  )
  const suggestion = useMemo(
    () =>
      dominante === null || cadrePrincipal === null
        ? null
        : rotationSuggeree(dominante, cadrePrincipal, ciel.matrice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dominante, ciel, azimutDeg, hauteurDeg, rotationDeg],
  )
  const viseeJ2000 = useMemo(() => {
    const vue: Vue = {
      mode,
      fovDeg,
      largeurPx: LARGEUR_CANEVAS,
      hauteurPx: HAUTEUR_CANEVAS,
      azimutDeg,
      hauteurDeg,
      rotationDeg,
    }
    return versSpherique(
      projecteur(vue, ciel.matrice).inverse(LARGEUR_CANEVAS / 2, HAUTEUR_CANEVAS / 2),
    )
  }, [mode, fovDeg, azimutDeg, hauteurDeg, rotationDeg, ciel])

  const tropDeProfils = refusAuDelaDuMaximum(props.profils.length)
  const avertissement = avertissementEpoque(ciel.epoqueAnnee)

  return (
    <section>
      <h2>Planétarium — §3</h2>

      <canvas
        ref={canevas}
        className="planetarium"
        width={LARGEUR_CANEVAS}
        height={HAUTEUR_CANEVAS}
        onPointerDown={surPointerDown}
        onPointerMove={surPointerMove}
        onPointerUp={surPointerUp}
        onWheel={surMolette}
      />

      <p className="etat">
        {dateAffichee.toLocaleString('fr-FR')} · visée {viseeJ2000.longitudeDeg.toFixed(2)}° AD /{' '}
        {viseeJ2000.latitudeDeg.toFixed(2)}° δ · azimut {azimutDeg.toFixed(0)}°, hauteur{' '}
        {hauteurDeg.toFixed(0)}° · époque {ciel.epoqueAnnee.toFixed(1)}
      </p>
      {ciel.cause !== undefined && <p className="cause">{ciel.cause}</p>}
      {avertissement !== null && <p className="cause">{avertissement}</p>}

      <div className="champs">
        <label>
          Projection
          <select value={mode} onChange={(e) => setMode(e.target.value as ModeProjection)}>
            <option value="MODE_PLANETARIUM">Planétarium — stéréographique</option>
            <option value="MODE_CADRE">Cadre — gnomonique, comme l’objectif</option>
            <option value="MODE_FISHEYE">Fisheye — équidistante</option>
          </select>
        </label>
        <label>
          Champ : {fovDeg.toFixed(1)}°
          <input
            type="range"
            min={bornes.fovMinDeg}
            max={bornes.fovMaxDeg}
            step={1}
            value={fovDeg}
            onChange={(e) => setFovDeg(Number(e.target.value))}
          />
        </label>
        <label>
          Rotation du cadre : {rotationDeg.toFixed(0)}°
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
            checked={vueRealiste}
            onChange={(e) => setVueRealiste(e.target.checked)}
          />
          Vue réaliste — plafonnée par le fond de ciel
        </label>
      </div>

      {bornes.cause !== undefined && <p className="cause">{bornes.cause}</p>}

      <div className="champs">
        {(
          [
            ['figures', 'Figures IAU'],
            ['frontieres', 'Frontières IAU'],
            ['asterismes', 'Astérismes'],
            ['cadre', 'Cadre matériel'],
            ['horizon', 'Horizon'],
          ] as const
        ).map(([cle, libelle]) => (
          <label className="interrupteur" key={cle}>
            <input
              type="checkbox"
              checked={couches[cle]}
              onChange={(e) => setCouches({ ...couches, [cle]: e.target.checked })}
            />
            {libelle}
          </label>
        ))}
      </div>
      {couches.asterismes && <p className="etat">{RAPPEL_ASTERISME}</p>}
      {couches.figures && <p className="etat">{RAPPEL_FIGURES}</p>}
      {couches.frontieres && (
        <TracedValue
          terme="precession"
          suffixe="frontières B1875 → époque affichée"
          trace={ecartFrontieresDeg(ciel.epoqueAnnee)}
          unite="°"
        />
      )}

      <div className="champs">
        <label>
          Mode de temps
          <select value={modeTemps} onChange={(e) => setModeTemps(e.target.value as ModeTemps)}>
            <option value="MAINTENANT">Maintenant — suit l’horloge système</option>
            <option value="FIGE">Figé</option>
            <option value="DEFILEMENT">Défilement</option>
            <option value="PAS_ASTRONOMIQUES">Pas astronomiques</option>
          </select>
        </label>
        {modeTemps === 'DEFILEMENT' && (
          <label>
            Facteur ×{facteurDemande.toFixed(0)}
            <input
              type="range"
              min={-reglage.facteurMax.value}
              max={reglage.facteurMax.value}
              step={1}
              value={facteurDemande}
              onChange={(e) => setFacteurDemande(Number(e.target.value))}
            />
          </label>
        )}
        {modeTemps === 'PAS_ASTRONOMIQUES' && (
          <>
            <label>
              Pas
              <select value={pas} onChange={(e) => setPas(e.target.value as PasAstronomique)}>
                {PAS_ASTRONOMIQUES.map((p) => (
                  <option key={p} value={p}>
                    {pasAstronomique(p).libelle}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="button" onClick={() => saute(-pasAstronomique(pas).dureeS)}>
                − 1 {pasAstronomique(pas).libelle.toLowerCase()}
              </button>
              <button type="button" onClick={() => saute(pasAstronomique(pas).dureeS)}>
                + 1 {pasAstronomique(pas).libelle.toLowerCase()}
              </button>
            </div>
            <p className="etat">{pasAstronomique(pas).enseigne}</p>
          </>
        )}
      </div>

      {modeTemps === 'DEFILEMENT' && (
        <>
          <TracedValue terme="vitesse_ecran" trace={reglage.vEcran} unite="px/s" />
          <TracedValue
            terme="facteur_vitesse_max"
            trace={reglage.facteurMax}
            decimales={0}
            unite="×"
          />
          <p className={reglage.etat === 'LISIBLE' ? 'etat' : 'cause'}>
            lisibilité : {reglage.etat}
          </p>
          {reglage.message !== undefined && <p className="cause">{reglage.message}</p>}
          {reglage.facteurPropose !== undefined && (
            <button type="button" onClick={() => setFacteurDemande(reglage.facteurPropose!)}>
              Passer à ×{reglage.facteurPropose.toFixed(0)}
            </button>
          )}
          {props.modeNuit && (
            <p className="cause">
              Mode nuit actif : le défilement est en pause. Aucune animation non sollicitée
              n’est jouée en mode nuit (§11.1) — la vue reste manipulable.
            </p>
          )}
        </>
      )}

      <TracedValue
        terme="magnitude_limite_rendue"
        trace={profondeur.magLimite}
        unite="mag"
      />
      {profondeur.cause !== undefined && <p className="cause">{profondeur.cause}</p>}

      <section>
        <h3>Cadre matériel — §3.5</h3>
        {props.profils.length === 0 && <p className="cause">{REFUS_SANS_PROFIL}</p>}
        {tropDeProfils !== null && <p className="cause">{tropDeProfils}</p>}
        <ul>
          {props.profils.map((profil) => (
            <li key={profil.libelle}>
              {profil.libelle} — {profil.fovLDeg.toFixed(1)}° × {profil.fovHDeg.toFixed(1)}°,
              échantillonnage {profil.echApx.toFixed(2)} "/px,{' '}
              {profil.tPoseS === null
                ? 'pose non chiffrable sans plafond de suivi'
                : `pose ${profil.tPoseS.toFixed(0)} s`}
            </li>
          ))}
        </ul>
        {props.profils.length > 1 && (
          <p className="etat">
            L’échantillonnage est identique dans les deux cadres : un recadrage de capteur ne
            change ni le pitch ni la focale, donc ni la résolution (§5.1).
          </p>
        )}
        {dominante !== null && (
          <p className="etat">
            Cible dominante dans le cadre : {dominante.objet.designation}, grand axe{' '}
            {(dominante.tailleDeg * ARCMIN_PAR_DEG).toFixed(0)}’ — remplissage{' '}
            {((dominante.tailleDeg / (props.profils[0]?.fovHDeg ?? 1)) * 100).toFixed(0)} % de la
            petite dimension du champ.
          </p>
        )}
        {suggestion !== null && (
          <div className="actions">
            <span className="etat">{suggestion.message}</span>
            <button type="button" onClick={() => setRotationDeg(suggestion.angleDeg)}>
              Appliquer {suggestion.angleDeg.toFixed(0)}°
            </button>
          </div>
        )}
      </section>

      {selection !== null && (
        <section>
          <h3>{selection.titre}</h3>
          {selection.lignes.map((ligne) => (
            <p className="etat" key={ligne}>
              {ligne}
            </p>
          ))}
          {selection.objet !== null && (
            <button type="button" onClick={() => props.surSelectionObjet(selection.objet!)}>
              Ouvrir la fiche de cadrage, de détectabilité et de pose
            </button>
          )}
        </section>
      )}

      <Terme
        cle="deux_horloges"
        contexte={`${diagnostic.fps.toFixed(0)} images/s`}
      />
      <p className="etat">
        {diagnostic.etoilesDessinees} étoiles tracées sur {diagnostic.etoilesExaminees} lues,{' '}
        {diagnostic.cellules} cellules d’index retenues sur {index.cellules.length},{' '}
        {index.nombreEtoiles} étoiles au catalogue, {diagnostic.labels} labels composés sur{' '}
        {K('LABELS_MAX')} au plus.
      </p>
    </section>
  )
}
