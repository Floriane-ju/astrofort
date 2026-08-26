/**
 * T-0113 — la coque planétarium : la scène occupe tout, le reste se pose dessus.
 *
 * Ce qui est vérifié ici n'est pas une apparence, c'est la structure : les cinq régions
 * existent, un seul contenu de panneau est monté à la fois, une carte repliée ne monte pas
 * son corps, un objet cliqué dans la scène déplie sa fiche, l'incrustation du filé fige le
 * temps, et le plan de session reste imprimable panneau fermé.
 *
 * Le rendu statique suffit : chaque bascule d'écran passe par un magasin de module, appelable
 * sans DOM. C'est précisément pourquoi l'état de la coque et la cible y vivent plutôt que
 * dans l'état local d'un composant.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/App.tsx'
import type { ObjetCielProfond } from '../src/data/deepsky.ts'
import { mentionProjection } from '../src/ui/scene-overlay.ts'
import {
  HAUTEUR_SCENE_PX,
  LARGEUR_SCENE_PX,
  etatScene,
  reinitialiseScene,
  resolutionRendu,
} from '../src/ui/scene-etat.ts'
import { MenuReglages } from '../src/ui/MenuReglages.tsx'
import { poidsParDefaut } from '../src/core/session.ts'
import { DOMAINES } from '../src/registry/domains.ts'
import {
  activeIncrustation,
  etatSeance,
  ouvreCible,
  publicateurRenduFile,
  reinitialiseSeance,
  type RenduFile,
} from '../src/ui/seance-etat.ts'
import {
  basculeCarte,
  basculePanneau,
  borne,
  bornesDeplacement,
  etatCoque,
  ouvreCarte,
  reinitialiseCoque,
} from '../src/ui/coque-etat.ts'

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

const CSS_COQUE = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

afterEach(() => {
  reinitialiseSeance()
  reinitialiseScene()
  reinitialiseCoque()
})

/** Les réglages de poids n'ont pas d'état dans un rendu statique : commandes inertes. */
const POIDS_INERTES = {
  poids: poidsParDefaut(),
  surPoids: () => undefined,
  surDefaut: () => undefined,
}

const REGLAGES_INERTES = {
  poids: POIDS_INERTES,
} as const

/** La barre haute : tout ce qui précède la scène dans le document. */
function barreHaute(html: string): string {
  return html.slice(0, html.indexOf('coque-scene'))
}

