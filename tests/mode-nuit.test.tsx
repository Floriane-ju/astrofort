/**
 * §11.1 — Mode nuit, et §11.2 — ergonomie de consultation nocturne.
 *
 * Le critère d'acceptation du PRD est une propriété de la feuille de style, pas une
 * impression visuelle : aucun pixel ne doit présenter de composante verte ou bleue non
 * nulle. Deux conditions le garantissent et sont vérifiées ici —
 *
 *   1. la palette du mode nuit n'écrit que du rouge pur ;
 *   2. AUCUNE couleur n'est écrite en dur ailleurs dans la feuille, sans quoi elle
 *      survivrait au basculement.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import { ETAT_INITIAL, appliqueModeNuit, litEtatPersiste } from '../src/ui/ModeNuit.tsx'
import { K } from '../src/registry/constants.ts'
import { etatScene } from '../src/ui/scene-etat.ts'

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

/** Le bloc de palette du mode nuit, isolé du reste de la feuille. */
function blocModeNuit(): string {
  const debut = CSS.indexOf(":root[data-mode-nuit='true']")
  expect(debut).toBeGreaterThan(-1)
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

function declarationsCouleur(bloc: string): readonly string[] {
  return bloc
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.startsWith('--') && ligne.includes(':'))
    .map((ligne) => ligne.slice(ligne.indexOf(':') + 1).replace(';', '').trim())
}

/** Les jetons d'un bloc de palette, avec leur valeur brute. */
function jetonsDuBloc(bloc: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...bloc.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  )
}

const paletteParDefaut = (): Readonly<Record<string, string>> =>
  jetonsDuBloc(CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {'))))

const paletteDeNuit = (): Readonly<Record<string, string>> => jetonsDuBloc(blocModeNuit())

/**
 * Les canaux 0-255 d'une valeur de palette, AU FACTEUR DE LUMINANCE NOMINAL : `#rrggbb`, ou
 * `rgb(calc(var(--luminance-nuit) * N) 0 0)` — le facteur multiplie toute la palette, donc
 * le lire à 1 revient à mesurer le meilleur cas, celui où le seuil doit tenir.
 */
function canaux(valeur: string): readonly [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(valeur)
  if (hex) {
    const canal = (i: number): number => parseInt(hex[1]!.slice(i, i + 2), 16)
    return [canal(0), canal(2), canal(4)]
  }
  const rouge = /^rgb\(\s*calc\(var\(--luminance-nuit\)\s*\*\s*(\d+)\)\s+0\s+0\s*\)$/.exec(valeur)
  expect(rouge, `valeur de palette illisible : ${valeur}`).not.toBeNull()
  return [Number(rouge![1]), 0, 0]
}

/** Luminance relative WCAG 2.2, https://www.w3.org/TR/WCAG22/#dfn-relative-luminance. */
function luminance(valeur: string): number {
  const lineaire = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, v, b] = canaux(valeur)
  return 0.2126 * lineaire(r / 255) + 0.7152 * lineaire(v / 255) + 0.0722 * lineaire(b / 255)
}

/** Ratio de contraste WCAG 2.2, https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio. */
function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (clair + 0.05) / (sombre + 0.05)
}

/** Le corps d'une règle, désignée par son sélecteur en début de ligne. */
function regle(selecteur: string): string {
  const debut = CSS.indexOf(`\n${selecteur} {`)
  expect(debut, selecteur).toBeGreaterThan(-1)
  return CSS.slice(debut, CSS.indexOf('}', debut))
}

