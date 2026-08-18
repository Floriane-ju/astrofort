/**
 * Lot 6 — la coque planétarium : la scène au centre, les réglages sur les côtés.
 *
 * Ce qui est vérifié ici n'est pas une apparence, c'est la structure : trois régions
 * existent, un seul jeu de réglages est monté à la fois, un objet cliqué dans la scène ouvre
 * l'onglet Cible garni, l'incrustation du filé fige le temps, et le plan de session reste
 * imprimable depuis n'importe quel onglet.
 *
 * Le rendu statique suffit : chaque bascule d'écran passe par un magasin de module, appelable
 * sans DOM. C'est précisément pourquoi l'onglet actif et la cible y vivent plutôt que dans
 * l'état local d'un composant.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import type { Site } from '../src/core/ephem.ts'
import type { Cadre } from '../src/core/cadre.ts'
import { cielInstantane } from '../src/core/horloges.ts'
import type { Vue } from '../src/core/projection.ts'
import { incrusteDansLeCadre, mentionProjection } from '../src/ui/scene-overlay.ts'
import {
  HAUTEUR_SCENE_PX,
  LARGEUR_SCENE_PX,
  etatScene,
  reinitialiseScene,
  resolutionRendu,
} from '../src/ui/scene-etat.ts'
import { MenuInfos } from '../src/ui/MenuInfos.tsx'
import { MenuReglages, OptionsCatalogue, objetDesigne } from '../src/ui/MenuReglages.tsx'
import { construitIndex } from '../src/core/index-ciel.ts'
import { projecteur } from '../src/core/projection.ts'
import { versSpherique } from '../src/core/mat3.ts'
import type { ProfilCadre } from '../src/core/cadre.ts'
import {
  activeIncrustation,
  choisisOnglet,
  etatSeance,
  ouvreCible,
  reinitialiseSeance,
} from '../src/ui/seance-etat.ts'

const M31: ObjetCielProfond = {
  designation: 'M31',
  nomsCommuns: 'Andromède',
  adDeg: 10.6847,
  decDeg: 41.269,
  type: 'GALAXIE',
  majAxArcmin: 189.1,
  minAxArcmin: 61.7,
  posAngDeg: 35,
  vMag: 3.4,
  bMag: 4.4,
  surfBr: 13.5,
}

function ecran(): string {
  return renderToStaticMarkup(<App />)
}

afterEach(() => {
  reinitialiseSeance()
  reinitialiseScene()
})

describe('§11.2 — les trois régions', () => {
  it('place le matériel à gauche, la scène au centre, la séance à droite', () => {
    const html = ecran()
    expect(html).toContain('coque-materiel')
    expect(html).toContain('coque-scene')
    expect(html).toContain('coque-seance')
    // La scène est bien le canevas du planétarium, pas une pile de sections.
    expect(html).toContain('class="planetarium"')
  })

  it('garde le groupe Séance visible quel que soit l’onglet actif', () => {
    for (const onglet of ['EXPLORER', 'CIBLE', 'NUIT', 'FILE'] as const) {
      choisisOnglet(onglet)
      const html = ecran()
      expect(html, onglet).toContain('Bortle')
      expect(html, onglet).toContain('horizon plat')
    }
  })

  it('porte le mode nuit et la vérification du socle dans la barre du haut', () => {
    const html = ecran()
    const topbar = html.slice(0, html.indexOf('coque-materiel'))
    expect(topbar).toContain('Activer le mode nuit')
    expect(topbar).toContain('Vérification')
    expect(topbar).toContain('Registre de constantes')
    // Fermé par défaut : le tiroir n'est pas déplié à l'ouverture de l'application.
    expect(topbar).not.toMatch(/<details class="tiroir tiroir-verification" open/)
  })
})

describe('§11.2 — un seul jeu de réglages à la fois', () => {
  it('ne monte que le contenu de l’onglet actif', () => {
    choisisOnglet('EXPLORER')
    const explorer = ecran()
    expect(explorer).toContain('Mode de temps')
    expect(explorer).not.toContain('Séquence de filé')

    choisisOnglet('FILE')
    const file = ecran()
    expect(file).toContain('Séquence de filé')
    expect(file).not.toContain('Mode de temps')
  })

  it('marque l’onglet actif autrement que par la seule couleur', () => {
    choisisOnglet('NUIT')
    const html = ecran()
    expect(html).toMatch(/aria-selected="true"[^>]*class="onglet actif"/)
    expect(html).toContain('Fenêtre nocturne')
  })

  it('survit à un changement de matériel : l’onglet reste celui qu’on avait ouvert', () => {
    choisisOnglet('FILE')
    ecran()
    expect(etatSeance().onglet).toBe('FILE')
  })
})

describe('§3.4 — un objet cliqué ouvre sa fiche', () => {
  it('bascule sur l’onglet Cible et le garnit', () => {
    expect(etatSeance().onglet).toBe('EXPLORER')
    ouvreCible(M31)
    expect(etatSeance().onglet).toBe('CIBLE')
    expect(etatSeance().cible?.designation).toBe('M31')
    // C'est bien la fiche §6.2 / §6.3 / §7 qui s'ouvre, pas un simple nom affiché.
    // (Le garnissage des champs par l'objet est posé par un effet de montage : il ne joue
    // pas en rendu statique, seule la présence de la fiche est vérifiable ici.)
    const html = ecran()
    expect(html).toContain('Détectabilité')
    expect(html).toContain('Cadrage')
  })
})

describe('§9.3 — l’incrustation fige le temps', () => {
  it('bascule la scène en temps figé quand l’incrustation est activée', () => {
    expect(etatScene().temps.modeTemps).toBe('MAINTENANT')
    activeIncrustation(true)
    expect(etatSeance().file.incrustation).toBe(true)
    expect(etatScene().temps.modeTemps).toBe('FIGE')
  })

  it('ne redémarre pas le temps toute seule quand on la désactive', () => {
    activeIncrustation(true)
    activeIncrustation(false)
    expect(etatSeance().file.incrustation).toBe(false)
    // Rendre le temps à l'horloge système est un geste, pas un effet de bord (§3.2).
    expect(etatScene().temps.modeTemps).toBe('FIGE')
  })
})

describe('§9.3 — le filé se dépose dans le cadre, pas ailleurs', () => {
  const SITE: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
  const VUE: Vue = {
    mode: 'MODE_PLANETARIUM',
    fovDeg: 60,
    largeurPx: 1920,
    hauteurPx: 1080,
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }
  const CADRE: Cadre = {
    profil: { libelle: '120 mm f/2.8', fovLDeg: 17, fovHDeg: 11.4, echApx: 8.8, tPoseS: 2.1 },
    azimutDeg: 180,
    hauteurDeg: 40,
    rotationDeg: 0,
  }

  /** Contexte 2D instrumenté : il enregistre l'ordre des opérations, il ne peint pas. */
  function contexteEspion() {
    const appels: string[] = []
    const enregistre =
      (nom: string) =>
      (): void => {
        appels.push(nom)
      }
    return {
      appels,
      lineWidth: 1,
      strokeStyle: '',
      save: enregistre('save'),
      restore: enregistre('restore'),
      clip: enregistre('clip'),
      drawImage: enregistre('drawImage'),
      beginPath: enregistre('beginPath'),
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: enregistre('stroke'),
    }
  }

  it('découpe sur le contour du cadre et dépose l’image, sans retracer le liseré', () => {
    const ctx = contexteEspion()
    const ciel = cielInstantane(SITE, new Date('2026-08-15T22:00:00Z'))
    incrusteDansLeCadre(
      ctx as unknown as CanvasRenderingContext2D,
      VUE,
      ciel.matrice,
      CADRE,
      {} as CanvasImageSource,
    )
    // L'ordre est le fond du critère : dessiner hors du clip déborderait sur le ciel.
    expect(ctx.appels.join(' ')).toBe('save beginPath clip drawImage restore')
    // T-0042 — le liseré appartient à la couche Cadre matériel, tracée en fin de passe.
    expect(ctx.appels).not.toContain('stroke')
  })

  it('annonce quand la projection de la scène n’est pas celle de l’objectif', () => {
    expect(mentionProjection('MODE_CADRE', 'MODE_CADRE')).toBeNull()
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_CADRE')).toMatch(/gnomonique/)
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_FISHEYE')).toMatch(/équidistante/)
  })
})