describe('T-0113 — la scène occupe tout, le reste se pose dessus', () => {
  it('monte les cinq régions : deux barres, la scène, les cartes, le panneau', () => {
    const html = ecran()
    expect(html).toContain('coque-topbar')
    expect(html).toContain('coque-scene')
    expect(html).toContain('coque-cartes')
    expect(html).toContain('coque-lateral')
    expect(html).toContain('coque-barrebas')
    // La scène est bien le canevas du planétarium, pas une pile de sections.
    expect(html).toContain('class="planetarium"')
  })

  it('pose les trois cartes sur la scène, matériel compris', () => {
    const html = ecran()
    for (const carte of ['carte-materiel', 'carte-vue', 'carte-cible']) {
      expect(html, carte).toContain(carte)
    }
    // Le matériel n'est plus une colonne : c'est une carte, avec les deux autres.
    expect(html).not.toContain('coque-materiel')
    expect(html).not.toContain('coque-seance')
  })

  it('garde le lieu lisible et réglable quel que soit le panneau ouvert', () => {
    // Les six champs du site sont descendus dans la barre basse : ce qui devait survivre au
    // déménagement n'est pas leur dépliement permanent, c'est leur accessibilité constante.
    for (const panneau of [null, 'CIBLES', 'NUIT', 'FILE'] as const) {
      if (panneau !== null) basculePanneau(panneau)
      const html = ecran()
      const barre = html.slice(html.indexOf('coque-barrebas'))
      expect(barre, `${panneau}`).toContain('Bortle')
      expect(barre, `${panneau}`).toContain('horizon plat')
      if (panneau !== null) basculePanneau(panneau)
    }
  })

  it('affiche les valeurs du site sans ouvrir le tiroir', () => {
    // Une pastille qui n'afficherait rien rendrait le déménagement coûteux : il faudrait
    // ouvrir un tiroir pour savoir sous quel ciel on calcule.
    const html = ecran()
    const resume = html.slice(html.indexOf('barrebas-lieu'))
    expect(resume.slice(0, resume.indexOf('</summary>'))).toMatch(/Bortle/)
  })

  it('porte le mode nuit et la vérification du socle dans la barre du haut', () => {
    const topbar = barreHaute(ecran())
    expect(topbar).toContain('Activer le mode nuit')
    expect(topbar).toContain('Vérification')
    expect(topbar).toContain('Registre de constantes')
    // Fermé par défaut : le tiroir n'est pas déplié à l'ouverture de l'application.
    expect(topbar).not.toMatch(/<details class="tiroir tiroir-verification" open/)
  })

  // T-0153 — la barre haute ne dit plus où pointe la vue : la phrase complète est en bas,
  // et la répéter ici en abrégé faisait deux lectures pour un seul fait.
  it('ne répète plus la visée : elle est au centre de la barre basse', () => {
    expect(barreHaute(ecran()).replaceAll('<!-- -->', '')).not.toMatch(/az \d+° · h \d+°/)
  })
})

describe('§11.2 — un seul jeu de réglages à la fois', () => {
  it('ne monte aucun contenu de panneau tant qu’aucun n’est ouvert', () => {
    const ferme = ecran()
    expect(ferme).not.toContain('Séquence de filé')
    // Le titre, pas le mot : « Fenêtre nocturne » est aussi une ligne de la matrice de
    // dégradation, qui vit dans le tiroir de vérification et ne bouge pas d'ici.
    expect(ferme).not.toContain('<h2>Fenêtre nocturne</h2>')
    // La coquille reste dans le document : c'est elle qui porte le plan imprimable.
    expect(ferme).toMatch(/<aside class="coque-lateral" id="panneau-lateral" hidden/)
  })

  it('ne monte que le contenu du panneau ouvert', () => {
    basculePanneau('NUIT')
    const nuit = ecran()
    expect(nuit).toContain('<h2>Fenêtre nocturne</h2>')
    expect(nuit).not.toContain('Séquence de filé')

    basculePanneau('FILE')
    const file = ecran()
    expect(file).toContain('Séquence de filé')
    expect(file).not.toContain('<h2>Fenêtre nocturne</h2>')
  })

  it('ne monte pas le corps d’une carte repliée', () => {
    // La carte Vue démarre repliée : ses réglages ne s'abonnent pas au magasin de scène, et
    // n'y recalculent donc aucune profondeur à chaque geste de visée.
    expect(ecran()).not.toContain('Vue réaliste')
    ouvreCarte('VUE')
    expect(ecran()).toContain('Vue réaliste')
  })

  it('marque le bouton du panneau ouvert autrement que par la seule couleur', () => {
    basculePanneau('NUIT')
    expect(ecran()).toMatch(/class="onglet actif"[^>]*aria-expanded="true"/)
  })

  it('referme le panneau quand on represse son bouton', () => {
    basculePanneau('NUIT')
    expect(etatCoque().panneau).toBe('NUIT')
    basculePanneau('NUIT')
    expect(etatCoque().panneau).toBeNull()
  })

  it('survit à un changement de matériel : le panneau reste celui qu’on avait ouvert', () => {
    basculePanneau('FILE')
    ecran()
    expect(etatCoque().panneau).toBe('FILE')
  })
})

