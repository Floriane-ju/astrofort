/**
 * La région « Cible » de la fiche : ce qu'on vise, choisi dans le ciel du moment ou saisi
 * à la main.
 *
 * Choisir dans la liste des visibles verrouille la saisie — les valeurs viennent alors
 * d'OpenNGC et ne se retouchent pas (T-0051). « Personnalisé » la rouvre.
 */

import { useMemo } from 'react'
import { TYPES_OBJET, type ObjetCielProfond, type TypeObjet } from '../data/deepsky.ts'
import type { VerdictDetectabilite } from '../core/detectability.ts'
import { ciblesVisibles, parType, typesPresents, type CibleVisible } from '../core/visibles.ts'
import { cielInstantane } from '../core/horloges.ts'
import type { Site } from '../core/ephem.ts'
import { majVue, useTrancheScene, type EtatScene } from './scene-etat.ts'
import { Etiquette } from './Terme.tsx'
import { LIBELLE_TYPE_OBJET, libelleCible } from './libelles-objet.ts'
import type { EtatSaisieCible } from './fiche-cible-saisie.ts'

/**
 * T-0045 — plafond de la liste des visibles. Le compte réel est annoncé à côté : un plafond
 * muet mentirait sur le ciel.
 *
 * ponytail: un `<select>` plafonné suffit tant que la liste se parcourt à l'œil. Le jour où
 * elle doit devenir cherchable, la sortie est `<input list>` + `<datalist>`, pas une
 * pagination.
 */
const CIBLES_LISTEES_MAX = 200

/**
 * La liste des visibles est recalculée sur la minute affichée, pas sur l'instant : la scène
 * publie `msAffiche` deux fois par seconde et le catalogue compte ~14 000 entrées. Une minute
 * de granularité ne change pas quel objet est au-dessus de l'horizon.
 */
const MS_PAR_MINUTE = 60_000

/**
 * T-0056 — la fiche s'abonne à cette minute, pas au magasin entier : entre deux publications
 * de la même minute, il n'y a rien à recalculer ni à redessiner.
 */
function minuteAffichee(etat: EtatScene): number {
  return Math.floor(etat.msAffiche / MS_PAR_MINUTE)
}

/** L'ordre des groupes dit ce que le setup fera de la cible, du plus direct au plus long. */
const VERDICTS_GROUPES: readonly VerdictDetectabilite[] = [
  'OEIL_NU',
  'JUMELLES',
  'TELESCOPE',
  'PHOTO_SEULE',
]

const LIBELLE_VERDICT: Readonly<Record<VerdictDetectabilite, string>> = {
  OEIL_NU: 'Œil nu',
  JUMELLES: 'Jumelles',
  TELESCOPE: 'Télescope',
  PHOTO_SEULE: 'Photo seule',
}

export interface ChampsCibleProps {
  readonly saisie: EtatSaisieCible
  readonly site: Site
  readonly catalogue: readonly ObjetCielProfond[]
  readonly sbCiel: number
  readonly mLimOeil: number | null
  readonly dMm: number
  readonly filtreType: TypeObjet | null
  readonly surFiltreType: (type: TypeObjet | null) => void
}

