/**
 * §6.4 — Origines, cadrage et refus de l'image d'objet.
 *
 * Ce module existe pour deux raisons distinctes, et la seconde est la vraie.
 *
 * La première est la règle du projet : une largeur, une marge, un plafond de taille sont des
 * valeurs, elles ne s'écrivent pas dans un moteur.
 *
 * La seconde est §13.1. La promesse de confidentialité ne se lit plus dans l'architecture —
 * l'application émet désormais du trafic — elle se lit dans `ORIGINES_IMAGERIE`. Cette liste
 * est la source unique : la politique de sécurité du contenu de `vite.config.ts` en est
 * dérivée, et un test refuse toute divergence. Ajouter une origine ici est un amendement du
 * PRD, pas un détail d'implémentation.
 *
 * Une seule directive s'ouvre, et c'est `connect-src` : les octets sont téléchargés puis
 * rangés en IndexedDB, et affichés depuis un `blob:`. Aucun hôte tiers n'a donc à figurer
 * dans `img-src` — une surface à surveiller au lieu de deux.
 */

export interface OrigineImagerie {
  readonly origine: string
  /** Ce qui est transmis à ce tiers, en clair. C'est ce que §13.1 énumère. */
  readonly transmis: string
}

export const ORIGINES_IMAGERIE: readonly OrigineImagerie[] = Object.freeze(
  [
    {
      origine: 'https://fr.wikipedia.org',
      transmis: 'la désignation de la cible consultée',
    },
    {
      origine: 'https://commons.wikimedia.org',
      transmis: 'le nom du fichier image de la cible consultée',
    },
    {
      origine: 'https://upload.wikimedia.org',
      transmis: 'le nom du fichier image de la cible consultée',
    },
    {
      origine: 'https://alasky.cds.unistra.fr',
      transmis: 'les coordonnées équatoriales de la cible consultée',
    },
  ].map(Object.freeze) as OrigineImagerie[],
)

/**
 * L'hôte du service de découpe du CDS : l'alias canonique de la documentation.
 *
 * `alaskybis` et `alasky.u-strasbg.fr` répondent à l'identique — ce sont des alias du même
 * service. Un seul est câblé, et c'est le seul que la politique de sécurité autorise : trois
 * origines ouvertes pour un service seraient trois surfaces à surveiller pour rien.
 */
export const HOTE_DECOUPE = 'https://alasky.cds.unistra.fr'

export const CHEMIN_DECOUPE = '/hips-image-services/hips2fits'

/** Le relevé interrogé. Le même que celui que §6.2 nomme pour la prévisualisation du cadre. */
export const RELEVE_DECOUPE = 'CDS/P/DSS2/color'

export const LANGUE_ENCYCLOPEDIE = 'fr'

export interface ValeurImagerie {
  readonly valeur: number
  readonly unite: string
  readonly source: string
  readonly tolerance: string
}

function valeur(v: ValeurImagerie): ValeurImagerie {
  return Object.freeze(v)
}