describe('§11.2 — le plan reste imprimable', () => {
  it('rend le plan de session hors de l’onglet Nuit, masqué à l’écran seulement', () => {
    choisisOnglet('EXPLORER')
    expect(ecran()).toContain('plan-session hors-onglet')
    choisisOnglet('NUIT')
    expect(ecran()).toMatch(/class="plan-session"/)
  })
})

/**
 * T-0039 — les lectures passent dans un menu d'information, en haut à droite.
 *
 * Ce qui se vérifie est le déplacement, pas la rédaction : les mêmes textes, au même endroit
 * logique, mais dans un tiroir de la barre haute plutôt que sous le canevas.
 */
describe('T-0039 — le menu d’information porte les lectures', () => {
  function barre(html: string): string {
    return html.slice(0, html.indexOf('coque-materiel'))
  }

  it('pose un tiroir fermé en fin de barre haute, pas une bande sous le canevas', () => {
    const html = ecran()
    expect(html).not.toContain('scene-lectures')
    const topbar = barre(html)
    expect(topbar).toContain('tiroir tiroir-infos')
    // Fermé par défaut : il ne prend aucune hauteur tant qu'on ne l'ouvre pas.
    expect(topbar).not.toMatch(/<details class="tiroir tiroir-infos"[^>]*open/)
    // Dernier élément de la barre, donc le plus à droite.
    expect(topbar.indexOf('tiroir-infos')).toBeGreaterThan(topbar.indexOf('tiroir-verification'))
  })

  it('y reprend les cinq groupes de lectures, textes inchangés', () => {
    const topbar = barre(ecran())
    // 1 — la ligne d'état qui date l'image.
    expect(topbar).toMatch(/visée[\s\S]*AD[\s\S]*azimut[\s\S]*hauteur[\s\S]*champ/)
    expect(topbar).toContain('jusqu’à la magnitude')
    expect(topbar).toContain('époque')
    // 3 — les lectures du cadre. 5 — le diagnostic de rendu.
    expect(topbar).toContain('images/s')
    expect(topbar).toContain('étoiles tracées sur')
    expect(topbar).toContain('cellules d’index retenues sur')
  })

  it('garde le bouton « Appliquer » actionnable depuis le menu', () => {
    const html = renderToStaticMarkup(<MenuInfos {...menuAvecCible()} />)
    expect(html).toMatch(/le grand axe de ALLONGEE s’aligne/)
    expect(html).toMatch(/<button type="button">Appliquer -?\d+°<\/button>/)
  })
})

