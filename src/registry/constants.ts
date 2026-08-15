/**
 * §2.1 — Registre de constantes de référence.
 *
 * Toute valeur qui n'est pas le résultat d'une formule vient d'ici. Chaque entrée porte
 * sa valeur, son unité, sa source nommée, sa tolérance et les sections consommatrices.
 *
 * Le registre est en lecture seule à l'exécution. Il n'existe aucun mécanisme
 * d'ajustement automatique : ni apprentissage, ni retour utilisateur, ni télémétrie.
 * Une prédiction reproductible est vérifiable ; une prédiction qui dérive ne l'est pas.
 */

export interface ConstantEntry {
  /** Référence au tableau du PRD : « C-03 » pour les conventionnelles, « A-… » pour les exactes. */
  readonly ref: string
  readonly libelle: string
  readonly valeur: number
  readonly unite: string
  readonly source: string
  /** `null` pour une constante exacte, sans tolérance. */
  readonly tolerance: string | null
  /**
   * Vrai quand la tolérance est « ordre de grandeur » : toute sortie qui en dépend
   * s'affiche avec sa plage, jamais comme une valeur exacte (§2.1, dernier critère).
   */
  readonly ordreDeGrandeur: boolean
  readonly sections: readonly string[]
  /** Constante conservée pour mémoire mais qu'aucun moteur ne doit consommer. */
  readonly deprecie?: string
}

function entree(e: ConstantEntry): ConstantEntry {
  return Object.freeze(e)
}

