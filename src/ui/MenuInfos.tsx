/**
 * T-0038 / T-0039 — le menu d'information de la barre haute.
 *
 * Ces lectures datent l'image : où pointe la scène, jusqu'à quelle magnitude, ce que le cadre
 * contient, ce que le calcul a refusé. On les consulte, on ne les surveille pas — leur place
 * n'est donc pas sous le canevas, où elles prenaient une bande de hauteur en permanence
 * (T-0037) au prix du ciel. Elles sont ici, dans un tiroir qui ne coûte rien tant qu'il est
 * fermé et qui se superpose à la scène quand on l'ouvre.
 *
 * Le composant est monté dans la barre haute, pas dans le planétarium : il lit donc le
 * magasin de scène plutôt que l'état local d'un voisin. Le prix est que `cielInstantane` et
 * `etatProfondeur` sont calculés une seconde fois, mémoïsés sur l'instant publié — deux fois
 * par seconde, pas soixante.
 *
 * T-0041 — un tiroir fermé cache ce qu'il contient. Le bouton porte donc le compte des
 * messages à lire, en toutes lettres : une pastille de couleur seule serait illisible en mode
 * nuit, où la palette est réduite au rouge.
 */

import { useMemo } from 'react'
import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Site } from '../core/ephem.ts'
import type { IndexCiel } from '../core/index-ciel.ts'
import { avertissementEpoque, cielInstantane } from '../core/horloges.ts'
import { etatProfondeur } from '../core/projection.ts'
import {
  REFUS_SANS_PROFIL,
  angleGrandAxeDansCadre,
  cibleDominante,
  refusAuDelaDuMaximum,
  rotationSuggeree,
  type Cadre,
  type ProfilCadre,
} from '../core/cadre.ts'
import { ficheCadrage } from '../core/framing.ts'
import { majVue, useScene } from './scene-etat.ts'
import { ligneVisee } from './scene-lecture.ts'
import { useSeance } from './seance-etat.ts'
import { Terme } from './Terme.tsx'

const ARCMIN_PAR_DEG = 60
const POURCENT = 100

export interface MenuInfosProps {
  readonly site: Site
  /** Index de sélection du catalogue : sa profondeur borne la magnitude atteignable. */
  readonly index: IndexCiel
  readonly objets: readonly ObjetCielProfond[]
  readonly profils: readonly ProfilCadre[]
  /** §2.2 — fond de ciel du site : il plafonne la profondeur affichée en vue réaliste. */
  readonly sbCiel: number | null
}