export const IMAGERIE = Object.freeze({
  /**
   * La largeur demandée aux deux sources. Une vignette d'illustration, pas une planche :
   * à cette largeur une découpe DSS2 pèse une dizaine de kilo-octets, ce qui rend le cache
   * par objet tenable.
   */
  LARGEUR_VIGNETTE_PX: valeur({
    valeur: 320,
    unite: 'px',
    source: 'convention d’affichage — mesuré à 9,5 ko pour une découpe DSS2 de 300 px',
    tolerance: 'sans objet — aucun verdict ne dépend de cette largeur',
  }),

  /**
   * Le champ de la découpe vaut la taille de l'objet multipliée par cette marge. Elle n'est
   * pas choisie à l'œil : 2,5 place l'objet à 40 % du champ, au milieu de la bande
   * CADRAGE_OPTIMAL de §6.2 (0,33 – 0,5). L'illustration cadre donc comme le PRD dit qu'on
   * cadre bien.
   */
  MARGE_CADRAGE_DECOUPE: valeur({
    valeur: 2.5,
    unite: '—',
    source: 'inverse du milieu de la bande CADRAGE_OPTIMAL de §6.2 (0,4)',
    tolerance: 'sans objet — cadrage d’illustration',
  }),

  /** Repli quand le catalogue ne donne aucune dimension : le cas est fréquent (§6.2). */
  CHAMP_DECOUPE_DEFAUT_DEG: valeur({
    valeur: 1,
    unite: '°',
    source: 'convention — ordre de grandeur du champ d’un instrument grand champ de §5.1',
    tolerance: 'sans objet — cadrage d’illustration',
  }),

  /** Bornes du champ demandé au service : en deçà il n'y a plus de relevé, au-delà plus d'objet. */
  CHAMP_DECOUPE_MIN_DEG: valeur({
    valeur: 0.05,
    unite: '°',
    source: 'résolution du relevé DSS2 — sous 3′ la découpe n’ajoute aucun détail',
    tolerance: 'sans objet — cadrage d’illustration',
  }),

  CHAMP_DECOUPE_MAX_DEG: valeur({
    valeur: 10,
    unite: '°',
    source: 'convention — au-delà la découpe montre le voisinage, plus la cible',
    tolerance: 'sans objet — cadrage d’illustration',
  }),

  /**
   * §6.2 — la marge autour du cadre dans l'aperçu de cadrage. Elle ne sert pas à décorer : à
   * 2, le cadre occupe la moitié de la largeur, donc un objet jusqu'à deux fois le cadre reste
   * ENTIÈREMENT visible. C'est la borne au-delà de laquelle le verdict MOSAIQUE_REQUISE
   * cesserait d'être lisible — un objet rogné par le bord ne montre pas qu'il débordait.
   */
  MARGE_APERCU_CADRE: valeur({
    valeur: 2,
    unite: '—',
    source: 'borne de lisibilité du verdict MOSAIQUE_REQUISE de §6.2 (remplissage > 1)',
    tolerance: 'sans objet — cadrage d’illustration',
  }),

  /**
   * Plafond d'un fichier accepté. Une image encyclopédique d'origine peut peser des dizaines
   * de méga-octets ; la ranger dans IndexedDB mettrait §12.3 en défaut pour une vignette.
   */
  POIDS_VIGNETTE_MAX_KO: valeur({
    valeur: 512,
    unite: 'ko',
    source: 'convention — vingt fois le poids observé d’une vignette, marge pour un format lourd',
    tolerance: 'sans objet — plafond de garde',
  }),
} satisfies Record<string, ValeurImagerie>)

export type IdImagerie = keyof typeof IMAGERIE

/** Lecture d'une valeur, sur le modèle de `K()` du registre §2.1. */
export function I(id: IdImagerie): number {
  return IMAGERIE[id].valeur
}

/**
 * Ce qui trahit un diagramme et non l'objet, dans le nom du fichier d'origine.
 *
 * Le motif décisif est `_IAU` : les pages Sharpless portent en tête la carte de leur
 * constellation — `Cassiopeia_IAU.svg` pour Sh2-180 — et une carte affichée comme une photo
 * de nébuleuse est un mensonge de l'interface, pas une approximation. Le format vectoriel
 * est refusé en bloc pour la même raison : un relevé du ciel n'est jamais vectoriel.
 */
export const MOTIFS_FICHIER_REFUSE: readonly RegExp[] = Object.freeze([
  /\.svgz?$/i,
  /_IAU\b/i,
  /\b(chart|map|atlas|diagram|schema|scheme)\b/i,
  /\b(constellation|starmap|skymap|finder)\b/i,
  /\blocation\b/i,
])

/** Crédit d'une découpe de relevé : elle n'a pas d'auteur individuel à nommer. */
export const CREDIT_RELEVE = Object.freeze({
  auteur: 'DSS2 couleur — relevé numérisé du ciel',
  licence: 'domaine public, distribué par le CDS (Strasbourg)',
  lien: 'https://aladin.cds.unistra.fr/hips/list',
})
