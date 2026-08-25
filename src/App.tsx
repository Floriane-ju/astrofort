/**
 * L'application : un lieu, un matériel, une intention, et la scène au centre.
 *
 * Ce fichier ne dessine plus rien et ne calcule plus rien. Il tient les magasins partagés,
 * appelle la chaîne de calcul (`app-calcul.ts`) et distribue ses sorties aux cinq régions de
 * la coque : la barre haute, la scène, les cartes posées dessus, le panneau latéral et la
 * barre basse.
 *
 * Chaque nombre affiché reste dépliable jusqu'à sa formule, et chaque terme technique porte
 * sa définition au contact (§1.5.2, §10.1) — c'est le contrat, pas la mise en page.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { epoqueAnnee } from './core/horloges.ts'
import { abonneModeReseau, modeReseauCourant } from './data/degradation.ts'
import { gaiaCharge } from './data/bootstrap.ts'
import { Coque } from './ui/Coque.tsx'
import { Planetarium } from './ui/Planetarium.tsx'
import { PanneauMateriel, modeObjectif } from './ui/PanneauMateriel.tsx'
import { useTrancheScene, type EtatScene } from './ui/scene-etat.ts'
import { ouvreCible, useSeance } from './ui/seance-etat.ts'
import { BarreHaut } from './ui/BarreHaut.tsx'
import { BarreBas } from './ui/BarreBas.tsx'
import { CartesSeance, LateralSeance } from './ui/RegionSeance.tsx'
import { useSaisieLieu, useSaisieMateriel, useSaisiePoids } from './ui/app-saisie.ts'
import {
  useCatalogues,
  usePersistance,
  useSaisieRestauree,
  type SaisieRestauree,
} from './ui/app-donnees.ts'
import { profilAEnregistrer, siteAEnregistrer } from './ui/saisie-persistee.ts'
import { useChaineCalcul } from './ui/app-calcul.ts'
import { appliqueModeNuit, litEtatPersiste, type EtatModeNuit } from './ui/ModeNuit.tsx'
import { NiveauContext, type NiveauUtilisateur } from './ui/Terme.tsx'

const MS_PAR_JOUR = 86_400_000

/**
 * T-0056 — la tranche du magasin de scène dont l'application dépend vraiment : l'époque de
 * précession, arrondie au jour. La boucle republie l'instant affiché deux fois par seconde ;
 * l'écart de frontières qu'en tire l'onglet Explorer bouge de 0,014° par an. S'abonner à la
 * journée plutôt qu'à la milliseconde, c'est ne plus rendre l'arbre entier à cette cadence.
 */
export function epoqueAffichee(etat: EtatScene): number {
  return epoqueAnnee(new Date(Math.floor(etat.msAffiche / MS_PAR_JOUR) * MS_PAR_JOUR))
}

/**
 * §11.1 — le mode nuit reste actif au redémarrage.
 *
 * T-0140 — il ne s'allume plus seul au crépuscule : un basculement au rouge pendant la
 * préparation du matériel n'est pas demandé à l'instant où il survient.
 */
function useModeNuit(): [EtatModeNuit, (etat: EtatModeNuit) => void] {
  const [modeNuit, setModeNuit] = useState<EtatModeNuit>(litEtatPersiste)

  useEffect(() => appliqueModeNuit(modeNuit), [modeNuit])

  return [modeNuit, setModeNuit]
}

/**
 * §12.3 — la saisie enregistrée se relit avant tout le reste. L'application n'a qu'un lieu et
 * qu'un matériel : les monter sur les valeurs par défaut pour les remplacer ensuite ferait
 * calculer, afficher puis jeter une nuit qui n'est pas celle du site enregistré.
 */
export function App() {
  const restauree = useSaisieRestauree()
  if (restauree === null) return <p className="etat">Lecture des données enregistrées…</p>
  return <AppPrete restauree={restauree} />
}