/**
 * T-0113 — une carte se replie et se déplace.
 *
 * Le bornage est une fonction pure : il se vérifie sans pointeur ni DOM, sur des rectangles
 * mesurés. C'est tout ce qui doit l'être — le reste est le comportement natif du navigateur.
 */
describe('T-0113 — les cartes posées sur la scène', () => {
  const HOTE = { left: 0, top: 0, width: 1400, height: 800 }
  const MARGES = { haut: 44, bas: 48, droite: 0 }

  it('replie et déplie une carte sans toucher aux autres', () => {
    expect(etatCoque().cartes.MATERIEL.ouverte).toBe(true)
    basculeCarte('MATERIEL')
    expect(etatCoque().cartes.MATERIEL.ouverte).toBe(false)
    expect(etatCoque().cartes.VUE.ouverte).toBe(false)
    basculeCarte('VUE')
    expect(etatCoque().cartes.VUE.ouverte).toBe(true)
    expect(etatCoque().cartes.MATERIEL.ouverte).toBe(false)
  })

  /** Un geste plus ample que la coque : c'est le bornage qui doit l'arrêter, pas sa taille. */
  const LOIN = 1e6

  it('garde une carte entièrement dans la coque, barres déduites', () => {
    const carte = { left: 12, top: 56, width: 300, height: 400 }
    const bornes = bornesDeplacement(carte, HOTE, MARGES, 10)
    // Vers la gauche : la carte s'arrête à la marge, elle ne sort pas.
    expect(carte.left + borne(-LOIN, bornes.x)).toBe(10)
    // Vers la droite : son bord droit s'arrête à la marge opposée.
    expect(carte.left + carte.width + borne(LOIN, bornes.x)).toBe(HOTE.width - 10)
    // Vers le haut : elle ne passe pas sous la barre haute.
    expect(carte.top + borne(-LOIN, bornes.y)).toBe(MARGES.haut + 10)
    // Vers le bas : ni sous la barre basse.
    expect(carte.top + carte.height + borne(LOIN, bornes.y)).toBe(HOTE.height - MARGES.bas - 10)
  })

  it('déduit la largeur du panneau ouvert : une carte ne se cache pas dessous', () => {
    const carte = { left: 12, top: 56, width: 300, height: 400 }
    const avec = bornesDeplacement(carte, HOTE, { ...MARGES, droite: 350 }, 10)
    expect(carte.left + carte.width + borne(LOIN, avec.x)).toBe(HOTE.width - 350 - 10)
  })

  it('laisse glisser une carte plus haute que la place, sans la projeter', () => {
    // Bornes inversées : la carte déborde forcément d'une barre ou de l'autre. Elle doit
    // pouvoir choisir laquelle — sans le garde de `borne`, tout mouvement la renverrait au
    // même bord et elle deviendrait immobile.
    const geante = { left: 12, top: 56, width: 300, height: 900 }
    const bornes = bornesDeplacement(geante, HOTE, MARGES, 10)
    expect(bornes.y.max).toBeLessThan(bornes.y.min)
    // Vers le bas : elle s'aligne sous la barre haute. Vers le haut : au-dessus de la basse.
    expect(geante.top + borne(LOIN, bornes.y)).toBe(MARGES.haut + 10)
    expect(geante.top + geante.height + borne(-LOIN, bornes.y)).toBe(
      HOTE.height - MARGES.bas - 10,
    )
  })
})