describe('palette du mode nuit §11.1', () => {
  it('n’écrit que du rouge pur : canaux vert et bleu strictement nuls', () => {
    for (const valeur of declarationsCouleur(blocModeNuit())) {
      const noir = /^#000(000)?$/.test(valeur)
      const rougePur = /^rgb\(\s*calc\(.*\)\s+0\s+0\s*\)$/.test(valeur)
      expect(noir || rougePur, valeur).toBe(true)
    }
  })

  it('couvre toutes les variables de couleur du thème par défaut', () => {
    const parDefaut = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {')))
    const variables = (texte: string): readonly string[] =>
      [...texte.matchAll(/--([a-z-]+):/g)].map((m) => m[1]!)
    // Les variables de mesure — pas de couleur, rien à repeindre en rouge.
    const mesures = ['cible-clic']
    const couleursParDefaut = variables(parDefaut).filter((v) => !mesures.includes(v))
    const couleursNuit = variables(blocModeNuit())
    for (const variable of couleursParDefaut) {
      expect(couleursNuit, variable).toContain(variable)
    }
  })

  it('n’écrit aucune couleur en dur hors des blocs de palette', () => {
    // Tout ce qui suit le bloc de palette nocturne est la feuille proprement dite : elle ne
    // doit référencer que des variables. Une couleur en dur y survivrait au mode nuit.
    //
    // L'ancrage est la PREMIÈRE occurrence, celle de la palette : depuis §6.4 la feuille porte
    // aussi des règles de composant sous ce sélecteur, et s'ancrer sur la dernière ne ferait
    // plus balayer que la fin du fichier.
    const apresPalettes = CSS.slice(CSS.indexOf(":root[data-mode-nuit='true']"))
    const corps = apresPalettes.slice(apresPalettes.indexOf('}') + 1)
    expect(corps).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(corps).not.toMatch(/\brgba?\(/)
    expect(corps).not.toMatch(/\bhsla?\(/)
  })

  it('prévoit une transition progressive plutôt qu’un basculement brutal', () => {
    expect(CSS).toMatch(/transition:\s*background-color/)
  })

  it('ne fait jamais porter l’information par la seule couleur', () => {
    // Une alerte se distingue aussi par sa forme : bordure latérale et signe en préfixe.
    expect(CSS).toMatch(/\.cause::before/)
    expect(CSS).toMatch(/content: '⚠ '/)
  })
})

/**
 * T-0070 — les couleurs que le navigateur peint tout seul.
 *
 * Le test de fuite ci-dessus lit la feuille de style : il ne peut rien voir de ce qui n'y
 * est pas écrit. L'anneau de focus, la sélection, le caret, la couleur d'accent et les
 * ascenseurs sont dans ce cas — bleus par défaut, donc une fuite §11.1 invisible au test.
 * Ce bloc vérifie qu'ils sont déclarés, et déclarés depuis les jetons de la palette : c'est
 * ce qui les fait basculer au rouge avec le reste.
 */
describe('focus et couleurs du navigateur — T-0070', () => {
  /** Seuil WCAG 2.4.11 « Focus Appearance » pour l'indicateur de focus. */
  const CONTRASTE_FOCUS_MINIMAL = 3

  /** Le second bloc `:root` : celui qui pose les couleurs peintes par le navigateur. */
  function blocNavigateur(): string {
    const debut = CSS.lastIndexOf('\n:root {')
    expect(debut, 'aucun bloc :root pour les couleurs du navigateur').toBeGreaterThan(
      CSS.indexOf(':root {'),
    )
    return CSS.slice(debut, CSS.indexOf('}', debut))
  }

  /** Les jetons cités par une déclaration : `var(--x) var(--y)` → ['x', 'y']. */
  function jetonsCites(declaration: string): readonly string[] {
    return [...declaration.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]!)
  }

  function valeurDe(bloc: string, propriete: string): string {
    const trouve = new RegExp(`\\b${propriete}:\\s*([^;]+);`).exec(bloc)
    expect(trouve, `${propriete} absent`).not.toBeNull()
    return trouve![1]!
  }

  const jetonsDeNuit = (): readonly string[] =>
    [...blocModeNuit().matchAll(/--([a-z-]+):/g)].map((m) => m[1]!)

  /** Le jeton qui colore l'anneau de focus. */
  function jetonFocus(): string {
    const cites = jetonsCites(valeurDe(regle(':focus-visible'), 'outline'))
    expect(cites, 'l’anneau de focus n’est pas coloré par un jeton').toHaveLength(1)
    return cites[0]!
  }

  it('trace un anneau de focus explicite, et n’en supprime aucun', () => {
    expect(valeurDe(regle(':focus-visible'), 'outline')).toMatch(/\d+px solid var\(--[a-z-]+\)/)
    // Un anneau détaché de la bordure de l'élément, sans quoi il s'y confond.
    expect(regle(':focus-visible')).toMatch(/outline-offset:/)
    // `outline: none` quelque part rendrait le parcours au clavier invisible à cet endroit.
    expect(CSS).not.toMatch(/outline:\s*(none|0)\b/)
  })

  it('rentre l’anneau du canevas, que la scène rognerait', () => {
    expect(valeurDe(regle('.planetarium:focus-visible'), 'outline-offset')).toMatch(/^-/)
  })

  it('donne à l’anneau ≥ 3:1 sur toutes les surfaces, à luminance nominale', () => {
    const palette = paletteParDefaut()
    const anneau = palette[jetonFocus()]!
    for (const surface of ['fond', 'surface', 'surface-haute']) {
      expect(contraste(anneau, palette[surface]!), surface).toBeGreaterThanOrEqual(
        CONTRASTE_FOCUS_MINIMAL,
      )
    }
  })

  it('déclare les couleurs que le navigateur peindrait en bleu', () => {
    const declarations = [
      ...['accent-color', 'caret-color', 'scrollbar-color'].map((propriete) => [
        propriete,
        valeurDe(blocNavigateur(), propriete),
      ]),
      ['::selection background', valeurDe(regle('::selection'), 'background')],
      ['::selection color', valeurDe(regle('::selection'), 'color')],
    ] as const
    for (const [nom, valeur] of declarations) {
      const cites = jetonsCites(valeur)
      expect(cites.length, `${nom} : ${valeur}`).toBeGreaterThan(0)
      // Une couleur écrite autrement que par un jeton survivrait au basculement.
      expect(valeur.replace(/var\(--[a-z-]+\)/g, '').trim(), nom).toBe('')
      for (const jeton of cites) {
        expect(jetonsDeNuit(), `${nom} → --${jeton}`).toContain(jeton)
      }
    }
  })

  it('colore l’anneau de focus depuis un jeton repeint en rouge la nuit', () => {
    expect(jetonsDeNuit()).toContain(jetonFocus())
  })
})

/**
 * T-0071 — le contraste du texte, recalculé depuis la feuille.
 *
 * Le seuil est une propriété des jetons, pas une impression visuelle : il se recalcule à
 * chaque exécution depuis `styles.css`, et tout jeton qui régresse fait échouer ce test.
 * Le calcul, le plafond du rouge pur et l'effondrement au plancher de 2 % sont écrits à
 * côté de la palette, dans la feuille.
 */
describe('contraste du texte — WCAG 2.2 AA', () => {
  /** Seuil AA du texte courant. Les libellés sont à 0,85 rem : jamais du « texte large ». */
  const CONTRASTE_TEXTE_MINIMAL = 4.5

  const JETONS_TEXTE = ['texte', 'attenue', 'alerte'] as const
  /** `--bordure` est un trait, pas un glyphe : il ne relève pas du seuil de texte. */
  const JETONS_FOND = ['fond', 'surface', 'surface-haute', 'fond-alerte'] as const

  for (const [mode, palette] of [
    ['normal', paletteParDefaut],
    ['nuit', paletteDeNuit],
  ] as const) {
    it(`donne ≥ 4,5:1 à tout texte sur toute surface, en mode ${mode}`, () => {
      const jetons = palette()
      for (const texte of JETONS_TEXTE) {
        for (const fond of JETONS_FOND) {
          expect(
            contraste(jetons[texte]!, jetons[fond]!),
            `--${texte} sur --${fond}`,
          ).toBeGreaterThanOrEqual(CONTRASTE_TEXTE_MINIMAL)
        }
      }
    })
  }

  it('garde la hiérarchie du texte secondaire, que la luminance ne porte plus', () => {
    // Le plafond de 5,25:1 colle --attenue à --texte : l'ordre subsiste mais ne se voit
    // plus. Ce qui distingue le texte secondaire est donc sa taille, et sa graisse là où
    // deux états partagent la même.
    const nuit = paletteDeNuit()
    expect(luminance(nuit['attenue']!)).toBeLessThan(luminance(nuit['texte']!))
    for (const selecteur of ['label', '.etat', '.niveau']) {
      expect(regle(selecteur), selecteur).toMatch(/font-size: 0\.\d+rem/)
    }
    expect(regle('.onglet.actif')).toMatch(/font-weight: 700/)
  })
})

describe('ergonomie de consultation nocturne §11.2', () => {
  it('donne aux cibles de clic la taille d’un usage ganté', () => {
    expect(CSS).toMatch(/--cible-clic:\s*44px/)
    for (const selecteur of ['button,', '.tracee summary', '.terme-detail summary']) {
      const index = CSS.indexOf(selecteur)
      expect(index, selecteur).toBeGreaterThan(-1)
      expect(CSS.slice(index, CSS.indexOf('}', index))).toMatch(/min-height: var\(--cible-clic\)/)
    }
  })

  it('rend le plan imprimable en masquant ce qui n’est pas le plan', () => {
    expect(CSS).toMatch(/@media print/)
  })
})

describe('état du mode nuit §11.1', () => {
  it('démarre inactif, à luminance nominale', () => {
    expect(ETAT_INITIAL.actif).toBe(false)
    expect(ETAT_INITIAL.luminance).toBe(1)
    expect(litEtatPersiste()).toStrictEqual(ETAT_INITIAL)
  })

  it('ignore les champs de forme inattendue d’un stockage abîmé', () => {
    // Le stockage local est hors du périmètre de confiance : un état à moitié corrompu
    // ne doit pas se propager jusqu'à la palette (§12.3).
    const stocke = (valeur: string) => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: () => valeur, setItem: () => undefined },
      })
    }
    try {
      stocke('{ ceci n’est pas du JSON')
      expect(litEtatPersiste()).toStrictEqual(ETAT_INITIAL)

      stocke(JSON.stringify({ actif: 'oui', luminance: 'sombre', intrus: true }))
      expect(litEtatPersiste()).toStrictEqual(ETAT_INITIAL)

      // T-0140 — `typeDalle` et `autoActivation` sont écrits par les versions antérieures :
      // ils ne sont plus lus, et leur présence ne doit pas contaminer l'état relu.
      stocke(JSON.stringify({ actif: true, luminance: 12, typeDalle: 'OLED' }))
      expect(litEtatPersiste()).toStrictEqual({ ...ETAT_INITIAL, actif: true })

      stocke(
        JSON.stringify({
          actif: true,
          luminance: 0.4,
          typeDalle: 'LCD',
          autoActivation: 'AU_CREPUSCULE',
        }),
      )
      expect(litEtatPersiste()).toStrictEqual({ actif: true, luminance: 0.4 })
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })

  it('ne s’applique pas hors navigateur, sans lever d’erreur', () => {
    expect(() => appliqueModeNuit(ETAT_INITIAL)).not.toThrow()
  })

  it('borne la luminance à un plancher d’environ 2 % du nominal', () => {
    expect(K('LUMINANCE_PLANCHER_MODE_NUIT')).toBeCloseTo(0.02, 6)
  })
})

