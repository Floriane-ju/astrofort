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
    consequence: 'Le pitch se lit dans la base matériel, il ne se règle pas au moment de la prise.',
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