export function MenuInfos(props: MenuInfosProps) {
  const { vue: pointage, rendu, lectures, msAffiche } = useScene()
  const { azimutDeg, hauteurDeg, rotationCadreDeg, fovDeg } = pointage
  const { couches, vueRealiste } = rendu
  const { diagnostic, selection } = lectures
  const { file } = useSeance()

  const dateAffichee = useMemo(() => new Date(msAffiche), [msAffiche])
  const ciel = useMemo(() => cielInstantane(props.site, dateAffichee), [props.site, dateAffichee])
  const profondeur = useMemo(
    () => etatProfondeur(fovDeg, props.index.profondeurMag, props.sbCiel, vueRealiste),
    [fovDeg, props.index.profondeurMag, props.sbCiel, vueRealiste],
  )
  // T-0068 — la même phrase que la description du canevas, composée une seule fois.
  const visee = useMemo(
    () => ligneVisee(pointage, ciel.matrice, dateAffichee),
    [pointage, ciel, dateAffichee],
  )

  const cadrePrincipal: Cadre | null =
    props.profils.length === 0
      ? null
      : { profil: props.profils[0]!, azimutDeg, hauteurDeg, rotationDeg: rotationCadreDeg }

  const dominante = useMemo(
    () =>
      cadrePrincipal === null
        ? null
        : cibleDominante(props.objets, cadrePrincipal, ciel.matrice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.objets, ciel, azimutDeg, hauteurDeg, rotationCadreDeg, props.profils],
  )
  const suggestion = useMemo(
    () =>
      dominante === null || cadrePrincipal === null
        ? null
        : rotationSuggeree(dominante, cadrePrincipal, ciel.matrice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dominante, ciel, azimutDeg, hauteurDeg, rotationCadreDeg],
  )

  /**
   * §6.2 recalculé à chaque rotation du boîtier : le remplissage et le verdict dépendent de
   * l'orientation, et c'est tout l'intérêt du geste — tourner de 90° une cible allongée peut
   * la faire passer de « cadrage large » à « cadrage optimal » (T-0084).
   */
  const cadrage = useMemo(() => {
    if (dominante === null || cadrePrincipal === null) return null
    const profil = cadrePrincipal.profil
    return ficheCadrage({
      fovHDeg: profil.fovHDeg,
      fovLDeg: profil.fovLDeg,
      echApx: profil.echApx,
      capteurHMm: profil.capteurHMm,
      tailleMajArcmin: dominante.tailleDeg * ARCMIN_PAR_DEG,
      tailleMinArcmin: dominante.objet.minAxArcmin,
      posAngDeg: dominante.objet.posAngDeg,
      angleGrandAxeDeg: angleGrandAxeDansCadre(dominante, cadrePrincipal, ciel.matrice),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominante, ciel, azimutDeg, hauteurDeg, rotationCadreDeg, props.profils])

  /**
   * T-0041 — la liste, pas un booléen : le compte affiché sur le bouton et les paragraphes
   * dépliés viennent de la même source, donc ils ne peuvent pas diverger.
   */
  const causes: readonly string[] = [
    ciel.cause ?? null,
    avertissementEpoque(ciel.epoqueAnnee),
    couches.cadre && props.profils.length === 0 ? REFUS_SANS_PROFIL : null,
    couches.cadre ? refusAuDelaDuMaximum(props.profils.length) : null,
  ].filter((c): c is string => c !== null)

  // Une rotation suggérée est un message à lire : son bouton « Appliquer » est la seule
  // façon de l'appliquer, et un tiroir fermé le rendrait introuvable. Une absence d'angle
  // motivée — cible ronde, angle de position manquant — se lit dans le tiroir mais n'alerte
  // pas : il n'y a rien à y faire.
  const aLire = causes.length + (suggestion?.angleDeg == null ? 0 : 1)

  return (
    <details
      className="tiroir tiroir-infos"
      data-alerte={aLire > 0}
      // `<details>` ne se referme pas à Échap : c'est le seul JavaScript du tiroir. Le clic
      // sur le bouton, le clavier et l'annonce d'état restent portés par l'élément natif.
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.removeAttribute('open')
      }}
    >
      <summary>
        <span aria-live="polite">
          {aLire === 0
            ? 'ℹ Lectures'
            : `⚠ Lectures — ${aLire} message${aLire > 1 ? 's' : ''} à lire`}
        </span>
      </summary>

      <div className="tiroir-contenu">
        <p className="etat">
          {visee} · jusqu’à la magnitude {profondeur.magLimite.value.toFixed(1)} · époque{' '}
          {ciel.epoqueAnnee.toFixed(1)}
          {file.incrustation && ' · filé tracé sur tout le ciel, en direct'}
        </p>

        {causes.map((cause) => (
          <p className="cause" key={cause}>
            {cause}
          </p>
        ))}

        {couches.cadre && (
          <>
            {props.profils.length > 1 && (
              <p className="etat">
                L’échantillonnage est identique dans les deux cadres : un recadrage de capteur
                ne change ni le pitch ni la focale, donc ni la résolution (§5.1).
              </p>
            )}
            {dominante !== null && cadrage !== null && (
              <>
                <p className="etat">
                  Cible dominante dans le cadre : {dominante.objet.designation}, grand axe{' '}
                  {(dominante.tailleDeg * ARCMIN_PAR_DEG).toFixed(0)}’ — remplissage{' '}
                  {(cadrage.remplissage.value * POURCENT).toFixed(0)} % du cadre, boîtier à{' '}
                  {rotationCadreDeg.toFixed(0)}°.
                </p>
                <p className="etat">{cadrage.message}</p>
                {cadrage.cause !== undefined && <p className="cause">{cadrage.cause}</p>}
              </>
            )}
            {suggestion !== null && (
              <div className="actions">
                <span className="etat">{suggestion.message}</span>
                {suggestion.angleDeg !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      majVue({ rotationCadreDeg: suggestion.angleDeg ?? 0 })
                    }}
                  >
                    Appliquer {suggestion.angleDeg.toFixed(0)}°
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {selection !== null && (
          <div className="selection">
            <h3>{selection.titre}</h3>
            {selection.lignes.map((ligne) => (
              <p className="etat" key={ligne}>
                {ligne}
              </p>
            ))}
            {selection.objet !== null && (
              <p className="etat">
                Fiche de cadrage, de détectabilité et de pose ouverte dans l’onglet Cible.
              </p>
            )}
          </div>
        )}

        <Terme cle="deux_horloges" contexte={`${diagnostic.fps.toFixed(0)} images/s`} />
        <p className="etat">
          {diagnostic.etoilesDessinees} étoiles tracées sur {diagnostic.etoilesExaminees} lues,{' '}
          {diagnostic.cellules} cellules d’index retenues sur {props.index.cellules.length},{' '}
          {props.index.nombreEtoiles} étoiles au catalogue, {diagnostic.labels} labels composés
          sur {K('LABELS_MAX')} au plus.
        </p>
      </div>
    </details>
  )
}