function AppPrete({ restauree }: { readonly restauree: SaisieRestauree }) {
  const [niveau, setNiveau] = useState<NiveauUtilisateur>('DEBUTANT')
  const lieu = useSaisieLieu(restauree.lieu)
  const materiel = useSaisieMateriel(restauree.materiel)
  const poids = useSaisiePoids()
  const catalogues = useCatalogues()
  // §12.5 — l'état affiché suit les bascules, il n'est pas figé au démarrage.
  const modeReseau = useSyncExternalStore(abonneModeReseau, modeReseauCourant, () => 'EN_LIGNE')

  // Pointage, temps et intention : les deux magasins que la scène et les panneaux partagent.
  const anneeEpoque = useTrancheScene(epoqueAffichee)
  const { cible: cibleDuCiel, file } = useSeance()

  const chaine = useChaineCalcul({
    lieu,
    materiel,
    niveau,
    catalogue: catalogues.objets,
    etoiles: catalogues.etoiles,
    tPoseFileS: file.tPoseS,
    poids: poids.poids,
  })
  const { calcul } = chaine
  const [modeNuit, setModeNuit] = useModeNuit()

  // §12.3 — le lieu et le matériel s'enregistrent au fil de la saisie, masque d'horizon
  // relevé compris, et l'export les emporte tels qu'ils sont à l'écran.
  const persistance = usePersistance({
    site: siteAEnregistrer(lieu, chaine.masque),
    profil: profilAEnregistrer(materiel),
    surMasqueImporte: lieu.surPointsMasque,
    poids,
    erreurRestauration: restauree.erreur,
  })

  const gaia = catalogues.etat === null ? false : gaiaCharge(catalogues.etat.catalogues)
  const sbCiel = calcul.ok ? calcul.ciel.sbCiel.value : null

  const topbar = (
    <BarreHaut
      niveau={niveau}
      surNiveau={setNiveau}
      focale={materiel.focale}
      ouverture={materiel.ouverture}
      capteurMode={materiel.capteurMode}
      modeNuit={modeNuit}
      surModeNuit={setModeNuit}
      etat={catalogues.etat}
      modeReseau={modeReseau}
      persistance={persistance}
      catalogue={catalogues.objets}
      poids={poids}
      site={chaine.site}
      index={chaine.index}
      profils={chaine.profilsCadre}
      sbCiel={sbCiel}
    />
  )

  const panneauMateriel = (
    <PanneauMateriel
      {...materiel}
      {...(calcul.ok
        ? {
            lectures: {
              optique: calcul.optique,
              suivi: calcul.suivi,
              poseNpf: calcul.poseNpf,
              zeroSysteme: calcul.zeroSysteme,
              iso: calcul.iso,
              estimations: calcul.estimations,
              ...(calcul.noteRecadrage === undefined
                ? {}
                : { noteRecadrage: calcul.noteRecadrage }),
            },
          }
        : { erreur: calcul.erreur })}
    />
  )

  const scene = calcul.ok ? (
    <Planetarium
      site={chaine.site}
      masque={chaine.masque}
      etoiles={catalogues.etoiles}
      index={chaine.index}
      objets={catalogues.objets}
      constellations={catalogues.constellations}
      profils={chaine.profilsCadre}
      mLimOeil={calcul.ciel.mLimOeil.value}
      sbCiel={calcul.ciel.sbCiel.value}
      gaiaCharge={gaia}
      modeObjectif={modeObjectif(materiel.typeObjectif)}
      modeNuit={modeNuit.actif}
      {...(chaine.materielFile === null ? {} : { file: chaine.materielFile })}
      surSelectionObjet={ouvreCible}
    />
  ) : (
    <p className="erreur">{calcul.erreur}</p>
  )

  const regions = {
    chaine,
    lieu,
    materiel,
    catalogue: catalogues.objets,
    etoiles: catalogues.etoiles,
    cibleDuCiel: cibleDuCiel ?? null,
    gaiaCharge: gaia,
    epoqueAnnee: anneeEpoque,
    modeNuitActif: modeNuit.actif,
  }

  const barrebas = (
    <BarreBas
      latitude={lieu.latitude}
      surLatitude={lieu.surLatitude}
      longitude={lieu.longitude}
      surLongitude={lieu.surLongitude}
      altitude={lieu.altitude}
      surAltitude={lieu.surAltitude}
      bortle={lieu.bortle}
      surBortle={lieu.surBortle}
      sqm={lieu.sqm}
      surSqm={lieu.surSqm}
      surDateIso={lieu.surDateIso}
      masque={chaine.masque}
      pointsMasque={lieu.pointsMasque}
      surPointsMasque={lieu.surPointsMasque}
      {...(calcul.ok ? { seuils: calcul.seuils } : {})}
    />
  )

  return (
    <NiveauContext value={niveau}>
      <Coque
        topbar={topbar}
        scene={scene}
        cartes={<CartesSeance {...regions} materielRendu={panneauMateriel} />}
        lateral={<LateralSeance {...regions} />}
        barrebas={barrebas}
      />
    </NiveauContext>
  )
}
