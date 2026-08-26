/**
 * §11.2 — Export texte imprimable du plan de session.
 *
 * Un plan qui exige un écran allumé pendant trois heures est un plan qui vide la batterie.
 * L'export est donc du texte brut : imprimable, lisible sans l'application, et sans aucune
 * dépendance au réseau.
 *
 * TOUTE VALEUR PORTE SON UNITÉ. Un « 13 » sans unité est une source d'erreur de manipulation
 * sur le terrain — c'est la règle de §11.2, et elle vaut aussi dans l'export.
 */

import { dureeLisible } from './exposure.ts'
import type { PlanSession } from './session.ts'

const MINUTE_DEUX_CHIFFRES = 2
const S_PAR_MINUTE = 60

function heure(date: Date): string {
  return (
    `${date.getHours().toString().padStart(MINUTE_DEUX_CHIFFRES, '0')}:` +
    `${date.getMinutes().toString().padStart(MINUTE_DEUX_CHIFFRES, '0')}`
  )
}

export interface EnTetePlan {
  readonly dateIso: string
  readonly lieu: string
  readonly materiel: string
}

export function planEnTexte(plan: PlanSession, enTete: EnTetePlan): string {
  const lignes: string[] = []
  const titre = `PLAN DE SESSION — ${enTete.dateIso}`
  lignes.push(titre, '='.repeat(titre.length), '')
  lignes.push(`Lieu     : ${enTete.lieu}`)
  lignes.push(`Matériel : ${enTete.materiel}`)
  lignes.push('')

  const b = plan.budget
  lignes.push('BUDGET DE NUIT')
  lignes.push(`  Nuit exploitable    : ${b.disponibleMin.toFixed(0)} min`)
  lignes.push(`  Capture             : ${b.captureMin.toFixed(0)} min`)
  lignes.push(`  Calibration         : ${b.calibrationMin.toFixed(0)} min`)
  lignes.push(`  Mise en station     : ${b.miseEnStationMin.toFixed(0)} min`)
  lignes.push(`  Pointage            : ${b.pointageMin.toFixed(0)} min`)
  lignes.push(
    `  Total               : ${b.totalMin.value.toFixed(0)} min — ` +
      `${b.tient ? 'tient dans la nuit' : 'DÉPASSE la nuit disponible'}`,
  )
  lignes.push('')

  if (plan.etapes.length === 0) {
    lignes.push('AUCUNE CIBLE PLANIFIÉE')
    lignes.push(`  ${plan.message}`)
    if (plan.contrainteDominante !== undefined) lignes.push(`  ${plan.contrainteDominante}`)
    if (plan.alternative !== undefined) lignes.push(`  ${plan.alternative}`)
  } else {
    lignes.push('CHRONOLOGIE')
    for (const [index, etape] of plan.etapes.entries()) {
      const nom =
        etape.objet.nomsCommuns === ''
          ? etape.objet.designation
          : `${etape.objet.designation} — ${etape.objet.nomsCommuns.split('|')[0]}`
      lignes.push('')
      lignes.push(
        `${index + 1}. ${heure(etape.creneauAlloue.debut)} → ` +
          `${heure(etape.creneauAlloue.fin)}  ${nom}`,
      )
      lignes.push(`     Créneau alloué   : ${etape.dureeAlloueeMin.toFixed(0)} min`)
      lignes.push(`     Pose unitaire    : ${etape.tPoseS} s`)
      lignes.push(`     Nombre de poses  : ${etape.nPoses} poses`)
      lignes.push(`     Volume           : ${etape.volumeGo.toFixed(1)} Go`)
      lignes.push(
        `     Intégration      : ${dureeLisible(etape.integration.tRequisS.value)} requises` +
          (etape.integrationComplete ? '' : ` — à répartir sur ${etape.nNuits} nuits`),
      )
      lignes.push(`     Verdict          : ${etape.verdict ?? '[DONNÉE MANQUANTE]'}`)
      lignes.push(`     Cadrage          : ${etape.verdictCadrage}`)
      lignes.push(
        `     Fond de ciel     : ${etape.sbCielEffectif.toFixed(2)} mag/arcsec²` +
          ` (Lune : +${etape.deltaSbLuneMag.value.toFixed(2)} mag/arcsec²)`,
      )
      // Le score est sans dimension : « sur 1 » le dit, plutôt que de laisser un nombre nu.
      lignes.push(`     Score            : ${etape.score.value.toFixed(3)} sur 1`)
      lignes.push(`     Consigne         : ${etape.consigne}`)
      if (etape.creneau.retournementMeridien) {
        lignes.push(
          '     Méridien         : retournement obligatoire, orientation du capteur ' +
            'basculée de 180° — re-vérifier le cadrage, la séquence redémarre',
        )
      }
    }
  }

  if (plan.calibration !== null) {
    lignes.push('', 'CALIBRATION')
    for (const lot of plan.calibration.lots) {
      lignes.push(
        `  ${lot.type.padEnd('OFFSETS'.length)} : ${lot.nombre} images ` +
          `(${lot.plage[0]} à ${lot.plage[1]}) — ${lot.consigne}`,
      )
    }
    lignes.push(
      `  Surcoût de temps : ${plan.calibration.surcoutTempsMin.value.toFixed(0)} min`,
    )
    lignes.push(`  Dithering        : ${plan.calibration.dithering}`)
    for (const avertissement of plan.calibration.avertissements) {
      lignes.push(`  ! ${avertissement}`)
    }
  }

  if (plan.ciblesEcartees.length > 0) {
    lignes.push('', 'CIBLES ÉCARTÉES — avec leur cause')
    for (const ecartee of plan.ciblesEcartees) {
      lignes.push(`  ${ecartee.designation} [${ecartee.code}] : ${ecartee.cause}`)
    }
    lignes.push(
      `  Décompte par cause : ${Object.entries(plan.comptesEcartees)
        .map(([code, nombre]) => `${code} ${nombre} objets`)
        .join(', ')}`,
    )
  }

  if (plan.noteCouvertureCatalogue !== undefined) {
    lignes.push('', 'COUVERTURE DU CATALOGUE', `  ${plan.noteCouvertureCatalogue}`)
  }

  lignes.push('', 'MÉTÉO', `  ${plan.avertissementMeteo}`)
  lignes.push(
    '',
    'Durée totale de capture : ' + dureeLisible(b.captureMin * S_PAR_MINUTE) + '.',
  )
  return lignes.join('\n')
}
