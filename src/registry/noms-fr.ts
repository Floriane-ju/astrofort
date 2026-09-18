/**
 * T-0281 — §6.4 : les noms d'usage français des objets du ciel profond.
 *
 * Les deux amonts du catalogue — OpenNGC et le catalogue DSO de Stellarium — ne portent que
 * des noms anglais : « Andromeda Galaxy », « Veil Nebula », « North America Nebula ». §6.4
 * pose pourtant que l'utilisateur « ne connaît pas les désignations » ; celui qui tape
 * « andromède » ne trouvait rien, et l'interface lui répondait que l'objet n'existait pas.
 *
 * La table est tenue à la main, comme `NOMS_FR_ASTERISMES` de `scripts/build-catalogs.ts`,
 * et pour la même raison : aucun amont ne publie ces noms sous une forme épinglable, et une
 * traduction mécanique produirait des noms que personne ne cherche. Elle ne couvre donc QUE
 * les objets dont l'usage francophone est établi — les autres restent atteignables par leur
 * désignation et par leur nom anglais, qui, eux, sont sourcés. Elle n'est pas dans le paquet
 * binaire : ce n'est pas une donnée d'amont, et l'y mettre imposerait un `pnpm data:build`
 * pour ajouter un synonyme.
 *
 * Elle ne s'affiche pas : c'est une ENTRÉE DE RECHERCHE, pas un libellé. Ce que la fiche
 * montre reste ce que le catalogue porte (§6.3) — une seule vérité sur ce que la donnée dit.
 *
 * Format : celui de `nomsCommuns`, plusieurs noms séparés par « | ». Le premier est le nom
 * complet, les suivants sont les raccourcis réellement tapés (« Andromède », « Amérique du
 * Nord »), pour qu'ils passent en tête comme préfixes et non en occurrence interne.
 *
 * Les clés sont des désignations du catalogue : `tests/recherche-catalogue.test.ts` vérifie
 * qu'aucune ne désigne un objet absent, sans quoi une faute de frappe rendrait un nom
 * introuvable en silence.
 */

export const NOMS_FR: Readonly<Record<string, string>> = Object.freeze({
  M1: 'Nébuleuse du Crabe',
  M8: 'Nébuleuse de la Lagune',
  M13: 'Grand amas d’Hercule|Amas d’Hercule',
  M16: 'Nébuleuse de l’Aigle|Piliers de la Création',
  M17: 'Nébuleuse Oméga|Nébuleuse du Cygne|Nébuleuse du Fer à Cheval',
  M20: 'Nébuleuse Trifide',
  M27: 'Nébuleuse de l’Haltère|Haltère',
  M31: 'Galaxie d’Andromède|Andromède',
  M33: 'Galaxie du Triangle',
  M42: 'Grande Nébuleuse d’Orion|Nébuleuse d’Orion',
  M43: 'Nébuleuse de Mairan',
  M44: 'Amas de la Crèche|Ruche',
  M45: 'Pléiades|Les Sept Sœurs',
  M51: 'Galaxie du Tourbillon',
  M57: 'Nébuleuse annulaire de la Lyre|Nébuleuse de la Lyre',
  M63: 'Galaxie du Tournesol',
  M64: 'Galaxie de l’Œil Noir',
  M76: 'Petit Haltère',
  M81: 'Galaxie de Bode',
  M82: 'Galaxie du Cigare',
  M97: 'Nébuleuse du Hibou',
  M101: 'Galaxie du Moulinet',
  M104: 'Galaxie du Sombrero',
  NGC0253: 'Galaxie du Sculpteur',
  NGC0281: 'Nébuleuse Pacman',
  NGC0869: 'Double Amas de Persée',
  NGC0884: 'Double Amas de Persée',
  NGC1499: 'Nébuleuse de Californie',
  NGC1977: 'Nébuleuse de l’Homme qui Court',
  NGC2024: 'Nébuleuse de la Flamme',
  NGC2237: 'Nébuleuse de la Rosette|Rosette',
  NGC2264: 'Amas de l’Arbre de Noël|Nébuleuse du Cône',
  NGC2359: 'Casque de Thor',
  NGC4565: 'Galaxie de l’Aiguille',
  NGC6543: 'Nébuleuse de l’Œil de Chat',
  NGC6888: 'Nébuleuse du Croissant',
  NGC6960: 'Dentelles du Cygne|Petite Dentelle|Balai de la Sorcière',
  NGC6992: 'Dentelles du Cygne|Grande Dentelle',
  NGC6995: 'Dentelles du Cygne|Grande Dentelle',
  NGC7000: 'Nébuleuse de l’Amérique du Nord|Amérique du Nord',
  NGC7293: 'Nébuleuse de l’Hélice|Hélice',
  NGC7380: 'Nébuleuse du Sorcier',
  NGC7635: 'Nébuleuse de la Bulle',
  IC0405: 'Nébuleuse de l’Étoile Flamboyante',
  IC1396: 'Nébuleuse de la Trompe d’Éléphant',
  IC1805: 'Nébuleuse du Cœur',
  IC1848: 'Nébuleuse de l’Âme',
  IC5070: 'Nébuleuse du Pélican',
  B33: 'Nébuleuse de la Tête de Cheval|Tête de Cheval',
  'Sh2-155': 'Nébuleuse de la Caverne',
})
