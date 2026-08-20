/**
 * Le panneau de droite : la séance, ses quatre onglets et le plan imprimable.
 *
 * Un seul onglet est monté à la fois — Explorer, Cible, Nuit, Filé. Le plan de session, lui,
 * est rendu en permanence : c'est la seule région qui survit à l'impression (§11.2).
 */

import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Etoile } from '../data/catalog.ts'
import { libelleZpSource } from '../data/equipment.ts'
import { PanneauExplorer } from './PanneauExplorer.tsx'
import { PanneauSeance } from './PanneauSeance.tsx'
import { PanneauFile } from './PanneauFile.tsx'
import { FicheCible } from './FicheCible.tsx'
import { PlanSessionVue } from './PlanSession.tsx'
import { RegionNuit } from './RegionNuit.tsx'
import { modeObjectif } from './PanneauMateriel.tsx'
import type { SaisieLieu, SaisieMateriel } from './app-saisie.ts'
import type { ChaineCalcul } from './app-calcul.ts'

export interface RegionSeanceProps {
  readonly chaine: ChaineCalcul
  readonly lieu: SaisieLieu
  readonly materiel: SaisieMateriel
  readonly catalogue: readonly ObjetCielProfond[]
  readonly etoiles: readonly Etoile[]
  /** §3.4 — la cible ouverte depuis le planétarium, `null` tant qu'aucune ne l'a été. */
  readonly cibleDuCiel: ObjetCielProfond | null
  readonly gaiaCharge: boolean
  readonly epoqueAnnee: number
  readonly modeNuitActif: boolean
}

export function RegionSeance(props: RegionSeanceProps) {
  const { chaine, lieu, materiel, catalogue } = props
  const { calcul } = chaine
  const mLimOeil = calcul.ok ? calcul.ciel.mLimOeil.value : null

  const contenus = {
    EXPLORER: (
      <PanneauExplorer
        modeObjectif={modeObjectif(materiel.typeObjectif)}
        gaiaCharge={props.gaiaCharge}
        profondeurMag={chaine.index.profondeurMag}
        mLimOeil={mLimOeil}
        epoqueAnnee={props.epoqueAnnee}
        modeNuit={props.modeNuitActif}
      />
    ),
    CIBLE:
      chaine.contexteFiche === null ? null : (
        <FicheCible
          {...chaine.contexteFiche}
          objetSelectionne={props.cibleDuCiel}
          site={chaine.site}
        />
      ),
    NUIT: calcul.ok ? (
      <RegionNuit
        nuit={calcul.nuit}
        ciel={calcul.ciel}
        offsetMidi={calcul.offsetMidi}
        planIndisponible={chaine.plan === null && catalogue.length === 0}
      />
    ) : null,
    FILE: chaine.panneauFile === null ? null : <PanneauFile {...chaine.panneauFile} />,
  }

  /* §11.2 — la seule région qui survit à l'impression : elle est nommée pour ça. */
  const planImprimable =
    calcul.ok && chaine.plan !== null && chaine.fenetreUtile !== null ? (
      <PlanSessionVue
        plan={chaine.plan}
        fenetreUtile={chaine.fenetreUtile}
        site={chaine.site}
        fovHDeg={calcul.optique.fovHDeg.value}
        fovLDeg={calcul.optique.fovLDeg.value}
        mLimOeil={calcul.ciel.mLimOeil.value}
        etoiles={props.etoiles}
        enTete={{
          dateIso: lieu.dateIso,
          lieu: `${lieu.latitude}° / ${lieu.longitude}° — Bortle ${lieu.bortle}`,
          materiel:
            `${materiel.focale} mm f/${materiel.ouverture} — ${calcul.boitier.libelle} · ` +
            `ISO ${calcul.iso.iso} · ${libelleZpSource(calcul.zeroSysteme)}`,
        }}
      />
    ) : null

  return (
    <PanneauSeance
      {...lieu}
      masque={chaine.masque}
      {...(calcul.ok ? { seuils: calcul.seuils } : {})}
      contenus={contenus}
      plan={planImprimable}
    />
  )
}
