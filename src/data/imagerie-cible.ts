/**
 * §6.4 — l'image d'une cible : une vignette et son attribution, ou rien.
 *
 * Deux sources, dans l'ordre que la mesure impose. L'encyclopédie rend une image pour
 * soixante objets NGC sur soixante — des découpes DSS, PanSTARRS et SDSS — mais pour quarante
 * deux Messier sur cent dix, un Barnard sur vingt. C'est donc la désignation NGC qui
 * interroge, y compris pour un objet Messier, et la découpe de relevé n'est pas un repli
 * d'exception : c'est le cas courant pour Sharpless et Barnard.
 *
 * Trois refus assumés, chacun pour une raison différente :
 *   - un fichier dont le nom trahit un diagramme (§6.4) — une carte de constellation
 *     affichée comme une photo de nébuleuse est un mensonge, pas une approximation ;
 *   - une image sans auteur ni licence lisibles — l'attribution est une condition d'usage ;
 *   - un fichier hors du plafond de poids du registre — §12.3 avant une vignette.
 *
 * Un échec ne lève jamais. Une cible sans image reste une cible complète : c'est la
 * formulation de §12.5, et un message d'erreur ferait passer un agrément visuel manquant
 * pour une panne.
 */

import { K } from '../registry/constants.ts'
import type { ObjetCielProfond } from './deepsky.ts'
import { ecritImage, litImage, type CreditImage, type ImageStockee } from './db.ts'
import { modeReseauCourant } from './degradation.ts'
import {
  CHEMIN_DECOUPE,
  CREDIT_RELEVE,
  HOTE_DECOUPE,
  I,
  LANGUE_ENCYCLOPEDIE,
  MOTIFS_FICHIER_REFUSE,
  RELEVE_DECOUPE,
} from '../registry/imagerie.ts'

const ARCMIN_PAR_DEG = 60
const OCTETS_PAR_KO = 1024

/**
 * Les titres à essayer, dans l'ordre mesuré. Pour un objet Messier, la désignation NGC vit
 * dans `nomsCommuns` : le constructeur de paquets y verse la colonne `Name` d'OpenNGC, donc
 * « NGC0224 » pour M31. L'identifiant le plus couvert est ainsi atteignable sans toucher au
 * format binaire.
 */
export function candidatsTitre(objet: ObjetCielProfond): readonly string[] {
  const champs = `${objet.designation} ${objet.nomsCommuns}`
  const candidats: string[] = []

  const ngcIc = /\b(NGC|IC)\s*0*(\d+)\b/i.exec(champs)
  if (ngcIc !== null) candidats.push(`${ngcIc[1]!.toUpperCase()} ${Number(ngcIc[2])}`)

  const messier = /^M\s*0*(\d+)$/i.exec(objet.designation)
  if (messier !== null) candidats.push(`Messier ${Number(messier[1])}`)

  const barnard = /^B\s*0*(\d+)$/i.exec(objet.designation)
  if (barnard !== null) candidats.push(`Barnard ${Number(barnard[1])}`)

  if (/^Sh2-\d+$/i.test(objet.designation)) candidats.push(objet.designation)

  const commun = objet.nomsCommuns.split(/[|,]/)[0]?.trim() ?? ''
  if (commun !== '') candidats.push(commun)

  return Object.freeze([...new Set(candidats)])
}

/**
 * Le champ de la découpe : la taille de l'objet, élargie par la marge du registre, bornée.
 * Un objet de 71′ et un objet de 2′ ne se regardent pas au même champ — c'est la raison
 * d'être de cette fonction, et la raison pour laquelle aucune valeur n'est écrite ici.
 */
export function champDecoupeDeg(objet: ObjetCielProfond): number {
  const taille = objet.majAxArcmin
  if (taille === null || !(taille > 0)) return I('CHAMP_DECOUPE_DEFAUT_DEG')
  const brut = (taille / ARCMIN_PAR_DEG) * I('MARGE_CADRAGE_DECOUPE')
  return Math.min(Math.max(brut, I('CHAMP_DECOUPE_MIN_DEG')), I('CHAMP_DECOUPE_MAX_DEG'))
}