describe('interface rendue', () => {
  const ecran = renderToStaticMarkup(<App />)

  it('n’écrit aucune couleur en ligne dans le balisage', () => {
    expect(ecran).not.toMatch(/style="[^"]*(?:color|background)[^"]*"/)
  })

  it('expose le réglage du mode nuit et la limite des dalles LCD', () => {
    expect(ecran).toContain('Activer le mode nuit')
    expect(ecran).toMatch(/dalle LCD/)
    expect(ecran).toMatch(/mode nuit/i)
  })

  // T-0140 — le tiroir ne porte que ce qui se décide : ni physiologie rétinienne, ni saisie
  // du type de dalle, ni bascule automatique.
  it('ne rend ni l’explication du rouge, ni les réglages retirés', () => {
    expect(ecran).not.toMatch(/bâtonnets/)
    expect(ecran).not.toContain('Type de dalle')
    expect(ecran).not.toContain('Activation automatique')
    expect(ecran).not.toContain('Au crépuscule nautique')
  })
})

/**
 * T-0072 — `prefers-reduced-motion` (WCAG 2.3.3).
 *
 * Deux exigences se contredisent en apparence : §11.1 interdit le basculement brutal et le
 * flash, la préférence système demande qu'aucun mouvement ne s'impose. Le compromis est écrit
 * dans la feuille — fondu de luminance conservé, durée coupée — et vérifié ici, parce qu'une
 * règle de style supprimée par mégarde ne casse aucun rendu.
 */
