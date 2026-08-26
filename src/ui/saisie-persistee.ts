/**
 * §12.3 — la frontière entre la saisie à l'écran et les enregistrements de §12.1.
 *
 * La saisie est du texte, un enregistrement est un nombre validé : la traversée se fait ici,
 * dans les deux sens. Une saisie hors domaine ne s'enregistre pas — un `NaN` ou un Bortle 12
 * persisté ressortirait à chaque démarrage, et rendrait l'export irréimportable puisque le
 * contrôle du réimport applique les mêmes plages du registre §2.1.
 *
 * Deux choses ne sont pas persistées, par décision : la date de séance repart d'aujourd'hui —
 * relire une date passée planifierait une nuit déjà écoulée — et la comparaison de recadrage
 * est un affichage, pas une saisie.
 */

import type { SiteEnregistre, ProfilMateriel } from '../data/db.ts'
import type { ProfilAEnregistrer, SiteAExporter } from '../data/persistence.ts'
import type { MasqueHorizon } from '../core/site.ts'
import { valide, type DomaineId } from '../registry/domains.ts'
import type { DepartLieu, DepartMateriel, SaisieLieu, SaisieMateriel } from './app-saisie.ts'

/**
 * Un champ optionnel de la saisie : absent quand il est vide, refusé quand il est hors
 * domaine. Le refus remonte en exception, comme partout ailleurs sur une saisie (§2.1).
 */
function siRenseigne<C extends string>(
  nom: C,
  saisi: string,
  domaine: DomaineId,
): { readonly [K in C]?: number } {
  if (saisi.trim() === '') return {}
  return { [nom]: valide(domaine, Number(saisi)) } as { readonly [K in C]?: number }
}

/**
 * Une grandeur sans laquelle l'enregistrement n'a pas de sens. Un champ vide est refusé comme
 * un `NaN`, jamais coercé en 0 : une latitude vide enregistrée à 0° ne serait pas un aveu
 * d'oubli mais un point au large du golfe de Guinée, relu tel quel à chaque démarrage.
 */
function requis(saisi: string, domaine: DomaineId): number {
  return valide(domaine, saisi.trim() === '' ? Number.NaN : Number(saisi))
}

/** Le texte d'une grandeur enregistrée ; vide quand elle est absente, jamais « undefined ». */
function texteDe(valeur: number | undefined): string {
  return valeur === undefined ? '' : String(valeur)
}

/**
 * Le site à enregistrer, ou `null` quand la saisie n'est pas encore chiffrable. Le refus n'a
 * pas à être annoncé ici : la chaîne de calcul l'affiche déjà, et le dernier enregistrement
 * valable reste en base plutôt que d'être écrasé par une saisie en cours de frappe.
 */
export function siteAEnregistrer(lieu: SaisieLieu, masque: MasqueHorizon): SiteAExporter | null {
  try {
    return {
      latitudeDeg: requis(lieu.latitude, 'latitude_deg'),
      longitudeDeg: requis(lieu.longitude, 'longitude_deg'),
      altitudeM: requis(lieu.altitude, 'altitude_m'),
      ...siRenseigne('bortleDeclare', lieu.bortle, 'bortle_declare'),
      ...siRenseigne('sqmMesure', lieu.sqm, 'sqm_mesure'),
      masque,
      pointsMasque: lieu.pointsMasque,
    }
  } catch {
    return null
  }
}

/** Le profil matériel à enregistrer, ou `null` quand la saisie n'est pas chiffrable. */
export function profilAEnregistrer(materiel: SaisieMateriel): ProfilAEnregistrer | null {
  const boitier = materiel.boitier
  try {
    return {
      focaleMm: requis(materiel.focale, 'focale_mm'),
      ouvertureN: requis(materiel.ouverture, 'ouverture_N'),
      typeObjectif: materiel.typeObjectif,
      formatCapteur: boitier.formatCapteur,
      ...siRenseigne('resolutionMpx', boitier.resolutionMpx, 'resolution_mpx'),
      ...siRenseigne('readNoiseE', boitier.readNoiseE, 'read_noise_e'),
      ...siRenseigne('seuilDoubleGainIso', boitier.seuilDoubleGainIso, 'seuil_double_gain_iso'),
      ...siRenseigne('fullWellE', boitier.fullWellE, 'full_well_e'),
      ...siRenseigne('zpSys', boitier.zpSys, 'zp_sys'),
      ...siRenseigne('tailleRawMo', boitier.tailleRawMo, 'taille_raw_mo'),
      ...siRenseigne('autonomieCipa', boitier.autonomieCipa, 'autonomie_cipa'),
      ...siRenseigne('isoCapture', materiel.iso, 'iso_capture'),
      capteurMode: materiel.capteurMode,
      suiviActif: materiel.suiviActif,
      qualiteMes: materiel.qualiteMes,
      typeMonture: materiel.typeMonture,
    }
  } catch {
    return null
  }
}

/** Le lieu tel qu'il se ressaisit au démarrage. `null` : rien n'a encore été enregistré. */
export function departLieu(site: SiteEnregistre | null): DepartLieu | null {
  if (site === null) return null
  return {
    latitude: String(site.latitudeDeg),
    longitude: String(site.longitudeDeg),
    altitude: String(site.altitudeM),
    // Un champ vidé volontairement le reste : sans cela, effacer le Bortle pour saisir un
    // SQM verrait le Bortle par défaut revenir au rechargement, et le ciel changer seul.
    bortle: texteDe(site.bortleDeclare),
    sqm: texteDe(site.sqmMesure),
    pointsMasque: site.masquePoints ?? [],
  }
}

/** Le matériel tel qu'il se ressaisit au démarrage. */
export function departMateriel(profil: ProfilMateriel | null): DepartMateriel | null {
  if (profil === null) return null
  return {
    boitier: {
      formatCapteur: profil.formatCapteur,
      resolutionMpx: texteDe(profil.resolutionMpx),
      readNoiseE: texteDe(profil.readNoiseE),
      seuilDoubleGainIso: texteDe(profil.seuilDoubleGainIso),
      fullWellE: texteDe(profil.fullWellE),
      zpSys: texteDe(profil.zpSys),
      tailleRawMo: texteDe(profil.tailleRawMo),
      autonomieCipa: texteDe(profil.autonomieCipa),
    },
    iso: texteDe(profil.isoCapture),
    focale: String(profil.focaleMm),
    ouverture: String(profil.ouvertureN),
    capteurMode: profil.capteurMode,
    typeObjectif: profil.typeObjectif,
    suiviActif: profil.suiviActif,
    // Absents d'un fichier importé d'ailleurs : les valeurs de départ de la saisie reprennent.
    ...(profil.qualiteMes === undefined ? {} : { qualiteMes: profil.qualiteMes }),
    ...(profil.typeMonture === undefined ? {} : { typeMonture: profil.typeMonture }),
  }
}