describe('§3.4 — un objet cliqué ouvre sa fiche', () => {
  it('déplie la carte Cible et la garnit', () => {
    // Repliée tant qu'aucun objet n'a été désigné : le clic sur la scène doit la déplier,
    // sinon le geste se termine sans que rien ne se voie.
    expect(etatCoque().cartes.CIBLE.ouverte).toBe(false)
    ouvreCible(M31)
    expect(etatCoque().cartes.CIBLE.ouverte).toBe(true)
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

/**
 * T-0116 — le filé se peint par image ; ses compteurs ne se publient pas au même rythme.
 * `poseRenduFile` écrit dans le magasin de séance, donc déclenche un rendu React : publiés à
 * chaque peinture, ils en feraient trente par seconde (T-0056). La boucle n'appelle donc ce
 * publicateur qu'au rythme du diagnostic, et il coupe tout ce qui n'a pas bougé.
 */
describe('T-0116 — les compteurs du filé ne rendent pas par image', () => {
  const RENDU: RenduFile = { reelles: 12, generees: 340, tronques: 5 }

  it('ne publie qu’une fois tant que les compteurs ne bougent pas', () => {
    const publies: (RenduFile | null)[] = []
    const publie = publicateurRenduFile((r) => publies.push(r))
    // Une période de diagnostic entière de passes identiques : un seul rendu React.
    for (let i = 0; i < 30; i++) publie({ ...RENDU })
    expect(publies).toHaveLength(1)
    expect(publies[0]).toEqual(RENDU)
  })

  it('publie dès qu’un compteur change, et une seule fois à l’extinction', () => {
    const publies: (RenduFile | null)[] = []
    const publie = publicateurRenduFile((r) => publies.push(r))
    publie(RENDU)
    publie({ ...RENDU, tronques: RENDU.tronques + 1 })
    publie(null)
    publie(null)
    expect(publies).toHaveLength(3)
    expect(publies[2]).toBeNull()
  })

  it('publie le premier état même quand le filé est éteint dès le départ', () => {
    // Sans amorce, un `null` initial serait pris pour « rien n'a changé » et des compteurs
    // laissés par une séance précédente resteraient affichés sur un cadre vide.
    const publies: (RenduFile | null)[] = []
    publicateurRenduFile((r) => publies.push(r))(null)
    expect(publies).toEqual([null])
  })
})

describe('§5.1 — la scène déclare l’écart de projection avec l’objectif', () => {
  it('annonce quand la projection de la scène n’est pas celle de l’objectif', () => {
    expect(mentionProjection('MODE_CADRE', 'MODE_CADRE')).toBeNull()
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_CADRE')).toMatch(/gnomonique/)
    expect(mentionProjection('MODE_PLANETARIUM', 'MODE_FISHEYE')).toMatch(/équidistante/)
  })
})

describe('§11.2 — le plan reste imprimable', () => {
  it('rend le plan de session panneau fermé, masqué à l’écran seulement', () => {
    expect(ecran()).toContain('plan-session hors-onglet')
    basculePanneau('NUIT')
    expect(ecran()).toMatch(/class="plan-session"/)
  })

  it('rouvre le panneau à l’impression, sans quoi le plan sortirait blanc', () => {
    const impression = CSS_COQUE.slice(CSS_COQUE.indexOf('@media print'))
    expect(impression).toMatch(/\.coque-lateral\[hidden\]/)
  })
})

/**
 * T-0153 — il ne reste qu'une lecture, et elle est au centre de la barre basse.
 *
 * Le tiroir d'information de T-0038 mêlait la phrase qui date l'image et quatre lectures
 * d'atelier — magnitude limite, époque, cadrage, diagnostic de rendu. Notre persona ne mesure
 * pas le rendu. Ce qui se vérifie ici est donc double : la phrase est visible sans un clic, et
 * le tiroir n'existe plus.
 */
describe('T-0153 — la barre basse porte la phrase qui date l’image', () => {
  /** La barre basse : ce qui suit la dernière région, en fin de document. */
  function barreBasse(html: string): string {
    return html.slice(html.indexOf('coque-barrebas'))
  }

  it('pose la phrase au centre de la barre basse, entre le lieu et le transport', () => {
    const bas = barreBasse(ecran()).replaceAll('<!-- -->', '')
    expect(bas).toMatch(/visée[\s\S]*AD[\s\S]*azimut[\s\S]*hauteur[\s\S]*champ/)
    expect(bas).toContain('barrebas-visee')
    // Entre les deux : le lieu la précède, le transport la suit.
    expect(bas.indexOf('barrebas-lieu')).toBeLessThan(bas.indexOf('barrebas-visee'))
    expect(bas.indexOf('barrebas-visee')).toBeLessThan(bas.indexOf('barretemps'))
  })

  it('la centre en lui laissant ce que le lieu et le transport ne prennent pas', () => {
    const debut = CSS_COQUE.indexOf('.coque-barrebas > .barrebas-visee {')
    expect(debut).toBeGreaterThan(-1)
    const corps = CSS_COQUE.slice(debut, CSS_COQUE.indexOf('}', debut))
    expect(corps).toContain('flex: 1')
    expect(corps).toContain('text-align: center')
    // Elle est la seule à se rogner : un transport amputé ne se rattrape pas.
    expect(corps).toContain('text-overflow: ellipsis')
  })

  it('ne monte plus aucun tiroir de lectures dans la barre haute', () => {
    const html = ecran()
    expect(html).not.toContain('scene-lectures')
    expect(html).not.toContain('tiroir-infos')
    // Les lectures d'atelier partent avec lui : plus de compteur d'images par seconde.
    expect(html).not.toContain('images/s')
    expect(html).not.toContain('étoiles tracées sur')
  })
})

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
 * T-0041 — une alerte se signale sur le tiroir fermé.
 *
 * Une cause rangée dans un tiroir fermé est une cause invisible : on règle quelque chose,
 * rien ne bouge à l'écran, et l'explication est derrière un clic qu'on ne pense pas à faire.
 * T-0153 a démonté le menu d'information ; la règle vaut toujours pour le tiroir de
 * vérification, dont T-0082 signale une écriture perdue.
 */
describe('T-0041 — un tiroir qui s’alerte ne le dit pas par la seule couleur', () => {
  const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'ui', 'styles.css'), 'utf8')

  it('change aussi la graisse et la bordure', () => {
    const debut = CSS.indexOf(".tiroir[data-alerte='true'] > summary {")
    expect(debut).toBeGreaterThan(-1)
    const corps = CSS.slice(debut, CSS.indexOf('}', debut))
    // Le rouge du mode nuit ne dit rien seul.
    expect(corps).toContain('font-weight: 700')
    expect(corps).toContain('border-color: var(--alerte)')
  })
})


describe('T-0047 — la roue crantée reloge le choix brut dans le catalogue', () => {
  it('monte un tiroir de réglages dans la barre haute', () => {
    const ecran = renderToStaticMarkup(<App />)
    expect(ecran).toContain('tiroir tiroir-reglages')
    expect(ecran).toContain('Réglages')
  })

  it('T-0153 — ferme la barre : plus rien ne se monte après lui', () => {
    const topbar = barreHaute(renderToStaticMarkup(<App />))
    expect(topbar.indexOf('tiroir-verification')).toBeLessThan(topbar.indexOf('tiroir-reglages'))
    expect(topbar.slice(topbar.indexOf('tiroir-reglages'))).not.toContain('<details')
  })

  it('T-0128 — ne porte plus le catalogue : il a un écran à lui', () => {
    const rendu = renderToStaticMarkup(<MenuReglages {...REGLAGES_INERTES} />)
    expect(rendu).not.toContain('Chercher dans le catalogue')
    expect(rendu).not.toContain('<datalist')
  })

  it('ne porte plus de niveau d’explication : la glose est au survol pour tous', () => {
    const rendu = renderToStaticMarkup(<MenuReglages {...REGLAGES_INERTES} />)
    expect(rendu).not.toContain('Niveau')
    expect(rendu).not.toContain('<select')
  })

  it('T-0087 — porte les cinq poids C-15 et le retour aux valeurs du registre', () => {
    const rendu = renderToStaticMarkup(<MenuReglages {...REGLAGES_INERTES} />)
    expect(rendu.match(/type="range"/g)).toHaveLength(5)
    expect(rendu).toContain('Revenir aux poids C-15')
    // Le poids effectif s'affiche : c'est lui que le plan utilise, pas la position brute.
    expect(rendu).toContain('25 %')
  })

  it('T-0087 — dit que le score arbitre les conflits, sans ordonner la nuit', () => {
    const rendu = renderToStaticMarkup(<MenuReglages {...REGLAGES_INERTES} />)
    expect(rendu).toMatch(/chronologie suit les culminations/)
    expect(rendu).toMatch(/Rien n’est appris/)
  })

  it('garde la cible de clic de §11.2 : le tiroir est un `.tiroir` comme les autres', () => {
    const rendu = renderToStaticMarkup(<MenuReglages {...REGLAGES_INERTES} />)
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
 * T-0128 — le catalogue a un écran, et il en a UN seul.
 *
 * Ce qui est vérifié ici est le remplacement, pas la recherche : `chercheCatalogue` a ses
 * propres tests, et le filtrage ceux de `cibles-liste`. Ce qui doit se constater au niveau
 * de la coque, c'est qu'aucun des deux chemins remplacés ne subsiste — un second chemin
 * vers le catalogue est exactement le défaut que ce lot corrige.
 */
describe('T-0128 — l’onglet Cibles remplace les deux chemins vers le catalogue', () => {
  it('ouvre un troisième panneau latéral, en tête des onglets', () => {
    const topbar = barreHaute(ecran())
    expect(topbar).toContain('Toutes les cibles')
    expect(topbar.indexOf('Toutes les cibles')).toBeLessThan(topbar.indexOf('Plan de nuit'))
    expect(topbar.indexOf('Plan de nuit')).toBeLessThan(topbar.indexOf('Panorama'))
  })

  it('ne monte son contenu qu’une fois ouvert, comme les deux autres (§11.2)', () => {
    expect(ecran()).not.toContain('Tout le catalogue')
    basculePanneau('CIBLES')
    const ouvert = ecran()
    expect(ouvert).toContain('Tout le catalogue')
    expect(ouvert).toContain('Photographiables')
    expect(ouvert).not.toContain('<h2>Fenêtre nocturne</h2>')
  })

  it('referme sur une seconde pression de son bouton', () => {
    basculePanneau('CIBLES')
    expect(etatCoque().panneau).toBe('CIBLES')
    basculePanneau('CIBLES')
    expect(etatCoque().panneau).toBeNull()
  })

  it('porte la recherche et les deux filtres, que plus personne d’autre ne porte', () => {
    basculePanneau('CIBLES')
    const ouvert = ecran()
    expect(ouvert).toMatch(/<input[^>]+type="search"/)
    expect(ouvert).toContain('Tous types')
    expect(ouvert).toContain('Jusqu’à la magnitude')
  })

  it('a vidé la carte Cible de son choix de cible : elle ne fait plus que décrire', () => {
    ouvreCarte('CIBLE')
    const carte = ecran().slice(ecran().indexOf('carte-cible'))
    expect(carte).not.toContain('Cibles visibles')
    expect(carte).not.toContain('Type listé')
  })

  it('borne le filtre de magnitude sur le domaine du registre, sans le réécrire', () => {
    basculePanneau('CIBLES')
    const ouvert = ecran()
    expect(ouvert).toContain(`min="${DOMAINES.m_int.min}"`)
    expect(ouvert).toContain(`max="${DOMAINES.m_int.max}"`)
  })

  it('nomme le SNR sur lequel la pose est calculée : un temps sans sa cible ne se lit pas', () => {
    basculePanneau('CIBLES')
    expect(ecran()).toMatch(/rapport signal sur bruit de \d+/)
  })
})

describe('§11.2 — la cible de clic tient dans les panneaux comme ailleurs', () => {
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
