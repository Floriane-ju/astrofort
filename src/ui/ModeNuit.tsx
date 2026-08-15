/**
 * §11.1 — Mode nuit, et §11.2 — ergonomie de consultation nocturne.
 *
 * Les bâtonnets rétiniens assurent la vision nocturne ; leur sensibilité s'effondre au-delà
 * de 640 nm. Une lumière rouge profond est donc vue par les cônes sans les blanchir.
 * L'adaptation à l'obscurité demande 20 à 30 minutes et se détruit en QUELQUES SECONDES
 * de lumière blanche : le mode est global et sans exception, pas un thème sombre.
 *
 * L'extinction est faite par la palette, pas par un filtre de teinte : la feuille de style
 * bascule des variables dont les canaux vert et bleu sont strictement nuls. Un filtre posé
 * sur une interface claire laisserait la luminance globale trop élevée.
 */

import { useEffect, useState } from 'react'
import { K } from '../registry/constants.ts'
import { Etiquette, Terme } from './Terme.tsx'

export type TypeDalle = 'OLED' | 'LCD' | 'INCONNUE'
export type AutoActivation = 'JAMAIS' | 'AU_CREPUSCULE'

export interface EtatModeNuit {
  readonly actif: boolean
  readonly luminance: number
  readonly typeDalle: TypeDalle
  readonly autoActivation: AutoActivation
}

const CLE_STOCKAGE = 'astrofort.mode-nuit'
const LUMINANCE_NOMINALE = 1

export const ETAT_INITIAL: EtatModeNuit = Object.freeze({
  actif: false,
  luminance: LUMINANCE_NOMINALE,
  typeDalle: 'INCONNUE',
  autoActivation: 'JAMAIS',
})

/** Le mode reste actif au redémarrage et entre les vues (§11.1). */
export function litEtatPersiste(): EtatModeNuit {
  if (typeof localStorage === 'undefined') return ETAT_INITIAL
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE)
    return brut === null ? ETAT_INITIAL : { ...ETAT_INITIAL, ...(JSON.parse(brut) as object) }
  } catch {
    return ETAT_INITIAL
  }
}

export function ecritEtatPersiste(etat: EtatModeNuit): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat))
  } catch {
    // Stockage refusé : le mode reste utilisable, il ne survit simplement pas au rechargement.
  }
}

/**
 * Applique la palette au document. La transition est portée par la feuille de style : le
 * basculement est progressif, jamais un flash.
 */
export function appliqueModeNuit(etat: EtatModeNuit): void {
  if (typeof document === 'undefined') return
  const racine = document.documentElement
  racine.dataset.modeNuit = String(etat.actif)
  racine.style.setProperty('--luminance-nuit', String(etat.luminance))
}

/** §11.1 — auto-activation liée au crépuscule nautique de §8.1. */
export function doitSActiver(
  etat: EtatModeNuit,
  crepusculeNautique: Date | null,
  maintenant: Date,
): boolean {
  if (etat.actif) return true
  if (etat.autoActivation !== 'AU_CREPUSCULE' || crepusculeNautique === null) return false
  return maintenant.getTime() >= crepusculeNautique.getTime()
}

export interface ModeNuitProps {
  readonly etat: EtatModeNuit
  readonly surChangement: (etat: EtatModeNuit) => void
}

export function ModeNuit({ etat, surChangement }: ModeNuitProps) {
  const [dalleAnnoncee, setDalleAnnoncee] = useState(false)

  useEffect(() => {
    appliqueModeNuit(etat)
    ecritEtatPersiste(etat)
    if (etat.actif && etat.typeDalle === 'LCD') setDalleAnnoncee(true)
  }, [etat])

  const plancher = K('LUMINANCE_PLANCHER_MODE_NUIT')

  return (
    <section>
      <h2>Mode nuit — §11</h2>
      <Terme cle="mode_nuit" contexte={etat.actif ? 'actif' : 'inactif'} />
      <div className="champs">
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={etat.actif}
            onChange={(e) => surChangement({ ...etat, actif: e.target.checked })}
          />
          Activer le mode nuit
        </label>
        <label>
          <Etiquette cle="luminance_mode_nuit" />
          <input
            type="range"
            min={plancher}
            max={LUMINANCE_NOMINALE}
            step={plancher}
            value={etat.luminance}
            onChange={(e) => surChangement({ ...etat, luminance: Number(e.target.value) })}
          />
          <span className="etat">
            {(etat.luminance * 100).toFixed(0)} % de la luminance nominale, plancher{' '}
            {(plancher * 100).toFixed(0)} %
          </span>
        </label>
        <label>
          Type de dalle
          <select
            value={etat.typeDalle}
            onChange={(e) => surChangement({ ...etat, typeDalle: e.target.value as TypeDalle })}
          >
            <option value="INCONNUE">Je ne sais pas</option>
            <option value="OLED">OLED</option>
            <option value="LCD">LCD</option>
          </select>
        </label>
        <label>
          Activation automatique
          <select
            value={etat.autoActivation}
            onChange={(e) =>
              surChangement({ ...etat, autoActivation: e.target.value as AutoActivation })
            }
          >
            <option value="JAMAIS">Jamais — bascule manuelle</option>
            <option value="AU_CREPUSCULE">Au crépuscule nautique</option>
          </select>
        </label>
      </div>

      {etat.typeDalle === 'LCD' && dalleAnnoncee && (
        <p className="cause">
          Dalle LCD : le rétroéclairage traverse toujours, un noir affiché reste émissif et une
          fuite de bleu subsiste. Le mode nuit y est efficace mais imparfait. Sur OLED, un noir
          est un pixel éteint, donc une extinction réelle des canaux vert et bleu.
        </p>
      )}
      <p className="etat">
        Aucune animation non sollicitée n’est jouée en mode nuit : le curseur temporel du
        planétarium se mettra en pause dès qu’il existera, et le signalera.
      </p>
    </section>
  )
}
