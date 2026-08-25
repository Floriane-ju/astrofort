/**
 * §6.4 — le résolveur d'image de cible.
 *
 * Aucune coordonnée, aucune magnitude, aucune dimension n'est écrite ici : les objets
 * viennent des paquets embarqués, et les cas limites sont CHERCHÉS dans le catalogue par
 * prédicat plutôt que recopiés. Un test qui recopie une valeur de catalogue vérifie la
 * copie, pas la formule.
 *
 * Le réseau est bouchonné par une table d'adresses : ce qui est vérifié, c'est la conduite
 * du résolveur face à chaque réponse — 404, 429, carte de constellation, licence absente,
 * fichier trop lourd — jamais la disponibilité d'un service tiers.
 */

import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'
import { db } from '../src/data/db.ts'
import {
  candidatsTitre,
  apercuCadreRendable,
  champApercuCadreDeg,
  champDecoupeDeg,
  cleApercuCadre,
  fichierRefuse,
  imageEnCache,
  nomFichierDeUrl,
  resoudApercuCadre,
  resoudImage,
  urlDecoupe,
} from '../src/data/imagerie-cible.ts'
import { fovDeg } from '../src/core/optics.ts'
import { DOMAINES } from '../src/registry/domains.ts'
import { K } from '../src/registry/constants.ts'
import { CREDIT_RELEVE, HOTE_DECOUPE, I, MOTIFS_FICHIER_REFUSE } from '../src/registry/imagerie.ts'

const ARCMIN_PAR_DEG = 60
const OCTETS_PAR_KO = 1024

function paquet(nom: string): ArrayBuffer {
  const octets = readFileSync(join(import.meta.dirname, '..', 'public', 'data', nom))
  return octets.buffer.slice(
    octets.byteOffset,
    octets.byteOffset + octets.byteLength,
  ) as ArrayBuffer
}

const CATALOGUE: readonly ObjetCielProfond[] = [
  ...decodeObjets({ enregistrements: paquet('openngc-1.bin'), chaines: paquet('openngc-noms-1.bin') }),
  ...decodeObjets({ enregistrements: paquet('deepsky-1.bin'), chaines: paquet('deepsky-noms-1.bin') }),
]

/** Le premier objet du catalogue qui satisfait le prédicat — jamais une désignation en dur. */
function trouve(predicat: (o: ObjetCielProfond) => boolean): ObjetCielProfond {
  const objet = CATALOGUE.find(predicat)
  expect(objet, 'aucun objet du catalogue ne satisfait ce cas').toBeDefined()
  return objet!
}

const MESSIER = trouve((o) => /^M\d+$/.test(o.designation) && /NGC/i.test(o.nomsCommuns))
const SHARPLESS = trouve((o) => /^Sh2-\d+$/.test(o.designation))
const BARNARD = trouve((o) => /^B\d+$/.test(o.designation))