export function ChampsCible(props: ChampsCibleProps) {
  const { saisie, catalogue, site, sbCiel, mLimOeil, dMm, filtreType } = props
  const minute = useTrancheScene(minuteAffichee)

  const visibles = useMemo(
    () =>
      ciblesVisibles({
        catalogue,
        matriceCiel: cielInstantane(site, new Date(minute * MS_PAR_MINUTE)).matrice,
        sbCiel,
        mLimOeil,
        dMm,
      }),
    [catalogue, site, minute, sbCiel, mLimOeil, dMm],
  )
  // T-0050 — le filtre tombe avant le plafond : filtrer les 200 plus brillantes du ciel
  // entier ne dirait rien du ciel. Le compte annoncé suit le filtre.
  const filtrees = parType(visibles, filtreType)
  const listees = filtrees.slice(0, CIBLES_LISTEES_MAX)
  const typesOfferts = useMemo(() => typesPresents(visibles), [visibles])

  /**
   * T-0046 — la cible visible courante est l'objet du catalogue retenu, relu dans `visibles`
   * pour sa position : le bouton vise donc la minute affichée, pas l'instant du choix. Une
   * cible personnalisée, ou passée sous l'horizon, n'a pas de position — le bouton disparaît,
   * ce qui est juste : on ne sait plus où pointer.
   */
  const choisie =
    saisie.objetCatalogue === null
      ? null
      : visibles.find((c) => c.objet.designation === saisie.objetCatalogue!.designation) ?? null

  /** La valeur vide de la liste est « Personnalisé » : elle rouvre la saisie (T-0051). */
  function choisitParmiLesVisibles(designationChoisie: string) {
    if (designationChoisie === '') {
      saisie.appliqueObjet(null)
      return
    }
    const cible = visibles.find((c) => c.objet.designation === designationChoisie)
    if (cible !== undefined) saisie.appliqueObjet(cible.objet)
  }

  return (
    <section>
      <h2>Cible</h2>
      <div className="champs">
        <label>
          Désignation
          <input
            value={saisie.designation}
            onChange={(e) => saisie.surDesignation(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        {catalogue.length > 0 && (
          <label>
            Type listé
            <select
              value={filtreType ?? ''}
              onChange={(e) =>
                props.surFiltreType(e.target.value === '' ? null : (e.target.value as TypeObjet))
              }
            >
              <option value="">Tous types</option>
              {typesOfferts.map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_TYPE_OBJET[t]}
                </option>
              ))}
            </select>
          </label>
        )}
        {catalogue.length > 0 && (
          <label>
            Cibles visibles
            <select
              value={saisie.objetCatalogue === null ? '' : saisie.objetCatalogue.designation}
              onChange={(e) => choisitParmiLesVisibles(e.target.value)}
            >
              <option value="">Personnalisé</option>
              {/* La cible retenue reste affichée même quand le filtre ou l'horizon l'ont
                  sortie de la liste : le verrou tient, la lecture doit le dire. */}
              {saisie.objetCatalogue !== null &&
                !listees.some((c) => c.objet.designation === saisie.objetCatalogue!.designation) && (
                  <option value={saisie.objetCatalogue.designation}>
                    {saisie.objetCatalogue.designation} (hors de la liste affichée)
                  </option>
                )}
              {VERDICTS_GROUPES.map((verdict) => (
                <GroupeVerdict key={verdict} verdict={verdict} cibles={listees} />
              ))}
            </select>
          </label>
        )}
        {catalogue.length > 0 && (
          <div className="actions">
            <span className="etat">
              {filtrees.length.toLocaleString('fr-FR')} cible
              {filtrees.length > 1 ? 's' : ''} au-dessus de l’horizon
              {filtreType === null ? '' : ` de type ${LIBELLE_TYPE_OBJET[filtreType]}`}
              {filtrees.length > CIBLES_LISTEES_MAX
                ? `, les ${CIBLES_LISTEES_MAX} plus brillantes listées`
                : ''}
              .
            </span>
            {/* T-0046 — « Voir » centre, et rien d'autre : ni le champ, ni la rotation, ni
                l'horloge ne bougent. L'utilisateur garde son zoom et son instant. */}
            {choisie !== null && (
              <button
                type="button"
                onClick={() => {
                  majVue({ azimutDeg: choisie.azimutDeg, hauteurDeg: choisie.hauteurDeg })
                }}
              >
                Voir
              </button>
            )}
          </div>
        )}
        <label>
          Type d’objet
          {/* Un `<select>` ne connaît pas `readonly` : c'est `disabled` qui le ferme. */}
          <select
            value={saisie.typeObjet}
            onChange={(e) => saisie.surTypeObjet(e.target.value as TypeObjet)}
            disabled={saisie.verrouille}
          >
            {TYPES_OBJET.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE_OBJET[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Etiquette cle="magnitude_integree" />
          <input
            value={saisie.mInt}
            onChange={(e) => saisie.surMInt(e.target.value)}
            placeholder="absente"
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Grand axe (’)
          <input
            value={saisie.aArcmin}
            onChange={(e) => saisie.surAArcmin(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Petit axe (’)
          <input
            value={saisie.bArcmin}
            onChange={(e) => saisie.surBArcmin(e.target.value)}
            readOnly={saisie.verrouille}
          />
        </label>
        <label>
          Angle de position (°)
          <input
            value={saisie.posAngDeg}
            onChange={(e) => saisie.surPosAngDeg(e.target.value)}
            placeholder="absent du catalogue"
            readOnly={saisie.verrouille}
          />
        </label>
      </div>
    </section>
  )
}

/** Un groupe de la liste des visibles : ce que le setup en fera, du plus direct au plus long. */
function GroupeVerdict({
  verdict,
  cibles,
}: {
  readonly verdict: VerdictDetectabilite
  readonly cibles: readonly CibleVisible[]
}) {
  const groupe = cibles.filter((c) => c.verdict === verdict)
  if (groupe.length === 0) return null
  return (
    <optgroup label={LIBELLE_VERDICT[verdict]}>
      {groupe.map((c) => (
        <option key={c.objet.designation} value={c.objet.designation}>
          {libelleCible(c)}
        </option>
      ))}
    </optgroup>
  )
}
