/**
 * §12.3 — l'export JSON est la seule protection contre l'éviction pour ce qui ne se
 * retélécharge pas. Il n'a de valeur que si le réimport restaure sans perte.
 *
 * `fake-indexeddb/auto` fournit l'implémentation IndexedDB manquante à Node.
 */

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type PlanEnregistre, type ProfilMateriel, type SiteEnregistre } from '../src/data/db.ts'
import {
  ExportInvalideError,
  VERSION_EXPORT,
  exporteDonneesUtilisateur,
  importeDonneesUtilisateur,
} from '../src/data/persistence.ts'

const SITE: SiteEnregistre = {
  id: 'site-reference',
  nom: 'Annexe A',
  latitudeDeg: 46.391,
  longitudeDeg: 6.697,
  altitudeM: 500,
  fuseau: 'Europe/Zurich',
  bortleDeclare: 4.5,
  // Le masque édité à la main est précisément ce qu'une éviction détruirait sans retour.
  masqueHorizon: Array.from({ length: 360 }, (_, azimut) => (azimut < 90 ? 12 : 3)),
  masqueEstHypothese: false,
}

const PROFIL: ProfilMateriel = {
  id: 'profil-1',
  nom: '135 mm sur tracker',
  focaleMm: 135,
  ouvertureN: 2.8,
  typeObjectif: 'RECTILINEAIRE',
  boitierId: 'inconnu',
  capteurMode: 'FULL_FRAME',
  suiviActif: true,
  qualiteMes: 'SOIGNEE',
  typeMonture: 'TRACKER',
}

const PLAN: PlanEnregistre = {
  id: 'plan-1',
  nom: 'Nuit du 14 août',
  dateIso: '2026-08-14',
  siteId: SITE.id,
  profilId: PROFIL.id,
  versionRegistre: '1',
  contenu: { creneaux: [{ cible: 'M31', debut: '22:41', poses: 120 }] },
}

/** `db()` mémorise sa connexion : chaque test réécrit le jeu de départ plutôt que de
 * rouvrir une base neuve. */
beforeEach(async () => {
  const base = await db()
  const tx = base.transaction(['sites', 'profils', 'plans'], 'readwrite')
  await Promise.all([
    tx.objectStore('sites').put(SITE),
    tx.objectStore('profils').put(PROFIL),
    tx.objectStore('plans').put(PLAN),
    tx.done,
  ])
})

describe('export et réimport §12.3', () => {
  it('emporte toutes les données produites par l’utilisateur', async () => {
    const donnees = await exporteDonneesUtilisateur()
    expect(donnees.format).toBe('astrofort-export')
    expect(donnees.version).toBe(VERSION_EXPORT)
    expect(donnees.sites).toHaveLength(1)
    expect(donnees.profils).toHaveLength(1)
    expect(donnees.plans).toHaveLength(1)
  })

  it('restaure sans perte après une éviction du stockage', async () => {
    // Sérialisation réelle : c'est un fichier qui transite, pas des objets en mémoire.
    const fichier = JSON.stringify(await exporteDonneesUtilisateur())

    const base = await db()
    const vidage = base.transaction(['sites', 'profils', 'plans'], 'readwrite')
    await Promise.all([
      vidage.objectStore('sites').clear(),
      vidage.objectStore('profils').clear(),
      vidage.objectStore('plans').clear(),
      vidage.done,
    ])
    expect(await base.getAll('sites')).toHaveLength(0)

    await importeDonneesUtilisateur(JSON.parse(fichier))

    const apres = await exporteDonneesUtilisateur()
    expect(apres.sites[0]).toEqual(SITE)
    expect(apres.profils[0]).toEqual(PROFIL)
    expect(apres.plans[0]).toEqual(PLAN)
    expect(apres.sites[0]?.masqueHorizon).toHaveLength(360)
  })

  it('remplace l’entrée de même identifiant au lieu de la dupliquer', async () => {
    const renomme = { ...SITE, nom: 'Site renommé' }
    await importeDonneesUtilisateur({
      format: 'astrofort-export',
      version: VERSION_EXPORT,
      exporteLe: new Date().toISOString(),
      sites: [renomme],
      profils: [],
      plans: [],
    })
    const apres = await exporteDonneesUtilisateur()
    expect(apres.sites).toHaveLength(1)
    expect(apres.sites[0]?.nom).toBe('Site renommé')
  })

  it('refuse un fichier étranger sans écraser les données en place', async () => {
    await expect(importeDonneesUtilisateur({ format: 'autre-appli' })).rejects.toThrow(
      ExportInvalideError,
    )
    await expect(
      importeDonneesUtilisateur({ format: 'astrofort-export', version: 99 }),
    ).rejects.toThrow(/version 99/)
    await expect(importeDonneesUtilisateur('pas un objet')).rejects.toThrow(ExportInvalideError)
    expect((await exporteDonneesUtilisateur()).sites[0]).toEqual(SITE)
  })
})