/** L'adresse de la découpe de relevé aux coordonnées de l'objet, au champ demandé. */
export function urlDecoupeAuChamp(objet: ObjetCielProfond, champDeg: number): string {
  const cote = I('LARGEUR_VIGNETTE_PX')
  const parametres = new URLSearchParams({
    hips: RELEVE_DECOUPE,
    width: String(cote),
    height: String(cote),
    fov: String(champDeg),
    projection: 'TAN',
    coordsys: 'icrs',
    ra: String(objet.adDeg),
    dec: String(objet.decDeg),
    format: 'jpg',
  })
  return `${HOTE_DECOUPE}${CHEMIN_DECOUPE}?${parametres.toString()}`
}

/** La découpe qui illustre l'objet : cadrée sur sa taille (§6.4). */
export function urlDecoupe(objet: ObjetCielProfond): string {
  return urlDecoupeAuChamp(objet, champDecoupeDeg(objet))
}

/**
 * §6.2 — le champ de l'aperçu de cadrage : le grand côté du capteur, élargi par la marge.
 *
 * Ce n'est pas le champ de §6.4, et ce ne peut pas l'être. La vignette est cadrée sur l'OBJET,
 * parce que c'est ce qui rend un objet reconnaissable ; l'aperçu est cadré sur le CAPTEUR,
 * parce que la question qu'il répond est « qu'est-ce qui tient dans le cadre ». Redimensionner
 * l'une ne produit pas l'autre.
 *
 * Le plancher est le champ du capteur lui-même : un aperçu plus étroit que le cadre ne
 * montrerait pas le cadre. C'est ce qui interdit de réemployer ici le plafond de la vignette —
 * à 120 mm sur plein format le champ vaut 17°, et un plafond à 10° rendait une vue dans
 * laquelle le rectangle du capteur ne tenait pas.
 *
 * Le plafond est celui de la projection, pas une convention de plus. La découpe est rendue en
 * TAN, exactement la gnomonique de §3.3, et C-26 dit déjà où elle cesse d'être lisible.
 */
export function champApercuCadreDeg(fovLDeg: number): number {
  const large = Math.min(fovLDeg * I('MARGE_APERCU_CADRE'), K('FOV_MAX_GNOMONIQUE_DEG'))
  return Math.max(large, fovLDeg, I('CHAMP_DECOUPE_MIN_DEG'))
}

/**
 * §3.3, C-26 — au-delà du plafond gnomonique, il n'y a pas d'aperçu à rendre : le cadre ne
 * tient dans aucune découpe en TAN. Le cas existe — un fisheye de 8 mm couvre 132° sur le
 * grand côté — et il vaut mieux ne rien montrer qu'un rectangle qui déborde de l'image sans
 * que ce débordement veuille dire quoi que ce soit sur le cadrage.
 */
export function apercuCadreRendable(fovLDeg: number): boolean {
  return fovLDeg > 0 && fovLDeg <= K('FOV_MAX_GNOMONIQUE_DEG')
}

/**
 * La clé de cache d'un aperçu de cadrage. Elle porte le champ, donc le matériel : changer de
 * focale ou de boîtier redemande la vue au lieu de servir celle de l'ancien cadre — et
 * n'invalide pas la vignette de §6.4, qui reste rangée sous la désignation nue.
 */
export function cleApercuCadre(designation: string, champDeg: number): string {
  return `${designation}@cadre-${champDeg.toFixed(3)}`
}

/** Vrai quand le nom du fichier trahit un diagramme et non l'objet (§6.4). */
export function fichierRefuse(nomFichier: string): boolean {
  return MOTIFS_FICHIER_REFUSE.some((motif) => motif.test(nomFichier))
}

/**
 * Le nom du fichier derrière une adresse d'image de l'encyclopédie. Les adresses de vignette
 * portent le fichier d'origine dans l'avant-dernier segment (`…/thumb/9/9d/X.jpg/330px-X.jpg`) :
 * c'est lui qu'il faut lire, parce que le refus porte sur le format d'origine — une carte
 * vectorielle est servie en vignette PNG.
 */
export function nomFichierDeUrl(adresse: string): string | null {
  let chemin: string
  try {
    chemin = new URL(adresse).pathname
  } catch {
    return null
  }
  const segments = chemin.split('/').filter((s) => s !== '')
  const dernier = segments.at(-1)
  if (dernier === undefined) return null
  const avantDernier = segments.at(-2)
  const nom = segments.includes('thumb') && avantDernier !== undefined ? avantDernier : dernier
  return decodeURIComponent(nom)
}

