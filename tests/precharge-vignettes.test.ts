/**
 * §6.4 — le préchargement des vignettes du haut de liste : ce qu'il demande, et ce qu'il ne
 * demande pas.
 *
 * Ce qui est vérifié ici est un DÉBIT, pas une image. Le motif des plafonds est le 429 d'un
 * service public : un préchargement correct est un préchargement qui compte ses requêtes, les
 * mène deux par deux, n'en émet aucune hors ligne, et abandonne un jeu de résultats périmé.
 *
 * Aucune désignation n'est écrite : les objets sont pris dans les paquets embarqués par
 * tranches disjointes. Le réseau est bouchonné par des promesses RETENUES — sans cela, la
 * concurrence ne s'observe pas : tout se résoudrait avant que la deuxième requête ne parte.
 *
 * ponytail: le réveil des vignettes déjà montées est vérifié au niveau du magasin
 * (`abonneImages`), pas à travers un rendu React — la suite tourne en environnement `node`,
 * sans DOM, donc aucun effet ne s'y exécute. Le jour où une dépendance de DOM entre au projet,
 * c'est ce test-là qui se double d'un rendu.
 */

import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeObjets, type ObjetCielProfond } from '../src/data/deepsky.ts'
import { db } from '../src/data/db.ts'
import { I } from '../src/registry/imagerie.ts'
import {
  abonneImages,
  oublieImages,
  prechargeVignettes,
} from '../src/ui/image-cible-memoire.ts'

function paquet(nom: string): ArrayBuffer {
  const octets = readFileSync(join(import.meta.dirname, '..', 'public', 'data', nom))
  return octets.buffer.slice(
    octets.byteOffset,
    octets.byteOffset + octets.byteLength,
  ) as ArrayBuffer
}

const CATALOGUE: readonly ObjetCielProfond[] = decodeObjets({
  enregistrements: paquet('openngc-1.bin'),
  chaines: paquet('openngc-noms-1.bin'),
})

const PLAFOND = I('VIGNETTES_PRECHARGEES_MAX')
const DEBIT = I('PRECHARGE_SIMULTANEE_MAX')

/** Une tranche du catalogue, disjointe des autres : deux jeux ne doivent rien partager. */
function tranche(rang: number, combien: number): readonly ObjetCielProfond[] {
  const debut = rang * combien
  const objets = CATALOGUE.slice(debut, debut + combien)
  expect(objets.length, 'le catalogue embarqué est trop court pour ce test').toBe(combien)
  return objets
}

// ---------------------------------------------------------------------------
// Réseau bouchonné, réponses RETENUES : c'est ce qui rend la concurrence observable
// ---------------------------------------------------------------------------

let appels: string[] = []
let enVol = 0
let volMax = 0
let retenues: (() => void)[] = []

function bouchonne(): void {
  vi.stubGlobal('fetch', (adresse: string) => {
    appels.push(String(adresse))
    enVol += 1
    volMax = Math.max(volMax, enVol)
    return new Promise((resolution) => {
      retenues.push(() => {
        enVol -= 1
        resolution({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })),
        })
      })
    })
  })
}

/** Nombre de tours de boucle accordés par requête attendue. Une garde, pas une attente. */
const TOURS_PAR_REQUETE = 40

/** Un tour de boucle : ce qui est retenu part, et les consommateurs reprennent la file. */
async function tour(): Promise<void> {
  for (const relache of retenues.splice(0)) relache()
  await new Promise((r) => setTimeout(r, 0))
}

/**
 * Attend que le préchargement ait émis `nouvelles` requêtes depuis `base`, puis se taise.
 *
 * L'attente porte sur un COMPTE, jamais sur un délai : entre deux requêtes, un consommateur
 * traverse IndexedDB — lecture puis écriture — et une suite qui tourne en parallèle d'une
 * soixantaine d'autres fichiers ne tient aucune promesse de calendrier.
 */
async function attend(base: number, nouvelles: number): Promise<void> {
  for (let garde = 0; garde <= (nouvelles + 1) * TOURS_PAR_REQUETE; garde += 1) {
    if (retenues.length === 0 && enVol === 0 && appels.length - base >= nouvelles) {
      // Deux tours de plus : une file vidée n'émet plus rien, et c'est ce qu'on vérifie.
      await tour()
      await tour()
      if (retenues.length === 0 && enVol === 0) return
    }
    await tour()
  }
  throw new Error(
    `préchargement inachevé : ${appels.length - base} requêtes sur ${nouvelles} attendues`,
  )
}

