/**
 * §5.1 + §7.2 — la section Boîtier : quel appareil, et l'ISO qu'il justifie.
 *
 * Deux modes, un seul sélecteur. Un boîtier de la base apporte ses grandeurs capteur : il n'y
 * a alors plus rien à régler, donc plus rien à afficher — les champs disparaissent au lieu de
 * rester là, remplis par autre chose que l'utilisateur. Reste l'ISO, qui cesse d'être une
 * question posée pour devenir une réponse.
 *
 * T-0205 — le poids d'une image fait exception et reste saisissable dans les deux modes. Il ne
 * décrit pas le capteur mais le réglage RAW du moment : compressé, sans perte ou non compressé
 * changent le fichier du simple au triple sans changer d'appareil. La ligne de la base ne donne
 * donc qu'un départ, pas une réponse.
 *
 * Le mode personnalisé, lui, est inchangé : type de capteur et résolution, le pitch dérivé,
 * et les grandeurs avancées repliées. C'est le chemin de première classe pour un boîtier
 * absent de la base, pas un rattrapage — aucune base matériel n'est exhaustive.
 */

import {
  notesEstimation,
  type IsoRetenu,
  type SaisieBoitier,
} from '../data/equipment.ts'
import { BASE_BOITIERS, ligneBoitier, type LigneBoitier } from '../data/boitiers.ts'
import {
  TABLE_FORMATS_CAPTEUR,
  ligneFormatCapteur,
  pitchDepuisFormat,
  type FormatCapteur,
} from '../registry/capteur-formats.ts'
import { type DomaineId } from '../registry/domains.ts'
import { K } from '../registry/constants.ts'
import { GLOSSAIRE, type TermeGlossaire } from '../registry/glossaire.ts'
import { Etiquette } from './Terme.tsx'
import { ChampChoix } from './ChampChoix.tsx'
import { AlerteChamp, ChampDomaine } from './ChampDomaine.tsx'
import { Bulle } from './Bulle.tsx'
import { Icone } from './Icone.tsx'
import { Mention } from './Mention.tsx'

/**
 * §5.1 — ce que la saisie exige, dit une fois au titre de la carte. Au survol plutôt qu'en
 * paragraphe : la règle se relit quand on hésite, elle n'occupe pas la place des champs.
 */
const AIDE_BOITIER =
  'Choisir son modèle suffit : ses grandeurs capteur viennent avec. Sinon, type de capteur ' +
  'et résolution sont exigés — sans eux, ni champ ni échantillonnage n’existent. Le pitch ' +
  's’en déduit, il ne se saisit jamais. Le reste peut rester vide : le registre fournit son ' +
  'repli, et les sorties qui en dépendent portent [ESTIMÉ].'

/**
 * T-0199 — pourquoi remplir un dépliant qu'on peut laisser fermé. Chaque champ porte déjà la
 * conséquence de son absence ; le dépliant, lui, dit ce que remplir fait gagner — sans quoi
 * le mode avancé n'a l'air que d'un recoin technique qu'on referme.
 */
const AIDE_AVANCEES =
  'Ces grandeurs décrivent l’électronique du capteur, pas l’optique. Renseignées, la pose ' +
  'unitaire et l’ISO recommandé deviennent propres à ce boîtier ; laissées vides, un ' +
  'générique du registre les remplace et toute sortie qui en dépend s’affiche [ESTIMÉ]. ' +
  'Photons to Photos les publie pour la plupart des boîtiers.'

/**
 * §5.1 — les grandeurs du mode avancé, dans l'ordre où elles se saisissent.
 *
 * Une seule liste : les champs la parcourent, et le dépliant fermé s'en sert pour dire
 * lesquelles manquent. Deux énumérations séparées finiraient par diverger, et c'est le
 * résumé — celui qu'on lit sans ouvrir — qui mentirait.
 */
