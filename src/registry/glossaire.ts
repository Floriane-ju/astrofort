/**
 * §10.1 — Glossaire contextuel.
 *
 * Le glossaire est indexé sur l'INTERFACE, pas sur un lexique : un terme n'y entre que s'il
 * apparaît dans une sortie de moteur, et aucun terme affiché ne peut en être absent.
 *
 * Cette seconde moitié de la règle est tenue par le typage plutôt que par une convention :
 * l'interface ne rend jamais un libellé littéral, elle rend une clé de ce fichier. Un terme
 * ajouté à l'écran sans définition ne compile pas, et le compilateur nomme la clé manquante.
 * C'est ce qui empêche la dérive documentaire.
 *
 * Le glossaire s'étend lot par lot, avec les moteurs qui produisent les termes. Les entrées
 * présentes ici sont celles du contrat d'entrée : §4 lieu, §5.1 optique, §5.2 suivi.
 */

export interface EntreeGlossaire {
  /** Libellé affiché dans l'interface. C'est lui qui est rendu, jamais une chaîne littérale. */
  readonly libelle: string
  /** Glose courte, cinq mots, visible au survol. */
  readonly glose: string
  /** Deux à quatre phrases, au clic. */
  readonly explication: string
  /** Ce que ça change pour l'utilisateur, en une phrase actionnable. */
  readonly consequence: string
  readonly sections: readonly string[]
}

function terme(e: EntreeGlossaire): EntreeGlossaire {
  return Object.freeze(e)
}

