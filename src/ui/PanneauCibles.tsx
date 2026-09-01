/**
 * §6.4 — le catalogue comme écran : ce qu'on peut photographier, et ce que ça demande.
 *
 * Ce panneau REMPLACE deux chemins qui posaient la même question sans jamais en afficher la
 * réponse — le `<select>` « Cibles visibles » de la carte Cible, et « Chercher dans le
 * catalogue » du tiroir des réglages. Un troisième chemin de plus n'aurait rien réglé : ce
 * sont les deux autres qui disparaissent au même commit.
 *
 * La bascule « Photographiables » porte sur le CRÉNEAU de la nuit, jamais sur la hauteur à
 * l'instant affiché. §6.4 l'interdit nommément : « fusionner les deux ferait disparaître de
 * la vue une cible qui sera bonne dans deux heures ». Une galaxie à 12° au-dessus de
 * l'horizon maintenant, qui culmine à 60° avant l'aube, est photographiable — et le reste.
 *
 * Aucun calcul ici. Les lectures viennent de `cibles-liste.ts` ; la pose et la note de
 * facilité arrivent en props, calculées une fois par la chaîne, qui réemploie le moteur du
 * plan de séance : la liste, la carte Cible et le plan ne peuvent pas annoncer deux poses —
 * ni deux notes — différentes pour la même cible.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  filtreLignes,
  lignesCatalogue,
  typesPresents,
  type EtatCible,
  type LigneCible,
  type PoseCible,
} from '../core/cibles-liste.ts'
import { dureeLisible } from '../core/exposure.ts'
import { cielInstantane } from '../core/horloges.ts'
import type { Site } from '../core/ephem.ts'
import type { ContexteSession } from '../core/session.ts'
import { K } from '../registry/constants.ts'
import { DOMAINES } from '../registry/domains.ts'
import { I } from '../registry/imagerie.ts'
import type { ObjetCielProfond, TypeObjet } from '../data/deepsky.ts'
import { Bulle } from './Bulle.tsx'
import { Curseur } from './Curseur.tsx'
import { Icone } from './Icone.tsx'
import { VignetteCible } from './ImageCible.tsx'
import { prechargeVignettes } from './image-cible-memoire.ts'
import { Pastilles } from './Pastilles.tsx'
import { LIBELLE_TYPE_OBJET, nomCommun } from './libelles-objet.ts'
import { ouvreCible } from './seance-etat.ts'
import { majVue, minuteAffichee, useTrancheScene, MS_PAR_MINUTE } from './scene-etat.ts'

/** Les deux portées de la liste. La seconde est un sur-ensemble de contraintes, pas un tri. */
type Portee = 'CATALOGUE' | 'PHOTOGRAPHIABLES'

const LIBELLE_PORTEE: Readonly<Record<Portee, string>> = Object.freeze({
  CATALOGUE: 'Tout le catalogue',
  PHOTOGRAPHIABLES: 'Photographiables',
})

const PORTEES: readonly Portee[] = ['CATALOGUE', 'PHOTOGRAPHIABLES']

const DOMAINE_MAG = DOMAINES.m_int
const PAS_MAG = 0.5
const POURCENT = 100

export interface PanneauCiblesProps {
  readonly catalogue: readonly ObjetCielProfond[]
  readonly site: Site
  readonly sbCiel: number
  readonly mLimOeil: number | null
  readonly dMm: number
  readonly fovHDeg: number
  readonly echApx: number
  readonly capteurHMm: number
  /** §8.3 — absent tant que la nuit n'est pas chiffrable : aucune pose n'est alors annoncée. */
  readonly contexteSession: ContexteSession | null
  /**
   * §6.4 — la pose et la note par désignation, calculées par la chaîne. Ce panneau ne les
   * calcule pas : la carte Cible lit la MÊME map, et deux calculs séparés se sont déjà
   * contredits une fois — la carte notait ce que la liste laissait vide.
   */
  readonly etats: ReadonlyMap<string, EtatCible>
}

