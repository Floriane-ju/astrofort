/**
 * §6.4 — le catalogue comme écran : ce qu'on peut photographier, et ce que ça demande.
 *
 * Ce panneau REMPLACE deux chemins qui posaient la même question sans jamais en afficher la
 * réponse — le `<select>` « Cibles visibles » de la carte Cible, et « Chercher dans le
 * catalogue » du tiroir des réglages. Un troisième chemin de plus n'aurait rien réglé : ce
 * sont les deux autres qui disparaissent au même commit.
 *
 * La liste par défaut — case « Ne montrer que les objets photographiables » cochée — porte sur le CRÉNEAU de la nuit, jamais sur la hauteur à
 * l'instant affiché. §6.4 l'interdit nommément : « fusionner les deux ferait disparaître de
 * la vue une cible qui sera bonne dans deux heures ». Une galaxie à 12° au-dessus de
 * l'horizon maintenant, qui culmine à 60° avant l'aube, est photographiable — et le reste.
 *
 * Aucun calcul ici. Les lectures viennent de `cibles-liste.ts` ; la pose et la note de
 * facilité arrivent en props, calculées une fois par la chaîne, qui réemploie le moteur du
 * plan de séance : la liste, la carte Cible et le plan ne peuvent pas annoncer deux poses —
 * ni deux notes — différentes pour la même cible.
 *
 * §6.4 — le filtre par type est un choix MULTIPLE (`types_retenus`). Des cases repliées
 * derrière un résumé plutôt qu'un `<select multiple>` : ce dernier demande Ctrl ou Cmd pour
 * cocher, ce qui ne se fait pas au gant (§11.2).
 */

import { useEffect, useMemo } from 'react'
import {
  ajouteCoordonnees,
  filtreLignes,
  lignesInvariantes,
  restreintParType,
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
import { TYPES_OBJET, type ObjetCielProfond, type TypeObjet } from '../data/deepsky.ts'
import { BoutonVisee } from './BoutonVisee.tsx'
import { Curseur } from './Curseur.tsx'
import { Icone } from './Icone.tsx'
import { Interrupteur } from './Interrupteur.tsx'
import { VignetteCible } from './ImageCible.tsx'
import { prechargeVignettes } from './image-cible-memoire.ts'
import { Pastilles } from './Pastilles.tsx'
import { LIBELLE_TYPE_OBJET, nomCommun } from './libelles-objet.ts'
import { ouvreCible } from './seance-etat.ts'
import { majCatalogue, useCatalogue } from './catalogue-etat.ts'
import { minuteAffichee, useTrancheScene, MS_PAR_MINUTE } from './scene-etat.ts'

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
  /** T-0188 — le champ de recherche est le repli du focus au retour de la fiche. */
  readonly inputRef?: React.RefObject<HTMLInputElement | null>
}