/** Constantes astronomiques exactes — aucune tolérance. */
const EXACTES = {
  ROTATION_CIEL_DEG_H: entree({
    ref: 'A-ROT',
    libelle: 'Rotation apparente du ciel',
    valeur: 15.041,
    unite: '°/h',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.1', '9.1', '9.3'],
  }),
  JOUR_SIDERAL_S: entree({
    ref: 'A-SID',
    libelle: 'Jour sidéral',
    valeur: 86164.09,
    unite: 's',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.2'],
  }),
  JOUR_SOLAIRE_S: entree({
    ref: 'A-SOL',
    libelle: 'Jour solaire moyen',
    valeur: 86400,
    unite: 's',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.2'],
  }),
  MOIS_SYNODIQUE_J: entree({
    ref: 'A-SYN',
    libelle: 'Mois synodique',
    valeur: 29.5306,
    unite: 'j',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.2'],
  }),
  ANNEE_TROPIQUE_J: entree({
    ref: 'A-TRO',
    libelle: 'Année tropique',
    valeur: 365.2422,
    unite: 'j',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.2'],
  }),
  PRECESSION_ARCSEC_AN: entree({
    ref: 'A-PRE',
    libelle: 'Précession générale',
    valeur: 50.29,
    unite: '"/an',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.1', '3.4'],
  }),
  RADIAN_EN_ARCSEC: entree({
    ref: 'A-RAD',
    libelle: 'Radian en arcsecondes',
    valeur: 206265,
    unite: '"/rad',
    source: 'constante astronomique exacte',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['5.1'],
  }),
  DAWES_NUMERATEUR: entree({
    ref: 'A-DAW',
    libelle: 'Numérateur de la limite de Dawes',
    valeur: 116,
    unite: '"·mm',
    source: 'limite de Dawes, 116 / D(mm)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['5.1'],
  }),
  REFRACTION_HORIZON_ARCMIN: entree({
    ref: 'A-REF',
    libelle: 'Réfraction à l’horizon vrai',
    valeur: 34,
    unite: "'",
    source: 'valeur conventionnelle de la réfraction à l’horizon',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['12.4'],
  }),
  EPOQUE_FRONTIERES_IAU: entree({
    ref: 'A-B1875',
    libelle: 'Époque des frontières IAU',
    valeur: 1875.0,
    unite: 'année (B)',
    source: 'découpage de Delporte (1930), coordonnées B1875.0',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['3.4'],
  }),
  HAUTEUR_CREPUSCULE_ASTRONOMIQUE_DEG: entree({
    ref: 'A-CRE',
    libelle: 'Hauteur du Soleil définissant le crépuscule astronomique',
    valeur: -18,
    unite: '°',
    source: 'définition du crépuscule astronomique',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  HAUTEUR_CREPUSCULE_NAUTIQUE_DEG: entree({
    ref: 'A-CRN',
    libelle: 'Hauteur du Soleil définissant le crépuscule nautique',
    valeur: -12,
    unite: '°',
    source: 'définition du crépuscule nautique',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  POGSON: entree({
    ref: 'A-POG',
    libelle: 'Coefficient de l’échelle de Pogson',
    valeur: 2.5,
    unite: '—',
    source: 'définition de la magnitude',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['2.3', '6.3', '7.1', '3.3'],
  }),
  BASE_MAGNITUDE: entree({
    ref: 'A-BAS',
    libelle: 'Base de l’échelle des magnitudes',
    valeur: 10,
    unite: '—',
    source: 'définition de la magnitude — un rapport de flux de 100 pour 5 magnitudes',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['6.3', '7.1'],
  }),
  AIRE_ELLIPSE_DIAMETRES: entree({
    ref: 'A-ELL',
    libelle: 'Diviseur de l’aire d’une ellipse donnée par ses diamètres',
    valeur: 4,
    unite: '—',
    source: 'géométrie — aire = π / 4 × a × b quand a et b sont les diamètres',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['6.3'],
  }),
  MO_PAR_GO: entree({
    ref: 'A-GO',
    libelle: 'Mégaoctets par gigaoctet',
    valeur: 1024,
    unite: 'Mo/Go',
    source: 'préfixe binaire',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['7.3'],
  }),
  DEG_PAR_RADIAN_APPROX: entree({
    ref: 'A-DEP',
    libelle: 'Facteur 57,296 (deg/rad)',
    valeur: 57.296,
    unite: '°/rad',
    source: 'approximation petits angles',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['5.1'],
    deprecie:
      "Remplacée par l'arctangente (§5.1, Annexe C ligne 4) : l'approximation linéaire " +
      'donne 205,7° à 10 mm sur plein format, valeur physiquement impossible. ' +
      'Aucun moteur ne doit consommer cette entrée.',
  }),
} as const

/** Constantes conventionnelles — sourcées, avec tolérance. */
const CONVENTIONNELLES = {
  SEUIL_HAUTEUR_IMAGERIE_DEG: entree({
    ref: 'C-01',
    libelle: 'Seuil de hauteur en imagerie (masse d’air 2)',
    valeur: 30,
    unite: '°',
    source: 'convention',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['4.1', '8.2'],
  }),
  SEUIL_HAUTEUR_VISUEL_DEG: entree({
    ref: 'C-02',
    libelle: 'Seuil de hauteur en visuel',
    valeur: 20,
    unite: '°',
    source: 'convention',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['4.1', '8.2'],
  }),
  FACTEUR_POSE_C_DEFAUT: entree({
    ref: 'C-03',
    libelle: 'Facteur de pose C, mode par défaut',
    valeur: 10,
    unite: '—',
    source: 'socle',
    tolerance: 'optimum plat, voir §2.3',
    ordreDeGrandeur: false,
    sections: ['7.2'],
  }),
  FACTEUR_POSE_C_PERMISSIF: entree({
    ref: 'C-03',
    libelle: 'Facteur de pose C, mode permissif',
    valeur: 3,
    unite: '—',
    source: 'socle',
    tolerance: 'optimum plat, voir §2.3',
    ordreDeGrandeur: false,
    sections: ['7.2'],
  }),
  ECHANTILLONNAGE_NOMINAL_MIN: entree({
    ref: 'C-04',
    libelle: 'Échantillonnage nominal, borne basse',
    valeur: 1,
    unite: '"/px',
    source: 'convention',
    tolerance: 'dépend du seeing',
    ordreDeGrandeur: false,
    sections: ['5.1'],
  }),
  ECHANTILLONNAGE_NOMINAL_MAX: entree({
    ref: 'C-04',
    libelle: 'Échantillonnage nominal, borne haute',
    valeur: 2,
    unite: '"/px',
    source: 'convention',
    tolerance: 'dépend du seeing',
    ordreDeGrandeur: false,
    sections: ['5.1'],
  }),
  ECHANTILLONNAGE_SOUS_MODERE_MAX: entree({
    ref: 'C-04',
    libelle: 'Sous-échantillonnage modéré, borne haute',
    valeur: 4,
    unite: '"/px',
    source: 'convention — au-delà, la résolution est limitée par le pixel, non par l’optique',
    tolerance: 'dépend du seeing',
    ordreDeGrandeur: false,
    sections: ['5.1'],
  }),
  REMPLISSAGE_CADRE_MIN: entree({
    ref: 'C-05',
    libelle: 'Remplissage de cadre, borne basse',
    valeur: 1 / 3,
    unite: '—',
    source: 'convention',
    tolerance: 'subjectif',
    ordreDeGrandeur: false,
    sections: ['6.1', '6.2'],
  }),
  REMPLISSAGE_CADRE_MAX: entree({
    ref: 'C-05',
    libelle: 'Remplissage de cadre, borne haute',
    valeur: 1 / 2,
    unite: '—',
    source: 'convention',
    tolerance: 'subjectif',
    ordreDeGrandeur: false,
    sections: ['6.1', '6.2'],
  }),
  REMPLISSAGE_CADRE_CIBLE: entree({
    ref: 'C-05',
    libelle: 'Remplissage visé pour la focale idéale',
    valeur: 0.42,
    unite: '—',
    source: '§6.1 — milieu de la plage C-05, entre le tiers et la moitié du champ',
    tolerance: 'subjectif',
    ordreDeGrandeur: false,
    sections: ['6.1'],
  }),
  DIAMETRE_PIXELS_MIN: entree({
    ref: 'C-05',
    libelle: 'Diamètre en pixels sous lequel aucun détail n’est exploitable',
    valeur: 50,
    unite: 'px',
    source: '§6.2 — sous ce diamètre l’objet est un amas de pixels',
    tolerance: 'convention',
    ordreDeGrandeur: false,
    sections: ['6.2'],
  }),
  PUPILLE_JUMELLES_MM: entree({
    ref: 'C-11',
    libelle: 'Diamètre des jumelles de référence',
    valeur: 50,
    unite: 'mm',
    source: '§6.3 — jumelles 50 mm, matériel d’entrée le plus répandu',
    tolerance: 'convention',
    ordreDeGrandeur: false,
    sections: ['6.3'],
  }),
  READ_NOISE_DEFAUT_E: entree({
    ref: 'C-03',
    libelle: 'Bruit de lecture par défaut, boîtier inconnu',
    valeur: 3.0,
    unite: 'e⁻',
    source: '§7.2 — repli quand la base matériel ne donne pas la courbe du boîtier',
    tolerance: '[À VÉRIFIER] par boîtier ; le résultat porte [ESTIMÉ]',
    ordreDeGrandeur: false,
    sections: ['7.2'],
  }),
  INTEGRATION_PLAFOND_H: entree({
    ref: 'C-03',
    libelle: 'Plafond d’intégration affichée',
    valeur: 24,
    unite: 'h',
    source: '§7.3 — au-delà, la cible est annoncée hors de portée du setup, pas chiffrée',
    tolerance: 'convention produit',
    ordreDeGrandeur: false,
    sections: ['7.3'],
  }),
  NPF_K_STRICT: entree({
    ref: 'C-06',
    libelle: 'Tolérance NPF, mode strict',
    valeur: 1.0,
    unite: '—',
    source: 'règle NPF',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['9.1'],
  }),
  NPF_K_TOLERANT: entree({
    ref: 'C-06',
    libelle: 'Tolérance NPF, mode tolérant',
    valeur: 2.0,
    unite: '—',
    source: 'règle NPF',
    tolerance: 'jamais appliqué en silence (§2.4)',
    ordreDeGrandeur: false,
    sections: ['9.1'],
  }),
  NPF_COEF_OUVERTURE: entree({
    ref: 'C-06',
    libelle: 'Coefficient d’ouverture de la règle NPF',
    valeur: 35,
    unite: 'mm·s',
    source: 'règle NPF — t = k × (35 × N + 30 × pitch_um) / (focale_mm × cos δ)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['9.1'],
  }),
  NPF_COEF_PITCH: entree({
    ref: 'C-06',
    libelle: 'Coefficient de pitch de la règle NPF',
    valeur: 30,
    unite: 'mm·s/µm',
    source: 'règle NPF — t = k × (35 × N + 30 × pitch_um) / (focale_mm × cos δ)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['9.1'],
  }),
  PLAFOND_POSE_SANS_AUTOGUIDAGE_S: entree({
    ref: 'C-07',
    libelle: 'Plafond de pose sans autoguidage',
    valeur: 240,
    unite: 's',
    source: 'convention terrain',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['5.2', '7.2'],
  }),
  RECOUVREMENT_MOSAIQUE: entree({
    ref: 'C-08',
    libelle: 'Recouvrement de mosaïque',
    valeur: 0.15,
    unite: '—',
    source: 'convention',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['6.2'],
  }),
  INTERVALLE_INTER_POSE_FILE_MAX_S: entree({
    ref: 'C-09',
    libelle: 'Intervalle inter-pose en filé',
    valeur: 1,
    unite: 's',
    source: 'socle',
    tolerance: 'contrainte dure',
    ordreDeGrandeur: false,
    sections: ['9.4'],
  }),
  ECART_TEMPERATURE_DARKS_C: entree({
    ref: 'C-10',
    libelle: 'Écart de température toléré pour les darks',
    valeur: 3,
    unite: '°C',
    source: 'convention',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['7.4'],
  }),
  PUPILLE_OEIL_ADAPTE_MM: entree({
    ref: 'C-11',
    libelle: 'Pupille de l’œil adapté à l’obscurité',
    valeur: 6.5,
    unite: 'mm',
    source: 'convention',
    tolerance: '5 à 8 mm selon l’âge',
    ordreDeGrandeur: false,
    sections: ['6.3'],
  }),
  T_REF_SOIGNE_200MM_S: entree({
    ref: 'C-12',
    libelle: 'Pose de référence à 200 mm, mise en station soignée',
    valeur: 120,
    unite: 's',
    source: 'socle (1 à 4 min)',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['5.2', '7.2'],
  }),
  T_REF_APPROX_200MM_S: entree({
    ref: 'C-13',
    libelle: 'Pose de référence à 200 mm, mise en station approximative',
    valeur: 45,
    unite: 's',
    source: 'socle',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['5.2', '7.2'],
  }),
  FOCALE_REFERENCE_SUIVI_MM: entree({
    ref: 'C-12/C-13',
    libelle: 'Focale de référence des poses de suivi',
    valeur: 200,
    unite: 'mm',
    source: 'socle — t_max_suivi = t_ref × (200 / focale_mm)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['5.2'],
  }),
  ZP_SYS_GENERIQUE: entree({
    ref: 'C-14',
    libelle: 'Point zéro système générique',
    valeur: 20.2,
    unite: 'mag',
    source: 'dérivé, voir §2.3',
    tolerance: '± 0,5 mag',
    ordreDeGrandeur: false,
    sections: ['2.3', '7.1'],
  }),
  POIDS_SCORING_CADRAGE: entree({
    ref: 'C-15',
    libelle: 'Poids de scoring — cadrage',
    valeur: 0.25,
    unite: '—',
    source: 'convention, réglable',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  POIDS_SCORING_HAUTEUR: entree({
    ref: 'C-15',
    libelle: 'Poids de scoring — hauteur',
    valeur: 0.2,
    unite: '—',
    source: 'convention, réglable',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  POIDS_SCORING_SNR: entree({
    ref: 'C-15',
    libelle: 'Poids de scoring — rapport signal sur bruit',
    valeur: 0.3,
    unite: '—',
    source: 'convention, réglable',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  POIDS_SCORING_FENETRE: entree({
    ref: 'C-15',
    libelle: 'Poids de scoring — fenêtre d’observation',
    valeur: 0.15,
    unite: '—',
    source: 'convention, réglable',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  POIDS_SCORING_LUNE: entree({
    ref: 'C-15',
    libelle: 'Poids de scoring — Lune',
    valeur: 0.1,
    unite: '—',
    source: 'convention, réglable',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  FACTEUR_FROID_DOUX: entree({
    ref: 'C-16',
    libelle: 'Facteur de froid batterie, au-dessus de 10 °C',
    valeur: 1.0,
    unite: '—',
    source: 'convention terrain',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['9.4'],
  }),
  FACTEUR_FROID_FRAIS: entree({
    ref: 'C-16',
    libelle: 'Facteur de froid batterie, de 0 à 10 °C',
    valeur: 0.6,
    unite: '—',
    source: 'convention terrain',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['9.4'],
  }),
  HAUTEUR_MIN_MASSE_AIR_DEG: entree({
    ref: 'C-17',
    libelle: 'Hauteur sous laquelle l’approximation 1 / sin(alt) cesse d’être valide',
    valeur: 15,
    unite: '°',
    source: 'Annexe B — masse d’air valide au-dessus d’environ 15°',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['8.2'],
  }),
  FACTEUR_FROID_NEGATIF: entree({
    ref: 'C-16',
    libelle: 'Facteur de froid batterie, sous 0 °C',
    valeur: 0.4,
    unite: '—',
    source: 'convention terrain',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['9.4'],
  }),
} as const

/**
 * §8.1 — Modèle de brillance lunaire de Krisciunas & Schaefer (1991).
 *
 * Les coefficients viennent de la publication, telle que le PRD la cite. Ils sont ici
 * plutôt qu'en dur dans le moteur pour la même raison que le reste du registre : une
 * constante recopiée dans un moteur devient invérifiable.
 */
const LUNE = {
  KS_MAGNITUDE_LUNE_PLEINE: entree({
    ref: 'L-01',
    libelle: 'Magnitude de la Lune à l’opposition, modèle KS91',
    valeur: 3.84,
    unite: 'mag',
    source: 'Krisciunas & Schaefer (1991), I*(α) = 10^(−0,4 × (3,84 + 0,026 |α| + 4e−9 α⁴))',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_COEF_PHASE: entree({
    ref: 'L-01',
    libelle: 'Coefficient linéaire de l’angle de phase, modèle KS91',
    valeur: 0.026,
    unite: 'mag/°',
    source: 'Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_COEF_PHASE_4: entree({
    ref: 'L-01',
    libelle: 'Coefficient quartique de l’angle de phase, modèle KS91',
    valeur: 4e-9,
    unite: 'mag/°⁴',
    source: 'Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_RAYLEIGH_LOG: entree({
    ref: 'L-02',
    libelle: 'Amplitude de la diffusion de Rayleigh, en log₁₀',
    valeur: 5.36,
    unite: '—',
    source: 'Krisciunas & Schaefer (1991), f(ρ) = 10^5,36 × (1,06 + cos²ρ) + 10^(6,15 − ρ/40)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_RAYLEIGH_CONSTANTE: entree({
    ref: 'L-02',
    libelle: 'Terme constant de la diffusion de Rayleigh',
    valeur: 1.06,
    unite: '—',
    source: 'Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_MIE_LOG: entree({
    ref: 'L-02',
    libelle: 'Amplitude de la diffusion de Mie, en log₁₀',
    valeur: 6.15,
    unite: '—',
    source: 'Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_MIE_ECHELLE_DEG: entree({
    ref: 'L-02',
    libelle: 'Échelle angulaire de la diffusion de Mie',
    valeur: 40,
    unite: '°',
    source: 'Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  KS_MASSE_AIR_COEF: entree({
    ref: 'L-03',
    libelle: 'Coefficient de la masse d’air de Krisciunas & Schaefer',
    valeur: 0.96,
    unite: '—',
    source: 'Krisciunas & Schaefer (1991), X(Z) = (1 − 0,96 sin²Z)^(−1/2)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  EXTINCTION_V_MAG_PAR_MASSE_AIR: entree({
    ref: 'L-04',
    libelle: 'Coefficient d’extinction atmosphérique en bande V',
    valeur: 0.172,
    unite: 'mag/masse d’air',
    source: 'valeur de site de montagne retenue par Krisciunas & Schaefer (1991)',
    tolerance: 'ordre de grandeur — 0,15 à 0,30 selon la transparence du soir',
    ordreDeGrandeur: true,
    sections: ['8.1'],
  }),
  NANOLAMBERT_ECHELLE: entree({
    ref: 'L-05',
    libelle: 'Échelle de conversion brillance de surface → nanolamberts',
    valeur: 34.08,
    unite: 'nL',
    source: 'Garstang, via Krisciunas & Schaefer (1991) : B = 34,08 × exp(20,7233 − 0,92104 V)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  NANOLAMBERT_OFFSET: entree({
    ref: 'L-05',
    libelle: 'Terme constant de la conversion en nanolamberts',
    valeur: 20.7233,
    unite: '—',
    source: 'Garstang, via Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  NANOLAMBERT_PENTE: entree({
    ref: 'L-05',
    libelle: 'Pente de la conversion en nanolamberts',
    valeur: 0.92104,
    unite: '1/mag',
    source: 'Garstang, via Krisciunas & Schaefer (1991)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.1'],
  }),
  PENALITE_SB_CREPUSCULE_NAUTIQUE_MAG: entree({
    ref: 'C-18',
    libelle: 'Pénalité de fond de ciel du crépuscule nautique',
    valeur: 1.0,
    unite: 'mag/arcsec²',
    source:
      '§8.1 — mode dégradé quand la nuit astronomique est nulle : la fenêtre nautique est ' +
      'retenue et sa pénalité de fond de ciel est chiffrée plutôt que passée sous silence',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['8.1'],
  }),
} as const

/** §8.3 — plan de session ordonné : budget de nuit et scoring. */
const PLANIFICATION = {
  TEMPS_MISE_EN_STATION_MIN: entree({
    ref: 'C-19',
    libelle: 'Temps de mise en station',
    valeur: 15,
    unite: 'min',
    source: '§8.3 — « temps_mise_en_station ≈ 15 min »',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['8.3'],
  }),
  TEMPS_POINTAGE_PAR_CIBLE_MIN: entree({
    ref: 'C-19',
    libelle: 'Temps de pointage par cible, sans GoTo',
    valeur: 10,
    unite: 'min',
    source: '§8.3 et §8.4 — cheminement ou carte directe, recadrage et vérification compris',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['8.3', '8.4'],
  }),
  TOLERANCE_LUNE_DELTA_SB_MAG: entree({
    ref: 'C-15',
    libelle: 'Dégradation lunaire annulant le score de Lune',
    valeur: 3.0,
    unite: 'mag/arcsec²',
    source: '§8.3 — S_lune = 1 − ΔSB_lune / 3,0, borné à [0 ; 1]',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  ETENDUE_SCORE_HAUTEUR_DEG: entree({
    ref: 'C-15',
    libelle: 'Étendue de hauteur au-dessus du seuil saturant le score',
    valeur: 40,
    unite: '°',
    source: '§8.3 — S_hauteur = min(1, (alt_culmination − 30) / 40)',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  CIBLES_MAX_DEBUTANT: entree({
    ref: 'C-20',
    libelle: 'Nombre de cibles maximal au niveau débutant',
    valeur: 2,
    unite: '—',
    source: '§8.3 — « limité à deux cibles au maximum, avec marge de temps élargie »',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  CIBLES_CANDIDATES_MAX: entree({
    ref: 'C-20',
    libelle: 'Nombre de candidates soumises au calcul de créneau',
    valeur: 40,
    unite: '—',
    source:
      '§8.3 — borne de calcul : les candidates les plus brillantes du pré-filtrage dur sont ' +
      'seules soumises au calcul d’éphéméride, qui est le poste coûteux',
    tolerance: 'convention produit',
    ordreDeGrandeur: false,
    sections: ['8.3'],
  }),
  MARGE_NUIT_DEBUTANT: entree({
    ref: 'C-20',
    libelle: 'Part de la nuit réservée en marge au niveau débutant',
    valeur: 0.2,
    unite: '—',
    source: '§8.3 — marge de temps élargie pour un débutant',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['8.3'],
  }),
} as const

/** §8.4 — cheminement d'étoiles et carte de pointage. */
const POINTAGE = {
  FOV_SEUIL_CARTE_DIRECTE_DEG: entree({
    ref: 'C-21',
    libelle: 'Champ au-delà duquel la carte directe remplace le cheminement',
    valeur: 8,
    unite: '°',
    source: '§8.4 — au-delà, le cadre contient toujours plusieurs étoiles brillantes',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
  MAG_ANCRAGE_PRINCIPAL_MAX: entree({
    ref: 'C-21',
    libelle: 'Magnitude maximale de l’ancrage principal',
    valeur: 4.5,
    unite: 'mag',
    source: '§8.4 — fiabilité en ciel dégradé',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
  MAG_DEPART_CHEMINEMENT_MAX: entree({
    ref: 'C-21',
    libelle: 'Magnitude maximale de l’étoile de départ d’un cheminement',
    valeur: 3.5,
    unite: 'mag',
    source: '§8.4 — le point de départ doit être identifiable à l’œil nu sans hésitation',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
  MAG_SAUT_MAX: entree({
    ref: 'C-21',
    libelle: 'Magnitude maximale d’une étoile de saut',
    valeur: 6.5,
    unite: 'mag',
    source: '§8.4 — visible dans un chercheur',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
  RECOUVREMENT_SAUT: entree({
    ref: 'C-21',
    libelle: 'Fraction du champ de chercheur admise pour un saut',
    valeur: 0.7,
    unite: '—',
    source: '§8.4 — distance ≤ 0,7 × FOV_chercheur, recouvrement garanti',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
  SAUTS_MAX: entree({
    ref: 'C-21',
    libelle: 'Nombre maximal de sauts d’un cheminement',
    valeur: 5,
    unite: '—',
    source: '§8.4 — au-delà, l’app propose la contrainte à relâcher plutôt qu’un itinéraire',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['8.4'],
  }),
} as const

/** §7.5, §10.3 — conseil filtre chiffré, et §11.1 — mode nuit. */
const TERRAIN = {
  LARGEUR_BANDE_LARGE_NM: entree({
    ref: 'C-22',
    libelle: 'Largeur de bande de référence en large bande',
    valeur: 300,
    unite: 'nm',
    source:
      '§7.5 — fenêtre visible utile d’un capteur sans filtre, base du rapport de fond de ciel ' +
      'transmis par une bande étroite',
    tolerance: 'ordre de grandeur — dépend de la courbe du filtre infrarouge du boîtier',
    ordreDeGrandeur: true,
    sections: ['7.5', '10.3'],
  }),
  BORTLE_SEUIL_CONSEIL_FILTRE: entree({
    ref: 'C-22',
    libelle: 'Classe Bortle à partir de laquelle le conseil filtre se déclenche',
    valeur: 5,
    unite: '—',
    source: '§7.5 — déclenchement si SB dégradé par la Lune OU bortle ≥ 5',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['7.5', '10.3'],
  }),
  TUILES_SEUIL_FOCALE_COURTE: entree({
    ref: 'C-22',
    libelle: 'Nombre de tuiles au-delà duquel une focale plus courte est recommandée',
    valeur: 4,
    unite: '—',
    source: '§10.3 — « focale plus courte si MOSAIQUE_REQUISE et n_tuiles > 4 »',
    tolerance: null,
    ordreDeGrandeur: false,
    sections: ['10.3'],
  }),
  LUMINANCE_PLANCHER_MODE_NUIT: entree({
    ref: 'C-23',
    libelle: 'Plancher du facteur de luminance du mode nuit',
    valeur: 0.02,
    unite: '—',
    source: '§11.1 — « réglable jusqu’à un plancher de ≈ 2 % de la luminance nominale »',
    tolerance: 'ordre de grandeur',
    ordreDeGrandeur: true,
    sections: ['11.1'],
  }),
} as const

/**
 * Domaine de validité des séries analytiques (§12.4). Hors de ces bornes, les corps du
 * système solaire sont masqués avec la cause nommée, jamais extrapolés en silence.
 */
const DOMAINE = {
  ANNEE_MIN_SERIES: entree({
    ref: 'D-MIN',
    libelle: 'Première année du domaine de validité des séries',
    valeur: 1700,
    unite: 'année',
    source: 'astronomy-engine — plage sur laquelle la bibliothèque est validée',
    tolerance: '[À VÉRIFIER] contre la documentation amont à chaque montée de version',
    ordreDeGrandeur: false,
    sections: ['3.1', '12.4'],
  }),
  ANNEE_MAX_SERIES: entree({
    ref: 'D-MAX',
    libelle: 'Dernière année du domaine de validité des séries',
    valeur: 2200,
    unite: 'année',
    source: 'astronomy-engine — plage sur laquelle la bibliothèque est validée',
    tolerance: '[À VÉRIFIER] contre la documentation amont à chaque montée de version',
    ordreDeGrandeur: false,
    sections: ['3.1', '12.4'],
  }),
} as const

/** Le registre complet, gelé. Aucun ajustement à l'exécution (§2.1). */
export const REGISTRE = Object.freeze({
  ...EXACTES,
  ...CONVENTIONNELLES,
  ...LUNE,
  ...PLANIFICATION,
  ...POINTAGE,
  ...TERRAIN,
  ...DOMAINE,
})

export type ConstantId = keyof typeof REGISTRE

/**
 * Lecture de la valeur d'une constante. Passer par cette fonction plutôt que par
 * `REGISTRE.X.valeur` garde le point de consommation traçable et refuse les entrées
 * dépréciées.
 */
export function K(id: ConstantId): number {
  const entree = REGISTRE[id]
  if (entree.deprecie !== undefined) {
    throw new Error(`Constante ${id} dépréciée et non consommable : ${entree.deprecie}`)
  }
  return entree.valeur
}

/** Référence citable dans un résultat tracé (§10.2). */
export interface ConstantRef {
  readonly id: ConstantId
  readonly ref: string
  readonly libelle: string
  readonly valeur: number
  readonly unite: string
  readonly source: string
  readonly tolerance: string | null
  readonly ordreDeGrandeur: boolean
}

export function ref(id: ConstantId): ConstantRef {
  const { ref, libelle, valeur, unite, source, tolerance, ordreDeGrandeur } = REGISTRE[id]
  return { id, ref, libelle, valeur, unite, source, tolerance, ordreDeGrandeur }
}
