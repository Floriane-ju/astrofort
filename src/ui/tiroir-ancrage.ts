/**
 * T-0121 — une fenêtre de tiroir s'ouvre SOUS son bouton, et se décale pour rester à l'écran.
 *
 * La feuille de style ne sait pas tenir les deux promesses à la fois : ancrée au bouton
 * (`right: 0`), une fenêtre de 52 rem ouverte au milieu de la barre sort par la gauche ;
 * plaquée au bord de l'écran, elle ne dit plus quel bouton l'a ouverte. L'ancrage CSS natif
 * (`position-area`) sait RABATTRE une fenêtre d'un bord à l'autre, mais pas la faire GLISSER
 * — or c'est bien un glissement qu'il faut ici, puisque la fenêtre est plus large que la
 * distance entre le bouton et le bord.
 *
 * Le calage est donc mesuré à l'ouverture, en coordonnées d'écran : la fenêtre est en
 * `position: fixed`. Seule l'horizontale est calculée — la verticale reste à la feuille de
 * style, qui l'ancre à la barre, laquelle ne bouge pas.
 */

/** Marge des barres (0.75 rem) : une fenêtre ne s'approche pas du bord plus près que la coque. */
const MARGE_PX = 12

function cale(tiroir: HTMLDetailsElement): void {
  const contenu = tiroir.querySelector<HTMLElement>('.tiroir-contenu')
  const bouton = tiroir.querySelector('summary')
  if (!contenu || !bouton) return

  // Fenêtre fermée, ou repli sous 1100 px où elle revient dans le flux : il n'y a rien à
  // caler, et un `left` en dur y décalerait le contenu de la barre.
  if (getComputedStyle(contenu).position !== 'fixed') {
    contenu.style.removeProperty('left')
    contenu.style.removeProperty('right')
    return
  }

  const gauche = bouton.getBoundingClientRect().left
  const debord = window.innerWidth - contenu.offsetWidth - MARGE_PX
  contenu.style.left = `${Math.round(Math.max(MARGE_PX, Math.min(gauche, debord)))}px`
  contenu.style.right = 'auto'
}

/** Recale toutes les fenêtres ouvertes — après un redimensionnement, leur bord a bougé. */
function caleTout(): void {
  for (const t of document.querySelectorAll<HTMLDetailsElement>('details.tiroir')) cale(t)
}

/**
 * Écoute les ouvertures de tiroir et rend la fonction de retrait.
 *
 * `toggle` ne remonte pas : l'écoute se fait en phase de CAPTURE sur le document, ce qui
 * couvre les six tiroirs des deux barres sans qu'aucun n'ait à s'enregistrer.
 */
export function ancreTiroirs(): () => void {
  const surBascule = (evt: Event) => {
    const cible = evt.target
    if (cible instanceof HTMLDetailsElement && cible.classList.contains('tiroir')) cale(cible)
  }
  document.addEventListener('toggle', surBascule, true)
  window.addEventListener('resize', caleTout)
  return () => {
    document.removeEventListener('toggle', surBascule, true)
    window.removeEventListener('resize', caleTout)
  }
}
