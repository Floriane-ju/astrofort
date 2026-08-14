/**
 * Annexe B — formulaire complet.
 *
 * Chaque formule est déclarée ici une seule fois, avec son expression littérale telle
 * qu'écrite dans le PRD. Les moteurs citent l'identifiant dans leur résultat tracé, ce qui
 * rend §10.2 « explication de verdict » dérivable au lieu d'être réécrite à la main.
 */

export interface FormulaEntry {
  readonly expression: string
  readonly unite: string
  readonly section: string
  /** Précision de lecture, quand l'expression seule ne suffit pas. */
  readonly note?: string
}

export const FORMULES = Object.freeze({
  // Optique et cadrage — §5.1, §6.1, §6.2
  FOV: {
    expression: 'FOV_deg = 2 × atan( dimension_capteur_mm / (2 × focale_mm) )',
    unite: '°',
    section: '5.1',
    note: "L'arctangente est utilisée partout, sans condition de bascule : l'approximation linéaire donne 205,7° à 10 mm sur plein format.",
  },
  DIAMETRE_PUPILLE: {
    expression: 'D_mm = focale_mm / ouverture_N',
    unite: 'mm',
    section: '5.1',
  },
  ECHANTILLONNAGE: {
    expression: 'ech_apx = 206 265 × pitch_um / focale_mm',
    unite: '"/px',
    section: '5.1',
  },
  DAWES: {
    expression: 'dawes_as = 116 / D_mm',
    unite: '"',
    section: '5.1',
  },
  REMPLISSAGE: {
    expression: 'remplissage = taille_objet_deg / FOV_H_deg',
    unite: '—',
    section: '6.2',
  },
  DIAMETRE_PIXELS: {
    expression: 'diam_px = taille_objet_arcsec / ech_apx',
    unite: 'px',
    section: '6.2',
  },
  NOMBRE_TUILES: {
    expression: 'n_tuiles = ceil( taille / FOV × 1,15 )²',
    unite: '—',
    section: '6.2',
  },

  // Détectabilité — §6.3
  AIRE_ELLIPSE: {
    expression: "aire_arcsec2 = (π / 4) × 3600 × a'_arcmin × b'_arcmin",
    unite: 'arcsec²',
    section: '6.3',
    note: 'Le facteur 2827,4 du PRD est ce produit, calculé plutôt qu’écrit en dur.',
  },
  BRILLANCE_SURFACE: {
    expression: 'SB_obj = m_int + 2,5 × log10( aire_arcsec2 )',
    unite: 'mag/arcsec²',
    section: '6.3',
  },
  CONTRASTE: {
    expression: 'ΔSB = SB_ciel − SB_obj',
    unite: 'mag/arcsec²',
    section: '6.3',
  },
  GAIN_INSTRUMENTAL: {
    expression: 'gain_mag = 5 × log10( D_mm / 6,5 )',
    unite: 'mag',
    section: '6.3',
  },
  MAGNITUDE_LIMITE_INSTRUMENT: {
    expression: 'm_lim_instr = m_lim_oeil + gain_mag',
    unite: 'mag',
    section: '6.3',
  },

  // Pose et intégration — §7
  FLUX_CIEL: {
    expression: 'E_ciel = 10^( −0,4 × (SB_ciel − ZP_sys) ) × (pitch_um / N)²',
    unite: 'e⁻/s/px',
    section: '7.1',
  },
  FLUX_OBJET: {
    expression: 'E_obj = 10^( −0,4 × (SB_obj − ZP_sys) ) × (pitch_um / N)²',
    unite: 'e⁻/s/px',
    section: '7.1',
  },
  POSE_OPTIMALE: {
    expression: 't_opt = C × RN² / E_ciel',
    unite: 's',
    section: '7.2',
  },
  POSE_RETENUE: {
    expression: 't_reco = min( t_opt, t_max_suivi )',
    unite: 's',
    section: '7.2',
  },
  SNR: {
    expression: 'SNR(T) = E_obj × T / √( (E_obj + E_ciel) × T + (T / t_pose) × RN² )',
    unite: '—',
    section: '7.3',
  },
  INTEGRATION_REQUISE: {
    expression: 'T_requis = SNR_cible² × ( E_obj + E_ciel + RN² / t_pose ) / E_obj²',
    unite: 's',
    section: '7.3',
  },
  NOMBRE_POSES: {
    expression: 'N_poses = ceil( T_requis / t_pose )',
    unite: '—',
    section: '7.3',
  },
  PERTE_SNR: {
    expression: 'perte_SNR = 1 − √( C / (C + 1) )',
    unite: '—',
    section: '2.3',
  },

  // Suivi et filé — §5.2, §9
  POSE_MAX_SUIVI: {
    expression: 't_max_suivi = t_ref × (200 / focale_mm), plafonné à 240 s',
    unite: 's',
    section: '5.2',
  },
  TRACE: {
    expression: 'trace_arcsec = 15,041 × t_s × cos(δ)',
    unite: '"',
    section: '9.1',
  },
  NPF: {
    expression: 't_npf = k × (35 × N + 30 × pitch_um) / ( focale_mm × cos(δ) )',
    unite: 's',
    section: '9.1',
  },
  ARC_FILE: {
    expression: 'arc_deg = 15,041 × duree_h × cos(δ)',
    unite: '°',
    section: '9.3',
  },
  NOMBRE_POSES_FILE: {
    expression: 'n_poses_file = floor( duree_s / (t_pose_s + intervalle_s) )',
    unite: '—',
    section: '9.4',
  },
  NOMBRE_BATTERIES: {
    expression: 'n_batteries = ceil( n_poses / (autonomie_cipa × facteur_froid) ) + 1',
    unite: '—',
    section: '9.4',
  },

  // Position et temps — §4, §8
  ALTITUDE_CULMINATION: {
    expression: 'alt_culmination = 90° − | latitude − δ |',
    unite: '°',
    section: '4.1',
  },
  MASSE_AIR: {
    expression: 'masse_air ≈ 1 / sin( alt )',
    unite: '—',
    section: '8.2',
    note: 'Valide au-dessus d’environ 15° de hauteur.',
  },
  DECLINAISON_CIRCUMPOLAIRE: {
    expression: 'circumpolaire si δ > 90° − latitude',
    unite: '°',
    section: '4.1',
  },
  DECLINAISON_MIN_IMAGERIE: {
    expression: 'δ_min_imagerie = latitude − 60°',
    unite: '°',
    section: '4.1',
    note: 'Seuil C-01 : la cible doit atteindre 30° de hauteur.',
  },
  DECLINAISON_MIN_VISUEL: {
    expression: 'δ_min_visuel = latitude − 70°',
    unite: '°',
    section: '4.1',
    note: 'Seuil C-02 : la cible doit atteindre 20° de hauteur.',
  },
  TEMPS_SIDERAL_LOCAL: {
    expression: 'TSL = TSG(t) + longitude_deg / 15',
    unite: 'h',
    section: '3.1',
  },
  ANGLE_ROTATION_CIEL: {
    expression: 'angle_rotation = TSL × 15,041',
    unite: '°',
    section: '3.1',
  },
  ANGLE_HORAIRE: {
    expression: 'cos H = ( sin(h) − sin δ × sin φ ) / ( cos δ × cos φ )',
    unite: '°',
    section: '8.2',
  },
  DUREE_NUIT: {
    expression: 'duree_nuit_h = 2 × (180° − H) / 15,041, avec h = −18°',
    unite: 'h',
    section: '8.1',
  },
  OFFSET_MIDI_SOLAIRE: {
    expression: 'offset_midi_min = (longitude_deg / 15) × 60 − offset_fuseau_h × 60',
    unite: 'min',
    section: '4.1',
    note: 'Le milieu de nuit ne tombe pas à minuit légal : les créneaux se centrent sur le milieu de nuit vrai.',
  },
  PRECESSION: {
    expression: 'precession_deg = 50,29 × n_annees / 3600',
    unite: '°',
    section: '3.1',
  },

  // Rendu — §3.2, §3.3, §9.2
  MAGNITUDE_LIMITE_ZOOM: {
    expression: 'mag_limite = mag_base + 5 × log10( fov_ref / fov_courant )',
    unite: 'mag',
    section: '3.3',
  },
  RAYON_ETOILE: {
    expression: 'rayon_px = r0 × 10^( −0,15 × (mag − mag_ref) )',
    unite: 'px',
    section: '3.3',
  },
  DENSITE_GALACTIQUE: {
    expression: 'densite(b) = d0 × exp( −|b| / 20° )',
    unite: 'étoiles/deg²',
    section: '9.2',
  },
  VITESSE_ECRAN: {
    expression: 'v_ecran = 15,041 × facteur × px_par_degre / 3600',
    unite: 'px/s',
    section: '3.2',
  },
  FACTEUR_VITESSE_MAX: {
    expression: 'facteur_max = 600 × 3600 / ( 15,041 × px_par_degre )',
    unite: '—',
    section: '3.2',
  },
  SENSIBILITE: {
    expression: 'sensibilite = | ∂ln(sortie) / ∂ln(variable) |',
    unite: '—',
    section: '10.2',
    note: 'Sert à désigner le facteur dominant d’un verdict.',
  },

  // Fond de ciel — §2.2
  INTERPOLATION_BORTLE: {
    expression: 'SB(b) = SB(⌊b⌋) + (b − ⌊b⌋) × ( SB(⌈b⌉) − SB(⌊b⌋) )',
    unite: 'mag/arcsec²',
    section: '2.2',
    note: 'Interpolation autorisée entre deux lignes ; extrapolation interdite hors [1 ; 9].',
  },
  INVERSION_BORTLE: {
    expression: 'm_lim_oeil = interpolation de la colonne « magnitude limite » à SB donnée',
    unite: 'mag',
    section: '2.2',
    note: 'Utilisée quand un SQM mesuré prévaut sur le Bortle. Hors du domaine de la table, aucune valeur n’est produite.',
  },
  MESURE_SQM: {
    expression: 'SB_ciel = sqm_mesure',
    unite: 'mag/arcsec²',
    section: '2.2',
    note: 'Une mesure prévaut toujours sur une estimation : ce n’est pas un calcul, c’est une donnée.',
  },
} as const satisfies Record<string, FormulaEntry>)

export type FormulaId = keyof typeof FORMULES

export function formule(id: FormulaId): FormulaEntry & { readonly id: FormulaId } {
  return { id, ...FORMULES[id] }
}
