/**
 * Livrable vérifiable du Lot 2 : pour une cible et un setup, l'écran produit un verdict
 * dépliable jusqu'à sa formule, une pose avec sa plage utile, une durée d'intégration et un
 * plan de calibration.
 *
 * Le rendu statique suffit : rien n'est à cliquer pour que la chaîne §6 → §7 → §10.2
 * produise ses sorties. Le catalogue, lui, n'est décodé qu'après vérification d'intégrité
 * des paquets — l'écran par défaut travaille donc sur la cible de référence de §6.3.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { ouvreCarte } from '../src/ui/coque-etat.ts'
import { FicheCible, LIBELLE_TYPE_OBJET } from '../src/ui/FicheCible.tsx'
import { lignesCatalogue } from '../src/core/cibles-liste.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import { profilOptique } from '../src/core/optics.ts'
import {
  BOITIER_REFERENCE,
  capteurEffectif,
  isoRecommande,
  pointZeroSysteme,
} from '../src/data/equipment.ts'
import { etatScene, majVue, reinitialiseScene } from '../src/ui/scene-etat.ts'
import type { Site } from '../src/core/ephem.ts'
import { TYPES_OBJET, type ObjetCielProfond } from '../src/data/deepsky.ts'

// T-0113 — la fiche vit dans la carte Cible, posée sur la scène. Elle démarre repliée tant
// qu'aucun objet n'a été désigné : c'est elle que ce fichier interroge, dépliée.
ouvreCarte('CIBLE')
const ecran = renderToStaticMarkup(<App />)

describe('fiche de cible — écran par défaut, M33 depuis le site de l’Annexe A', () => {
  it('annonce le domaine du setup et sa fenêtre de cadrage', () => {
    expect(ecran).toContain('DOMAINE_TRES_GRAND_CHAMP')
    expect(ecran).toContain('3.79')
    expect(ecran).toContain('5.69')
  })

  it('produit le verdict de détectabilité de M33 avec sa brillance et son contraste', () => {
    // 23,0148 mag/arcsec² et −2,0648 : le PRD écrit 23,02 et −2,07, arrondis obtenus avec
    // le facteur 8,63 plutôt qu’avec π/4 × 3600 calculé.
    expect(ecran).toContain('23.01')
    expect(ecran).toContain('-2.06')
    expect(ecran).toContain('PHOTO_SEULE')
  })

  it('ne présente jamais photo seulement comme un refus, mais comme une durée', () => {
    expect(ecran).toMatch(/Ce n’est pas un refus/)
    expect(ecran).toMatch(/d’intégration/)
  })

  it('affiche la pose avec sa plage utile, présentée comme équivalente', () => {
    // Le profil par défaut est sans suivi : c'est la NPF, 2,10 s, qui plafonne la pose, et
    // le régime bascule en LIMITE_SUIVI avec sa cause. La plage reste [t/2 ; t×2].
    expect(ecran).toMatch(/poser 2 s — de 1 à 4 s, c’est équivalent/)
    expect(ecran).toContain('LIMITE_SUIVI')
    expect(ecran).toMatch(/bruit de lecture dominera/)
  })

  it('déplie chaque nombre jusqu’à sa formule et sa constante source', () => {
    expect(ecran).toContain('SB_obj = m_int + 2,5 × log10( aire_arcsec2 )')
    expect(ecran).toContain('t_opt = C × RN² / E_ciel')
    expect(ecran).toContain('T_requis = SNR_cible² × ( E_obj + E_ciel + RN² / t_pose ) / E_obj²')
    expect(ecran).toContain('C-03')
  })

  it('nomme le facteur dominant et propose un levier gratuit avant tout achat', () => {
    expect(ecran).toContain('sb_obj')
    expect(ecran).toMatch(/Levier de premier rang : se déplacer vers un site plus sombre/)
  })

  it('prescrit un plan de calibration, sans jamais offrir d’écran de calibration', () => {
    expect(ecran).toContain('FLATS')
    expect(ecran).toContain('DARKS')
    expect(ecran).toContain('OFFSETS')
    expect(ecran).toMatch(/bague de mise au point/)
    // Le point zéro système reste une lecture : aucun champ de saisie ne le vise.
    expect(ecran).not.toMatch(/<input[^>]*(zp|calibr)/i)
  })

  it('affiche le budget de stockage et la loi en racine du temps', () => {
    expect(ecran).toMatch(/Go de carte/)
    expect(ecran).toMatch(/QUADRUPLE LE TEMPS/)
  })
})


// --- T-0046 / T-0048 — le choix de la cible, et ce que la fiche en fait ------------------

/** Annexe A. Depuis 44,84° N, δ = +85° ne se couche jamais et δ = −85° ne se lève jamais. */
const SITE: Site = { latitudeDeg: 44.84, longitudeDeg: -0.58, altitudeM: 20 }
const CAPTEUR = capteurEffectif(BOITIER_REFERENCE, 'FULL_FRAME')
const OPTIQUE = profilOptique({ focaleMm: 120, ouvertureN: 2.8, ...CAPTEUR })

function objetForge(
  designation: string,
  decDeg: number,
  partiel: Partial<ObjetCielProfond> = {},
): ObjetCielProfond {
  return {
    designation,
    nomsCommuns: '',
    adDeg: 0,
    decDeg,
    type: 'GALAXIE',
    majAxArcmin: 10,
    minAxArcmin: 6,
    posAngDeg: null,
    vMag: 6,
    bMag: null,
    surfBr: null,
    ...partiel,
  }
}

const AU_DESSUS = objetForge('CIRCUMPOLAIRE', 85)
const AU_DESSOUS = objetForge('JAMAIS_LEVE', -85)

