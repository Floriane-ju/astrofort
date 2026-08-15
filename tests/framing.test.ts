/**
 * §6.1 verdict de domaine · §6.2 verdict de cadrage.
 *
 * Valeurs de référence : Annexe A et critères d'acceptation du PRD. Le fil directeur des
 * cas limites est toujours le même — une cible écartée l'est avec sa cause, et jamais avec
 * une proposition de recadrage logiciel.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ciblesDansFenetre,
  ficheCadrage,
  focaleIdeale,
  REFUS_RECADRAGE_LOGICIEL,
  verdictDomaine,
} from '../src/core/framing.ts'
import { profilOptique } from '../src/core/optics.ts'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'
import { BOITIER_REFERENCE, capteurEffectif } from '../src/data/equipment.ts'
import { CIBLES_EXEMPLES } from '../src/registry/verdicts.ts'

const REFERENCE = {
  focaleMm: 120,
  ouvertureN: 2.8,
  ...capteurEffectif(BOITIER_REFERENCE, 'FULL_FRAME'),
}
const OPTIQUE = profilOptique(REFERENCE)
const APSC = profilOptique({
  focaleMm: 120,
  ouvertureN: 2.8,
  ...capteurEffectif(BOITIER_REFERENCE, 'APSC_CROP'),
})

function catalogue(): readonly ObjetCielProfond[] {
  const racine = join(import.meta.dirname, '..', 'public', 'data')
  const lit = (nom: string): ArrayBuffer => {
    const octets = readFileSync(join(racine, nom))
    return octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer
  }
  return decodeObjets({
    enregistrements: lit('openngc-1.bin'),
    chaines: lit('openngc-noms-1.bin'),
  })
}

const OPENNGC = catalogue()

describe('verdict de domaine §6.1', () => {
  it('annonce un très grand champ et sa fenêtre de cadrage pour le profil de référence', () => {
    const verdict = verdictDomaine(OPTIQUE.fovHDeg.value)
    expect(verdict.domaine).toBe('DOMAINE_TRES_GRAND_CHAMP')
    expect(verdict.tailleMinDeg.value).toBeCloseTo(3.79, 2)
    expect(verdict.tailleMaxDeg.value).toBeCloseTo(5.69, 2)
    expect(verdict.phrase).toMatch(/Voie lactée/)
    expect(verdict.phrase).toMatch(/hors domaine/)
  })

  it('recalcule la fenêtre au basculement en APS-C sans changer de domaine', () => {
    const verdict = verdictDomaine(APSC.fovHDeg.value)
    expect(verdict.tailleMinDeg.value).toBeCloseTo(2.48, 2)
    expect(verdict.tailleMaxDeg.value).toBeCloseTo(3.72, 2)
    expect(verdict.domaine).toBe('DOMAINE_TRES_GRAND_CHAMP')
  })

  it('propose 5 à 8 cibles réelles du catalogue dans la fenêtre calculée', () => {
    const verdict = verdictDomaine(APSC.fovHDeg.value, OPENNGC)
    expect(verdict.cibles.length).toBeGreaterThanOrEqual(CIBLES_EXEMPLES.min)
    expect(verdict.cibles.length).toBeLessThanOrEqual(CIBLES_EXEMPLES.max)
    for (const cible of verdict.cibles) {
      const tailleDeg = cible.majAxArcmin! / 60
      expect(tailleDeg).toBeGreaterThanOrEqual(verdict.tailleMinDeg.value)
      expect(tailleDeg).toBeLessThanOrEqual(verdict.tailleMaxDeg.value)
    }
    expect(verdict.causeAbsence).toBeUndefined()
  })

  it('annonce l’absence de cible plutôt qu’une liste par défaut hors fenêtre', () => {
    // Aucun objet du catalogue ne mesure plusieurs dizaines de degrés.
    const verdict = verdictDomaine(300, OPENNGC)
    expect(verdict.cibles).toHaveLength(0)
    expect(verdict.causeAbsence).toMatch(/Aucune cible cataloguée/)
    expect(ciblesDansFenetre(OPENNGC, 100, 200)).toHaveLength(0)
  })
})

describe('verdict de cadrage §6.2', () => {
  const cadre = (tailleMajArcmin: number, tailleMinArcmin?: number, posAngDeg?: number) =>
    ficheCadrage({
      fovHDeg: OPTIQUE.fovHDeg.value,
      echApx: OPTIQUE.echApx.value,
      capteurHMm: REFERENCE.capteurHMm,
      tailleMajArcmin,
      ...(tailleMinArcmin === undefined ? {} : { tailleMinArcmin }),
      ...(posAngDeg === undefined ? {} : { posAngDeg }),
    })

  it('classe M31 en cadrage large et exploite son grand axe', () => {
    const fiche = cadre(190, 60, 35)
    expect(fiche.remplissage.value).toBeCloseTo(0.278, 3)
    expect(fiche.verdict).toBe('CADRAGE_LARGE')
    expect(fiche.faisable).toBe(true)
    expect(fiche.angleBoitierDeg).toBe(35)
    expect(fiche.noteOrientation).toMatch(/grand axe/)
  })

  it('exige une mosaïque et chiffre le facteur sur le temps total', () => {
    const fiche = cadre(900, 600)
    expect(fiche.verdict).toBe('MOSAIQUE_REQUISE')
    expect(fiche.nTuiles?.value).toBeGreaterThan(1)
    expect(fiche.nTuiles?.note).toMatch(/temps total/)
  })

  it('signale l’absence d’angle de position au lieu d’en afficher un arbitraire', () => {
    const fiche = cadre(190, 60)
    expect(fiche.angleBoitierDeg).toBeNull()
    expect(fiche.noteOrientation).toMatch(/ne donne pas son angle de position/)
    expect(fiche.noteOrientation).toMatch(/orientation par défaut/)
  })

  it('refuse le verdict « faisable » à une cible de 44 px, cause et focale à l’appui', () => {
    // M84 : 6,5’, soit 0,108° — 0,95 % du champ et 44 px de diamètre (§6.1).
    const fiche = cadre(6.5, 6.5)
    expect(fiche.diamPx.value).toBeCloseTo(44, 0)
    expect(fiche.faisable).toBe(false)
    expect(fiche.verdict).toBe('HORS_DOMAINE')
    expect(fiche.cause).toMatch(/0.95 % du champ/)
    expect(fiche.cause).toMatch(/44 px/)
    expect(fiche.focaleIdealeMm).toBeDefined()
  })

  it('ne propose jamais de compenser par un recadrage logiciel', () => {
    const fiche = cadre(6.5, 6.5)
    expect(fiche.cause).toContain(REFUS_RECADRAGE_LOGICIEL)
    expect(fiche.focaleIdealeMm?.note).toContain(REFUS_RECADRAGE_LOGICIEL)
    expect(REFUS_RECADRAGE_LOGICIEL).toMatch(/n’ajoute aucun pixel/)
  })

  it('nomme toujours une cause quand la cible est écartée', () => {
    for (const taille of [6.5, 30, 60]) {
      const fiche = cadre(taille, taille)
      if (!fiche.faisable) expect(fiche.cause?.length ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('focale nécessaire §6.1', () => {
  it('encadre la focale de M84 par la fenêtre C-05', () => {
    // Le PRD annonce « ordre de 4 200 mm », qui est la borne d’un remplissage au tiers du
    // champ. La valeur retenue vise 42 %, milieu de la fenêtre, et la plage couvre les deux.
    const focale = focaleIdeale(6.5 / 60, REFERENCE.capteurHMm)
    expect(focale.value).toBeCloseTo(5309, 0)
    expect(focale.range?.[0]).toBeCloseTo(4213, 0)
    expect(focale.range?.[1]).toBeCloseTo(6320, 0)
    expect(focale.formula.id).toBe('FOCALE_IDEALE')
  })
})
