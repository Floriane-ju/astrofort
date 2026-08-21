/**
 * T-0099 — brillance du ciel crépusculaire au zénith, en bande V.
 *
 * SOURCE UNIQUE, lue et vérifiée : Patat, Ugolnikov & Postylyakov (2006), A&A 455, 385,
 * « UBVRI twilight sky brightness at ESO-Paranal », Table 1. Plus de 2000 images FORS1
 * d'archive, ajustement par un polynôme du second degré :
 *
 *     μ(ζ) = a0 + a1 (ζ − 95) + a2 (ζ − 95)²        95° ≤ ζ ≤ 105°
 *
 * ζ est la DISTANCE ZÉNITHALE DU SOLEIL en degrés, soit 90° + dépression solaire (les auteurs
 * négligent la dépression de l'horizon). Le domaine ajusté couvre donc une dépression de 5° à
 * 15° : ni le crépuscule civil, ni la nuit astronomique.
 *
 * EXTRAPOLATION INTERDITE, et pas seulement par principe : le polynôme a son sommet à
 * ζ = 108,3° puis REDESCEND. Prolongé, il ferait réapparaître un ciel de crépuscule au milieu
 * de la nuit. Sous 5° de dépression, il n'est pas prolongé non plus — la valeur du bord de
 * table est retenue et le déclare, comme `contrast.ts` plafonne au dernier palier de Blackwell.
 *
 * SITE DE MONTAGNE — la question était ouverte, la source y répond. Paranal est à 2600 m ;
 * les auteurs comparent avec CrAO (600 m) et concluent (§5) : « the bright twilight and night
 * sky brightnesses are very close at the two sites », Paranal n'étant plus sombre que d'environ
 * 30 % en bande V pendant le crépuscule PROFOND. La table est donc utilisable pour un site de
 * plaine là où elle compte — le crépuscule clair, celui qui efface les étoiles — et l'écart de
 * 30 % (0,3 mag, une fois et demie la dispersion σ de l'ajustement lui-même) se concentre dans
 * la phase où la contribution est déjà résiduelle. Limite déclarée, aucune correction
 * d'altitude appliquée : il n'existe pas de table par altitude à citer.
 */

export interface AjustementCrepuscule {
  /** μ au bord bas du domaine, mag/arcsec². */
  readonly a0: number
  /** mag/arcsec² par degré. */
  readonly a1: number
  /** mag/arcsec² par degré carré. */
  readonly a2: number
  /** Écart quadratique moyen des mesures à l'ajustement, mag/arcsec². */
  readonly sigma: number
  /** Distance zénithale solaire de référence du polynôme, en degrés. */
  readonly zetaReferenceDeg: number
  readonly zetaMinDeg: number
  readonly zetaMaxDeg: number
}

/** Bande V — la seule des cinq utilisée : c'est celle de `TABLE_BORTLE` et de `moon.ts`. */
export const CREPUSCULE_V: AjustementCrepuscule = Object.freeze({
  a0: 11.84,
  a1: 1.518,
  a2: -0.057,
  sigma: 0.18,
  zetaReferenceDeg: 95,
  zetaMinDeg: 95,
  zetaMaxDeg: 105,
})

export const SOURCE_CREPUSCULE =
  'Patat, Ugolnikov & Postylyakov (2006), A&A 455, 385, Table 1 — brillance de surface du ' +
  'ciel au zénith en bande V, ajustée sur 95° ≤ ζ_Soleil ≤ 105°. Interpolation autorisée ' +
  'dans le domaine, extrapolation interdite hors de lui.'