/**
 * Un menu garni : un profil de cadre, et une galaxie allongée posée pile sur la visée
 * courante. C'est le seul montage qui déclenche à la fois la cible dominante et la rotation
 * suggérée — les deux lectures du groupe « cadre » qui portent un geste.
 */
function menuAvecCible(): {
  readonly site: Site
  readonly index: ReturnType<typeof construitIndex>
  readonly objets: readonly ObjetCielProfond[]
  readonly profils: readonly ProfilCadre[]
  readonly mLimOeil: number
} {
  const site: Site = { latitudeDeg: 46.391, longitudeDeg: 6.697, altitudeM: 500 }
  const { vue, msAffiche } = etatScene()
  const ciel = cielInstantane(site, new Date(msAffiche))
  // La visée, ramenée en J2000 : y poser l'objet garantit qu'il tombe dans le cadre.
  const visee = versSpherique(
    projecteur(vue, ciel.matrice).inverse(vue.largeurPx / 2, vue.hauteurPx / 2),
  )
  return {
    site,
    index: construitIndex([]),
    objets: [
      {
        ...M31,
        designation: 'ALLONGEE',
        adDeg: visee.longitudeDeg,
        decDeg: visee.latitudeDeg,
      },
    ],
    profils: [{ libelle: '120 mm', fovLDeg: 17, fovHDeg: 11.4, echApx: 8.8, tPoseS: 2.1 }],
    mLimOeil: 6.05,
  }
}

