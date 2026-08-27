/**
 * La région « À propos » de la fiche : ce qu'on vise, et d'où viennent ses valeurs.
 *
 * T-0156 — la cible ne se saisit plus. Elle venait du catalogue OU de la main, et le second
 * régime coûtait plus qu'il ne rendait : une magnitude retouchée produit un verdict dont
 * personne ne sait plus d'où il vient, et une cible sans coordonnées ne chiffre ni la Lune,
 * ni l'extinction, ni son image. Le catalogue embarqué compte plus de 13 000 objets et la
 * recherche porte sur son étendue entière : l'objet qui en manque est un cas théorique.
 *
 * Les valeurs sont donc des lectures, empruntant la ligne des grandeurs non tracées
 * (§6.4) : elles viennent d'OpenNGC, pas d'une formule, et rien ne s'y déplie. T-0158 —
 * les trois dimensions apparentes se rangent sous leur propre sous-titre.
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

/**
 * Les dimensions apparentes du catalogue. Une valeur absente ne s'affiche pas : OpenNGC en
 * manque souvent, et trois lignes de « donnée manquante » occupent la place de trois lectures
 * sans rien en dire. Le vide complet, lui, se nomme une fois.
 */
function Dimensions({ objet }: ChampsCibleProps) {
  const lignes = [
    objet.majAxArcmin === null ? null : { libelle: 'Grand axe', valeur: `${objet.majAxArcmin} ’` },
    objet.minAxArcmin === null ? null : { libelle: 'Petit axe', valeur: `${objet.minAxArcmin} ’` },
    objet.posAngDeg === null
      ? null
      : { libelle: 'Angle de position', valeur: `${objet.posAngDeg} °` },
  ].filter((ligne) => ligne !== null)

  return (
    <>
      <h3>Dimensions</h3>
      {lignes.length === 0 ? (
        <p className="etat">{MANQUANTE}</p>
      ) : (
        lignes.map((ligne) => (
          <Lecture key={ligne.libelle} libelle={ligne.libelle} valeur={ligne.valeur} />
        ))
      )}
    </>
  )
}

export function ChampsCible({ objet }: ChampsCibleProps) {
  return (
    <section>
      <h2>À propos</h2>
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
      <Dimensions objet={objet} />
      <p className="etat">Valeurs du catalogue OpenNGC.</p>
    </section>
  )
}
