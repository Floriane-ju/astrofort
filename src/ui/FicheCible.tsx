/**
 * Fiche d'une cible : §6.1 domaine, §6.2 cadrage, §6.3 détectabilité, §7 pose, intégration
 * et calibration, §10.2 explication dépliable.
 *
 * Toute la valeur de l'application tient dans cet écran, et il se livre avant le
 * planétarium. Ce qui est vérifiable ici, c'est la chaîne complète : d'un lieu et d'un
 * matériel jusqu'à « pose 13 s, 252 images, 8,3 Go », chaque nombre dépliable jusqu'à sa
 * formule et sa constante source.
 *
 * Ce fichier n'assemble que les régions. La saisie est dans `fiche-cible-saisie.ts`, le
 * calcul dans `fiche-cible-calcul.ts`, le choix de la cible dans `ChampsCible.tsx` et les
 * verdicts dans `Verdicts.tsx`.
 */

import { useMemo, useState } from 'react'
import { SaisieRefuseeError } from '../registry/domains.ts'
import { PRESETS_SNR } from '../registry/verdicts.ts'
import type { ObjetCielProfond } from '../data/deepsky.ts'
import type { Site } from '../core/ephem.ts'
import { ChampsCible } from './ChampsCible.tsx'
import { Verdicts } from './Verdicts.tsx'
import { useSaisieCible } from './fiche-cible-saisie.ts'
import { useLuneCible } from './fiche-cible-lune.ts'
import { conseilsCible, evalue, type ContexteFiche, type Resultat } from './fiche-cible-calcul.ts'

export { LIBELLE_TYPE_OBJET, libelleObjet } from './libelles-objet.ts'

export interface FicheCibleProps extends ContexteFiche {
  /**
   * §3.4 — cible ouverte depuis le planétarium. Un clic sur un objet du ciel profond charge
   * ici son verdict de cadrage, de détectabilité et son plan de capture : le planétarium
   * n'est pas décoratif, c'est le point d'entrée vers les moteurs.
   */
  readonly objetSelectionne?: ObjetCielProfond | null
  /** T-0045 — le lieu, sans lequel « au-dessus de l'horizon » ne veut rien dire. */
  readonly site: Site
}

export function FicheCible(props: FicheCibleProps) {
  const [filtreDualBand, setFiltreDualBand] = useState(false)
  /** §7.2 — mode permissif C-03 = 3, désactivé par défaut : il se choisit, il ne se subit pas. */
  const [permissif, setPermissif] = useState(false)
  const [explicationDepliee, setExplicationDepliee] = useState(false)
  const [snrCible, setSnrCible] = useState(PRESETS_SNR[1]!.valeur)

  const saisie = useSaisieCible(props.objetSelectionne ?? null)
  const iso = props.iso
  /**
   * T-0089 — la Lune de cette cible, à l'instant affiché par le planétarium. Elle entre dans
   * la chaîne comme dans le plan de séance : c'est le fond de ciel qui change, donc la pose,
   * le nombre d'images et l'intégration.
   */
  const lune = useLuneCible(props.site, props.sbCiel, saisie.objetCatalogue)

  const calcul = useMemo<{ ok: true; r: Resultat } | { ok: false; erreur: string }>(() => {
    try {
      return { ok: true, r: evalue(props, saisie.saisie, snrCible, iso, lune, permissif) }
    } catch (erreur) {
      if (erreur instanceof SaisieRefuseeError) return { ok: false, erreur: erreur.message }
      throw erreur
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, saisie.saisie, snrCible, iso.iso, lune, permissif])

  const conseils = useMemo(
    () =>
      calcul.ok
        ? conseilsCible(props, calcul.r, {
            typeObjet: saisie.typeObjet,
            snrCible,
            filtreDualBand,
            explicationDepliee,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calcul, filtreDualBand, explicationDepliee, saisie.typeObjet, snrCible, props],
  )

  return (
    <>
      <ChampsCible saisie={saisie} />
      {!calcul.ok && <p className="erreur">{calcul.erreur}</p>}
      {calcul.ok && (
        <Verdicts
          r={calcul.r}
          snrCible={snrCible}
          surSnr={setSnrCible}
          isoLibelle={iso.message}
          zeroSysteme={props.zeroSysteme}
          conseils={conseils}
          permissif={permissif}
          surPermissif={setPermissif}
          filtreDualBand={filtreDualBand}
          surFiltre={setFiltreDualBand}
          surDeplie={setExplicationDepliee}
        />
      )}
    </>
  )
}