function ficheAvecCatalogue(
  catalogue: readonly ObjetCielProfond[],
  objetSelectionne: ObjetCielProfond | null = null,
): string {
  return renderToStaticMarkup(
    <FicheCible
      objetSelectionne={objetSelectionne}
      site={SITE}
      optique={OPTIQUE}
      capteurHMm={CAPTEUR.capteurHMm}
      pitchUm={CAPTEUR.pitchUm}
      ouvertureN={2.8}
      boitier={BOITIER_REFERENCE}
      zeroSysteme={pointZeroSysteme(BOITIER_REFERENCE)}
      iso={isoRecommande(BOITIER_REFERENCE)}
      sbCiel={21}
      mLimOeil={6.1}
      tMaxS={2.1}
      catalogue={catalogue}
      bortle={4}
      suiviActif={false}
      focaleMm={120}
    />,
  )
}

describe('T-0128 — la fiche décrit la cible, elle ne la choisit plus', () => {
  const rendu = ficheAvecCatalogue([AU_DESSUS, AU_DESSOUS])

  it('ne porte plus ni liste des visibles, ni filtre de type, ni bouton « Voir »', () => {
    // Les trois ont rejoint le panneau « Toutes les cibles » : les garder ici rendrait le
    // catalogue accessible par deux chemins, ce que T-0128 supprime.
    expect(rendu).not.toContain('Cibles visibles')
    expect(rendu).not.toContain('Type listé')
    expect(rendu).not.toContain('>Voir<')
    expect(rendu).not.toMatch(/<optgroup/)
  })

  it('garde les six champs qui décrivent la cible', () => {
    for (const champ of [
      'Désignation',
      'Type d’objet',
      'Grand axe',
      'Petit axe',
      'Angle de position',
    ]) {
      expect(rendu, champ).toContain(champ)
    }
  })
})

describe('T-0046 — « Voir » amène la cible au centre, et ne touche à rien d’autre', () => {
  it('pose l’azimut et la hauteur de l’objet sans changer le champ ni la rotation', () => {
    reinitialiseScene()
    const avant = etatScene().vue

    const [ligne] = lignesCatalogue({
      catalogue: [AU_DESSUS],
      matriceCiel: cielInstantane(SITE, new Date(etatScene().msAffiche)).matrice,
      sbCiel: 21,
      mLimOeil: 6.1,
      dMm: OPTIQUE.dMm.value,
      fovHDeg: OPTIQUE.fovHDeg.value,
      echApx: OPTIQUE.echApx.value,
      capteurHMm: CAPTEUR.capteurHMm,
    })
    expect(ligne).toBeDefined()
    expect(ligne!.hauteurDeg).toBeGreaterThan(0)

    // Le geste du bouton, tel qu'il est câblé dans le panneau des cibles.
    majVue({ azimutDeg: ligne!.azimutDeg, hauteurDeg: ligne!.hauteurDeg })

    const apres = etatScene().vue
    expect(apres.azimutDeg).toBeCloseTo(ligne!.azimutDeg, 1)
    expect(apres.hauteurDeg).toBeCloseTo(ligne!.hauteurDeg, 1)
    expect(apres.fovDeg).toBe(avant.fovDeg)
    expect(apres.rotationCadreDeg).toBe(avant.rotationCadreDeg)
    reinitialiseScene()
  })
})


// --- T-0048 — la cible vient du catalogue, ou elle est personnalisée ---------------------

const GLOBULAIRE = objetForge('GLOB', 85, { type: 'AMAS_GLOB', vMag: 7 })

describe('T-0049 — les types du catalogue se lisent en français', () => {
  const rendu = ficheAvecCatalogue([AU_DESSUS, GLOBULAIRE])

  it('traduit le sélecteur « Type d’objet » de la fiche', () => {
    expect(rendu).not.toContain('>AMAS_GLOB<')
    expect(rendu).toContain('>nébuleuse planétaire<')
  })

  it('donne un libellé aux dix types du catalogue', () => {
    expect(TYPES_OBJET.filter((t) => LIBELLE_TYPE_OBJET[t].trim() === '')).toEqual([])
  })
})

describe('T-0051 — une cible du catalogue ne se saisit plus', () => {
  it('s’ouvre en personnalisé : aucun champ verrouillé', () => {
    const rendu = ficheAvecCatalogue([AU_DESSUS])
    expect(rendu).not.toMatch(/readonly/i)
    expect(rendu).not.toMatch(/disabled/i)
  })

  it('verrouille les six champs d’une cible venue du catalogue', () => {
    const rendu = ficheAvecCatalogue([AU_DESSUS], AU_DESSUS)
    // Cinq <input> en lecture seule, et le <select> de type désactivé — un <select> ne
    // connaît pas readonly.
    expect(rendu.match(/<input[^>]*readonly/gi)).toHaveLength(5)
    expect(rendu).toMatch(/<select[^>]*disabled/i)
  })

  it('garde un chemin pour rouvrir la saisie, la liste des visibles disparue', () => {
    // T-0128 — l'option « Personnalisé » du `<select>` est devenue un bouton : le verrou de
    // T-0051 ne serait plus qu'une impasse sans geste pour en sortir.
    const rendu = ficheAvecCatalogue([AU_DESSUS], AU_DESSUS)
    expect(rendu).toContain('>Cible personnalisée<')
    expect(ficheAvecCatalogue([AU_DESSUS])).not.toContain('>Cible personnalisée<')
  })

  it('garde les valeurs du catalogue affichées, verrou posé', () => {
    const rendu = ficheAvecCatalogue([AU_DESSUS], AU_DESSUS)
    expect(rendu).toContain('value="CIRCUMPOLAIRE"')
    expect(rendu).toContain('value="6"')
  })
})
