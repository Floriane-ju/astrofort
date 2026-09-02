/**
 * T-0194 — les deux échelles de `styles.css`, et le retour d'état des contrôles.
 *
 * La feuille garantit déjà qu'aucune COULEUR n'y est écrite en dur (`mode-nuit.test.tsx`) :
 * c'est ce qui rend le basculement de §11.1 total. Les écarts et les tailles de texte
 * relèvent de la même mécanique et n'avaient pas la même garantie — d'où vingt et une
 * valeurs d'espacement et treize corps de texte, dont cinq tenaient dans un dixième de rem.
 *
 * Ce qui est vérifié ici n'est pas une valeur mais une DISCIPLINE : un écart ou un corps de
 * texte ajouté demain doit citer un pas de l'échelle, pas en inventer un seizième. Le test
 * lit le texte de la feuille, comme ses voisins, parce qu'une règle de style ne casse aucun
 * rendu quand elle dérive — elle se contente de désaligner l'interface d'un pixel à la fois.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

/** La feuille moins ses commentaires : une valeur citée en prose n'est pas une déclaration. */
const REGLES = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** Les déclarations d'une propriété, valeur brute, hors blocs de commentaire. */
function declarations(motif: RegExp): readonly string[] {
  return [...REGLES.matchAll(motif)].map((m) => m[1]!.trim())
}

describe('T-0194 — l’échelle d’espacement', () => {
  const ESPACEMENT =
    /^\s*(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block|inline-start))?:\s*([^;]+);/gm

  it('déclare sept pas, et rien entre eux', () => {
    const pas = [...CSS.matchAll(/^ {2}--pas-(\d): ([^;]+);/gm)].map((m) => m[2]!)
    expect(pas).toEqual(['0.125rem', '0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem'])
  })

  it('ne laisse aucun écart écrit en dur dans une propriété d’espacement', () => {
    // `-1px` fait exception : ce n'est pas un écart mais la ruse qui sort
    // `.scene-description` du flux visuel sans la sortir de l'arbre d'accessibilité.
    for (const valeur of declarations(ESPACEMENT)) {
      if (valeur === '-1px') continue
      expect(valeur, valeur).not.toMatch(/(?<![\w.-])[0-9]*\.?[0-9]+(rem|px|em)\b/)
    }
  })

  it('garde les gabarits hors de l’échelle : ils mesurent des objets, pas de l’air', () => {
    // Un pas d'espacement qui dimensionnerait une barre ou une carte ferait dépendre la
    // hauteur de la coque du grain des marges — deux réglages qui n'ont rien à voir.
    for (const jeton of ['barre-haut', 'barre-bas', 'lateral', 'carte-large', 'bulle-large']) {
      const valeur = new RegExp(`--${jeton}: ([^;]+);`).exec(CSS)?.[1]
      expect(valeur, jeton).toMatch(/^[\d.]+rem$/)
    }
  })
})

describe('T-0194 — l’échelle typographique', () => {
  it('déclare six rangs, strictement décroissants', () => {
    const rangs = [...CSS.matchAll(/^ {2}--texte-[a-z]+: ([\d.]+)rem;/gm)].map((m) =>
      Number(m[1]),
    )
    expect(rangs).toHaveLength(6)
    for (let i = 1; i < rangs.length; i += 1) {
      expect(rangs[i]!, `rang ${i}`).toBeLessThan(rangs[i - 1]!)
    }
  })

  it('ne laisse aucun corps de texte écrit en dur', () => {
    // Deux exceptions, déclarées dans la feuille : `.icone` porte la taille d'un GLYPHE, pas
    // d'un texte, et `.tracee-plage` se règle en `em` sur ce qui la contient.
    const corps = [
      ...declarations(/^\s*font-size:\s*([^;]+);/gm),
      ...declarations(/^\s*font:\s*([^;]+);/gm).map((v) => v.split('/')[0]!),
    ]
    const derogations = ['1.25rem', '0.85em']
    for (const valeur of corps) {
      if (derogations.includes(valeur)) continue
      expect(valeur, valeur).toMatch(/^var\(--texte-[a-z]+\)$/)
    }
  })
})

describe('T-0194 — le retour d’état des contrôles', () => {
  /** Ce qui se clique, se tire ou se saisit : tout doit répondre au geste de la même façon. */
  const CONTROLES = [
    'button',
    '.bouton-fichier',
    '.onglet',
    '.tiroir > summary',
    '.terme-detail summary',
    '.tracee summary',
    '.carte-entete',
    '.cible-ligne',
    '.compteur',
    'input',
    'select',
  ] as const

  /** Le corps de la règle qui porte la transition d'état. */
  function regleDuFondu(): string {
    const debut = CSS.indexOf('  transition: background-color var(--fondu-etat)')
    expect(debut, 'aucune transition d’état dans la feuille').toBeGreaterThan(-1)
    return CSS.slice(CSS.lastIndexOf('\n\n', debut), CSS.indexOf('}', debut))
  }

  it('fait passer chaque contrôle par le même fondu', () => {
    const regle = regleDuFondu()
    for (const selecteur of CONTROLES) {
      expect(regle, selecteur).toContain(`\n${selecteur},`)
    }
  })

  it('n’anime que des couleurs : §11.2 refuse qu’un contrôle se déplace sous le doigt', () => {
    const proprietes = /transition: ([^;]+);/.exec(regleDuFondu())![1]!
    for (const part of proprietes.split(',')) {
      expect(part.trim(), part).toMatch(/^(background|border)-color|^color\b/)
    }
  })

  it('annonce chaque contrôle au survol', () => {
    // Onze commandes en portaient un, trois seulement répondaient à l'appui : un contrôle
    // muet sous la souris ne se distingue pas d'une lecture.
    // Une ligne de sélecteur, qu'elle ferme la liste (`{`) ou la continue (`,`).
    const survols = [...CSS.matchAll(/^[^{}\n]*:hover[^{}\n]*[,{]$/gm)].map((m) => m[0])
    for (const selecteur of CONTROLES) {
      expect(
        survols.some((s) => s.includes(selecteur)),
        `${selecteur} ne dit rien au survol`,
      ).toBe(true)
    }
  })

  it('raccourcit le fondu sous mouvement réduit sans le supprimer', () => {
    // La surcharge doit suivre la valeur nominale dans la feuille : un jeton se résout à
    // l'ordre du texte, et le même bloc placé avant serait réécrit par elle.
    const nominale = Number(/--fondu-etat: (\d+)ms;/.exec(CSS)![1])
    const surcharge = [...CSS.matchAll(/--fondu-etat: (\d+)ms;/g)].map((m) => m.index!)
    expect(surcharge, 'aucune surcharge sous mouvement réduit').toHaveLength(2)
    expect(surcharge[1]!).toBeGreaterThan(surcharge[0]!)

    const reduite = Number(
      /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--fondu-etat: (\d+)ms;/.exec(
        CSS,
      )![1],
    )
    expect(reduite).toBeGreaterThan(0)
    expect(reduite).toBeLessThan(nominale)
  })

  it('n’allume pas une commande éteinte', () => {
    // Un bouton désactivé qui répond au survol promet un clic qui n'aura pas lieu.
    expect(CSS).toMatch(/button:not\(:disabled\):hover/)
    expect(CSS).toMatch(/button:not\(:disabled\):active/)
  })
})