describe('candidats de titre §6.4', () => {
  it('interroge la désignation NGC avant le numéro Messier', () => {
    const candidats = candidatsTitre(MESSIER)
    expect(candidats[0]).toMatch(/^NGC \d+$/)
    expect(candidats).toContain(`Messier ${MESSIER.designation.slice(1)}`)
    // L'ordre est la mesure : le NGC couvre soixante objets sur soixante, le Messier
    // quarante-deux sur cent dix. L'inverser dégraderait la couverture de moitié.
    expect(candidats.indexOf(candidats[0]!)).toBeLessThan(
      candidats.indexOf(`Messier ${MESSIER.designation.slice(1)}`),
    )
  })

  it('dé-zéro-pade la désignation du catalogue', () => {
    const ngc = trouve((o) => /^NGC0\d+$/.test(o.designation))
    const numero = Number(ngc.designation.replace(/^NGC0*/, ''))
    expect(candidatsTitre(ngc)[0]).toBe(`NGC ${numero}`)
  })

  it('interroge un Sharpless par sa désignation et un Barnard par son nom déplié', () => {
    expect(candidatsTitre(SHARPLESS)).toContain(SHARPLESS.designation)
    const numero = Number(BARNARD.designation.slice(1))
    expect(candidatsTitre(BARNARD)).toContain(`Barnard ${numero}`)
  })

  it('ne rend ni doublon ni candidat vide, sur tout le catalogue', () => {
    for (const objet of CATALOGUE) {
      const candidats = candidatsTitre(objet)
      expect(new Set(candidats).size, objet.designation).toBe(candidats.length)
      expect(candidats.every((c) => c.trim() !== ''), objet.designation).toBe(true)
    }
  })

  /**
   * Restent sans candidat deux familles, et c'est délibéré dans les deux cas.
   *
   * Les composantes lettrées — « IC0186A », « IC0715NW » : la page du couple décrit un AUTRE
   * objet, et servir son image pour une composante serait la faute que §6.4 nomme.
   * Les entrées d'autres catalogues — ESO, PGC, MWSC, Melotte : aucune page encyclopédique ne
   * porte cette désignation, l'interroger serait une requête perdue d'avance.
   *
   * Les deux familles gardent la découpe à leurs propres coordonnées, qui est exacte.
   */
  it('ne laisse sans candidat que ce qu’il serait faux ou vain d’interroger', () => {
    const interrogeable = /^(NGC|IC)\s*\d+$|^M\s*\d+$|^B\s*\d+$|^Sh2-\d+$/i
    const sans = CATALOGUE.filter((o) => candidatsTitre(o).length === 0)
    expect(sans.length).toBeGreaterThan(0)
    for (const objet of sans) {
      expect(objet.designation, objet.designation).not.toMatch(interrogeable)
      expect(() => new URL(urlDecoupe(objet)), objet.designation).not.toThrow()
    }
  })

  it('donne un chemin vers une image à chaque entrée du catalogue, sans exception', () => {
    for (const objet of CATALOGUE) {
      const adresse = new URL(urlDecoupe(objet))
      expect(Number(adresse.searchParams.get('fov')), objet.designation).toBeGreaterThan(0)
    }
  })
})

describe('champ de la découpe §6.4', () => {
  it('applique la marge du registre à la taille du catalogue', () => {
    const objet = trouve((o) => {
      if (o.majAxArcmin === null) return false
      const brut = (o.majAxArcmin / ARCMIN_PAR_DEG) * I('MARGE_CADRAGE_DECOUPE')
      return brut > I('CHAMP_DECOUPE_MIN_DEG') && brut < I('CHAMP_DECOUPE_MAX_DEG')
    })
    expect(champDecoupeDeg(objet)).toBeCloseTo(
      (objet.majAxArcmin! / ARCMIN_PAR_DEG) * I('MARGE_CADRAGE_DECOUPE'),
      10,
    )
  })

  it('retombe sur le champ par défaut quand le catalogue ne donne aucune dimension', () => {
    const sansTaille = trouve((o) => o.majAxArcmin === null)
    expect(champDecoupeDeg(sansTaille)).toBe(I('CHAMP_DECOUPE_DEFAUT_DEG'))
  })

  it('borne le champ des deux côtés, sur tout le catalogue', () => {
    for (const objet of CATALOGUE) {
      const champ = champDecoupeDeg(objet)
      expect(champ, objet.designation).toBeGreaterThanOrEqual(I('CHAMP_DECOUPE_MIN_DEG'))
      expect(champ, objet.designation).toBeLessThanOrEqual(I('CHAMP_DECOUPE_MAX_DEG'))
    }
  })

  it('cadre le grand objet au plafond et le petit au plancher', () => {
    const grand = trouve(
      (o) =>
        o.majAxArcmin !== null &&
        (o.majAxArcmin / ARCMIN_PAR_DEG) * I('MARGE_CADRAGE_DECOUPE') > I('CHAMP_DECOUPE_MAX_DEG'),
    )
    expect(champDecoupeDeg(grand)).toBe(I('CHAMP_DECOUPE_MAX_DEG'))

    const petit = trouve(
      (o) =>
        o.majAxArcmin !== null &&
        o.majAxArcmin > 0 &&
        (o.majAxArcmin / ARCMIN_PAR_DEG) * I('MARGE_CADRAGE_DECOUPE') < I('CHAMP_DECOUPE_MIN_DEG'),
    )
    expect(champDecoupeDeg(petit)).toBe(I('CHAMP_DECOUPE_MIN_DEG'))
  })
})