const CHAMPS_AVANCES = Object.freeze([
  { champ: 'readNoiseE', domaine: 'read_noise_e', cle: 'bruit_de_lecture' },
  { champ: 'seuilDoubleGainIso', domaine: 'seuil_double_gain_iso', cle: 'seuil_double_gain' },
  { champ: 'fullWellE', domaine: 'full_well_e', cle: 'capacite_saturation' },
  { champ: 'zpSys', domaine: 'zp_sys', cle: 'point_zero_systeme' },
] as const satisfies readonly {
  readonly champ: keyof SaisieBoitier
  readonly domaine: DomaineId
  readonly cle: TermeGlossaire
}[])

type NotesEstimation = Readonly<Partial<Record<keyof SaisieBoitier, string>>>

/**
 * T-0199 — ce que le dépliant FERMÉ doit dire. Sans ce résumé, les alertes de champ ne se
 * voient qu'une fois ouvert : une grandeur manquante n'aurait aucune chance d'être remarquée
 * par qui ne déplie jamais le mode avancé.
 */
function resumeManquantes(notes: NotesEstimation): string | undefined {
  const manquantes = CHAMPS_AVANCES.filter((c) => notes[c.champ] !== undefined)
  if (manquantes.length === 0) return undefined
  const s = manquantes.length > 1 ? 's' : ''
  return (
    `${manquantes.length} grandeur${s} laissée${s} vide${s} : ` +
    manquantes.map((c) => GLOSSAIRE[c.cle].libelle.toLowerCase()).join(', ') +
    '. Un générique du registre les remplace, et toute sortie qui en dépend s’affiche [ESTIMÉ].'
  )
}

/** §5.1 — les grandeurs du mode avancé : facultatives, repliées derrière un dépliant. */
function ChampsAvances({
  boitier,
  surChamp,
  notes,
}: {
  readonly boitier: SaisieBoitier
  readonly surChamp: (champ: keyof SaisieBoitier) => (v: string) => void
  readonly notes: NotesEstimation
}) {
  return (
    <div className="champs">
      {CHAMPS_AVANCES.map(({ champ, domaine, cle }) => (
        <ChampDomaine
          key={champ}
          domaine={domaine}
          cle={cle}
          unite
          valeur={boitier[champ]}
          surValeur={surChamp(champ)}
          note={notes[champ]}
        />
      ))}
    </div>
  )
}

/**
 * §5.1 — retour immédiat sur le pitch dérivé, dès que la résolution saisie est exploitable.
 * Pas de `TracedValue` ici : ce n'est pas une formule de moteur tracée, juste un aperçu de
 * saisie — cohérent avec « chaque nombre reste dépliable » sans en être une instance.
 */
function ApercuPitch({
  formatCapteur,
  resolutionMpx,
}: {
  readonly formatCapteur: string
  readonly resolutionMpx: string
}) {
  const mpx = Number(resolutionMpx)
  if (resolutionMpx.trim() === '' || !Number.isFinite(mpx) || mpx <= 0) return null
  const pitch = pitchDepuisFormat(ligneFormatCapteur(formatCapteur as FormatCapteur), mpx)
  return <p className="etat">Pitch calculé : {pitch.toFixed(2)} µm</p>
}

/**
 * T-0204 — le sélecteur de modèle, groupé par marque.
 *
 * Les groupes gardent l'ordre du fichier plutôt qu'un tri alphabétique : la base se lit de
 * haut en bas, et on retrouve son boîtier là où on l'a écrit.
 */
function SelecteurBoitier({
  boitierId,
  surBoitierId,
}: {
  readonly boitierId: string
  readonly surBoitierId: (v: string) => void
}) {
  const marques: string[] = []
  for (const b of BASE_BOITIERS) if (!marques.includes(b.marque)) marques.push(b.marque)
  return (
    <ChampChoix cle="mon_boitier" valeur={boitierId} surChangement={surBoitierId}>
      <option value="">Personnalisé — décrire le capteur</option>
      {marques.map((marque) => (
        <optgroup key={marque} label={marque}>
          {BASE_BOITIERS.filter((b) => b.marque === marque).map((b) => (
            <option key={b.id} value={b.id}>
              {b.libelle}
            </option>
          ))}
        </optgroup>
      ))}
    </ChampChoix>
  )
}

