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