describe('adresse de la découpe de relevé', () => {
  it('porte les coordonnées de l’objet et le champ calculé, sur l’hôte du registre', () => {
    const adresse = new URL(urlDecoupe(SHARPLESS))
    expect(`${adresse.protocol}//${adresse.host}`).toBe(HOTE_DECOUPE)
    expect(Number(adresse.searchParams.get('ra'))).toBe(SHARPLESS.adDeg)
    expect(Number(adresse.searchParams.get('dec'))).toBe(SHARPLESS.decDeg)
    expect(Number(adresse.searchParams.get('fov'))).toBe(champDecoupeDeg(SHARPLESS))
    expect(Number(adresse.searchParams.get('width'))).toBe(I('LARGEUR_VIGNETTE_PX'))
  })
})

describe('refus d’un fichier qui n’est pas l’objet §6.4', () => {
  it('refuse la carte de constellation servie en tête des pages Sharpless', () => {
    expect(fichierRefuse('Cassiopeia_IAU.svg')).toBe(true)
    expect(fichierRefuse('Orion_IAU.svg')).toBe(true)
  })

  it('accepte une découpe de relevé nommée par son objet', () => {
    for (const nom of ['NGC_0224_DSS.jpg', 'NGC_6543_PanS.jpg', 'NGC_7504_SDSS2.jpg']) {
      expect(fichierRefuse(nom), nom).toBe(false)
    }
  })

  it('refuse tout format vectoriel : un relevé du ciel n’est jamais vectoriel', () => {
    expect(fichierRefuse('M31.svg')).toBe(true)
    expect(fichierRefuse('M31.svgz')).toBe(true)
  })

  it('garde les motifs de refus au registre, et gelés', () => {
    expect(Object.isFrozen(MOTIFS_FICHIER_REFUSE)).toBe(true)
    expect(MOTIFS_FICHIER_REFUSE.length).toBeGreaterThan(0)
  })
})