/**
 * T-0204 — ce qui manque encore à un boîtier de la base.
 *
 * Les champs disparaissent, pas le contrat T-0199 : une grandeur absente de la ligne choisie
 * a les mêmes conséquences que laissée vide à la main, et doit se dire quelque part.
 *
 * `notesEstimation` ne convient pas ici : elle décrit une SAISIE, qui ne porte qu'un bruit de
 * lecture rattaché à un seul ISO. Une ligne de la base porte une courbe — la lui faire juger
 * par le contrat de la saisie lui reprocherait une absence qui n'existe pas.
 *
 * Le seuil de double gain n'y figure pas : son absence est déjà dite, et mieux, par le message
 * de l'ISO juste en dessous. Deux fois la même chose vaut moins qu'une.
 *
 * T-0205 — le poids d'une image n'y figure plus non plus : son champ est resté à l'écran, et
 * c'est lui qui porte l'alerte. Une colonne vide n'est pas une base incomplète quand la
 * grandeur n'était de toute façon pas à la base de la donner.
 */
function ManquesDeLaBase({ ligne }: { readonly ligne: LigneBoitier }) {
  if (Object.keys(ligne.readNoiseE).length > 0) return null
  return (
    <Mention ton="cause">
      <AlerteChamp
        note={
          'Cette ligne de la base laisse le bruit de lecture vide : ' +
          `${K('READ_NOISE_DEFAUT_E')} e⁻ du registre s’appliquent, et la pose optimale varie ` +
          'comme le carré de cette valeur. Toute sortie qui en dépend s’affiche [ESTIMÉ].'
        }
      />{' '}
      Base incomplète pour ce boîtier.
    </Mention>
  )
}

/**
 * §7.2 — l'ISO. Boîtier de la base : un fait, pas une question.
 *
 * L'ISO du double gain ne se choisit pas, il se constate — demander à quelqu'un de taper le
 * chiffre qu'on vient de lui calculer est une question dont on connaît déjà la réponse.
 *
 * T-0206 — il ne se modifie donc plus du tout. Le seuil de la ligne désigne un palier et un
 * seul : en dessous le bruit de lecture impose des poses plus longues, au-dessus la dynamique
 * est sacrifiée sans rien gagner. Garder la main dessus offrait un réglage dont toutes les
 * valeurs sont moins bonnes que celle affichée, et le forcer faussait la pose calculée. Un
 * boîtier absent de la base garde son champ : là, aucune courbe ne répond à sa place.
 */
function LigneIso({
  iso,
  surIso,
  lecture,
  fige,
}: {
  readonly iso: string
  readonly surIso: (v: string) => void
  readonly lecture?: IsoRetenu | undefined
  /** Vrai quand un boîtier de la base répond déjà à la question. */
  readonly fige: boolean
}) {
  return (
    <>
      {fige ? (
        <p className="etat">
          <Etiquette cle="iso_recommande" /> : {lecture === undefined ? '—' : lecture.iso}
        </p>
      ) : (
        <ChampDomaine
          domaine="iso_capture"
          cle="iso_recommande"
          valeur={iso}
          surValeur={surIso}
          inputMode="numeric"
          placeholder={lecture === undefined ? 'recommandé' : `recommandé : ${lecture.iso}`}
        />
      )}
      {lecture !== undefined && (
        <Mention ton={lecture.readNoiseE === null ? 'cause' : 'etat'}>{lecture.message}</Mention>
      )}
    </>
  )
}