export function PanneauCibles(props: PanneauCiblesProps) {
  const { catalogue, site, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm, etats } = props
  const [portee, setPortee] = useState<Portee>('CATALOGUE')
  const [recherche, setRecherche] = useState('')
  const [type, setType] = useState<TypeObjet | null>(null)
  const [magMax, setMagMax] = useState(DOMAINE_MAG.max)

  // T-0056 — la minute affichée, pas l'instant : la scène publie deux fois par seconde, et
  // une minute de granularité ne change pas la hauteur au degré près sur 14 000 entrées.
  const minute = useTrancheScene(minuteAffichee)

  // Les dépendances sont énumérées champ par champ, jamais `props` : l'objet de props est
  // neuf à chaque rendu, et 14 000 verdicts recalculés à chaque frappe rendraient la
  // recherche inutilisable.
  const lignes = useMemo(
    () =>
      lignesCatalogue({
        catalogue,
        matriceCiel: cielInstantane(site, new Date(minute * MS_PAR_MINUTE)).matrice,
        sbCiel,
        mLimOeil,
        dMm,
        fovHDeg,
        echApx,
        capteurHMm,
      }),
    [catalogue, site, minute, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm],
  )

  const typesOfferts = useMemo(() => typesPresents(lignes), [lignes])

  const retenues = useMemo(() => {
    const filtrees = filtreLignes(lignes, { type, magMax, recherche })
    if (portee === 'CATALOGUE') return filtrees
    // Une cible écartée porte une note et pas de pose : elle n'est pas photographiable, donc
    // elle ne passe pas cette portée-là. C'est la POSE qui décide, pas la présence d'une note.
    return filtrees.filter((l) => etats.get(l.objet.designation)?.pose != null)
  }, [lignes, type, magMax, recherche, portee, etats])

  // §6.4 — le haut de la liste est demandé au réseau, une fois, après que la saisie s'est
  // posée. Ce sont les RÉSULTATS qui déclenchent, donc les trois gestes en sont couverts :
  // recherche, bascule de portée, filtres. Le défilement, lui, ne demande toujours rien.
  const aPrecharger = useMemo(
    () => retenues.slice(0, I('VIGNETTES_PRECHARGEES_MAX')).map((l) => l.objet),
    [retenues],
  )

  useEffect(() => {
    const attente = setTimeout(() => prechargeVignettes(aPrecharger), I('DELAI_PRECHARGE_MS'))
    return () => clearTimeout(attente)
  }, [aPrecharger])

  const plafond = K('CIBLES_LISTEES_MAX')
  const listees = retenues.slice(0, plafond)
  const seuil = props.contexteSession?.seuilHauteurDeg ?? K('SEUIL_HAUTEUR_IMAGERIE_DEG')

  return (
    <section className="cibles">
      <input
        className="cibles-recherche"
        type="search"
        aria-label="Rechercher un objet du catalogue"
        value={recherche}
        placeholder="M45, pléiades, NGC0224…"
        onChange={(e) => setRecherche(e.target.value)}
      />

      {/* La bascule ne trie pas, elle restreint : le libellé doit dire laquelle est active. */}
      <div className="cibles-portee" role="group" aria-label="Portée de la liste">
        {PORTEES.map((p) => (
          <button
            key={p}
            type="button"
            className={portee === p ? 'onglet actif' : 'onglet'}
            aria-pressed={portee === p}
            onClick={() => setPortee(p)}
          >
            {LIBELLE_PORTEE[p]}
          </button>
        ))}
      </div>

      <p className="etat">
        {portee === 'CATALOGUE'
          ? `Le catalogue embarqué, ${catalogue.length.toLocaleString('fr-FR')} entrées, sans contrainte de date.`
          : `Cibles ayant un créneau au-dessus de ${seuil}° cette nuit, cadrables par ce capteur.`}
      </p>

      <div className="cibles-filtres">
        <label>
          Type
          <select
            value={type ?? ''}
            onChange={(e) => setType(e.target.value === '' ? null : (e.target.value as TypeObjet))}
          >
            <option value="">Tous types</option>
            {typesOfferts.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE_OBJET[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Jusqu’à la magnitude{' '}
            <span className="cibles-mag-valeur">
              {magMax >= DOMAINE_MAG.max ? 'toutes' : magMax.toFixed(1)}
            </span>
          </span>
          <Curseur
            libelle="Jusqu’à la magnitude"
            valeur={magMax}
            min={DOMAINE_MAG.min}
            max={DOMAINE_MAG.max}
            pas={PAS_MAG}
            texte={magMax >= DOMAINE_MAG.max ? 'toutes' : `${magMax.toFixed(1)} mag`}
            sur={setMagMax}
          />
        </label>
      </div>

      <p className="etat">
        {retenues.length.toLocaleString('fr-FR')} objet{retenues.length > 1 ? 's' : ''}
        {retenues.length > plafond ? `, les ${plafond} plus brillants affichés` : ''}.
      </p>

      <ul className="cibles-liste">
        {listees.map((ligne) => (
          <LigneListe
            key={ligne.objet.designation}
            ligne={ligne}
            etat={etats.get(ligne.objet.designation) ?? null}
          />
        ))}
      </ul>

      {listees.length === 0 && (
        <p className="etat">
          {recherche.trim() === ''
            ? 'Aucun objet ne passe ces filtres.'
            : 'Aucun objet du catalogue ne porte ce nom.'}
        </p>
      )}

      {props.contexteSession !== null && (
        <p className="etat cibles-note">
          La pose requise vise un rapport signal sur bruit de {props.contexteSession.snrCible} avec
          le matériel courant et le fond de ciel du site. Elle double si le site perd
          0,75 mag/as². La note de facilité lit les poids de scoring réglés au plan de séance — un
          tiret dit que la cible n’a pas été évaluée, pas qu’elle est impossible.
        </p>
      )}
    </section>
  )
}

/**
 * Une ligne : ce qui décide, dans l'ordre où on le lit. Le nom, la note, puis l'encombrement
 * sur le capteur et le temps de pose. Magnitude, hauteur et brillance de surface n'y sont plus :
 * elles filtrent et ordonnent la liste, elles ne disent rien de la prise de vue que la note et
 * le temps de pose ne disent mieux.
 *
 * Deux boutons distincts et non imbriqués : choisir la cible n'est pas la même intention que
 * pointer la scène dessus, et un `<button>` dans un `<button>` n'est pas du HTML valide.
 */
function LigneListe({ ligne, etat }: { readonly ligne: LigneCible; readonly etat: EtatCible | null }) {
  const { objet } = ligne
  const nom = nomCommun(objet)

  return (
    <li className="cible-item">
      {/* §6.4 — depuis le cache seulement : le défilement de la liste n'émet aucune requête.
          C'est le préchargement du haut de liste qui garnit ce cache, en une salve plafonnée.
          Hors du bouton, pour que l'image ne soit pas un contenu cliquable de plus. */}
      <VignetteCible objet={objet} />
      <button type="button" className="cible-ligne" onClick={() => ouvreCible(objet)}>
        <span className="cible-designation">{objet.designation}</span>
        {/* Sans note, aucune pastille : cinq pastilles vides se lisent « impossible », ce qui
            serait faux d'une cible que le moteur n'a simplement pas évaluée. */}
        {etat !== null && (
          <Pastilles note={etat.note} libelle={etat.libelle} cause={etat.cause} />
        )}
        <span className="cible-commun">{nom === '' ? LIBELLE_TYPE_OBJET[objet.type] : nom}</span>
        <span className="cible-lectures">
          {lectures(ligne, etat).map((mesure) => (
            <span key={mesure}>{mesure}</span>
          ))}
        </span>
      </button>
      {/* T-0046 — « Voir » centre, et rien d'autre : ni le champ, ni l'horloge ne bougent.
          Sous l'horizon, la direction existe quand même — la vue descend jusqu'à −90° — et
          c'est elle qu'on veut connaître pour savoir de quel côté attendre le lever. Le
          bouton reste donc offert sur toute ligne ; la couche Sol continue de masquer ce
          qu'elle recouvre, et la bulle dit pourquoi la cible n'apparaîtra pas. */}
      <Bulle texte={libelleVisee(ligne)} place="gauche" nomme>
        <button
          type="button"
          className="cible-voir"
          onClick={() => majVue({ azimutDeg: ligne.azimutDeg, hauteurDeg: ligne.hauteurDeg })}
        >
          <Icone nom="my_location" />
        </button>
      </Bulle>
    </li>
  )
}

/**
 * Viser sous l'horizon centre une direction sans objet à voir : le sol la recouvre. La bulle
 * l'annonce avant le clic, sinon le geste se lit comme un bouton cassé.
 */
function libelleVisee(ligne: LigneCible): string {
  const cible = `Centrer la scène sur ${ligne.objet.designation}`
  return ligne.hauteurDeg > 0 ? cible : `${cible} — sous l’horizon, masquée par le sol`
}

/**
 * Les lectures d'une ligne, séparées : chacune doit pouvoir tenir sur une ligne. Le temps de
 * pose vient en dernier parce qu'il dépend de tout le reste — sans évaluation du moteur, il ne
 * s'invente pas, et la lecture disparaît plutôt que d'annoncer un tiret de plus.
 */
function lectures(ligne: LigneCible, etat: EtatCible | null): readonly string[] {
  const pose = etat?.pose ?? null
  return [
    libelleEncombrement(ligne),
    ...(pose === null ? [] : [libellePose(pose)]),
  ]
}

/** §7.3 — plus d'une nuit change la nature du plan, pas seulement sa durée : ça se dit. */
function libellePose(pose: PoseCible): string {
  const total = `temps de pose ${dureeLisible(pose.tRequisS)}`
  return pose.nNuits > 1 ? `${total} · ${pose.nNuits} nuits` : total
}

/**
 * La place sur la photo, et rien d'autre : c'est la question qu'on se pose devant une ligne de
 * catalogue. Le diamètre en pixels reste sur la fiche cible (§6.2), où il tranche le détail —
 * sur une liste il se lisait comme un encombrement, ce qu'il n'est pas.
 */
function libelleEncombrement(ligne: LigneCible): string {
  const { remplissage } = ligne
  if (remplissage === null) return 'dimensions absentes'
  return `${(remplissage * POURCENT).toFixed(0)} % du cadre`
}
