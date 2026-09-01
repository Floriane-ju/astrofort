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
  REMPLISSAGE_ORIENTE: {
    expression:
      'u = √( maj²·cos²φ + min²·sin²φ ) · v = √( maj²·sin²φ + min²·cos²φ ) · ' +
      'remplissage = max( u / FOV_L_deg , v / FOV_H_deg )',
    unite: '—',
    section: '6.2',
    note: 'φ est l’angle du grand axe de la cible dans le repère du cadre, roulis du boîtier compris (§3.5). u et v sont la boîte englobante de l’ELLIPSE (§6.3), pas d’un rectangle : une cible ronde resterait sinon grossie d’un facteur √2 à 45°, alors qu’un disque n’a pas d’orientation. La corde du rectangle est écartée pour la raison inverse — elle donnerait à 45° plus de marge qu’un grand axe aligné sur la grande dimension. À φ = 90° l’expression se réduit exactement à REMPLISSAGE, ce qui préserve la calibration de la table de cadrage (§6.2).',
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
  FENETRE_CADRAGE: {
    expression: 'taille_min_deg = FOV_H_deg / 3 · taille_max_deg = FOV_H_deg / 2',
    unite: '°',
    section: '6.1',
    note: 'La contrainte porte sur la PETITE dimension du champ : c’est elle qui limite.',
  },
  FOCALE_IDEALE: {
    expression:
      'focale_ideale_mm = capteur_H_mm / ( 2 × tan( (taille_objet_deg / remplissage_cible) / 2 ) )',
    unite: 'mm',
    section: '6.1',
    note:
      'Le PRD écrit « taille / (2 × 0,42) / 2 » et annonce 4 200 mm pour M84 : les deux ne ' +
      'concordent pas. La focale visant 42 % du champ est retenue, et la plage affichée ' +
      'couvre toute la fenêtre C-05 — sa borne basse est le 4 200 mm du PRD.',
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
  GROSSISSEMENT: {
    expression: 'G = D_mm / pupille_oeil_mm',
    unite: '×',
    section: '6.3',
    note:
      'Grossissement à pupille de sortie pleine, celui du champ le plus riche. C’est le ' +
      'réglage qui favorise la détection d’un objet étendu.',
  },
  TAILLE_APPARENTE: {
    expression: 'taille_apparente_arcmin = taille_reelle_arcmin × G',
    unite: "'",
    section: '6.3',
    note:
      'Un instrument n’augmente jamais la brillance de surface : il augmente la taille ' +
      'apparente, et c’est par elle qu’il abaisse le seuil de contraste.',
  },
  SEUIL_CONTRASTE: {
    expression: 'seuil_ΔSB = table_de_contraste( taille_apparente_arcmin )',
    unite: 'mag/arcsec²',
    section: '6.3',
    note:
      'Tables Blackwell / Clark embarquées. Au-delà de la plus grande taille tabulée, la ' +
      'sommation spatiale est complète : le seuil plafonne, il n’est pas extrapolé.',
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
  ATTENUATION_ATMOSPHERIQUE: {
    expression: 'attenuation = 10^( −0,4 × k × X )',
    unite: '—',
    section: '7.6',
    note:
      'Une magnitude de catalogue est une magnitude HORS ATMOSPHÈRE : le flux qui atteint le ' +
      'capteur est atténué par la traversée. Le fond de ciel, lui, est relevé AU SOL — SQM ou ' +
      'table Bortle — donc déjà atténué : l’éteindre une seconde fois le compterait deux fois. ' +
      'Comme T_requis ∝ 1 / E_obj², la perte se paie au carré : le temps est multiplié par ' +
      '10^( +0,8 × k × X ), soit 1,37 au zénith et 1,88 à 30° de hauteur.',
  },
  FLUX_OBJET_REEL: {
    expression: 'E_obj_reel = E_obj × attenuation',
    unite: 'e⁻/s/px',
    section: '7.6',
    note:
      'C’est ce flux, et non celui du catalogue, qui alimente la pose et l’intégration de ' +
      '§7.3. Une cible basse coûte près du double du temps d’une cible au zénith.',
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
  PLAGE_UTILE_POSE: {
    expression: 'plage_utile = [ t_opt / 2 ; t_opt × 2 ]',
    unite: 's',
    section: '2.3',
    note: 'Les trois durées sont équivalentes en pratique : l’optimum de pose est plat.',
  },
  VOLUME_STOCKAGE: {
    expression: 'volume_go = N_poses × taille_raw_mo / 1024',
    unite: 'Go',
    section: '7.3',
  },
  NOMBRE_NUITS: {
    expression: 'n_nuits = ceil( T_requis / duree_creneau_disponible )',
    unite: '—',
    section: '7.3',
  },
  TEMPS_DARKS: {
    expression: 'temps_darks_min = n_darks × t_pose_s / 60',
    unite: 'min',
    section: '7.4',
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
  POSE_MAX_CADRE: {
    expression: 't_max_cadre = t_npf( δ_min_abs présent dans le cadre )',
    unite: 's',
    section: '9.1',
    note:
      'Sur un grand champ la déclinaison varie de plusieurs dizaines de degrés d’un bord à ' +
      'l’autre : la pose est dictée par la zone la plus contraignante du cadre, jamais par ' +
      'son centre.',
  },
  FOCALE_EQUIVALENTE: {
    expression: 'focale_equiv = focale_mm × diagonale_24x36 / diagonale_capteur',
    unite: 'mm',
    section: '9.1',
  },
  MAGNITUDE_LIMITE_PREVISU: {
    expression:
      'm_lim = zp_sys − 2,5 × log10( F_seuil × (206 265 / (1000 × D_mm))² ) · ' +
      'F_seuil × t = ( S² + √(S⁴ + 4 S² n_px (E_ciel t + RN²)) ) / 2',
    unite: 'mag',
    section: '9.2',
    note:
      'Profondeur réellement atteinte par la capture, marquée [À CALCULER] par le PRD : elle ' +
      'dépend de la pose, de l’ouverture et du fond de ciel, et pilote le nombre d’étoiles ' +
      'affichées dans la prévisualisation.',
  },
  VIGNETTAGE: {
    expression: 'attenuation_diaph = v_coins × (r / r_max)²',
    unite: 'diaphragme',
    section: '9.2',
  },
  POSITION_POLE: {
    expression: 'altitude_pole = |latitude| · azimut_pole = 0 si latitude > 0, sinon 180',
    unite: '°',
    section: '9.3',
    note:
      'Le pôle est très souvent HORS du cadre : une prévisualisation qui le force dans ' +
      'l’image est fausse et induit un cadrage raté sur le terrain.',
  },
  INTENSITE_TRACE: {
    expression:
      'pose_par_pixel_s = duree_s / longueur_arc_px · ' +
      'opacite = min( 1, 10^( −(mag − m_lim(pose_par_pixel_s)) / 2,5 ) )',
    unite: '—',
    section: '9.3',
    note:
      'Une étoile qui file est moins brillante par pixel qu’une étoile ponctuelle : le même ' +
      'flux s’étale sur toute la trace.',
  },
  TROU_TRACE: {
    expression: 'trou_deg = 15,041 × intervalle_s / 3600 × cos(δ)',
    unite: '°',
    section: '9.4',
    note: 'Trou entre deux poses successives, défaut irréparable en post-traitement.',
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
  MASSE_AIR_MOYENNE: {
    expression: 'X_moyen = moyenne( 1 / sin(alt_i) ) sur les échantillons du créneau',
    unite: '—',
    section: '8.2',
    note:
      'La masse d’air d’un créneau n’est pas celle de la culmination : une cible passe une ' +
      'partie de son créneau plus bas, et l’extinction se paie sur toute la durée. La ' +
      'moyenne est donc supérieure à la masse d’air minimale affichée par ailleurs.',
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

  // Lune et fenêtre utile — §8.1
  ILLUMINATION_LUNE: {
    expression: 'illumination = ( 1 + cos(α) ) / 2, α = angle de phase',
    unite: '—',
    section: '8.1',
    note: 'Une Lune sous l’horizon ne dégrade rien, quelle que soit sa phase.',
  },
  MASSE_AIR_KS: {
    expression: 'X(Z) = ( 1 − 0,96 × sin²(Z) )^(−1/2)',
    unite: '—',
    section: '8.1',
    note: 'Masse d’air du modèle de Krisciunas & Schaefer, valide jusqu’à l’horizon.',
  },
  DELTA_SB_LUNE: {
    expression:
      'B_lune = f(ρ) × I*(α) × 10^(−0,4 k X(Z_lune)) × ( 1 − 10^(−0,4 k X(Z_cible)) ) · ' +
      'ΔSB_lune = 2,5 × log10( (B_ciel + B_lune) / B_ciel )',
    unite: 'mag/arcsec²',
    section: '8.1',
    note:
      'Modèle de Krisciunas & Schaefer (1991). Une nuit de Lune n’est pas perdue : elle a un ' +
      'fond de ciel plus élevé, donc des poses plus courtes et une intégration plus longue.',
  },
  // Fond de ciel peint — extension de rendu de §3.3 (T-0096)
  LUMINANCE_FOND_CIEL: {
    expression: 'Y_ecran = K_exposition × B(sb) · (R,V,B)_lin = Y_ecran × (chroma_R, chroma_V, chroma_B)',
    unite: '—',
    section: '3.3',
    note:
      'La luminance d’écran est proportionnelle à la brillance physique du ciel : une seule ' +
      'constante libre, l’exposition. Le rapport entre deux fonds de ciel n’est donc jamais ' +
      'choisi, il est celui des brillances.',
  },
  HALO_HORIZON: {
    expression:
      'vanRhijn(h) = 1 / √( 1 − (R / (R + H))² cos²h ) · ' +
      'facteur(h) = vanRhijn(h) × 10^(−0,4 k (X(h) − 1))',
    unite: '—',
    section: '3.3',
    note:
      'van Rhijn (1921) : la couche émissive est vue sous une épaisseur croissante quand la ' +
      'visée baisse. Le terme d’extinction n’est pas décoratif — van Rhijn seul donnerait ×6 ' +
      'à l’horizon, valeur non observée ; avec l’extinction, ×3,2.',
  },
  SB_EFFECTIF_RENDU: {
    expression: 'B_total = B_site × facteur(h) + B_lune(ρ, h_lune, α) · sb_effectif = B⁻¹(B_total)',
    unite: 'mag/arcsec²',
    section: '3.3',
    note:
      'Les brillances s’additionnent en nanolamberts, jamais en magnitudes : c’est déjà la ' +
      'règle de ΔSB_lune (§8.1). Le rendu réemploie ce moteur, il ne le réécrit pas.',
  },
  DUREE_NUIT_NAUTIQUE: {
    expression: 'fenetre_nautique = [ Soleil à −12° en descente ; Soleil à −12° en montée ]',
    unite: 'h',
    section: '8.1',
    note:
      'Retenue en mode dégradé quand la nuit astronomique est nulle, avec sa pénalité de fond ' +
      'de ciel chiffrée. Jamais une durée négative, jamais un plantage.',
  },

  // Créneaux et plan de session — §8.2, §8.3
  DUREE_CRENEAU: {
    expression: 'creneau = [ alt > seuil ] ∩ fenetre_utile ∩ [ alt > masque(azimut) ]',
    unite: 'min',
    section: '8.2',
    note: 'Consommée par l’objectif de qualité (§7.3) : elle décide si N_poses tient dans la nuit.',
  },
  SCORE_CIBLE: {
    expression:
      'score = w_c·S_cadrage + w_h·S_hauteur + w_s·S_signal + w_f·S_fenetre + w_l·S_lune',
    unite: '—',
    section: '8.3',
    note: 'Pondération explicite C-15, exposée et réglable. La sortie est une chronologie, pas un palmarès.',
  },
  SCORE_CADRAGE: {
    expression: 'S_cadrage = 1 − | remplissage − 0,42 | / 0,42',
    unite: '—',
    section: '8.3',
  },
  SCORE_HAUTEUR: {
    expression: 'S_hauteur = min( 1, (alt_culmination − 30) / 40 )',
    unite: '—',
    section: '8.3',
  },
  SCORE_SIGNAL: {
    expression: 'S_signal = min( 1, duree_creneau / T_requis )',
    unite: '—',
    section: '8.3',
  },
  SCORE_FENETRE: {
    expression: 'S_fenetre = duree_creneau / duree_nuit_noire',
    unite: '—',
    section: '8.3',
  },
  SCORE_LUNE: {
    expression: 'S_lune = 1 − ΔSB_lune / 3,0, borné à [0 ; 1]',
    unite: '—',
    section: '8.3',
  },
  BUDGET_NUIT: {
    expression:
      'budget = temps_capture + temps_calibration + temps_mise_en_station + temps_pointage × n_cibles',
    unite: 'min',
    section: '8.3',
    note:
      'Dépassement → retrait de la cible de plus faible score. Jamais de troncature ' +
      'silencieuse d’une intégration.',
  },

  // Cheminement et pointage — §8.4
  ANGLE_ZENITH: {
    expression: 'tan(q) = sin(H) / ( tan(φ) × cos(δ) − sin(δ) × cos(H) )',
    unite: '°',
    section: '8.4',
    note:
      'Angle de position du zénith à l’instant du pointage. Un schéma non orienté est ' +
      'inutilisable dans le noir.',
  },
  DECALAGE_POINTAGE: {
    expression: 'Δad_h = AD_cible − AD_ancrage · Δdec_deg = δ_cible − δ_ancrage',
    unite: 'h, °',
    section: '8.4',
  },
  DISTANCE_SAUT: {
    expression: 'distance_saut_deg ≤ 0,7 × FOV_chercheur_deg',
    unite: '°',
    section: '8.4',
    note: 'Recouvrement garanti entre deux vignettes successives.',
  },
  SEPARATION_ANGULAIRE: {
    expression: 'cos(d) = sin(δ₁)·sin(δ₂) + cos(δ₁)·cos(δ₂)·cos(AD₁ − AD₂)',
    unite: '°',
    section: '8.4',
  },

  // Conseil filtre et recommandation d'équipement — §7.5, §10.3
  GAIN_FILTRE: {
    expression: 'gain_snr = √( E_ciel_sans / E_ciel_avec )',
    unite: '—',
    section: '7.5',
    note:
      'Le dual-band ne transmet que Hα et OIII : il rejette l’essentiel du fond de ciel en ' +
      'conservant le signal de la nébuleuse. Jamais appliqué à un objet en spectre continu.',
  },
  TRANSMISSION_FOND_DE_CIEL: {
    expression: 'fraction_transmise = Σ bandes_passantes_nm / largeur_bande_large_nm',
    unite: '—',
    section: '7.5',
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
  MAGNITUDE_LIMITE_RENDUE: {
    expression: 'mag_rendue = min( mag_limite, m_lim_oeil )',
    unite: 'mag',
    section: '3.3',
    note:
      'Vue réaliste : le fond de ciel local plafonne la profondeur affichée. Le rendu montre ' +
      'le ciel tel qu’il serait vu, non le catalogue complet.',
  },
  PROJECTION_RADIALE: {
    expression:
      'R(θ) = 2·tan(θ/2) [stéréographique] · tan(θ) [gnomonique] · θ [équidistante] · ' +
      'x = k·R·sin(φ), y = −k·R·cos(φ), k = (largeur_px / 2) / R(fov / 2)',
    unite: 'px',
    section: '3.3',
    note:
      'Une seule implémentation : le mode ne change que la fonction radiale R. Deux bases de ' +
      'code feraient diverger le cadre du planétarium et la prévisualisation.',
  },
  PRECESSION_MATRICE: {
    expression:
      'P = R_x(−ε) · R_z(ψ) · R_x(ε), avec ψ = 50,29"/an × (époque − 2000)',
    unite: '—',
    section: '3.1',
    note:
      'Précession générale autour du pôle de l’écliptique. Ni nutation, ni termes planétaires ' +
      'du développement IAU 2006 : à l’échelle de lecture d’un planétarium, l’écart reste très ' +
      'inférieur au pixel sur le domaine des séries.',
  },
  INTERPOLATION_CORPS: {
    expression: 'pos(t) = pos(t₀) + ( pos(t₁) − pos(t₀) ) × (t − t₀) / (t₁ − t₀)',
    unite: '°',
    section: '3.1',
    note:
      'Interpolation linéaire entre deux échantillons d’éphémérides. Les étoiles ne sont ' +
      'JAMAIS interpolées : seule la matrice de rotation du ciel change.',
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
