/**
 * Domaines de saisie — colonne « plage valide » des tableaux Entrées / Sorties du PRD
 * (§4.1, §5.1, §5.2).
 *
 * Ils vivent à côté du registre §2.1 pour la même raison que lui : ce sont des valeurs
 * déclarées par le PRD, pas des résultats de formule. Les moteurs les citent au lieu de
 * réécrire des bornes en dur, et un refus de saisie nomme toujours le champ fautif.
 */

export interface DomaineSaisie {
  /** Libellé du champ tel qu'il apparaît à l'utilisateur, cité dans le message de refus. */
  readonly champ: string
  readonly min: number
  readonly max: number
  readonly unite: string
  readonly section: string
}

function domaine(d: DomaineSaisie): DomaineSaisie {
  return Object.freeze(d)
}

export const DOMAINES = Object.freeze({
  // §4.1 — profil Lieu
  latitude_deg: domaine({ champ: 'la latitude', min: -90, max: 90, unite: '°', section: '4.1' }),
  longitude_deg: domaine({ champ: 'la longitude', min: -180, max: 180, unite: '°', section: '4.1' }),
  altitude_m: domaine({ champ: 'l’altitude', min: -400, max: 6000, unite: 'm', section: '4.1' }),
  sqm_mesure: domaine({ champ: 'le SQM mesuré', min: 16, max: 22, unite: 'mag/as²', section: '4.1' }),
  bortle_declare: domaine({ champ: 'le Bortle déclaré', min: 1, max: 9, unite: '—', section: '4.1' }),
  masque_horizon_deg: domaine({
    champ: 'le masque d’horizon',
    min: 0,
    max: 90,
    unite: '°',
    section: '4.1',
  }),
  // L'azimut se referme sur lui-même : 360° est accepté et vaut 0°, pas une saisie fautive.
  azimut_masque_deg: domaine({
    champ: 'l’azimut du masque',
    min: 0,
    max: 360,
    unite: '°',
    section: '4.1',
  }),

  // §5.1 — profil optique et capteur
  focale_mm: domaine({ champ: 'la focale', min: 8, max: 4000, unite: 'mm', section: '5.1' }),
  ouverture_N: domaine({ champ: 'l’ouverture', min: 0.95, max: 32, unite: 'f/N', section: '5.1' }),
  capteur_mm: domaine({
    champ: 'la dimension de capteur',
    min: 3,
    max: 60,
    unite: 'mm',
    section: '5.1',
  }),
  pitch_um: domaine({ champ: 'le pitch', min: 0.8, max: 24, unite: 'µm', section: '5.1' }),
  read_noise_e: domaine({ champ: 'le bruit de lecture', min: 0.5, max: 15, unite: 'e⁻', section: '5.1' }),
  seuil_double_gain_iso: domaine({
    champ: 'le seuil de double gain',
    min: 100,
    max: 6400,
    unite: 'ISO',
    section: '5.1',
  }),
  full_well_e: domaine({
    champ: 'la capacité de saturation',
    min: 5000,
    max: 200000,
    unite: 'e⁻',
    section: '5.1',
  }),
  zp_sys: domaine({ champ: 'le point zéro système', min: 18, max: 22, unite: 'mag', section: '5.1' }),
  taille_raw_mo: domaine({ champ: 'la taille RAW', min: 5, max: 120, unite: 'Mo', section: '5.1' }),
  autonomie_cipa: domaine({
    champ: 'l’autonomie CIPA',
    min: 100,
    max: 2000,
    unite: 'vues',
    section: '5.1',
  }),

  iso_capture: domaine({ champ: 'l’ISO de capture', min: 100, max: 6400, unite: 'ISO', section: '7.2' }),

  // §6.3, §7.1 — détectabilité et flux
  m_int: domaine({ champ: 'la magnitude intégrée', min: -2, max: 20, unite: 'mag', section: '6.3' }),
  sb_ciel: domaine({
    champ: 'la brillance du fond de ciel',
    min: 16,
    max: 22,
    unite: 'mag/as²',
    section: '7.1',
  }),
  sb_obj: domaine({
    champ: 'la brillance de surface de l’objet',
    min: 16,
    max: 26,
    unite: 'mag/as²',
    section: '7.1',
  }),

  // §7.3 — objectif de qualité
  snr_cible: domaine({ champ: 'le rapport signal sur bruit visé', min: 5, max: 50, unite: '—', section: '7.3' }),

  // §7.4 — plan de calibration
  temp_capteur_c: domaine({
    champ: 'la température du capteur',
    min: -20,
    max: 40,
    unite: '°C',
    section: '7.4',
  }),

  // §5.2 — profil Suivi
  t_max_suivi_s: domaine({ champ: 'la pose maximale de suivi', min: 1, max: 240, unite: 's', section: '5.2' }),

  // §9.1 — déclinaison de la zone visée
  dec_deg: domaine({ champ: 'la déclinaison', min: -90, max: 90, unite: '°', section: '9.1' }),

  // §8.3 — poids de scoring C-15. Le domaine porte le poids BRUT, avant normalisation :
  // seule la somme des cinq vaut 1, aucun poids pris isolément n'est contraint au-delà.
  poids_scoring: domaine({ champ: 'un poids de scoring', min: 0, max: 1, unite: '—', section: '8.3' }),
})

export type DomaineId = keyof typeof DOMAINES

/** Saisie refusée : le champ fautif est nommé, jamais corrigé en silence (§5.1). */
export class SaisieRefuseeError extends Error {
  readonly champ: DomaineId

  constructor(champ: DomaineId, message: string) {
    super(message)
    this.name = 'SaisieRefuseeError'
    this.champ = champ
  }
}

/** Retourne la valeur si elle est dans le domaine, lève en la nommant sinon. */
export function valide(champ: DomaineId, valeur: number): number {
  const d = DOMAINES[champ]
  if (!Number.isFinite(valeur)) {
    throw new SaisieRefuseeError(
      champ,
      `Saisie refusée : ${d.champ} doit être un nombre (§${d.section}).`,
    )
  }
  if (valeur < d.min || valeur > d.max) {
    throw new SaisieRefuseeError(
      champ,
      `Saisie refusée : ${d.champ} vaut ${valeur} ${d.unite}, hors de la plage ${d.min} à ` +
        `${d.max} ${d.unite} (§${d.section}).`,
    )
  }
  return valeur
}