/**
 * T-0040 — le canevas seul au centre, sans marges.
 *
 * Rien à observer sans moteur de rendu : ce qui se vérifie ici est la règle elle-même. La
 * rangée basse à hauteur réservée de T-0037 n'a plus d'objet une fois les lectures parties ;
 * ce qui reste indispensable est `min-height: 0`, sans quoi le canevas reprend sa hauteur
 * intrinsèque et le défilement de page revient.
 */
describe('T-0040 — la colonne centrale ne porte plus que la scène', () => {
  const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

  /** Le corps d'une règle, isolé du reste de la feuille. */
  function regle(selecteur: string): string {
    const debut = CSS.indexOf(`${selecteur} {`)
    expect(debut).toBeGreaterThan(-1)
    return CSS.slice(debut, CSS.indexOf('}', debut))
  }

  it('ne réserve plus aucune hauteur sous le canevas', () => {
    expect(CSS).not.toContain('--hauteur-lectures')
    expect(CSS).not.toContain('.scene-lectures')
    expect(regle('.coque-scene > .scene')).not.toContain('grid-template-rows')
  })

  it('colle le canevas aux bordures : ni marge ni remplissage', () => {
    const scene = regle('.coque-scene > .scene')
    expect(scene).toContain('padding: 0')
    expect(scene).toContain('margin: 0')
    // Sans lui, la piste de grille reprend la hauteur intrinsèque du canevas.
    expect(scene).toContain('min-height: 0')
    expect(regle('.coque-scene')).toContain('padding: 0')
  })

  it('remplit la boîte plutôt que d’y loger un rapport figé', () => {
    const canevas = regle('.coque-scene .planetarium')
    expect(canevas).toContain('width: 100%')
    expect(canevas).toContain('height: 100%')
    // `contain` logeait un 16/9 dans une boîte qui ne l'est pas : bandes noires en haut et
    // en bas. La définition de rendu suit désormais la boîte, il n'y a plus rien à loger.
    expect(canevas).not.toContain('object-fit')
    // Un canevas en ligne réserve l'interligne sous sa ligne de base : la page défile.
    expect(canevas).toContain('display: block')
  })

  it('fait suivre la définition de rendu à la boîte, sans déformer', () => {
    // Le rapport de la définition est celui de la boîte : des étoiles rondes le restent.
    const haute = resolutionRendu(1000, 1000, 1)
    expect(haute.largeurPx / haute.hauteurPx).toBeCloseTo(1, 6)
    const large = resolutionRendu(1600, 400, 1)
    expect(large.largeurPx / large.hauteurPx).toBeCloseTo(4, 6)
  })

  it('plafonne le nombre de pixels peints au budget de référence', () => {
    const budget = LARGEUR_SCENE_PX * HAUTEUR_SCENE_PX
    // Dalle Retina sur grande fenêtre : suivre `devicePixelRatio` doublerait la charge.
    const retina = resolutionRendu(1600, 900, 2)
    expect(retina.largeurPx * retina.hauteurPx).toBeLessThanOrEqual(budget + 1)
    // Petite boîte : la densité de l'écran reste la borne, pas le budget.
    const petite = resolutionRendu(400, 300, 2)
    expect(petite).toStrictEqual({ largeurPx: 800, hauteurPx: 600 })
  })

  it('rend la scène au flux vertical sous le repli, canevas en 16 / 9', () => {
    const repli = CSS.slice(CSS.indexOf('@media (max-width: 1100px)'))
    expect(repli).toMatch(/\.coque-scene > \.scene \{[^}]*display: block/)
    expect(repli).toMatch(/\.coque-scene \.planetarium \{[^}]*aspect-ratio: 16 \/ 9/)
    // Le menu reste utilisable : son contenu défile plutôt que d'allonger la page.
    expect(repli).toMatch(/\.tiroir\[open\] > \.tiroir-contenu \{[^}]*max-height/)
  })
})