interface ReponseResume {
  readonly originalimage?: { readonly source?: string }
  readonly thumbnail?: { readonly source?: string }
}

interface ReponseInfoFichier {
  readonly query?: {
    readonly pages?: Record<
      string,
      {
        readonly imageinfo?: readonly {
          readonly thumburl?: string
          readonly extmetadata?: Record<string, { readonly value?: unknown }>
        }[]
      }
    >
  }
}

/**
 * §13.1 — aucune requête ne dit d'où elle vient. Sans cela, le navigateur joint l'origine de
 * l'application à chaque appel : ce n'est ni un profil, ni un site, ni un plan, mais c'est une
 * information que rien n'oblige à transmettre, et la liste des origines énumère ce qui sort.
 */
const SANS_REFERENT: RequestInit = { referrerPolicy: 'no-referrer' }

async function json<T>(adresse: string): Promise<T | null> {
  const reponse = await fetch(adresse, SANS_REFERENT)
  if (!reponse.ok) return null
  return (await reponse.json()) as T
}

/** L'adresse de l'image de tête d'une page, ou `null` si la page n'existe pas ou n'en a pas. */
async function imageDeTete(titre: string): Promise<string | null> {
  const chemin = encodeURIComponent(titre.replace(/ /g, '_'))
  const resume = await json<ReponseResume>(
    `https://${LANGUE_ENCYCLOPEDIE}.wikipedia.org/api/rest_v1/page/summary/${chemin}?redirect=true`,
  )
  return resume?.originalimage?.source ?? resume?.thumbnail?.source ?? null
}

/** Le texte d'un champ de métadonnée, débarrassé du balisage que l'API y laisse. */
function texteNu(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.replace(/<[^>]*>/g, '').trim() : ''
}

/**
 * Vignette et attribution d'un fichier, en une seule interrogation. Demander la largeur au
 * service plutôt que redimensionner à l'affichage évite de télécharger l'original — qui pèse
 * couramment des dizaines de méga-octets.
 */