describe('mouvement réduit — WCAG 2.3.3', () => {
  /** Le bloc `@media (prefers-reduced-motion: reduce)`, accolade fermante comprise. */
  function blocMouvementReduit(): string {
    const debut = CSS.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(debut, 'aucune règle prefers-reduced-motion dans la feuille').toBeGreaterThan(-1)
    return CSS.slice(debut, CSS.indexOf('\n}', debut) + 2)
  }

  it('raccourcit la transition du mode nuit sans la supprimer', () => {
    const bloc = blocMouvementReduit()
    const durees = [...bloc.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]))
    expect(durees.length, 'la préférence ne redéfinit aucune durée').toBeGreaterThan(0)
    const nominale = Number(/transition:\s*background-color\s*(\d+)ms/.exec(CSS)?.[1])
    for (const duree of durees) {
      // Zéro rendrait le basculement brutal que §11.1 interdit.
      expect(duree, `${duree}ms`).toBeGreaterThan(0)
      expect(duree, `${duree}ms`).toBeLessThan(nominale)
    }
  })

  it('ne laisse aucune autre animation s’imposer', () => {
    // Rien ne bouge en dehors du fondu de bascule : ni image clé, ni défilement lissé,
    // ni transition sur une propriété de position.
    expect(CSS).not.toMatch(/@keyframes/)
    expect(CSS).not.toMatch(/\banimation(-name)?:/)
    expect(CSS).not.toMatch(/scroll-behavior:\s*smooth/)
    const transitions = [...CSS.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]!)
    for (const declaration of transitions) {
      expect(declaration, declaration).toMatch(/^(background-color|color)\b/)
    }
  })

  it('n’anime le curseur temporel que sur demande explicite', () => {
    // §11.2 — aucune animation non sollicitée. Le défilement n'est jamais l'état de départ :
    // il ne peut donc pas démarrer de lui-même, et reste choisissable sous la préférence.
    expect(etatScene().temps.modeTemps).not.toBe('DEFILEMENT')
  })
})