export interface PanneauBoitierProps {
  readonly boitierId: string
  readonly surBoitierId: (v: string) => void
  readonly boitier: SaisieBoitier
  readonly surBoitier: (v: SaisieBoitier) => void
  readonly iso: string
  readonly surIso: (v: string) => void
  /** §7.2 — l'ISO retenu et sa justification. Absent tant que la saisie est refusée. */
  readonly lectureIso?: IsoRetenu | undefined
}

export function PanneauBoitier(props: PanneauBoitierProps) {
  const ligne = ligneBoitier(props.boitierId)
  // T-0199 — les notes viennent de la SAISIE, pas des lectures : c'est quand la saisie est
  // refusée qu'il importe le plus de voir ce qui manque, et les lectures sont alors absentes.
  const notes = notesEstimation(props.boitier)
  const resumeAvancees = resumeManquantes(notes)
  const surChamp = (champ: keyof SaisieBoitier) => (v: string) =>
    props.surBoitier({ ...props.boitier, [champ]: v })

  return (
    <section>
      <h2>
        <Bulle texte={AIDE_BOITIER} place="bas">
          <span className="aide">Boîtier</span>
        </Bulle>
      </h2>
      <div className="champs">
        <SelecteurBoitier boitierId={props.boitierId} surBoitierId={props.surBoitierId} />
        {ligne === null && (
          <>
            <ChampChoix
              cle="format_capteur"
              valeur={props.boitier.formatCapteur}
              surChangement={surChamp('formatCapteur')}
            >
              {TABLE_FORMATS_CAPTEUR.map((f) => (
                <option key={f.format} value={f.format}>
                  {f.libelle}
                </option>
              ))}
            </ChampChoix>
            <ChampDomaine
              domaine="resolution_mpx"
              cle="resolution_capteur"
              unite
              valeur={props.boitier.resolutionMpx}
              surValeur={surChamp('resolutionMpx')}
              requis
            />
          </>
        )}
        {/* T-0155 — §7.3 tient le budget de stockage pour « bloquant en pratique ». Un chiffre
            qui décide de la sortie ne se range pas sous un dépliant : il varie d'un boîtier à
            l'autre, et c'est la seule grandeur avancée dont l'absence fausse un volume affiché.
            T-0205 — il survit au choix d'un boîtier de la base, prérempli par sa ligne : le
            réglage RAW change le poids sans changer d'appareil. */}
        <ChampDomaine
          domaine="taille_raw_mo"
          cle="poids_image"
          unite
          valeur={props.boitier.tailleRawMo}
          surValeur={surChamp('tailleRawMo')}
          note={notes.tailleRawMo}
        />
      </div>
      {ligne === null ? (
        <>
          <ApercuPitch
            formatCapteur={props.boitier.formatCapteur}
            resolutionMpx={props.boitier.resolutionMpx}
          />
          {/* T-0199 — l'absence de ces grandeurs se signale à chaque champ, plus dans un bloc
              d'encadrés sous la section : une alerte loin de sa cause ne désigne rien. La ligne
              `zp_source` part avec eux — §7.1 l'exige partout où une pose est affichée, et ce
              panneau n'en affiche aucune ; elle vit dans les verdicts, le filé et la séance. */}
          <details className="avancees">
            <summary>
              <Bulle texte={AIDE_AVANCEES} place="bas">
                <span className="aide">Grandeurs du capteur — mode avancé</span>
              </Bulle>
              {resumeAvancees !== undefined && <AlerteChamp note={resumeAvancees} />}
              {/* Le chevron remplace le marqueur natif : celui-ci se pose avant le texte, à
                  gauche, et une étiquette qui passe à la ligne le laissait seul sur la sienne. */}
              <Icone nom="expand_more" classe="chevron" />
            </summary>
            <ChampsAvances boitier={props.boitier} surChamp={surChamp} notes={notes} />
          </details>
        </>
      ) : (
        <ManquesDeLaBase ligne={ligne} />
      )}
      <LigneIso
        iso={props.iso}
        surIso={props.surIso}
        lecture={props.lectureIso}
        fige={ligne !== null}
      />
    </section>
  )
}