export function PanneauCibles(props: PanneauCiblesProps) {
  const { catalogue, site, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm, etats } = props
  // T-0182 — la saisie vit dans le magasin : la fiche démonte cette liste, et une recherche
  // perdue au retour ferait recommencer le tri à chaque cible consultée.
  const { photographiablesSeules, recherche, types, magMax } = useCatalogue()

  // T-0056 — la minute affichée, pas l'instant : la scène publie deux fois par seconde, et
  // une minute de granularité ne change pas la hauteur au degré près sur 14 000 entrées.
  const minute = useTrancheScene(minuteAffichee)

  // Les dépendances sont énumérées champ par champ, jamais `props` : l'objet de props est
  // neuf à chaque rendu, et 14 000 verdicts recalculés à chaque frappe rendraient la
  // recherche inutilisable.
  // T-0190, T-0248 — détectabilité, cadrage et tri ne dépendent pas de l'instant : ils ne se
  // recalculent qu'avec le catalogue ou l'optique. La minute n'ajoute qu'azimut et hauteur.
  const invariantes = useMemo(
    () => lignesInvariantes({ catalogue, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm }),
    [catalogue, sbCiel, mLimOeil, dMm, fovHDeg, echApx, capteurHMm],
  )
  const lignes = useMemo(
    () =>
      ajouteCoordonnees(
        invariantes,
        cielInstantane(site, new Date(minute * MS_PAR_MINUTE)).matrice,
      ),
    [invariantes, site, minute],
  )

  const typesOfferts = useMemo(() => typesPresents(lignes), [lignes])

  const retenues = useMemo(() => {
    const filtrees = filtreLignes(lignes, { types, magMax, recherche })
    if (!photographiablesSeules) return filtrees
    // Une cible écartée porte une note et pas de pose : elle n'est pas photographiable, donc
    // elle ne passe pas. C'est la POSE qui décide, pas la présence d'une note.
    return filtrees.filter((l) => etats.get(l.objet.designation)?.pose != null)
  }, [lignes, types, magMax, recherche, photographiablesSeules, etats])

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

  // Le verrou ne vaut que case cochée : le catalogue reste consultable sans suivi, c'est la
  // SÉANCE qui est fermée, pas la base d'objets.
  const domaineCpFerme = photographiablesSeules
    ? (props.contexteSession?.domaineCpFerme ?? null)
    : null

  const plafond = K('CIBLES_LISTEES_MAX')
  const listees = retenues.slice(0, plafond)
  const seuil = props.contexteSession?.seuilHauteurDeg ?? K('SEUIL_HAUTEUR_IMAGERIE_DEG')

  return (
    <section className="cibles">
      <input
        ref={props.inputRef}
        className="cibles-recherche"
        type="search"
        aria-label="Rechercher un objet du catalogue"
        value={recherche}
        placeholder="M45, pléiades, NGC0224…"
        onChange={(e) => majCatalogue({ recherche: e.target.value })}
      />

      <Interrupteur
        actif={photographiablesSeules}
        surChangement={(actif) => majCatalogue({ photographiablesSeules: actif })}
      >
        Ne montrer que les objets photographiables
      </Interrupteur>

      {photographiablesSeules && (
        <p className="etat">Objets à plus de {seuil}° cette nuit, qui tiennent dans votre cadre.</p>
      )}

      <div className="cibles-filtres">
        <details className="cibles-types">
          {/* Le résumé dit la sélection fermé : un filtre replié qui restreint sans le dire
              ferait chercher pourquoi la liste est courte. */}
          <summary>
            <span className="libelle">Type</span>
            <span className="cibles-types-valeur">
              {resumeTypes(typesOfferts, types)}
              <Icone nom="expand_more" classe="chevron" />
            </span>
          </summary>
          <div className="cibles-types-choix" role="group" aria-label="Types d’objet retenus">
            <div className="cibles-types-tout">
              <button type="button" onClick={() => majCatalogue({ types: new Set(TYPES_OBJET) })}>
                Tout cocher
              </button>
              <button type="button" onClick={() => majCatalogue({ types: new Set() })}>
                Tout décocher
              </button>
            </div>
            {typesOfferts.map((t) => (
              <Interrupteur
                key={t}
                actif={types.has(t)}
                surChangement={(actif) => majCatalogue({ types: bascule(types, t, actif) })}
              >
                {LIBELLE_TYPE_OBJET[t]}
              </Interrupteur>
            ))}
          </div>
        </details>
        <label>
          <span className="libelle">
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
            sur={(magMax) => majCatalogue({ magMax })}
          />
        </label>
      </div>

      {/* T-0187 — une seule région vive pour le compte ET le message de liste vide.
          Deux régions annonceraient deux fois le même changement. */}
      <div aria-live="polite" aria-atomic="true">
        <p className="etat">
          {retenues.length.toLocaleString('fr-FR')} objet{retenues.length > 1 ? 's' : ''}
          {retenues.length > plafond ? `, les ${plafond} plus brillants affichés` : ''}.
        </p>

        {listees.length === 0 && (
          <p className="etat">
            {/* §5.2 — domaine fermé : la liste vide n'est pas un filtre trop serré, c'est le
                suivi qui manque. Le dire ici évite de chercher le levier dans les filtres. */}
            {domaineCpFerme !== null
              ? domaineCpFerme
              : recherche.trim() === ''
                ? 'Aucun objet ne passe ces filtres.'
                : 'Aucun objet de ce nom.'}
          </p>
        )}
      </div>

      <ul className="cibles-liste">
        {listees.map((ligne) => (
          <LigneListe
            key={ligne.objet.designation}
            ligne={ligne}
            etat={etats.get(ligne.objet.designation) ?? null}
          />
        ))}
      </ul>

      {props.contexteSession !== null && (
        <p className="etat cibles-note">
          Temps de pose total pour un signal/bruit de {props.contexteSession.snrCible}. Un tiret :
          cible non évaluée.
        </p>
      )}
    </section>
  )
}

function bascule(
  types: ReadonlySet<TypeObjet>,
  type: TypeObjet,
  actif: boolean,
): ReadonlySet<TypeObjet> {
  return new Set(actif ? [...types, type] : [...types].filter((t) => t !== type))
}

/** Compté sur les types PROPOSÉS : « 3 types sur 10 » ne doit pas compter ceux qu'on ne voit pas. */
function resumeTypes(offerts: readonly TypeObjet[], types: ReadonlySet<TypeObjet>): string {
  if (!restreintParType(types)) return 'Tous types'
  const coches = offerts.filter((t) => types.has(t))
  if (coches.length === 0) return 'Aucun type'
  if (coches.length === offerts.length) return 'Tous types'
  const [premier] = coches
  if (coches.length === 1 && premier !== undefined) return LIBELLE_TYPE_OBJET[premier]
  return `${coches.length} types sur ${offerts.length}`
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
      <BoutonVisee
        designation={objet.designation}
        azimutDeg={ligne.azimutDeg}
        hauteurDeg={ligne.hauteurDeg}
      />
    </li>
  )
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
