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
import { ciblesVisibles } from '../src/core/visibles.ts'
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


// --- T-0045 / T-0046 — la liste des visibles et le bouton « Voir » -----------------------

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

describe('T-0045 — l’onglet Cible propose ce que le ciel offre à cet instant', () => {
  const rendu = ficheAvecCatalogue([AU_DESSUS, AU_DESSOUS])

  it('remplace le choix brut dans le catalogue par la liste des visibles', () => {
    expect(rendu).toContain('Cibles visibles')
    expect(rendu).not.toContain('Choisir dans le catalogue')
  })

  it('liste l’objet au-dessus de l’horizon et tait celui qui est sous l’horizon', () => {
    expect(rendu).toContain('CIRCUMPOLAIRE')
    expect(rendu).not.toContain('JAMAIS_LEVE')
  })

  it('groupe les entrées par verdict, pour dire ce que le setup en fera', () => {
    expect(rendu).toMatch(/<optgroup label="(Œil nu|Jumelles|Télescope|Photo seule)"/)
  })

  it('annonce le compte réel de cibles au-dessus de l’horizon', () => {
    expect(rendu).toMatch(/1 cible au-dessus de l’horizon/)
  })

  it('annonce le plafond quand la liste déborde, plutôt que de tronquer en silence', () => {
    // 250 objets circumpolaires, tous distincts en magnitude : 200 listés, 250 annoncés.
    const foule = Array.from({ length: 250 }, (_, i) =>
      objetForge(`OBJ${i}`, 85, { vMag: 4 + i / 100 }),
    )
    const large = ficheAvecCatalogue(foule)
    expect(large).toMatch(/250 cibles au-dessus de l’horizon, les 200 plus brillantes listées/)
    expect(large).toContain('OBJ0')
    expect(large).not.toContain('OBJ249')
  })

  it('n’offre pas de bouton « Voir » tant qu’aucune cible visible n’est choisie', () => {
    // La fiche s’ouvre sur la cible de référence de §6.3, qui n’est dans aucun catalogue.
    expect(rendu).not.toContain('>Voir<')
  })
})

describe('T-0046 — « Voir » amène la cible au centre, et ne touche à rien d’autre', () => {
  it('pose l’azimut et la hauteur de l’objet sans changer le champ ni la rotation', () => {
    reinitialiseScene()
    const avant = etatScene().vue

    const [cible] = ciblesVisibles({
      catalogue: [AU_DESSUS],
      matriceCiel: cielInstantane(SITE, new Date(etatScene().msAffiche)).matrice,
      sbCiel: 21,
      mLimOeil: 6.1,
      dMm: OPTIQUE.dMm.value,
    })
    expect(cible).toBeDefined()

    // Le geste du bouton, tel qu'il est câblé dans la fiche.
    majVue({ azimutDeg: cible!.azimutDeg, hauteurDeg: cible!.hauteurDeg })

    const apres = etatScene().vue
    expect(apres.azimutDeg).toBeCloseTo(cible!.azimutDeg, 1)
    expect(apres.hauteurDeg).toBeCloseTo(cible!.hauteurDeg, 1)
    expect(apres.fovDeg).toBe(avant.fovDeg)
    expect(apres.rotationCadreDeg).toBe(avant.rotationCadreDeg)
    reinitialiseScene()
  })
})


// --- T-0048 — la cible vient du catalogue, ou elle est personnalisée ---------------------

const GLOBULAIRE = objetForge('GLOB', 85, { type: 'AMAS_GLOB', vMag: 7 })

describe('T-0049 — le type de l’objet se lit dans la liste', () => {
  const rendu = ficheAvecCatalogue([AU_DESSUS, GLOBULAIRE])

  it('porte le type de chaque objet, en français, dans son option', () => {
    expect(rendu).toContain('· galaxie ·')
    expect(rendu).toContain('· amas globulaire ·')
  })

  it('traduit du même coup le sélecteur « Type d’objet » de la fiche', () => {
    expect(rendu).not.toContain('>AMAS_GLOB<')
    expect(rendu).toContain('>nébuleuse planétaire<')
  })

  it('donne un libellé aux dix types du catalogue', () => {
    expect(TYPES_OBJET.filter((t) => LIBELLE_TYPE_OBJET[t].trim() === '')).toEqual([])
  })
})

describe('T-0050 — la liste se restreint à un type d’objet', () => {
  const rendu = ficheAvecCatalogue([AU_DESSUS, GLOBULAIRE])

  it('offre un filtre de type au-dessus de la liste', () => {
    expect(rendu).toContain('Type listé')
  })

  it('ne filtre rien par défaut : les deux cibles restent comptées', () => {
    expect(rendu).toContain('>Tous types<')
    expect(rendu).toMatch(/2 cibles au-dessus de l’horizon/)
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

  it('propose « Personnalisé » dans la liste pour rouvrir la saisie', () => {
    expect(ficheAvecCatalogue([AU_DESSUS], AU_DESSUS)).toContain('>Personnalisé<')
  })

  it('garde les valeurs du catalogue affichées, verrou posé', () => {
    const rendu = ficheAvecCatalogue([AU_DESSUS], AU_DESSUS)
    expect(rendu).toContain('value="CIRCUMPOLAIRE"')
    expect(rendu).toContain('value="6"')
  })
})