/**
 * T-0041 — une alerte se signale sur le menu fermé.
 *
 * Une cause rangée dans un tiroir fermé est une cause invisible : on règle quelque chose,
 * rien ne bouge à l'écran, et l'explication est derrière un clic qu'on ne pense pas à faire.
 */
describe('T-0041 — le bouton du menu dit qu’il a quelque chose à lire', () => {
  const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

  it('annonce le compte en toutes lettres quand une cause est active', () => {
    // Sans profil déclaré, le cadre est refusé : un message attend d'être lu.
    const alerte = renderToStaticMarkup(
      <MenuInfos {...menuAvecCible()} profils={[]} />,
    )
    expect(alerte).toContain('data-alerte="true"')
    expect(alerte).toMatch(/1 message à lire/)
  })

  it('compte une rotation en attente comme un message à lire', () => {
    // Son bouton « Appliquer » est le seul moyen de l'appliquer : il ne doit pas s'oublier.
    const html = renderToStaticMarkup(<MenuInfos {...menuAvecCible()} />)
    expect(html).toContain('data-alerte="true"')
    expect(html).toMatch(/1 message à lire/)
  })

  it('retire le signalement dès que la dernière cause disparaît', () => {
    // Un profil déclaré, aucune cible dans le cadre : plus rien à lire.
    const calme = renderToStaticMarkup(
      <MenuInfos {...menuAvecCible()} objets={[]} />,
    )
    expect(calme).toContain('data-alerte="false"')
    expect(calme).not.toMatch(/à lire/)
  })

  it('expose le compte aux technologies d’assistance', () => {
    expect(ecran()).toMatch(/<summary><span aria-live="polite">/)
  })

  it('ne fait pas porter le signalement par la seule couleur', () => {
    const debut = CSS.indexOf(".tiroir-infos[data-alerte='true'] > summary {")
    expect(debut).toBeGreaterThan(-1)
    const corps = CSS.slice(debut, CSS.indexOf('}', debut))
    // La graisse et la bordure changent aussi : le rouge du mode nuit ne dit rien seul.
    expect(corps).toContain('font-weight: 700')
    expect(corps).toContain('border-color: var(--alerte)')
  })
})


describe('T-0047 — la roue crantée reloge le choix brut dans le catalogue', () => {
  it('monte un tiroir de réglages dans la barre haute', () => {
    choisisOnglet('CIBLE')
    const ecran = renderToStaticMarkup(<App />)
    expect(ecran).toContain('tiroir tiroir-reglages')
    expect(ecran).toContain('⚙ Réglages')
  })

  it('le place avant le menu des lectures, qui ferme la barre', () => {
    const ecran = renderToStaticMarkup(<App />)
    expect(ecran.indexOf('tiroir-reglages')).toBeLessThan(ecran.indexOf('tiroir-infos'))
  })

  it('porte l’accès au catalogue, que l’onglet Cible n’a plus', () => {
    const rendu = renderToStaticMarkup(<MenuReglages catalogue={[M31]} />)
    expect(rendu).toContain('Chercher dans le catalogue')

    choisisOnglet('CIBLE')
    expect(renderToStaticMarkup(<App />)).not.toContain('Chercher dans le catalogue')
  })

  it('lit une entrée du catalogue comme la liste des visibles la lit', () => {
    const rendu = renderToStaticMarkup(<OptionsCatalogue catalogue={[M31]} saisie="M31" />)
    expect(rendu).toContain('— Andromède · galaxie · mag 3.4')
  })

  it('garde la cible de clic de §11.2 : le tiroir est un `.tiroir` comme les autres', () => {
    const rendu = renderToStaticMarkup(<MenuReglages catalogue={[]} />)
    expect(rendu).toMatch(/class="tiroir tiroir-reglages"/)
    const styles = readFileSync(
      join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'),
      'utf8',
    )
    const debut = styles.indexOf('.tiroir > summary {')
    expect(debut).toBeGreaterThan(-1)
    expect(styles.slice(debut, styles.indexOf('}', debut))).toContain(
      'min-height: var(--cible-clic)',
    )
  })
})