export const GLOSSAIRE = Object.freeze({
  // §4.1 — profil Lieu
  latitude: terme({
    libelle: 'Latitude',
    glose: 'position nord-sud du site',
    explication:
      'La latitude fixe quelle portion du ciel est atteignable depuis ce site. Elle décide ' +
      'de la hauteur maximale de chaque cible et de la limite australe au-delà de laquelle ' +
      'plus rien ne se lève assez haut. C’est la donnée la plus structurante du profil de lieu.',
    consequence:
      'Une erreur d’un degré déplace de la même valeur tous les seuils de déclinaison du site.',
    sections: ['4.1'],
  }),
  longitude: terme({
    libelle: 'Longitude',
    glose: 'position est-ouest du site',
    explication:
      'La longitude ne change pas ce qui est visible, mais quand ça l’est. Elle produit le ' +
      'décalage entre l’heure légale et le vrai midi solaire du lieu.',
    consequence: 'Elle décale le milieu de nuit vrai, sur lequel se centrent tous les créneaux.',
    sections: ['4.1'],
  }),
  altitude_site: terme({
    libelle: 'Altitude du site',
    glose: 'hauteur du lieu d’observation',
    explication:
      'L’altitude influe marginalement sur la réfraction et sur l’extinction atmosphérique. ' +
      'Elle n’est pas critique pour la planification. Une valeur approchée suffit.',
    consequence: 'Une centaine de mètres d’écart ne change aucune recommandation.',
    sections: ['4.1'],
  }),
  midi_solaire_vrai: terme({
    libelle: 'Décalage du midi solaire vrai',
    glose: 'écart au midi légal',
    explication:
      'Le Soleil ne culmine pas à midi pile, ni le milieu de nuit à minuit. L’écart vient de ' +
      'la longitude du lieu et du fuseau horaire qui lui a été attribué. L’application centre ' +
      'ses créneaux sur le milieu de nuit vrai, jamais sur l’heure ronde.',
    consequence:
      'Viser minuit légal plutôt que le milieu de nuit vrai décale la meilleure fenêtre.',
    sections: ['4.1', '8.1'],
  }),
  masque_horizon: terme({
    libelle: 'Masque d’horizon',
    glose: 'relief qui bouche l’horizon',
    explication:
      'Le masque donne, pour chaque azimut, la hauteur sous laquelle le ciel est caché par le ' +
      'relief, les arbres ou les bâtiments. Sans lui, une cible annoncée visible peut se ' +
      'trouver derrière une crête toute la nuit. Faute de donnée de relief, un horizon plat ' +
      'est supposé et signalé comme tel.',
    consequence:
      'Sur un site encaissé, compléter le masque évite des recommandations inatteignables.',
    sections: ['4.1', '8.1'],
  }),
  hypothese: terme({
    libelle: 'Hypothèse [HYP]',
    glose: 'valeur supposée, non mesurée',
    explication:
      'Une valeur marquée [HYP] comble une donnée absente par une hypothèse par défaut. Elle ' +
      'est affichée comme telle pour qu’aucune sortie qui en dépend ne passe pour une mesure.',
    consequence: 'Remplacer une hypothèse par une donnée réelle affine tout ce qui en découle.',
    sections: ['4.1', '2.3'],
  }),
  declinaison: terme({
    libelle: 'Déclinaison',
    glose: 'latitude céleste d’un objet',
    explication:
      'La déclinaison est l’équivalent céleste de la latitude, comptée depuis l’équateur du ' +
      'ciel. Combinée à celle du site, elle décide de la hauteur atteinte par une cible et de ' +
      'la durée pendant laquelle elle est exploitable.',
    consequence:
      'Comparer une déclinaison aux seuils du site dit tout de suite si la cible est jouable.',
    sections: ['4.1', '8.2'],
  }),
  circumpolaire: terme({
    libelle: 'Circumpolaire',
    glose: 'objet ne se couchant jamais',
    explication:
      'Au-delà d’une certaine déclinaison, un objet tourne autour du pôle sans jamais passer ' +
      'sous l’horizon. Il est alors disponible toute la nuit, à une hauteur qui varie mais ne ' +
      's’annule pas.',
    consequence: 'Une cible circumpolaire tolère une séance longue, sans fenêtre à respecter.',
    sections: ['4.1', '8.2'],
  }),
  seuil_imagerie: terme({
    libelle: 'Imagerie impossible sous δ',
    glose: 'limite australe en imagerie',
    explication:
      'Sous cette déclinaison, une cible ne dépasse jamais trente degrés de hauteur depuis ce ' +
      'site, soit deux masses d’air. La turbulence et l’extinction y annulent le bénéfice de ' +
      'toute pose supplémentaire.',
    consequence:
      'Les cibles sous ce seuil sont hors de portée d’ici, quelle que soit la durée investie.',
    sections: ['4.1'],
  }),
  seuil_visuel: terme({
    libelle: 'Visuel impossible sous δ',
    glose: 'limite australe en visuel',
    explication:
      'Le seuil visuel est plus permissif que le seuil d’imagerie, car l’œil se contente de ' +
      'vingt degrés de hauteur. En dessous, la cible reste hors de portée depuis ce site.',
    consequence: 'Entre les deux seuils, l’observation reste possible mais pas la capture.',
    sections: ['4.1'],
  }),
  fond_de_ciel: terme({
    libelle: 'Fond de ciel',
    glose: 'luminosité propre du ciel',
    explication:
      'Le fond de ciel est la lumière qu’émet le ciel lui-même, pollution lumineuse comprise. ' +
      'Il se mesure en magnitude par seconde d’arc au carré, et une valeur plus grande ' +
      'signifie un ciel plus sombre. C’est lui qui fixe le contraste disponible sur toute ' +
      'cible étendue.',
    consequence: 'Un fond de ciel plus sombre réduit directement le temps d’intégration requis.',
    sections: ['2.2', '4.1'],
  }),
  bortle: terme({
    libelle: 'Bortle',
    glose: 'échelle de pollution lumineuse',
    explication:
      'L’échelle de Bortle classe un ciel de un, désertique, à neuf, centre-ville. Elle sert ' +
      'd’estimation quand aucune mesure n’est disponible. La table du registre la convertit ' +
      'en brillance de fond de ciel, sans jamais extrapoler hors de ses bornes.',
    consequence: 'Un Bortle déclaré à la louche suffit à cadrer l’ordre de grandeur du site.',
    sections: ['2.2', '4.1'],
  }),
  sqm: terme({
    libelle: 'SQM mesuré',
    glose: 'mesure directe du ciel',
    explication:
      'Un sky quality meter mesure la brillance réelle du fond de ciel au moment et à ' +
      'l’endroit de l’observation. Une mesure prévaut toujours sur une estimation, quelle que ' +
      'soit la source de cette dernière.',
    consequence: 'Renseigner un SQM remplace l’estimation Bortle pour tous les calculs suivants.',
    sections: ['2.2', '4.1'],
  }),
  magnitude_limite_oeil: terme({
    libelle: 'Magnitude limite à l’œil nu',
    glose: 'étoile la plus faible visible',
    explication:
      'C’est la magnitude de la plus faible étoile perceptible à l’œil nu sous ce ciel, une ' +
      'fois la vision adaptée à l’obscurité. Elle découle de la brillance du fond de ciel.',
    consequence: 'Elle sert de repère de terrain pour vérifier le fond de ciel supposé du site.',
    sections: ['2.2', '4.1'],
  }),

  // §5.1 — profil optique et capteur
  focale: terme({
    libelle: 'Focale',
    glose: 'longueur focale de l’objectif',
    explication:
      'La focale détermine à la fois le champ couvert et l’échelle de l’image. Elle entre dans ' +
      'presque toutes les grandeurs dérivées du profil matériel.',
    consequence: 'Doubler la focale divise par deux le champ et l’échantillonnage angulaire.',
    sections: ['5.1'],
  }),
  ouverture: terme({
    libelle: 'Ouverture',
    glose: 'rapport focale sur diamètre',
    explication:
      'Le nombre f est le rapport entre la focale et le diamètre de la pupille d’entrée. Plus ' +
      'il est petit, plus le flux collecté par pixel est élevé. Il pilote le temps de pose ' +
      'utile autant que la profondeur atteinte.',
    consequence: 'Ouvrir d’un cran double le flux reçu, donc réduit de moitié le temps requis.',
    sections: ['5.1', '7.1'],
  }),
  champ: terme({
    libelle: 'Champ',
    glose: 'portion de ciel cadrée',
    explication:
      'Le champ est l’angle couvert par le capteur, calculé par l’arctangente du rapport entre ' +
      'la dimension du capteur et la focale. L’approximation linéaire souvent citée devient ' +
      'fausse en grand angle, où elle produit des valeurs supérieures à cent quatre-vingts ' +
      'degrés. L’arctangente est donc employée partout, sans exception.',
    consequence: 'Comparer le champ à la taille d’une cible dit immédiatement si elle tient.',
    sections: ['5.1', '6.2'],
  }),
  pitch: terme({
    libelle: 'Pitch',
    glose: 'taille d’un photosite',
    explication:
      'Le pitch est la distance entre deux pixels voisins du capteur. Il fixe l’échantillonnage ' +
      'et entre dans la pose maximale sans suivi. Un recadrage de capteur ne le change jamais.',
    consequence:
      'Le pitch se lit dans la base matériel ; pour un boîtier absent, il se saisit une fois ' +
      'avec les dimensions du capteur, et ne se règle jamais au moment de la prise.',
    sections: ['5.1'],
  }),
  echantillonnage: terme({
    libelle: 'Échantillonnage',
    glose: 'ciel couvert par pixel',
    explication:
      'L’échantillonnage dit combien de secondes d’arc de ciel tombent sur un pixel. Sous une ' +
      'seconde, on enregistre surtout du bruit ; au-delà de quatre, la résolution est limitée ' +
      'par le pixel et non par l’optique. Ce dernier régime est le régime normal du grand ' +
      'champ, pas un défaut.',
    consequence: 'Il fixe la taille en pixels de toute cible, et donc ce qui est cadrable.',
    sections: ['5.1', '6.2'],
  }),
  diametre_pupille: terme({
    libelle: 'Diamètre de pupille',
    glose: 'ouverture réelle de l’objectif',
    explication:
      'C’est le diamètre physique du faisceau entrant, égal à la focale divisée par le nombre ' +
      'f. Il commande la quantité de lumière collectée et le pouvoir séparateur théorique.',
    consequence: 'À focale égale, un plus grand diamètre gagne à la fois en flux et en finesse.',
    sections: ['5.1', '6.3'],
  }),
  pouvoir_separateur: terme({
    libelle: 'Pouvoir séparateur',
    glose: 'plus petit détail séparable',
    explication:
      'La limite de Dawes donne l’écart angulaire minimal entre deux étoiles encore ' +
      'distinguables, à partir du seul diamètre de la pupille. C’est une limite optique ' +
      'théorique, souvent hors d’atteinte car la turbulence ou l’échantillonnage limitent avant.',
    consequence:
      'Comparé à l’échantillonnage, il dit lequel des deux limite réellement l’image.',
    sections: ['5.1'],
  }),
  recadrage_capteur: terme({
    libelle: 'Recadrage capteur',
    glose: 'utiliser une portion du capteur',
    explication:
      'Le recadrage n’utilise qu’une partie centrale du capteur. Il réduit le champ et rien ' +
      'd’autre : le pitch ne bouge pas, donc ni l’échantillonnage, ni la pose maximale, ni le ' +
      'pouvoir séparateur. Le capteur jette des pixels sur les bords, il n’en ajoute aucun au ' +
      'centre.',
    consequence: 'Passer en recadrage ne rapproche de rien, cela cadre seulement plus serré.',
    sections: ['5.1'],
  }),
  plein_format: terme({
    libelle: 'Plein format',
    glose: 'capteur au format argentique',
    explication:
      'Le plein format désigne un capteur de vingt-quatre sur trente-six millimètres, hérité du ' +
      'film. Il sert de référence pour comparer les champs entre matériels différents.',
    consequence: 'Toute focale équivalente citée ailleurs se rapporte à ce format.',
    sections: ['5.1'],
  }),
  type_objectif: terme({
    libelle: 'Type d’objectif',
    glose: 'rectilinéaire ou fisheye',
    explication:
      'Un objectif rectilinéaire conserve les lignes droites, un fisheye les courbe pour ' +
      'englober bien plus de ciel. À focale identique, les deux ne couvrent pas le même champ ' +
      'et ne se projettent pas de la même façon.',
    consequence: 'Le type choisi change le rendu du cadre et la superposition sur le ciel.',
    sections: ['5.1', '3.3'],
  }),
  point_zero_systeme: terme({
    libelle: 'Point zéro système',
    glose: 'sensibilité globale de la chaîne',
    explication:
      'Le point zéro système résume en une magnitude le rendement complet de la chaîne ' +
      'optique et électronique. Il permet de convertir une brillance de ciel en flux ' +
      'd’électrons par pixel et par seconde. Faute de valeur mesurée pour le boîtier, une ' +
      'valeur générique est appliquée et affichée comme estimée.',
    consequence: 'Une erreur d’un facteur deux dessus coûte peu, car l’optimum de pose est plat.',
    sections: ['2.3', '5.1'],
  }),

  // §5.2 — profil Suivi
  suivi: terme({
    libelle: 'Suivi',
    glose: 'monture compensant la rotation',
    explication:
      'Une monture qui suit compense la rotation de la Terre et permet des poses bien plus ' +
      'longues que la pose maximale à étoiles ponctuelles. Sans elle, le domaine du ciel ' +
      'profond reste fermé et seul le grand champ est exploitable.',
    consequence: 'Activer le suivi ouvre les cibles faibles, hors de portée en pose courte.',
    sections: ['5.2'],
  }),
  mise_en_station: terme({
    libelle: 'Mise en station',
    glose: 'alignement sur l’axe polaire',
    explication:
      'La mise en station aligne l’axe de rotation de la monture sur celui du ciel. Faite à la ' +
      'boussole, elle tient des poses courtes ; faite au viseur polaire réglé, elle en tient ' +
      'plusieurs fois plus. C’est la seule question posée à l’utilisateur, et « je ne sais ' +
      'pas » vaut réponse approximative.',
    consequence: 'Soigner la mise en station est le levier le moins cher pour allonger la pose.',
    sections: ['5.2'],
  }),
  type_monture: terme({
    libelle: 'Type de monture',
    glose: 'équatoriale, rotule ou altazimutale',
    explication:
      'Une équatoriale allemande impose un retournement au passage du méridien, une monture ' +
      'sur rotule non. Une altazimutale fait tourner le champ pendant la pose, phénomène non ' +
      'traité dans cette version.',
    consequence: 'Le type déclaré décide du retournement à prévoir et des domaines ouverts.',
    sections: ['5.2', '8.2'],
  }),
  pose_max_suivi: terme({
    libelle: 'Pose maximale avec suivi',
    glose: 'plafond imposé par la monture',
    explication:
      'La pose de suivi dépend de la qualité de la mise en station et de la focale employée, ' +
      'car l’erreur de suivi se mesure en secondes d’arc. Elle est plafonnée sans autoguidage. ' +
      'Les valeurs de référence sont des ordres de grandeur de terrain, affichés en plage.',
    consequence: 'Elle borne la pose unitaire retenue, même quand l’optimum calculé est plus long.',
    sections: ['5.2', '7.2'],
  }),
  npf: terme({
    libelle: 'Pose maximale sans suivi',
    glose: 'pose gardant les étoiles ponctuelles',
    explication:
      'La règle NPF donne la pose la plus longue avant que la rotation du ciel n’allonge les ' +
      'étoiles en traits, à partir de l’ouverture, du pitch et de la focale. Elle dépend de la ' +
      'déclinaison visée : il n’existe pas une pose maximale, mais une par région du ciel. ' +
      'Près du pôle, les poses tolérées deviennent très longues.',
    consequence: 'Sans suivi, c’est elle qui borne la pose, et donc la profondeur atteignable.',
    sections: ['9.1'],
  }),
  rotation_de_champ: terme({
    libelle: 'Rotation de champ',
    glose: 'champ pivotant pendant la pose',
    explication:
      'Sur une monture altazimutale, le champ tourne lentement autour du centre visé pendant ' +
      'la pose. Les étoiles décrivent alors des arcs même avec un suivi parfait. Le phénomène ' +
      'n’est pas modélisé dans cette version.',
    consequence:
      'Avec ce type de monture, aucune pose unitaire n’est chiffrée pour le ciel profond.',
    sections: ['5.2'],
  }),
  // §6.1, §6.2 — cadrage
  domaine_cadrage: terme({
    libelle: 'Domaine de cadrage',
    glose: 'famille d’objets cadrables',
    explication:
      'Le domaine dit quelle famille d’objets ce matériel cadre proprement : longue focale, ' +
      'classique, grand champ ou très grand champ. Il se déduit du champ, sans rien demander ' +
      'd’autre. C’est le matériel qui choisit les cibles, pas l’inverse.',
    consequence: 'Chercher hors de son domaine mène à des cibles trop petites ou débordantes.',
    sections: ['6.1'],
  }),
  fenetre_cadrage: terme({
    libelle: 'Fenêtre de cadrage',
    glose: 'tailles bien cadrées ici',
    explication:
      'Un cadrage propre veut que l’objet occupe du tiers à la moitié de la petite dimension ' +
      'du champ. La fenêtre traduit cette règle en tailles angulaires réelles pour ce setup. ' +
      'C’est la contrainte sur la petite dimension qui décide : c’est elle qui limite.',
    consequence: 'Toute cible hors de cette fenêtre demande une autre focale, pas un recadrage.',
    sections: ['6.1'],
  }),
  remplissage: terme({
    libelle: 'Remplissage du champ',
    glose: 'part du champ occupée',
    explication:
      'Le remplissage est le rapport entre le grand axe de la cible et la petite dimension du ' +
      'champ. Au-delà de un, la cible déborde et demande une mosaïque ; très en dessous, elle ' +
      'se perd dans l’image.',
    consequence: 'Il classe la cible en six verdicts, de la mosaïque au hors-domaine.',
    sections: ['6.2'],
  }),
  diametre_pixels: terme({
    libelle: 'Diamètre en pixels',
    glose: 'taille de l’objet en pixels',
    explication:
      'C’est la taille de la cible sur le capteur, en pixels, une fois l’échantillonnage ' +
      'appliqué. Sous une cinquantaine de pixels, l’objet est un amas de pixels sans détail ' +
      'exploitable, quelle que soit la durée d’intégration. Recadrer au traitement n’y change ' +
      'rien : cela n’ajoute aucun pixel.',
    consequence: 'C’est ce diamètre, pas la magnitude, qui décide si une cible mérite la sortie.',
    sections: ['6.2'],
  }),
  focale_ideale: terme({
    libelle: 'Focale nécessaire',
    glose: 'focale pour cadrer proprement',
    explication:
      'Quand une cible est trop petite pour ce setup, l’application indique la focale qui la ' +
      'cadrerait dans la fenêtre visée. La valeur vise le milieu de la fenêtre ; la plage en ' +
      'couvre les deux bornes.',
    consequence: 'Elle chiffre l’écart au matériel actuel, au lieu d’annoncer un refus sec.',
    sections: ['6.1'],
  }),
  mosaique: terme({
    libelle: 'Mosaïque',
    glose: 'cible débordant du champ',
    explication:
      'Une cible qui déborde du champ s’assemble en tuiles se recouvrant partiellement. Le ' +
      'nombre de tuiles multiplie d’autant le temps total de session, calibration comprise.',
    consequence: 'Une mosaïque de quatre tuiles demande quatre sessions, pas une session longue.',
    sections: ['6.2'],
  }),

  // §6.3 — détectabilité
  magnitude_integree: terme({
    libelle: 'Magnitude intégrée',
    glose: 'éclat total de l’objet',
    explication:
      'La magnitude intégrée additionne toute la lumière de l’objet comme s’il était ponctuel. ' +
      'Pour un objet étendu, elle ment : M33, de magnitude 5,7, est bien plus difficile que ' +
      'M57, de magnitude 8,8, parce que sa lumière est étalée sur mille fois plus de surface.',
    consequence: 'Ne jamais juger la visibilité d’un objet étendu sur sa seule magnitude.',
    sections: ['6.3'],
  }),
  brillance_surface: terme({
    libelle: 'Brillance de surface',
    glose: 'éclat par seconde d’arc carrée',
    explication:
      'La brillance de surface répartit la lumière de l’objet sur sa surface apparente. C’est ' +
      'elle, et non la magnitude, qui se compare au fond de ciel. Une valeur plus grande ' +
      'signifie un objet plus faible.',
    consequence: 'Comparée au fond de ciel, elle décide de tout : visuel, filtre, durée.',
    sections: ['6.3'],
  }),
  contraste_ciel: terme({
    libelle: 'Contraste sur le fond de ciel',
    glose: 'écart objet moins ciel',
    explication:
      'Le contraste est l’écart entre la brillance du fond de ciel et celle de l’objet. ' +
      'Positif, l’objet est plus brillant que le ciel par seconde d’arc carrée ; négatif, il ' +
      'est plus faible, et seule l’intégration le fera sortir.',
    consequence: 'Un contraste négatif n’interdit pas la photo, il en fixe la durée.',
    sections: ['6.3'],
  }),
  verdict_detectabilite: terme({
    libelle: 'Verdict de détectabilité',
    glose: 'œil, jumelles, télescope, photo',
    explication:
      'Les quatre verdicts sont évalués dans l’ordre et le premier satisfait gagne. Un ' +
      'instrument n’augmente jamais la brillance de surface : il agrandit l’objet, et c’est ' +
      'l’agrandissement qui abaisse le seuil de détection. Photo seulement n’est pas un refus, ' +
      'c’est une durée d’intégration.',
    consequence: 'Le verdict dit avec quoi sortir ce soir, pas si la cible est « bonne ».',
    sections: ['6.3'],
  }),
  tolerance_lune: terme({
    libelle: 'Tolérance à la Lune',
    glose: 'sensibilité au clair de Lune',
    explication:
      'Elle découle du type d’objet. Une nébuleuse en émission tolère la Lune avec un filtre ' +
      'bi-bande ; une galaxie exige un ciel noir et la Lune couchée, aucun filtre n’y aide. ' +
      'Une Lune sous l’horizon n’entre pas dans le calcul.',
    consequence: 'Elle réordonne les cibles d’une nuit selon la phase lunaire, sans en exclure.',
    sections: ['6.3'],
  }),
  magnitude_limite_instrument: terme({
    libelle: 'Magnitude limite de l’instrument',
    glose: 'étoile la plus faible atteinte',
    explication:
      'Le gain d’un instrument sur l’œil nu ne dépend que du rapport des diamètres collecteurs. ' +
      'Il déplace la limite sur les objets ponctuels ; sur les objets étendus, il ne fait rien ' +
      'd’autre qu’agrandir.',
    consequence: 'Elle tranche pour les étoiles et les amas, jamais seule pour les nébuleuses.',
    sections: ['6.3'],
  }),

  // §7 — moteur Pose
  flux_ciel: terme({
    libelle: 'Flux du fond de ciel',
    glose: 'électrons par seconde et pixel',
    explication:
      'Le flux du fond de ciel par pixel ne dépend pas du diamètre de l’instrument : il dépend ' +
      'du rapport d’ouverture et de la taille des pixels. Deux setups de même ouverture et même ' +
      'pitch collectent le même fond de ciel, quel que soit leur diamètre.',
    consequence: 'C’est lui qui fixe la pose optimale : plus il est fort, plus la pose est courte.',
    sections: ['7.1'],
  }),
  flux_objet: terme({
    libelle: 'Flux de l’objet',
    glose: 'signal utile par pixel',
    explication:
      'Même conversion que pour le fond de ciel, appliquée à la brillance de surface de la ' +
      'cible. C’est le signal utile, celui dont dépend directement la durée totale requise.',
    consequence: 'Diviser ce flux par deux quadruple le temps nécessaire à qualité égale.',
    sections: ['7.1'],
  }),
  pose_unitaire: terme({
    libelle: 'Pose unitaire',
    glose: 'durée d’une image',
    explication:
      'La pose unitaire noie le bruit de lecture sous le bruit de photons du ciel. Elle est ' +
      'plafonnée par ce que la monture sait suivre. Un ciel plus sombre exige des poses PLUS ' +
      'LONGUES, pas plus courtes : c’est l’inverse de l’intuition.',
    consequence: 'C’est la réponse chiffrée au « je pose combien de secondes » du débutant.',
    sections: ['7.2'],
  }),
  plage_utile: terme({
    libelle: 'Plage utile de pose',
    glose: 'durées équivalentes en pratique',
    explication:
      'L’optimum de pose est plat : de la moitié au double de la valeur retenue, le résultat est ' +
      'équivalent. C’est cette platitude qui rend toute calibration du matériel inutile — et il ' +
      'n’en existe aucune dans l’application.',
    consequence: 'Choisir la durée d’obturateur la plus pratique dans la plage ne coûte rien.',
    sections: ['2.3', '7.2'],
  }),
  regime_pose: terme({
    libelle: 'Régime de pose',
    glose: 'physique ou monture limitante',
    explication:
      'En régime nominal, la physique décide et poser plus longtemps n’apporte rien. En régime ' +
      'limité par le suivi, c’est la monture qui bride : le bruit de lecture domine, et la perte ' +
      'de rapport signal sur bruit est chiffrée.',
    consequence: 'En régime bridé, soigner la mise en station rapporte plus que tout achat.',
    sections: ['7.2'],
  }),
  iso_recommande: terme({
    libelle: 'ISO recommandé',
    glose: 'palier du double gain',
    explication:
      'Les capteurs à double gain de conversion voient leur bruit de lecture chuter d’un coup ' +
      'au-delà d’un seuil d’ISO. Comme la pose optimale varie comme le carré de ce bruit, ' +
      'franchir le seuil divise la pose par plusieurs. Monter au-delà ne gagne plus rien et ' +
      'sacrifie la dynamique.',
    consequence:
      'Régler l’ISO sur ce palier une fois pour toutes, sachant qu’en changer sans courbe de ' +
      'bruit à cet ISO fait appliquer le repli du registre et porter [ESTIMÉ] à la pose.',
    sections: ['7.2'],
  }),
  snr_cible: terme({
    libelle: 'Qualité visée',
    glose: 'rapport signal sur bruit voulu',
    explication:
      'La qualité visée se choisit avant de calculer une durée : aperçu, correct, bon ou ' +
      'excellent. Le rapport signal sur bruit croît comme la racine du temps, donc doubler la ' +
      'qualité quadruple la durée.',
    consequence: 'Viser « correct » puis rallonger une autre nuit coûte moins qu’un abandon.',
    sections: ['7.3'],
  }),
  integration_totale: terme({
    libelle: 'Intégration totale',
    glose: 'durée cumulée sur la cible',
    explication:
      'C’est le temps cumulé de toutes les poses sur une cible, pour atteindre la qualité visée. ' +
      'Il se répartit sur autant de nuits que nécessaire, la seule contrainte étant de garder ' +
      'des darks à température comparable.',
    consequence: 'Elle dit si la cible tient dans une nuit, ou s’il faut planifier une série.',
    sections: ['7.3'],
  }),
  nombre_poses: terme({
    libelle: 'Nombre de poses',
    glose: 'combien d’images empiler',
    explication:
      'Le nombre de poses est l’intégration totale divisée par la pose unitaire, arrondi au ' +
      'supérieur. C’est aussi lui qui fixe le volume de carte mémoire à emporter.',
    consequence: 'Il se vérifie avant la sortie : une carte pleine à trois heures du matin est perdue.',
    sections: ['7.3'],
  }),
  volume_stockage: terme({
    libelle: 'Volume de stockage',
    glose: 'place occupée sur la carte',
    explication:
      'Le volume est le nombre de poses multiplié par la taille d’un fichier brut. Une seule ' +
      'cible exigeante peut saturer une carte de 32 Go, et une session de trois cibles y arrive ' +
      'presque toujours.',
    consequence: 'C’est une contrainte bloquante en pratique, annoncée avant la sortie.',
    sections: ['7.3'],
  }),
  nombre_nuits: terme({
    libelle: 'Nombre de nuits',
    glose: 'sessions nécessaires à la cible',
    explication:
      'Quand l’intégration dépasse le créneau exploitable d’une nuit, la capture se répartit ' +
      'sur plusieurs sorties. L’empilement multi-nuits impose alors des darks pris à ' +
      'température comparable.',
    consequence: 'Il transforme une cible « impossible » en une série de sessions ordinaires.',
    sections: ['7.3'],
  }),
  plan_calibration: terme({
    libelle: 'Plan de calibration',
    glose: 'images de correction à prendre',
    explication:
      'Offsets, darks et flats corrigent trois défauts différents du capteur et de l’optique. ' +
      'L’ordre d’importance affiché n’est pas alphabétique : à grande ouverture, les flats ' +
      'passent avant tout, car le vignettage atteint un à deux diaphragmes dans les coins.',
    consequence: 'C’est l’étape oubliée qui ruine le plus de sessions, budget de temps compris.',
    sections: ['7.4'],
  }),
  dithering: terme({
    libelle: 'Dithering',
    glose: 'décalage aléatoire entre poses',
    explication:
      'Le dithering décale l’image de quelques pixels entre les poses. Il supprime le bruit à ' +
      'motif fixe et les colonnes chaudes que les darks laissent passer. Sans autoguidage, la ' +
      'dérive naturelle du suivi le fournit gratuitement.',
    consequence: 'Il coûte zéro minute de session et rattrape ce qu’aucun dark ne corrige.',
    sections: ['7.4'],
  }),

  // §10.2 — explication de verdict
  facteur_dominant: terme({
    libelle: 'Facteur dominant',
    glose: 'variable qui décide du verdict',
    explication:
      'Le facteur dominant est calculé, pas rédigé : c’est la variable dont une petite ' +
      'variation change le plus le résultat. Deux variables de sensibilité voisine sont ' +
      'présentées ensemble plutôt que départagées arbitrairement.',
    consequence: 'Il désigne où agir en premier, et rend l’explication impossible à diverger du calcul.',
    sections: ['10.2'],
  }),
  levier: terme({
    libelle: 'Levier',
    glose: 'action qui déplace le verdict',
    explication:
      'Les leviers sont classés par coût croissant : changer de cible, attendre un meilleur ' +
      'créneau, gagner un site plus sombre, intégrer plus longtemps, et seulement ensuite un ' +
      'achat. L’application ne recommande jamais un achat en premier.',
    consequence: 'Le premier levier proposé est toujours gratuit ou presque.',
    sections: ['10.2'],
  }),

  // §8.1 — fenêtre nocturne et Lune
  nuit_astronomique: terme({
    libelle: 'Nuit astronomique',
    glose: 'Soleil sous −18°',
    explication:
      'La nuit astronomique commence quand le Soleil descend sous 18° sous l’horizon : au-delà, ' +
      'sa lumière diffusée ne contribue plus au fond de ciel. C’est la fenêtre de référence de ' +
      'toute planification. À nos latitudes, elle fond de 11 h 43 en décembre à 2 h 35 en juin.',
    consequence:
      'Le budget d’une nuit d’été n’est pas celui d’une nuit d’hiver : le plan raisonne en ' +
      'temps disponible, pas en faisabilité binaire.',
    sections: ['8.1'],
  }),
  fenetre_utile: terme({
    libelle: 'Fenêtre utile',
    glose: 'nuit noire sans la Lune',
    explication:
      'La part de la nuit où la Lune est sous l’horizon. Une Lune couchée ne dégrade rien, ' +
      'quelle que soit sa phase ; une Lune levée éclaircit le fond de ciel sans rendre la nuit ' +
      'inutilisable. Les deux durées sont affichées séparément.',
    consequence:
      'Une fenêtre utile plus courte que la nuit signifie des poses plus courtes et une ' +
      'intégration plus longue, pas une nuit perdue.',
    sections: ['8.1'],
  }),
  degradation_lunaire: terme({
    libelle: 'Dégradation lunaire',
    glose: 'apport lunaire au ciel',
    explication:
      'La Lune diffuse sa lumière dans l’atmosphère et éclaircit le fond de ciel d’autant plus ' +
      'qu’elle est pleine, haute et proche de la cible. Le modèle de Krisciunas & Schaefer (1991) ' +
      'chiffre cet apport en magnitudes par seconde d’arc au carré.',
    consequence:
      'Une nuit de Lune reste exploitable : le moteur raccourcit la pose et allonge ' +
      'l’intégration au lieu de barrer la nuit.',
    sections: ['8.1'],
  }),
  mode_degrade_nuit: terme({
    libelle: 'Mode dégradé de nuit',
    glose: 'repli sur le crépuscule nautique',
    explication:
      'Au-delà de 48,6° de latitude, la nuit astronomique disparaît une partie de l’été. ' +
      'L’application ne produit alors ni durée négative ni erreur : elle retient la fenêtre ' +
      'nautique — Soleil sous 12° — et chiffre la pénalité de fond de ciel qui l’accompagne.',
    consequence: 'Les cibles les plus brillantes restent accessibles, avec une pénalité affichée.',
    sections: ['8.1'],
  }),

  // §8.2 — créneau
  creneau: terme({
    libelle: 'Créneau d’observation',
    glose: 'quand la cible est exploitable',
    explication:
      'L’intervalle où la cible est simultanément assez haute, hors du relief et dans la ' +
      'fenêtre nocturne. Sur une monture équatoriale allemande, le passage au méridien le ' +
      'scinde en deux : le tube heurte le pied et l’orientation du capteur bascule de 180°.',
    consequence:
      'C’est la durée du créneau, et non celle de la nuit, qui décide si l’intégration ' +
      'requise tient en une seule nuit.',
    sections: ['8.2'],
  }),
  cause_exclusion: terme({
    libelle: 'Cause d’exclusion',
    glose: 'pourquoi la cible est écartée',
    explication:
      'Hauteur, relief, Lune, fenêtre ou cible qui ne se lève jamais depuis ce site : toute ' +
      'cible écartée nomme la contrainte qui l’écarte. Une cible rejetée sans motif est la ' +
      'première source de méfiance envers une application de planification.',
    consequence:
      'La cause dit quoi changer : la date, le site, la latitude ou simplement la cible.',
    sections: ['8.2'],
  }),

  // §8.3 — plan de session
  plan_session: terme({
    libelle: 'Plan de session',
    glose: 'chronologie exécutable de la nuit',
    explication:
      'Une liste de cibles ordonnée dans le temps, chacune avec son créneau alloué, sa pose, ' +
      'son nombre d’images et sa consigne. La sortie est une chronologie, pas un palmarès : un ' +
      'palmarès n’est pas exécutable sur le terrain.',
    consequence: 'Le plan se suit dans l’ordre, de la première cible au lever du jour.',
    sections: ['8.3'],
  }),
  score_cible: terme({
    libelle: 'Score de cible',
    glose: 'arbitrage entre cibles concurrentes',
    explication:
      'Cinq composantes pondérées — cadrage, hauteur, signal, fenêtre et Lune — avec des poids ' +
      'déclarés au registre, exposés et réglables. Aucun apprentissage, aucune dérive : deux ' +
      'exécutions identiques donnent le même plan.',
    consequence:
      'Quand deux créneaux se chevauchent, c’est le score qui tranche, et sa décomposition ' +
      'est affichée.',
    sections: ['8.3'],
  }),
  budget_nuit: terme({
    libelle: 'Budget de nuit',
    glose: 'temps total de la session',
    explication:
      'La capture, la calibration, la mise en station et le pointage de chaque cible tiennent ' +
      'dans la durée de la nuit — ou le plan retire une cible entière. Aucune intégration n’est ' +
      'tronquée en silence pour faire tenir la liste.',
    consequence: 'Un budget serré se corrige en retirant une cible, jamais en rognant une pose.',
    sections: ['8.3'],
  }),

  // §8.4 — pointage
  mode_pointage: terme({
    libelle: 'Mode de pointage',
    glose: 'carte directe ou cheminement',
    explication:
      'Au-delà de 8° de champ, le cadre contient toujours plusieurs étoiles à l’œil nu : une ' +
      'carte directe suffit, en une seule étape. Sous 8°, il faut cheminer d’étoile en étoile ' +
      'depuis un repère brillant, chaque saut recouvrant le champ du chercheur.',
    consequence: 'Le mode est déduit du matériel, jamais choisi à la main.',
    sections: ['8.4'],
  }),
  angle_orientation: terme({
    libelle: 'Orientation du champ',
    glose: 'angle de position du zénith',
    explication:
      'Le champ tourne au cours de la nuit dans le référentiel de l’observateur. Le schéma de ' +
      'pointage est orienté pour l’heure et le lieu exacts du pointage, avec le haut et le bas ' +
      'réels tels que l’œil les verra.',
    consequence: 'Un schéma non orienté est inutilisable dans le noir.',
    sections: ['8.4'],
  }),
  decalage_pointage: terme({
    libelle: 'Décalage de pointage',
    glose: 'écart chiffré vers la cible',
    explication:
      'L’écart en ascension droite, en heures d’angle horaire, et en déclinaison, en degrés, ' +
      'entre l’étoile d’ancrage et la cible. Il se reporte directement sur des cercles gradués ' +
      'ou sur les flexibles d’une monture.',
    consequence:
      'La mise en station reste à la charge de l’observateur : l’application aide à trouver, ' +
      'elle ne corrige pas l’installation.',
    sections: ['8.4'],
  }),

  // §11 — mode nuit
  mode_nuit: terme({
    libelle: 'Mode nuit',
    glose: 'rouge profond, sans bleu',
    explication:
      'Les bâtonnets de la rétine assurent la vision nocturne et s’effondrent au-delà de 640 nm : ' +
      'un rouge profond est vu sans les blanchir. L’adaptation à l’obscurité demande 20 à 30 ' +
      'minutes et se détruit en quelques secondes de lumière blanche — le mode est donc global ' +
      'et sans exception, pas un thème sombre.',
    consequence:
      'Une seule fenêtre blanche annule une demi-heure d’attente : aucune surface claire n’est ' +
      'affichée tant que le mode est actif.',
    sections: ['11.1'],
  }),
  luminance_mode_nuit: terme({
    libelle: 'Luminance du mode nuit',
    glose: 'plancher à 2 %',
    explication:
      'La luminance du rouge est réglable jusqu’à un plancher d’environ 2 % de la luminance ' +
      'nominale. Sur une dalle OLED le noir est un pixel éteint ; sur une dalle LCD le ' +
      'rétroéclairage traverse toujours et une fuite de bleu subsiste.',
    consequence:
      'Sur LCD, le mode nuit reste efficace mais imparfait : l’application le dit une fois.',
    sections: ['11.1'],
  }),

  // §3 — planétarium et rendu du ciel
  deux_horloges: terme({
    libelle: 'Pipeline à deux horloges',
    glose: 'rendu rapide, éphémérides lentes',
    explication:
      'L’image est produite soixante fois par seconde, les positions planétaires dix fois ' +
      'seulement, et l’écart est comblé par interpolation. Les étoiles, elles, ne sont jamais ' +
      'interpolées : elles sont fixes, seule la matrice de rotation du ciel change. C’est ce ' +
      'découplage qui rend l’animation fluide, quel que soit le nombre d’étoiles.',
    consequence:
      'Ajouter des étoiles au catalogue ne ralentit pas l’animation : le coût suit ce qui est ' +
      'affiché, pas ce qui est stocké.',
    sections: ['3.1'],
  }),
  vitesse_ecran: terme({
    libelle: 'Vitesse à l’écran',
    glose: 'défilement perçu, en pixels/seconde',
    explication:
      'La vitesse utile ne se mesure pas en heures par seconde mais en pixels par seconde. ' +
      'Sous 2 px/s le mouvement est invisible ; au-delà de 600 px/s l’image se replie et le ' +
      'ciel devient illisible. Entre les deux se trouve la plage lisible.',
    consequence:
      'Le temps réel, à 0,13 px/s, ne montre rien : l’animation n’a d’intérêt qu’accélérée.',
    sections: ['3.2'],
  }),
  facteur_vitesse_max: terme({
    libelle: 'Plafond de défilement',
    glose: 'vitesse maximale encore lisible',
    explication:
      'Le plafond est dérivé de la lisibilité, pas de la puissance de la machine. Il dépend du ' +
      'zoom : un champ serré grandit l’échelle en pixels par degré, donc abaisse le facteur ' +
      'admissible. Un réglage fixe serait fluide en vue large et illisible en vue serrée.',
    consequence:
      'Zoomer ramène automatiquement le facteur sous le plafond, et l’application le signale.',
    sections: ['3.2'],
  }),
  magnitude_limite_rendue: terme({
    libelle: 'Profondeur affichée',
    glose: 'magnitude la plus faible tracée',
    explication:
      'La profondeur suit le zoom : un champ deux fois plus serré descend d’environ 1,5 ' +
      'magnitude. En vue réaliste, elle est en outre plafonnée par le fond de ciel du site — ' +
      'le rendu montre alors ce que l’œil verrait, non le catalogue complet.',
    consequence:
      'Quand la profondeur dépasse celle du catalogue chargé, l’application le déclare plutôt ' +
      'que de compléter le champ par des étoiles inventées.',
    sections: ['3.3'],
  }),
  precession: terme({
    libelle: 'Précession',
    glose: 'lente dérive des coordonnées',
    explication:
      'L’axe de la Terre décrit un cône en 26 000 ans : les coordonnées d’un astre changent ' +
      'de 50,29 secondes d’arc par an, soit un degré tous les 71,6 ans. Les frontières IAU ' +
      'sont définies dans les coordonnées de 1875 ; sans correction, elles seraient décalées ' +
      'de plus de deux degrés aujourd’hui.',
    consequence:
      'Les positions sont précessées vers l’époque affichée ; ni les magnitudes ni les noms ' +
      'ne le sont, et les mouvements propres restent ignorés.',
    sections: ['3.1', '3.4'],
  }),

  // §9 — grand champ, prévisualisation et filé
  pose_max_cadre: terme({
    libelle: 'Pose max du cadre',
    glose: 'pose de la zone limitante',
    explication:
      'Il n’existe pas une pose maximale, mais une pose maximale par déclinaison : une étoile ' +
      'proche du pôle se déplace moins vite qu’une étoile équatoriale. Sur un grand champ, la ' +
      'déclinaison varie de plusieurs dizaines de degrés d’un bord du cadre à l’autre. La pose ' +
      'retenue est celle de la zone la plus contraignante, jamais celle du centre de visée.',
    consequence:
      'Recadrer vers le pôle rallonge la pose utile, et l’application nomme la zone qui la bride.',
    sections: ['9.1'],
  }),
  regle_500: terme({
    libelle: 'Règle des 500',
    glose: 'repère historique, jamais retenu',
    explication:
      'La règle des 500 divise 500 par la focale équivalente et donne une valeur unique pour ' +
      'tout le ciel. Elle vaut le double de la pose correcte à l’équateur céleste et trente ' +
      'fois trop peu près du pôle. Elle est affichée parce qu’elle est partout, pas parce ' +
      'qu’elle est juste.',
    consequence:
      'Aucun calcul de l’application ne la consomme : seule la NPF complète pilote la pose.',
    sections: ['9.1'],
  }),
  trainee: terme({
    libelle: 'Traînée',
    glose: 'filé inscrit sur le capteur',
    explication:
      'La traînée est la longueur, en pixels, du déplacement d’une étoile pendant la pose. ' +
      'Elle croît avec la pose et la focale, et décroît avec la déclinaison. Au-delà d’un ' +
      'pixel ou deux, les étoiles cessent d’être ponctuelles à l’examen à cent pour cent.',
    consequence:
      'La prévisualisation ovalise les étoiles dès que la pose dépasse la pose max du cadre.',
    sections: ['9.1', '9.2'],
  }),
  focale_equivalente: terme({
    libelle: 'Focale équivalente',
    glose: 'focale ramenée au plein format',
    explication:
      'La focale équivalente compare des cadrages entre formats de capteur différents. Elle ne ' +
      'sert ici qu’au repère de la règle des 500. Le champ réel, l’échantillonnage et la pose ' +
      'maximale se calculent tous sur les dimensions et le pas réels du capteur.',
    consequence:
      'Un recadrage de capteur change la focale équivalente sans rien changer à la pose maximale.',
    sections: ['9.1'],
  }),
  profondeur_previsu: terme({
    libelle: 'Profondeur atteinte',
    glose: 'magnitude enregistrée par la pose',
    explication:
      'La profondeur atteinte dit jusqu’à quelle magnitude la pose enregistre une étoile au ' +
      'seuil de détection retenu. Elle dépend de la pose, du diamètre de pupille, du bruit de ' +
      'lecture et du fond de ciel du site. C’est elle qui fixe le nombre d’étoiles affichées ' +
      'dans la prévisualisation, et non le zoom.',
    consequence:
      'Un ciel plus pollué ou une pose plus courte vident visiblement le champ prévisualisé.',
    sections: ['9.2'],
  }),
  semis_generatif: terme({
    libelle: 'Fond génératif',
    glose: 'étoiles générées, non catalographiées',
    explication:
      'Au-delà du seuil catalographié, les étoiles affichées sont générées par un semis à ' +
      'graine fixe : leurs positions individuelles sont fausses, leur densité est fidèle. La ' +
      'densité est modulée par la latitude galactique, sans quoi la bande de la Voie lactée ' +
      'n’apparaîtrait pas. Le même cadre donne toujours le même rendu.',
    consequence:
      'Aucun repérage ne doit s’appuyer sur ces étoiles-là, seulement sur les étoiles réelles.',
    sections: ['9.2'],
  }),
  voie_lactee: terme({
    libelle: 'Voie lactée',
    glose: 'bande modulée par le ciel',
    explication:
      'La bande est rendue par un masque procédural en coordonnées galactiques, hors ligne. ' +
      'Son contraste est piloté par le fond de ciel du site : atténuée en Bortle 4 ou 5, elle ' +
      'disparaît en Bortle 8. L’application montre ce que vous verrez depuis ce lieu, pas une ' +
      'carte de référence idéale.',
    consequence:
      'Si la bande disparaît du rendu, elle ne sortira pas non plus sur les images depuis ce site.',
    sections: ['9.2'],
  }),
  vignettage: terme({
    libelle: 'Vignettage',
    glose: 'coins plus sombres que centre',
    explication:
      'Un objectif ouvert assombrit les coins de l’image de un à deux diaphragmes à pleine ' +
      'ouverture. La prévisualisation le simule pour que le cadrage tienne compte de la ' +
      'répartition réelle de lumière. Fermer d’un cran le réduit fortement.',
    consequence:
      'Placer un sujet important dans un coin le condamne à sortir plus sombre que prévu.',
    sections: ['9.2'],
  }),
  pole_celeste: terme({
    libelle: 'Centre de rotation',
    glose: 'pôle céleste, souvent hors cadre',
    explication:
      'Le pôle céleste est fixe dans le repère local : sa hauteur vaut la latitude du site. ' +
      'Il tombe très souvent hors du cadre, et les arcs sont alors concentriques autour d’un ' +
      'point situé en dehors de l’image. L’application ne le ramène jamais artificiellement ' +
      'dans le cadre.',
    consequence:
      'La direction et la distance du pôle hors champ sont indiquées pour préparer le cadrage.',
    sections: ['9.3'],
  }),
  longueur_arc: terme({
    libelle: 'Longueur d’arc',
    glose: 'trace décrite par une étoile',
    explication:
      'La longueur d’arc croît avec la durée d’accumulation et décroît avec la déclinaison. ' +
      'Elle varie donc d’une étoile à l’autre dans le même cadre, et c’est l’effet le plus ' +
      'caractéristique du filé. À vingt minutes, l’arc ne fait qu’environ cinq pour cent de ' +
      'la hauteur du cadre.',
    consequence:
      'Un filé lisible demande typiquement au moins une heure, et devient spectaculaire vers deux.',
    sections: ['9.3'],
  }),
  duree_file: terme({
    libelle: 'Durée d’accumulation',
    glose: 'temps total de la séquence',
    explication:
      'La durée totale est le temps couvert par l’ensemble des poses empilées, intervalles ' +
      'compris. Elle fixe la longueur des arcs, le nombre de fichiers et le budget batterie. ' +
      'Elle n’est pas la durée d’une pose unitaire, qui reste courte.',
    consequence:
      'Doubler la durée totale double la longueur des arcs, sans rien changer à la pose unitaire.',
    sections: ['9.3', '9.4'],
  }),
  intervalle_file: terme({
    libelle: 'Intervalle inter-pose',
    glose: 'temps mort entre deux poses',
    explication:
      'Chaque seconde d’obturateur fermé laisse un trou dans toutes les traces. Au-delà d’une ' +
      'seconde, ces trous deviennent visibles et le défaut est irréparable en post-traitement. ' +
      'La réduction de bruit longue exposition du boîtier crée à elle seule un intervalle égal ' +
      'à la pose.',
    consequence:
      'Désactiver la réduction de bruit longue exposition avant de partir est une consigne bloquante.',
    sections: ['9.4'],
  }),
  n_poses_file: terme({
    libelle: 'Nombre de poses',
    glose: 'images de la séquence',
    explication:
      'Le nombre de poses découle de la durée totale divisée par la cadence, pose et intervalle ' +
      'compris. Il fixe le volume de fichiers et la consommation de batterie. La pose unique ' +
      'très longue est écartée : bruit thermique et ciel cramé en présence de pollution lumineuse.',
    consequence:
      'Les poses courtes s’empilent ensuite en mode éclaircir pour reconstituer le filé complet.',
    sections: ['9.4'],
  }),
  batteries: terme({
    libelle: 'Batteries à emporter',
    glose: 'nombre, marge d’une incluse',
    explication:
      'Le budget se calcule à partir de l’autonomie constructeur, corrigée par le facteur de ' +
      'froid, avec une batterie de marge assumée. L’application annonce un nombre de batteries ' +
      'et jamais une durée d’autonomie précise : un chiffre faux au quart d’heure près serait ' +
      'plus nuisible qu’utile.',
    consequence:
      'Sans autonomie constructeur renseignée, aucun nombre n’est produit plutôt qu’estimé au hasard.',
    sections: ['9.4'],
  }),
  facteur_froid: terme({
    libelle: 'Facteur de froid',
    glose: 'autonomie réduite par température',
    explication:
      'Une batterie perd une grande part de sa capacité utile dès que la température descend. ' +
      'Le facteur retenu vaut un au-dessus de dix degrés, six dixièmes entre zéro et dix, et ' +
      'quatre dixièmes sous zéro. Ce sont des ordres de grandeur de terrain, pas des mesures.',
    consequence:
      'Une nuit sous zéro peut plus que doubler le nombre de batteries à emporter.',
    sections: ['9.4'],
  }),
  autonomie_cipa: terme({
    libelle: 'Autonomie CIPA',
    glose: 'images par batterie, norme constructeur',
    explication:
      'La norme CIPA donne un nombre d’images par charge, mesuré dans des conditions ' +
      'standardisées. Elle est optimiste pour la pose longue en continu, et elle n’est pas ' +
      'renseignée pour tous les boîtiers de la base. La valeur saisie reste un ordre de grandeur.',
    consequence:
      'Renseigner cette valeur débloque le budget batterie de la fiche de séquence.',
    sections: ['9.4'],
  }),
  espace_carte: terme({
    libelle: 'Espace libre sur la carte',
    glose: 'gigaoctets encore disponibles',
    explication:
      'Une séquence de filé produit plusieurs centaines de fichiers bruts. La carte se remplit ' +
      'souvent avant la fin de la durée visée, et la séquence s’arrête alors sans prévenir. Le ' +
      'budget de stockage se vérifie avant la sortie, pas pendant.',
    consequence:
      'L’application chiffre l’arc réellement obtenu si la carte s’avère trop petite.',
    sections: ['9.4'],
  }),

  ordre_de_grandeur: terme({
    libelle: 'Ordre de grandeur',
    glose: 'valeur approchée, affichée en plage',
    explication:
      'Certaines constantes du registre sont des conventions de terrain, pas des mesures. ' +
      'Toute sortie qui en dépend est affichée avec sa plage plutôt que comme un nombre exact.',
    consequence: 'Une valeur en plage se lit comme un repère à ajuster, pas comme une consigne.',
    sections: ['2.1'],
  }),
} as const satisfies Record<string, EntreeGlossaire>)

export type TermeGlossaire = keyof typeof GLOSSAIRE

export function glose(cle: TermeGlossaire): EntreeGlossaire {
  return GLOSSAIRE[cle]
}
