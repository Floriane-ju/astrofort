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
 * Aucun calcul ici. Les lectures viennent de `cibles-liste.ts` et la pose de `posesRequises`,
 * qui réemploie le moteur du plan de séance : la liste et le plan ne peuvent pas annoncer
 * deux poses différentes pour la même cible.
 */

import { useMemo, useState } from 'react'
import {
  filtreLignes,
  lignesCatalogue,
  posesRequises,
  typesPresents,
  type LigneCible,
  type PoseCible,
} from '../core/cibles-liste.ts'
import { dureeLisible } from '../core/exposure.ts'
import { cielInstantane } from '../core/horloges.ts'
import type { Site } from '../core/ephem.ts'
import type { ContexteSession } from '../core/session.ts'
import { K } from '../registry/constants.ts'
import { DOMAINES } from '../registry/domains.ts'
import type { ObjetCielProfond, TypeObjet } from '../data/deepsky.ts'
import { Icone } from './Icone.tsx'
import { VignetteCible } from './ImageCible.tsx'
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
}

export function PanneauCibles(props: PanneauCiblesProps) {
  const { catalogue, site, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm } = props
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

  /**
   * Le poste coûteux : une éphéméride de créneau par cible. Il ne dépend pas de la minute
   * affichée — un créneau est une propriété de la NUIT — donc bouger le curseur de temps ne
   * le relance pas.
   *
   * ponytail: environ une seconde à la première ouverture, sur le thread de rendu, comme le
   * plan de séance (§12.1 le veut en Web Worker). C'est un coût par changement de site ou de
   * matériel, pas par geste : la bascule et la frappe retombent sous les 100 ms. Le jour où
   * il faut le déporter, c'est ce memo-là et celui du plan, pas le rendu de la liste.
   */
  const poses = useMemo(
    () =>
      props.contexteSession === null
        ? new Map<string, PoseCible>()
        : posesRequises(props.contexteSession, catalogue),
    [props.contexteSession, catalogue],
  )

  const typesOfferts = useMemo(() => typesPresents(lignes), [lignes])

  const retenues = useMemo(() => {
    const filtrees = filtreLignes(lignes, { type, magMax, recherche })
    return portee === 'CATALOGUE' ? filtrees : filtrees.filter((l) => poses.has(l.objet.designation))
  }, [lignes, type, magMax, recherche, portee, poses])

  const plafond = K('CIBLES_LISTEES_MAX')
  const listees = retenues.slice(0, plafond)
  const seuil = props.contexteSession?.seuilHauteurDeg ?? K('SEUIL_HAUTEUR_IMAGERIE_DEG')

  return (
    <section className="cibles">
      <p className="etat">
        {portee === 'CATALOGUE'
          ? `Le catalogue embarqué, ${catalogue.length.toLocaleString('fr-FR')} entrées, sans contrainte de date.`
          : `Cibles ayant un créneau au-dessus de ${seuil}° cette nuit, cadrables par ce capteur.`}
      </p>

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
          <input
            type="range"
            min={DOMAINE_MAG.min}
            max={DOMAINE_MAG.max}
            step={PAS_MAG}
            value={magMax}
            onChange={(e) => setMagMax(Number(e.target.value))}
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
            pose={poses.get(ligne.objet.designation) ?? null}
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
          0,75 mag/as². La magnitude ordonne la liste ; c’est la brillance de surface qui dit la
          difficulté.
        </p>
      )}
    </section>
  )
}

/**
 * Une ligne : ce qui décide, dans l'ordre où on le lit. Le nom, ce que ça coûte, puis les
 * lectures qui l'expliquent — brillance de surface, hauteur, encombrement sur le capteur.
 *
 * Deux boutons distincts et non imbriqués : choisir la cible n'est pas la même intention que
 * pointer la scène dessus, et un `<button>` dans un `<button>` n'est pas du HTML valide.
 */
function LigneListe({ ligne, pose }: { readonly ligne: LigneCible; readonly pose: PoseCible | null }) {
  const { objet } = ligne
  const nom = nomCommun(objet)

  return (
    <li className="cible-item">
      {/* §6.4 — depuis le cache seulement : le défilement de la liste n'émet aucune requête.
          Hors du bouton, pour que l'image ne soit pas un contenu cliquable de plus. */}
      <VignetteCible objet={objet} />
      <button type="button" className="cible-ligne" onClick={() => ouvreCible(objet)}>
        <span className="cible-tete">
          <span className="cible-designation">{objet.designation}</span>
          <span className="cible-pose">{libellePose(pose)}</span>
        </span>
        <span className="cible-tete">
          <span className="cible-commun">{nom === '' ? LIBELLE_TYPE_OBJET[objet.type] : nom}</span>
          <span className="cible-mag">
            {objet.vMag === null ? 'mag —' : objet.vMag.toFixed(1)}
          </span>
        </span>
        <span className="cible-lectures">
          {lectures(ligne).map((mesure) => (
            <span key={mesure}>{mesure}</span>
          ))}
        </span>
      </button>
      {/* T-0046 — « Voir » centre, et rien d'autre : ni le champ, ni l'horloge ne bougent.
          Sous l'horizon, il n'y a pas de direction à viser : le bouton disparaît. */}
      {ligne.hauteurDeg > 0 && (
        <button
          type="button"
          className="cible-voir"
          aria-label={`Centrer la scène sur ${objet.designation}`}
          onClick={() => majVue({ azimutDeg: ligne.azimutDeg, hauteurDeg: ligne.hauteurDeg })}
        >
          <Icone nom="my_location" />
        </button>
      )}
    </li>
  )
}

/**
 * Une pose absente n'est pas un tiret muet : elle dit ce qui manque. « — » sans raison est
 * la lecture qui pousse à croire l'application en panne.
 */
function libellePose(pose: PoseCible | null): string {
  if (pose === null) return '—'
  const total = dureeLisible(pose.tRequisS)
  return pose.nNuits > 1 ? `${total} · ${pose.nNuits} nuits` : total
}

/** Les trois lectures d'une ligne, séparées : chacune doit pouvoir tenir sur une ligne. */
function lectures(ligne: LigneCible): readonly string[] {
  return [
    ligne.sbObj === null ? 'SB absente' : `SB ${ligne.sbObj.toFixed(1)} mag/as²`,
    ligne.hauteurDeg > 0 ? `h ${ligne.hauteurDeg.toFixed(0)}°` : 'sous l’horizon',
    libelleEncombrement(ligne),
  ]
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