describe('nom de fichier derrière une adresse d’image', () => {
  it('lit le fichier d’origine sous une adresse de vignette, pas la vignette', () => {
    // Le refus porte sur le format d'origine : une carte vectorielle est servie en PNG.
    expect(
      nomFichierDeUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Cassiopeia_IAU.svg/330px-Cassiopeia_IAU.svg.png',
      ),
    ).toBe('Cassiopeia_IAU.svg')
  })

  it('ignore les paramètres de suivi que l’API accroche à l’adresse', () => {
    expect(
      nomFichierDeUrl(
        'https://upload.wikimedia.org/wikipedia/commons/9/9d/NGC_0224_DSS.jpg?utm_source=fr.wikipedia.org',
      ),
    ).toBe('NGC_0224_DSS.jpg')
  })

  it('rend null sur une adresse illisible plutôt que de lever', () => {
    expect(nomFichierDeUrl('pas une adresse')).toBeNull()
    expect(nomFichierDeUrl('https://upload.wikimedia.org/')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Résolution complète, réseau bouchonné
// ---------------------------------------------------------------------------

type Reponse = { readonly statut: number; readonly corps?: unknown; readonly type?: string; readonly poids?: number }

let appels: string[] = []
let table: readonly [RegExp, Reponse][] = []

function bouchonne(entrees: readonly [RegExp, Reponse][]): void {
  table = entrees
  vi.stubGlobal('fetch', (adresse: string) => {
    appels.push(String(adresse))
    const trouvee = table.find(([motif]) => motif.test(String(adresse)))
    const reponse = trouvee?.[1] ?? { statut: 404 }
    return Promise.resolve({
      ok: reponse.statut >= 200 && reponse.statut < 300,
      status: reponse.statut,
      json: () => Promise.resolve(reponse.corps),
      blob: () =>
        Promise.resolve(
          new Blob([new Uint8Array(reponse.poids ?? 1024)], { type: reponse.type ?? 'image/jpeg' }),
        ),
    })
  })
}

const RESUME = (fichier: string): Reponse => ({
  statut: 200,
  corps: {
    originalimage: { source: `https://upload.wikimedia.org/wikipedia/commons/1/12/${fichier}` },
  },
})

const INFO = (licence: string | null): Reponse => ({
  statut: 200,
  corps: {
    query: {
      pages: {
        '-1': {
          imageinfo: [
            {
              thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/X.jpg/320px-X.jpg',
              extmetadata:
                licence === null
                  ? { Artist: { value: '<a href="#">Quelqu’un</a>' } }
                  : {
                      Artist: { value: '<a href="#">Quelqu’un</a>' },
                      LicenseShortName: { value: licence },
                    },
            },
          ],
        },
      },
    },
  },
})

const RESUME_MOTIF = /rest_v1\/page\/summary/
const INFO_MOTIF = /commons\.wikimedia\.org\/w\/api\.php/
const FICHIER_MOTIF = /upload\.wikimedia\.org/
const DECOUPE_MOTIF = /hips2fits/

/** Un objet du catalogue jamais encore résolu : le cache est un état partagé entre tests. */
let compteur = 0
function cibleNeuve(): ObjetCielProfond {
  const objet = CATALOGUE[compteur++ * 97 + 3]
  expect(objet).toBeDefined()
  return objet!
}

beforeEach(async () => {
  appels = []
  await (await db()).clear('images')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('résolution — source encyclopédique', () => {
  it('rend la vignette, son auteur et sa licence', async () => {
    bouchonne([
      [RESUME_MOTIF, RESUME('NGC_0224_DSS.jpg')],
      [INFO_MOTIF, INFO('CC BY-SA 4.0')],
      [FICHIER_MOTIF, { statut: 200 }],
    ])
    const image = await resoudImage(cibleNeuve())
    expect(image?.origine).toBe('ENCYCLOPEDIE')
    expect(image?.credit.licence).toBe('CC BY-SA 4.0')
    expect(image?.credit.auteur).toBe('Quelqu’un')
    // Le balisage que l'API laisse dans le champ auteur ne doit pas atteindre l'écran.
    expect(image?.credit.auteur).not.toMatch(/</)
    expect(image?.credit.lien).toContain('commons.wikimedia.org/wiki/File:')
  })

  it('demande la largeur du registre au service plutôt que l’original', async () => {
    bouchonne([
      [RESUME_MOTIF, RESUME('NGC_0224_DSS.jpg')],
      [INFO_MOTIF, INFO('CC BY-SA 4.0')],
      [FICHIER_MOTIF, { statut: 200 }],
    ])
    await resoudImage(cibleNeuve())
    const info = appels.find((a) => INFO_MOTIF.test(a))
    expect(info).toContain(`iiurlwidth=${I('LARGEUR_VIGNETTE_PX')}`)
  })
})

describe('résolution — repli sur la découpe de relevé', () => {
  it('replie quand aucune page n’existe', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const image = await resoudImage(cibleNeuve())
    expect(image?.origine).toBe('RELEVE')
    expect(image?.credit).toStrictEqual(CREDIT_RELEVE)
  })

  it('replie sur une carte de constellation, sans interroger la licence', async () => {
    bouchonne([
      [RESUME_MOTIF, RESUME('Cassiopeia_IAU.svg')],
      [INFO_MOTIF, INFO('CC BY-SA 4.0')],
      [DECOUPE_MOTIF, { statut: 200 }],
    ])
    const image = await resoudImage(cibleNeuve())
    expect(image?.origine).toBe('RELEVE')
    // Une carte refusée arrête la piste encyclopédique : rien à demander à Commons.
    expect(appels.some((a) => INFO_MOTIF.test(a))).toBe(false)
  })

  it('replie quand la licence ou l’auteur n’est pas lisible', async () => {
    bouchonne([
      [RESUME_MOTIF, RESUME('NGC_0224_DSS.jpg')],
      [INFO_MOTIF, INFO(null)],
      [DECOUPE_MOTIF, { statut: 200 }],
    ])
    expect((await resoudImage(cibleNeuve()))?.origine).toBe('RELEVE')
  })

  it('replie sur un 429 : la limite de débit d’un service n’engage pas l’autre', async () => {
    bouchonne([
      [RESUME_MOTIF, { statut: 429 }],
      [DECOUPE_MOTIF, { statut: 200 }],
    ])
    expect((await resoudImage(cibleNeuve()))?.origine).toBe('RELEVE')
  })

  it('refuse un corps qui n’est pas une image, même annoncé 200', async () => {
    bouchonne([
      [RESUME_MOTIF, RESUME('NGC_0224_DSS.jpg')],
      [INFO_MOTIF, INFO('CC BY-SA 4.0')],
      [FICHIER_MOTIF, { statut: 200, type: 'text/html' }],
      [DECOUPE_MOTIF, { statut: 200 }],
    ])
    expect((await resoudImage(cibleNeuve()))?.origine).toBe('RELEVE')
  })

  it('refuse un fichier au-delà du plafond de poids du registre', async () => {
    const trop = I('POIDS_VIGNETTE_MAX_KO') * OCTETS_PAR_KO + 1
    bouchonne([
      [RESUME_MOTIF, RESUME('NGC_0224_DSS.jpg')],
      [INFO_MOTIF, INFO('CC BY-SA 4.0')],
      [FICHIER_MOTIF, { statut: 200, poids: trop }],
      [DECOUPE_MOTIF, { statut: 200 }],
    ])
    expect((await resoudImage(cibleNeuve()))?.origine).toBe('RELEVE')
  })
})

describe('résolution — échec, cache et débit', () => {
  it('rend null sans lever quand les deux sources échouent', async () => {
    bouchonne([])
    await expect(resoudImage(cibleNeuve())).resolves.toBeNull()
  })

  it('rend null sans lever quand le réseau jette', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('réseau coupé')))
    await expect(resoudImage(cibleNeuve())).resolves.toBeNull()
  })

  it('lit le cache avant le réseau, et n’y retourne pas', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    const premiere = await resoudImage(cible)
    expect(premiere).not.toBeNull()
    const apresPremiere = appels.length

    const seconde = await resoudImage(cible)
    expect(appels.length).toBe(apresPremiere)
    expect(seconde?.source).toBe(premiere?.source)
    expect(await imageEnCache(cible.designation)).not.toBeNull()
  })

  it('n’émet qu’une résolution pour deux demandes simultanées', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    const [a, b] = await Promise.all([resoudImage(cible), resoudImage(cible)])
    expect(appels.filter((u) => DECOUPE_MOTIF.test(u))).toHaveLength(1)
    expect(a?.source).toBe(b?.source)
  })

  it('hors réseau et sans cache : rien, aucune requête, aucune erreur', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    vi.stubGlobal('navigator', { onLine: false })
    await expect(resoudImage(cibleNeuve())).resolves.toBeNull()
    expect(appels).toHaveLength(0)
  })

  it('hors réseau, une cible déjà consultée garde son image', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    const enLigne = await resoudImage(cible)
    expect(enLigne).not.toBeNull()

    appels = []
    vi.stubGlobal('navigator', { onLine: false })
    const horsLigne = await resoudImage(cible)
    expect(horsLigne?.source).toBe(enLigne?.source)
    expect(appels).toHaveLength(0)
  })

  it('range les octets, pas l’adresse : c’est ce qui survit à la coupure', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const image = await resoudImage(cibleNeuve())
    expect(image?.octets).toBeInstanceOf(Blob)
    expect(image?.octets.size).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// §6.2 — l'aperçu du cadre sur imagerie de fond
// ---------------------------------------------------------------------------

/**
 * Deux champs réels, aux deux bouts du domaine de focale : un grand-angle et un télescope,
 * sur le même capteur. Les valeurs viennent de la formule de §5.1 et des bornes de saisie,
 * jamais d'un nombre choisi pour que le test passe.
 */
const COTE_CAPTEUR_MM = 36
const FOV_COURT = fovDeg(COTE_CAPTEUR_MM, DOMAINES.focale_mm.min).value
const FOV_LONG = fovDeg(COTE_CAPTEUR_MM, DOMAINES.focale_mm.max).value

describe('champ de l’aperçu de cadrage §6.2', () => {
  it('élargit le champ du capteur par la marge du registre', () => {
    // La moitié du plus grand champ non borné : par construction, la marge s'y applique en
    // entier, donc l'écart mesuré est bien celui de la formule et pas celui d'un plafond.
    const dansLesBornes = I('CHAMP_DECOUPE_MAX_DEG') / I('MARGE_APERCU_CADRE') / 2
    expect(champApercuCadreDeg(dansLesBornes)).toBeCloseTo(
      dansLesBornes * I('MARGE_APERCU_CADRE'),
      10,
    )
  })

  it('dépend du matériel là où la vignette dépend de l’objet', () => {
    // C'est la raison d'être des deux fonctions. Si l'une variait comme l'autre, une seule
    // suffirait — et l'aperçu de cadrage ne dirait plus ce qui tient dans CE cadre.
    const petit = trouve((o) => o.majAxArcmin !== null && o.majAxArcmin > 0)
    const grand = trouve(
      (o) => o.majAxArcmin !== null && o.majAxArcmin > petit.majAxArcmin! * 2,
    )
    expect(champDecoupeDeg(petit)).not.toBe(champDecoupeDeg(grand))
    expect(champApercuCadreDeg(FOV_COURT)).not.toBe(champApercuCadreDeg(FOV_LONG))
  })

  /**
   * Le défaut que ce test empêche de revenir : le plafond de la vignette (10°) appliqué à
   * l'aperçu rendait, à 120 mm sur plein format, une découpe de 10° pour un cadre de 17°. Le
   * rectangle du capteur ne tenait pas dans l'image censée le montrer.
   */
  it('n’est JAMAIS plus étroit que le cadre, sur tout le domaine de focale', () => {
    const cotes = [36, 24, 23.5, 15.6]
    for (const cote of cotes) {
      for (let focale = DOMAINES.focale_mm.min; focale <= DOMAINES.focale_mm.max; focale *= 1.3) {
        const fovL = fovDeg(cote, focale).value
        if (!apercuCadreRendable(fovL)) continue
        expect(champApercuCadreDeg(fovL), `${cote} mm à ${focale.toFixed(0)} mm`).toBeGreaterThanOrEqual(
          fovL,
        )
      }
    }
  })

  it('plafonne au champ de la projection gnomonique, pas à celui de la vignette', () => {
    // La découpe est rendue en TAN : c'est la gnomonique de §3.3, et C-26 dit déjà où elle
    // cesse d'être lisible. Inventer un second plafond ici en ferait deux à maintenir.
    expect(champApercuCadreDeg(FOV_COURT)).toBe(K('FOV_MAX_GNOMONIQUE_DEG'))
    expect(champApercuCadreDeg(FOV_LONG)).toBeGreaterThanOrEqual(I('CHAMP_DECOUPE_MIN_DEG'))
  })

  it('renonce plutôt que de mentir au-delà du plafond gnomonique', () => {
    // Un fisheye de 8 mm couvre plus que ce que la TAN peut rendre : aucun rectangle posé sur
    // une telle découpe ne dirait quoi que ce soit du cadrage.
    expect(apercuCadreRendable(K('FOV_MAX_GNOMONIQUE_DEG') + 1)).toBe(false)
    expect(apercuCadreRendable(FOV_LONG)).toBe(true)
    expect(apercuCadreRendable(0)).toBe(false)
  })
})

describe('clé de cache de l’aperçu §6.2', () => {
  /**
   * Second défaut que ce test empêche de revenir : le plafond de la vignette écrasait tous les
   * champs supérieurs à 10° sur la même valeur, donc sur la même clé. Passer de 120 mm à 400 mm
   * ne redemandait rien et servait la découpe de l'ancien cadre.
   */
  it('sépare deux champs différents et ne sépare rien d’autre', () => {
    const focales = [DOMAINES.focale_mm.min]
    while (focales[focales.length - 1]! * 1.5 <= DOMAINES.focale_mm.max) {
      focales.push(focales[focales.length - 1]! * 1.5)
    }
    const cleDe = (f: number) => cleApercuCadre('M31', champApercuCadreDeg(fovDeg(36, f).value))
    const champDe = (f: number) => champApercuCadreDeg(fovDeg(36, f).value)

    for (const a of focales) {
      for (const b of focales) {
        if (!apercuCadreRendable(fovDeg(36, a).value)) continue
        if (!apercuCadreRendable(fovDeg(36, b).value)) continue
        // Deux focales partagent une clé exactement quand elles partagent un champ. Au-delà de
        // 75°, le plafond gnomonique les ramène toutes au même : la découpe est alors la même,
        // légitimement, et c'est le rectangle — calculé depuis `fovL` — qui porte la différence.
        expect(cleDe(a) === cleDe(b), `${a} mm vs ${b} mm`).toBe(champDe(a) === champDe(b))
      }
    }
  })

  it('sépare bien les focales où le plafond ne mord pas — le défaut d’origine', () => {
    // 120 mm et 400 mm sur plein format : les deux focales que le plafond de la vignette
    // confondait, en servant à 400 mm la découpe du cadre de 120 mm.
    expect(champApercuCadreDeg(fovDeg(36, 120).value)).not.toBe(
      champApercuCadreDeg(fovDeg(36, 400).value),
    )
  })

  it('porte le champ, donc le matériel', () => {
    const d = MESSIER.designation
    expect(cleApercuCadre(d, champApercuCadreDeg(FOV_COURT))).not.toBe(
      cleApercuCadre(d, champApercuCadreDeg(FOV_LONG)),
    )
  })

  it('n’est jamais la désignation nue : la vignette de §6.4 garde la sienne', () => {
    const d = MESSIER.designation
    expect(cleApercuCadre(d, champApercuCadreDeg(FOV_LONG))).not.toBe(d)
    expect(cleApercuCadre(d, champApercuCadreDeg(FOV_LONG))).toContain(d)
  })
})

describe('résolution de l’aperçu de cadrage §6.2', () => {
  it('demande la découpe au champ du capteur, et n’interroge aucune encyclopédie', () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    return resoudApercuCadre(cible, FOV_LONG).then((image) => {
      expect(image?.origine).toBe('RELEVE')
      // Une image encyclopédique est cadrée par son auteur : elle ne répond pas à la question.
      expect(appels.some((a) => RESUME_MOTIF.test(a))).toBe(false)
      expect(appels.some((a) => INFO_MOTIF.test(a))).toBe(false)
      const fov = Number(new URL(appels[0]!).searchParams.get('fov'))
      expect(fov).toBeCloseTo(champApercuCadreDeg(FOV_LONG), 10)
    })
  })

  it('redemande la vue quand la focale change, et pas quand elle ne change pas', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()

    await resoudApercuCadre(cible, FOV_LONG)
    const apresPremiere = appels.length
    await resoudApercuCadre(cible, FOV_LONG)
    expect(appels.length, 'même focale : rien à redemander').toBe(apresPremiere)

    await resoudApercuCadre(cible, FOV_COURT)
    expect(appels.length, 'autre focale : autre cadre, autre découpe').toBeGreaterThan(
      apresPremiere,
    )
  })

  it('n’invalide pas la vignette de §6.4 : les deux vues coexistent', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    const vignette = await resoudImage(cible)
    const apercu = await resoudApercuCadre(cible, FOV_LONG)

    expect(vignette).not.toBeNull()
    expect(apercu).not.toBeNull()
    expect(apercu?.source).not.toBe(vignette?.source)
    // La vignette est toujours là, sous sa propre clé, et n'a pas été écrasée.
    expect((await imageEnCache(cible.designation))?.source).toBe(vignette?.source)
  })

  it('hors réseau : rien, aucune requête — c’est la ligne §12.5 de cette vue', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    vi.stubGlobal('navigator', { onLine: false })
    await expect(resoudApercuCadre(cibleNeuve(), FOV_LONG)).resolves.toBeNull()
    expect(appels).toHaveLength(0)
  })

  it('rend null sans lever quand le service échoue', async () => {
    bouchonne([])
    await expect(resoudApercuCadre(cibleNeuve(), FOV_LONG)).resolves.toBeNull()
  })

  it('n’émet qu’une découpe pour deux demandes simultanées au même cadre', async () => {
    bouchonne([[DECOUPE_MOTIF, { statut: 200 }]])
    const cible = cibleNeuve()
    await Promise.all([resoudApercuCadre(cible, FOV_LONG), resoudApercuCadre(cible, FOV_LONG)])
    expect(appels.filter((u) => DECOUPE_MOTIF.test(u))).toHaveLength(1)
  })
})
