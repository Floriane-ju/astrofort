/**
 * La région « Cible » de la fiche : ce qu'on vise, et d'où viennent ses valeurs.
 *
 * T-0156 — la cible ne se saisit plus. Elle venait du catalogue OU de la main, et le second
 * régime coûtait plus qu'il ne rendait : une magnitude retouchée produit un verdict dont
 * personne ne sait plus d'où il vient, et une cible sans coordonnées ne chiffre ni la Lune,
 * ni l'extinction, ni son image. Le catalogue embarqué compte plus de 13 000 objets et la
 * recherche porte sur son étendue entière : l'objet qui en manque est un cas théorique.
 *
 * Les six valeurs sont donc des lectures, empruntant la ligne des grandeurs non tracées
 * (§6.4) : elles viennent d'OpenNGC, pas d'une formule, et rien ne s'y déplie.
 */

import type { ObjetCielProfond } from '../data/deepsky.ts'
import { Etiquette } from './Terme.tsx'
import { LIBELLE_TYPE_OBJET } from './libelles-objet.ts'

/** §6.3 — ce que le catalogue ne porte pas se nomme, et aucune saisie n'y changera rien. */
const MANQUANTE = '[DONNÉE MANQUANTE]'

export interface ChampsCibleProps {
  readonly objet: ObjetCielProfond
}

function Lecture({
  libelle,
  valeur,
}: {
  readonly libelle: string
  readonly valeur: string
}) {
  return (
    <p className="tracee tracee-vide">
      <span>{libelle}</span>
      <span className="tracee-valeur">{valeur}</span>
    </p>
  )
}

/** Une dimension du catalogue, en minutes d'arc, ou son absence nommée. */
function arcmin(valeur: number | null): string {
  return valeur === null ? MANQUANTE : `${valeur} ’`
}

export function ChampsCible({ objet }: ChampsCibleProps) {
  return (
    <section>
      <h2>Cible</h2>
      <Lecture libelle="Désignation" valeur={objet.designation} />
      <Lecture libelle="Type d’objet" valeur={LIBELLE_TYPE_OBJET[objet.type]} />
      <p className="tracee tracee-vide">
        <span>
          <Etiquette cle="magnitude_integree" />
        </span>
        <span className="tracee-valeur">
          {objet.vMag === null ? MANQUANTE : objet.vMag}
        </span>
      </p>
      <Lecture libelle="Grand axe" valeur={arcmin(objet.majAxArcmin)} />
      <Lecture libelle="Petit axe" valeur={arcmin(objet.minAxArcmin)} />
      <Lecture
        libelle="Angle de position"
        valeur={objet.posAngDeg === null ? MANQUANTE : `${objet.posAngDeg} °`}
      />
      <p className="etat">Valeurs du catalogue OpenNGC.</p>
    </section>
  )
}