/** Précharge un jeu, et attend les requêtes NOUVELLES qu'il doit émettre — ni plus, ni moins. */
async function prechargeEtAttend(
  objets: readonly ObjetCielProfond[],
  nouvelles: number,
): Promise<void> {
  const base = appels.length
  prechargeVignettes(objets)
  await attend(base, nouvelles)
  expect(appels.length - base).toBe(nouvelles)
}

/** L'adresse d'une découpe porte les coordonnées : la désignation n'y figure pas. */
function requetesPour(objets: readonly ObjetCielProfond[]): number {
  return appels.filter((adresse) => {
    const parametres = new URL(adresse).searchParams
    return objets.some(
      (o) =>
        Number(parametres.get('ra')) === o.adDeg && Number(parametres.get('dec')) === o.decDeg,
    )
  }).length
}

beforeEach(async () => {
  appels = []
  retenues = []
  enVol = 0
  volMax = 0
  oublieImages()
  await (await db()).clear('images')
  bouchonne()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('plafond de requêtes §6.4', () => {
  it('ne demande que le haut de la liste, quelle que soit sa longueur', async () => {
    await prechargeEtAttend(tranche(0, PLAFOND * 3), PLAFOND)
  })

  it('mène les requêtes au débit du registre, jamais toutes de front', async () => {
    await prechargeEtAttend(tranche(1, PLAFOND), PLAFOND)
    expect(volMax).toBe(DEBIT)
  })

  it('ne redemande pas un jeu de résultats identique — la liste se recompose chaque minute', async () => {
    const jeu = tranche(2, DEBIT * 2)
    await prechargeEtAttend(jeu, jeu.length)
    await prechargeEtAttend(jeu, 0)
  })

  it('ne redemande pas une image déjà en mémoire de session', async () => {
    const jeu = tranche(3, DEBIT * 2)
    await prechargeEtAttend(jeu, jeu.length)

    // Un jeu ÉLARGI : le même début, une cible de plus. Seule la nouvelle doit partir.
    await prechargeEtAttend([...jeu, ...tranche(4, 1)], 1)
  })
})

describe('abandon d’un jeu périmé §6.4', () => {
  it('n’achève pas la liste précédente : ce qui n’est pas parti ne part plus', async () => {
    const perime = tranche(5, PLAFOND)
    const courant = tranche(6, DEBIT)

    prechargeVignettes(perime)
    await tour() // les premières requêtes partent, la file garde le reste
    expect(appels.length).toBeGreaterThan(0)

    await prechargeEtAttend(courant, courant.length)

    // Seules les requêtes déjà en vol au moment de la bascule ont pu concerner l'ancien jeu.
    expect(requetesPour(perime)).toBeLessThanOrEqual(DEBIT)
    expect(requetesPour(courant)).toBe(courant.length)
  })
})

describe('hors ligne §12.5', () => {
  it('n’émet aucune requête, et laisse le même jeu redemandable au retour du réseau', async () => {
    const jeu = tranche(7, DEBIT * 2)

    vi.stubGlobal('navigator', { onLine: false })
    await prechargeEtAttend(jeu, 0)

    // Le refus hors ligne ne compte pas pour une demande servie : sinon le retour du réseau
    // ne rattraperait jamais la liste affichée.
    vi.stubGlobal('navigator', { onLine: true })
    await prechargeEtAttend(jeu, jeu.length)
  })
})

describe('réveil des vignettes montées §6.4', () => {
  it('notifie le magasin à chaque image retenue', async () => {
    const jeu = tranche(8, DEBIT * 2)
    let reveils = 0
    const desabonne = abonneImages(() => {
      reveils += 1
    })

    await prechargeEtAttend(jeu, jeu.length)
    desabonne()

    // Sans cette notification, une ligne qui a conclu à l'absence resterait sans image
    // jusqu'au prochain montage du panneau.
    expect(reveils).toBe(jeu.length)
  })
})
