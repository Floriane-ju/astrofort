/**
 * §1.5 — les renvois au PRD sont de la traçabilité, pas du texte d'interface.
 *
 * Le registre cite sa section (`§8.3 — …`) parce que c'est ce qui rend une valeur
 * vérifiable : la référence reste dans la donnée. Elle est retirée au rendu, où elle
 * n'apprend rien au lecteur du ciel et alourdit chaque libellé.
 *
 * Les motifs suivent les trois formes que le registre emploie — renvoi en tête suivi d'un
 * tiret, renvoi entre parenthèses, renvoi introduit par « voir » — de sorte que la phrase
 * reste grammaticale une fois la référence enlevée.
 */

const RENVOIS: readonly (readonly [RegExp, string])[] = Object.freeze([
  // « (§2.4) » et « (§9.2 et §9.3) » : la parenthèse entière disparaît avec son renvoi.
  [/\s*\(§[\d.]+(?:\s*(?:,|et|à)\s*§?[\d.]+)*\)/g, ''],
  // « (§2.1, dernier critère) » : seul le renvoi part, la précision reste.
  [/\(§[\d.]+\s*,\s*/g, '('],
  // « §8.3 — … » et « §8.3 et §8.4 — … » en tête de source.
  [/^§[\d.]+(?:\s*(?:et|,)\s*§[\d.]+)*\s*[—–-]\s*/, ''],
  [/,?\s*voir\s+§[\d.]+/g, ''],
  [/\s*[—–]\s*§[\d.]+(?:\s*(?:et|,)\s*§[\d.]+)*/g, ''],
  [/\s*§[\d.]+/g, ''],
  [/\s{2,}/g, ' '],
] as const)

export function sansSection(texte: string): string {
  return RENVOIS.reduce((t, [motif, remplacement]) => t.replace(motif, remplacement), texte).trim()
}
