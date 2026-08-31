/**
 * T-0162 — la loi de vitesse du glisser latéral, isolée du composant qui l'applique.
 *
 * Le geste est celui des éditeurs graphiques : on attrape un nombre, on tire à l'horizontale,
 * la valeur suit. Il est ABSOLU, pas incrémental — la valeur se recalcule à chaque mouvement
 * depuis celle qu'elle avait au moment du clic. C'est ce qui rend le geste réversible :
 * ramener le pointeur à son abscisse de départ rend la valeur de départ, alors qu'une somme
 * de déplacements dériverait à chaque arrondi.
 *
 * L'exposant est ce qui distingue ce geste d'un rail : un curseur `range` mappe une course
 * finie sur une plage finie, un compteur n'a pas de course. Avec une loi linéaire il faudrait
 * choisir entre régler au degré près et traverser une plage entière ; en puissance 3/2, les
 * premiers pixels donnent le cran et l'éloignement donne la course, sans mode à basculer.
 */

/** Pixels du premier cran. Sous ce seuil le geste ne change rien : c'est un clic. */
const PX_PAR_CRAN = 6
/**
 * Puissance de la distance. 3/2 est le compromis mesuré à la main : à 60 px on a une trentaine
 * de crans — de quoi parcourir une heure ou un mois — et à 6 px on en a exactement un.
 */
const EXPOSANT = 1.5

/**
 * Le nombre de crans que vaut un déplacement horizontal, en pixels CSS. Impair par
 * construction : tirer à gauche retire ce que tirer d'autant à droite ajoute.
 */
export function cransGlisse(dxPx: number): number {
  const crans = Math.trunc((Math.abs(dxPx) / PX_PAR_CRAN) ** EXPOSANT)
  // Le signe n'est posé qu'après : `Math.sign(-1) * 0` rendrait -0, et un zéro négatif se
  // propagerait jusque dans la valeur affichée.
  return crans === 0 ? 0 : Math.sign(dxPx) * crans
}