async function vignetteEtCredit(
  nomFichier: string,
): Promise<{ readonly source: string; readonly credit: CreditImage } | null> {
  const parametres = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'extmetadata|url',
    iiurlwidth: String(I('LARGEUR_VIGNETTE_PX')),
    titles: `File:${nomFichier}`,
  })
  const info = await json<ReponseInfoFichier>(
    `https://commons.wikimedia.org/w/api.php?${parametres.toString()}`,
  )
  const pages = info?.query?.pages
  if (pages === undefined) return null
  const premiere = Object.values(pages)[0]?.imageinfo?.[0]
  if (premiere?.thumburl === undefined) return null

  const meta = premiere.extmetadata ?? {}
  const auteur = texteNu(meta['Artist']?.value) || texteNu(meta['Credit']?.value)
  const licence = texteNu(meta['LicenseShortName']?.value) || texteNu(meta['UsageTerms']?.value)
  // Sans auteur ni licence, l'image n'est pas affichable : mieux vaut la découpe de relevé,
  // dont le crédit est connu, qu'une image libre servie sans son attribution.
  if (auteur === '' || licence === '') return null

  return {
    source: premiere.thumburl,
    credit: {
      auteur,
      licence,
      lien: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(nomFichier)}`,
    },
  }
}

/**
 * Les octets d'une image, ou `null`. Un service qui répond 200 avec une page d'erreur HTML
 * n'est pas une image : le type est vérifié, pas supposé.
 */
async function octets(adresse: string): Promise<Blob | null> {
  const reponse = await fetch(adresse, SANS_REFERENT)
  if (!reponse.ok) return null
  const corps = await reponse.blob()
  if (!corps.type.startsWith('image/')) return null
  if (corps.size > I('POIDS_VIGNETTE_MAX_KO') * OCTETS_PAR_KO) return null
  return corps
}

async function depuisEncyclopedie(objet: ObjetCielProfond): Promise<ImageStockee | null> {
  for (const titre of candidatsTitre(objet)) {
    const adresse = await imageDeTete(titre)
    if (adresse === null) continue

    const nomFichier = nomFichierDeUrl(adresse)
    // Un fichier refusé arrête la recherche encyclopédique : les candidats suivants mènent
    // par redirection à la même page, donc à la même carte.
    if (nomFichier === null || fichierRefuse(nomFichier)) return null

    const vignette = await vignetteEtCredit(nomFichier)
    if (vignette === null) return null

    const corps = await octets(vignette.source)
    if (corps === null) return null

    return {
      designation: objet.designation,
      origine: 'ENCYCLOPEDIE',
      octets: corps,
      credit: vignette.credit,
      source: vignette.source,
      obtenueIso: new Date().toISOString(),
    }
  }
  return null
}

/**
 * Une découpe de relevé, rangée sous la clé donnée. La clé n'est pas toujours la désignation :
 * un aperçu de cadrage y ajoute son champ, sans quoi deux vues du même objet à deux focales
 * se recouvriraient dans le magasin.
 */
async function decoupe(cle: string, adresse: string): Promise<ImageStockee | null> {
  const corps = await octets(adresse)
  if (corps === null) return null
  return {
    designation: cle,
    origine: 'RELEVE',
    octets: corps,
    credit: CREDIT_RELEVE,
    source: adresse,
    obtenueIso: new Date().toISOString(),
  }
}

/**
 * Les résolutions en vol, par désignation. Sans elles, la fiche et la vignette de liste
 * demandent deux fois la même image au même instant — et le service répond 429.
 */
const enVol = new Map<string, Promise<ImageStockee | null>>()

/**
 * L'image d'une cible : le cache d'abord, le réseau ensuite, jamais l'inverse.
 *
 * Hors réseau, l'absence de cache n'est pas une erreur : c'est la ligne §12.5 de cette
 * fonction. En ligne, un échec de bout en bout rend `null` sans lever.
 */
export async function resoudImage(objet: ObjetCielProfond): Promise<ImageStockee | null> {
  const enCache = await litImage(objet.designation)
  if (enCache !== null) return enCache
  if (modeReseauCourant() === 'HORS_LIGNE') return null

  const dejaEnVol = enVol.get(objet.designation)
  if (dejaEnVol !== undefined) return dejaEnVol

  const resolution = (async () => {
    try {
      const image =
        (await depuisEncyclopedie(objet)) ??
        (await decoupe(objet.designation, urlDecoupe(objet)))
      if (image !== null) await ecritImage(image)
      return image
    } catch {
      return null
    }
  })().finally(() => enVol.delete(objet.designation))

  enVol.set(objet.designation, resolution)
  return resolution
}

/** L'image d'une cible si elle est déjà rangée, sans jamais toucher au réseau (§6.4). */
export function imageEnCache(designation: string): Promise<ImageStockee | null> {
  return litImage(designation)
}

/**
 * §6.2 — l'aperçu de cadrage : la découpe du relevé au champ du capteur.
 *
 * Une seule source, et c'est voulu. Une image encyclopédique est cadrée par son auteur : elle
 * ne répond pas à « qu'est-ce qui tient dans MON cadre ». Seule une découpe au champ demandé
 * y répond, et elle existe pour n'importe quelles coordonnées.
 *
 * Hors réseau, rien : c'est la ligne §12.5 « prévisualisation du cadre sur imagerie de fond »,
 * dont la dégradation nommée est le cadre schématique de §9.2, déjà rendu sur la scène.
 */
export async function resoudApercuCadre(
  objet: ObjetCielProfond,
  fovLDeg: number,
): Promise<ImageStockee | null> {
  if (!apercuCadreRendable(fovLDeg)) return null
  const champDeg = champApercuCadreDeg(fovLDeg)
  const cle = cleApercuCadre(objet.designation, champDeg)

  const enCache = await litImage(cle)
  if (enCache !== null) return enCache
  if (modeReseauCourant() === 'HORS_LIGNE') return null

  const dejaEnVol = enVol.get(cle)
  if (dejaEnVol !== undefined) return dejaEnVol

  const resolution = (async () => {
    try {
      const image = await decoupe(cle, urlDecoupeAuChamp(objet, champDeg))
      if (image !== null) await ecritImage(image)
      return image
    } catch {
      return null
    }
  })().finally(() => enVol.delete(cle))

  enVol.set(cle, resolution)
  return resolution
}