/**
 * Fond de ciel nocturne du site où la table a été mesurée, en bande V : c'est LUI qu'il faut
 * retirer à l'ajustement pour obtenir la contribution du crépuscule seul.
 *
 * L'ajustement mesure un total — lueur crépusculaire diffusée PLUS lueur nocturne de Paranal.
 * Le composer avec le fond d'un autre site sans retirer celui de Paranal compterait deux fois
 * une lueur nocturne.
 *
 * Source : Patat (2003), A&A 400, 1183, Table 4 (valeurs publiées par l'ESO pour Paranal :
 * U 22,28 · B 22,64 · V 21,61 · R 20,87 · I 19,71 mag/arcsec², σ_V = 0,20). Recoupée sur
 * l'article de 2006 lui-même, qui donne les couleurs du ciel nocturne de Paranal
 * (U−B = −0,36 · B−V = 1,03 · V−R = 0,74 · V−I = 1,90) : les cinq magnitudes les redonnent
 * exactement.
 */
export const SB_NUIT_SITE_REFERENCE_MAG = 21.61

const DEPRESSION_HORIZON_DEG = 90

/** Dépression solaire au bord bas du domaine ajusté : sous elle, rien n'est extrapolé. */
export const DEPRESSION_MIN_TABLE_DEG = CREPUSCULE_V.zetaMinDeg - DEPRESSION_HORIZON_DEG

/**
 * Dépression solaire à laquelle l'ajustement rejoint le fond de ciel nocturne de son propre
 * site : au-delà, la contribution du crépuscule est nulle, et le polynôme n'est plus évalué.
 *
 * Elle se DÉDUIT — racine de μ(ζ) = SB_NUIT_SITE_REFERENCE_MAG, la plus petite des deux. Elle
 * ne se choisit pas, et elle tombe à 15,9°, soit ζ = 105,9° : exactement dans l'intervalle que
 * l'article annonce par ailleurs (« the night sky brightness level is reached at around
 * ζ = 105°-106° »). Le raccord n'est donc pas une convention posée sur le bord de la table,
 * c'est le point que la source elle-même désigne.
 */
export const DEPRESSION_FIN_CREPUSCULE_DEG = (() => {
  const { a0, a1, a2 } = CREPUSCULE_V
  const c = a0 - SB_NUIT_SITE_REFERENCE_MAG
  const discriminant = a1 * a1 - 4 * a2 * c
  const racine = (-a1 + Math.sqrt(discriminant)) / (2 * a2)
  return DEPRESSION_MIN_TABLE_DEG + racine
})()

export type BorneCrepuscule = 'AUCUNE' | 'CIEL_PLUS_CLAIR'

export interface SbCrepuscule {
  /** Brillance de surface totale du ciel crépusculaire au zénith, mag/arcsec². */
  readonly value: number
  /** `CIEL_PLUS_CLAIR` : la dépression est sous le domaine, la valeur est celle du bord. */
  readonly borne: BorneCrepuscule
}

/**
 * Brillance TOTALE du ciel de Paranal au zénith pour cette dépression solaire — lueur
 * nocturne du site de mesure comprise. La contribution du crépuscule seul se déduit en
 * retirant `SB_NUIT_SITE_REFERENCE_MAG`, ce que fait `brillanceCrepusculeNl`.
 *
 * Au-delà de `DEPRESSION_FIN_CREPUSCULE_DEG` la fonction n'a plus de sens : elle refuse de
 * répondre plutôt que de prolonger un polynôme qui redescend.
 */
export function sbCrepusculeZenith(depressionSolaireDeg: number): SbCrepuscule | null {
  if (!Number.isFinite(depressionSolaireDeg)) return null
  if (depressionSolaireDeg >= DEPRESSION_FIN_CREPUSCULE_DEG) return null
  const sousLaTable = depressionSolaireDeg < DEPRESSION_MIN_TABLE_DEG
  const depression = sousLaTable ? DEPRESSION_MIN_TABLE_DEG : depressionSolaireDeg
  const { a0, a1, a2 } = CREPUSCULE_V
  const d = depression - DEPRESSION_MIN_TABLE_DEG
  return {
    value: a0 + a1 * d + a2 * d * d,
    borne: sousLaTable ? 'CIEL_PLUS_CLAIR' : 'AUCUNE',
  }
}