/**
 * T-0053 — le catalogue se cherche au lieu de se dérouler. Le `<datalist>` ne porte que les
 * résultats de la frappe en cours : ce qui est vérifié ici est la structure native et la
 * résolution avant `ouvreCible`, pas le comportement de la liste déroulante du navigateur.
 */
describe('T-0053 — le tiroir cherche le catalogue au lieu de le dérouler', () => {
  const M45: ObjetCielProfond = {
    designation: 'M45',
    nomsCommuns: 'Pléiades',
    adDeg: 56.75,
    decDeg: 24.12,
    type: 'AMAS_OUVERT',
    majAxArcmin: 110,
    minAxArcmin: 110,
    posAngDeg: null,
    vMag: 1.6,
    bMag: null,
    surfBr: null,
  }

  it('porte un champ de saisie relié à un `datalist`, plus un `select` déroulant', () => {
    const rendu = renderToStaticMarkup(<MenuReglages catalogue={[M31, M45]} />)
    expect(rendu).toContain('<datalist')
    expect(rendu).toMatch(/<input[^>]+list="/)
    expect(rendu).not.toContain('<select')
  })

  it('ne rend aucune option avant la première frappe : le catalogue n’est pas une liste', () => {
    expect(renderToStaticMarkup(<OptionsCatalogue catalogue={[M31, M45]} saisie="" />)).toBe('')
  })

  it('propose M45 sur « pléiades » comme sur « M45 », et n’insère que la désignation', () => {
    for (const saisie of ['pléiades', 'PLEIADES', 'M45']) {
      const rendu = renderToStaticMarkup(
        <OptionsCatalogue catalogue={[M31, M45]} saisie={saisie} />,
      )
      expect(rendu).toContain('value="M45"')
      expect(rendu).not.toContain('value="M45 —')
    }
  })

  it('atteint n’importe quelle partie du catalogue : les Messier ne sont plus hors de portée', () => {
    const remplissage: ObjetCielProfond[] = Array.from({ length: 500 }, (_, i) => ({
      ...M31,
      designation: `IC${i}`,
      nomsCommuns: '',
    }))
    const rendu = renderToStaticMarkup(
      <OptionsCatalogue catalogue={[...remplissage, M45]} saisie="M45" />,
    )
    expect(rendu).toContain('value="M45"')
  })

  it('résout la saisie sur une désignation exacte, et sur rien d’autre', () => {
    expect(objetDesigne([M31, M45], 'M45')).toBe(M45)
    expect(objetDesigne([M31, M45], '  M45  ')).toBe(M45)
    expect(objetDesigne([M31, M45], 'Pléiades')).toBeNull()
    expect(objetDesigne([M31, M45], 'M4')).toBeNull()
    expect(objetDesigne([M31, M45], '')).toBeNull()
  })

  it('garde le message d’attente d’intégrité quand le catalogue n’est pas vérifié', () => {
    const rendu = renderToStaticMarkup(<MenuReglages catalogue={[]} />)
    expect(rendu).toContain('contrôle d’intégrité')
    expect(rendu).not.toContain('<input')
  })

  it('garde la cible de clic de §11.2 : un `input` a la hauteur d’usage ganté', () => {
    const styles = readFileSync(
      join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'),
      'utf8',
    )
    const debut = styles.indexOf('input,\nselect {')
    expect(debut).toBeGreaterThan(-1)
    expect(styles.slice(debut, styles.indexOf('}', debut))).toContain(
      'min-height: var(--cible-clic)',
    )
  })
})
