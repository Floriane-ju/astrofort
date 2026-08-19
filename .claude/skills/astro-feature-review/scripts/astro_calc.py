#!/usr/bin/env python3
"""
Calculateur astro deterministe. Python 3, stdlib uniquement.

Sert a verifier les chiffres d'une revue de feature sans refaire l'arithmetique
optique de tete : une erreur de facteur 2 ou 60 passe inapercue dans une prose
confiante, pas dans une sortie de script.

Sous-commandes :
  cadrage   champ, echantillonnage, verdict d'echantillonnage, pouvoir separateur
  pose      pose unitaire optimale (noyage du bruit de lecture) et integration
  file      pose max avant file, et parametres d'un file d'etoiles intentionnel
  cible     cadrage d'un objet de taille donnee dans un champ donne

Toutes les entrees sont en unites explicites. Voir --help de chaque sous-commande.

Ce script ne calcule AUCUNE ephemeride : pas de position, pas de lever, pas de
phase lunaire. Ces grandeurs exigent une bibliotheque dediee (Skyfield, Astropy)
et ne doivent jamais etre approximees a la main dans une revue.
"""

import argparse
import math
import sys

ARCSEC_PER_RAD = 206264.806
SIDEREAL_ARCSEC_PER_SEC = 15.041  # rotation apparente a l'equateur celeste


# ---------------------------------------------------------------- utilitaires

def fov_deg(sensor_mm: float, focale_mm: float) -> float:
    """Champ exact via arctangente. L'approximation petite-angle derive au grand-angle."""
    return math.degrees(2.0 * math.atan(sensor_mm / (2.0 * focale_mm)))


def echantillonnage(pitch_um: float, focale_mm: float) -> float:
    """Arcsec par pixel."""
    return ARCSEC_PER_RAD * (pitch_um / 1000.0) / focale_mm


def fmt_angle(deg: float) -> str:
    """Degres decimaux -> forme lisible (deg / arcmin selon l'ordre de grandeur)."""
    if deg >= 1.0:
        return f"{deg:.3f}deg ({deg * 60:.1f}')"
    return f"{deg * 60:.2f}' ({deg * 3600:.0f}\")"


def verdict_echantillonnage(sampling: float) -> str:
    if sampling > 3.0:
        return "SOUS-ECHANTILLONNE - etoiles carrees, detail perdu definitivement"
    if sampling > 2.0:
        return "limite haute - acceptable sous seeing mediocre (>3\")"
    if sampling >= 1.0:
        return "OPTIMAL pour un seeing courant de 2 a 3\""
    if sampling >= 0.7:
        return "limite basse - justifie seulement sous excellent seeing"
    return "SUR-ECHANTILLONNE - bruit de lecture collecte pour rien"


# -------------------------------------------------------------------- cadrage

def cmd_cadrage(a) -> None:
    fl = a.focale * a.reducteur
    s = echantillonnage(a.pitch, fl)
    w = fov_deg(a.capteur_l, fl)
    h = fov_deg(a.capteur_h, fl)

    print(f"Focale effective     : {fl:.1f} mm", end="")
    if a.reducteur != 1.0:
        print(f"  (={a.focale:.0f} x {a.reducteur} reducteur/barlow)")
    else:
        print()
    if a.diametre:
        print(f"Rapport f/D          : f/{fl / a.diametre:.2f}")
    print(f"Champ                : {fmt_angle(w)} x {fmt_angle(h)}")
    print(f"Echantillonnage      : {s:.2f} \"/px")
    print(f"Verdict              : {verdict_echantillonnage(s)}")
    print(f"Pixels du champ      : {w * 3600 / s:.0f} x {h * 3600 / s:.0f} px")

    if a.diametre:
        print(f"Pouvoir separateur   : Dawes {116.0 / a.diametre:.2f}\"  "
              f"Rayleigh {138.0 / a.diametre:.2f}\"")
        print(f"Mag limite visuelle  : ~{2 + 5 * math.log10(a.diametre):.1f} "
              f"(ordre de grandeur, bon ciel)")

    petit = min(w, h) * 60.0  # arcmin
    print(f"\nCible bien cadree    : {petit / 3:.0f}' a {petit / 2:.0f}' "
          f"de diametre apparent (1/3 a 1/2 du petit cote)")


# ----------------------------------------------------------------------- pose

def cmd_pose(a) -> None:
    if not 0 < a.perte_snr < 1:
        sys.exit("perte-snr doit etre strictement entre 0 et 1 (ex: 0.05 pour 5%)")
    C = 1.0 / ((1.0 / (1.0 - a.perte_snr)) ** 2 - 1.0)
    t = C * a.rn ** 2 / a.fond_ciel

    print(f"Perte de SNR toleree : {a.perte_snr * 100:.0f}%  -> facteur C = {C:.2f}")
    print(f"Bruit de lecture     : {a.rn:.2f} e-")
    print(f"Fond de ciel         : {a.fond_ciel:.2f} e-/s/px")
    duree = f"{t:.0f} s" + (f" ({t / 60:.1f} min)" if t >= 60 else "")
    print(f"\nPose unitaire optimale : {duree}")
    print(f"  formule : t = C x RN^2 / flux_ciel = {C:.2f} x {a.rn ** 2:.2f} / {a.fond_ciel:.2f}")

    # Le seuil physique n'est pas le seuil praticable. La formule peut renvoyer
    # une pose theoriquement suffisante mais ingerable sur le terrain : le nombre
    # de fichiers explose, le temps de lecture devient une fraction notable du
    # cycle, et le suivi n'a pas le temps de se stabiliser entre poses.
    if t < 10:
        print(f"\n  /!\\ PRATICABILITE : {t:.0f} s est physiquement suffisant mais tres court.")
        print("      A ce niveau, le nombre de fichiers et le temps de lecture dominent.")
        print("      Verifier que le flux de fond de ciel est plausible (un fond > 5 e-/s/px")
        print("      suppose un ciel tres pollue en large bande), puis plafonner a 15-30 s")
        print("      comme choix produit assume plutot que comme resultat de formule.")
    elif t > 600:
        print(f"\n  /!\\ PRATICABILITE : {t / 60:.0f} min expose a la perte d'images (vent, avion,")
        print("      satellite, saturation des etoiles brillantes). Plafonner vers 300-600 s")
        print("      coute peu de SNR et reduit fortement le risque.")

    if a.integration_h:
        total = a.integration_h * 3600.0
        n = total / t
        print(f"\nIntegration visee    : {a.integration_h:.1f} h  -> {n:.0f} poses de {t:.0f} s")
        print(f"Pour doubler le SNR  : {a.integration_h * 4:.1f} h "
              f"(SNR proportionnel a la racine du temps total)")
        if a.taille_fichier_mo:
            print(f"Volume disque        : {n * a.taille_fichier_mo / 1024:.1f} Go "
                  f"({a.taille_fichier_mo:.0f} Mo/pose)")

    print("\nRappels : le flux de fond de ciel doit etre MESURE sur le site avec le")
    print("materiel reel. Ciel pollue -> fond eleve -> pose optimale COURTE.")
    print("Narrowband -> fond coupe par le filtre -> pose optimale LONGUE.")
    print("Calibration : darks (meme T, gain, duree), flats, offsets, dithering.")


# ----------------------------------------------------------------------- file

def cmd_file(a) -> None:
    fl = a.focale * a.reducteur
    s = echantillonnage(a.pitch, fl)
    cd = math.cos(math.radians(a.dec))

    print(f"Focale effective     : {fl:.1f} mm   Echantillonnage : {s:.2f} \"/px")
    print(f"Declinaison cible    : {a.dec:.1f}deg  -> cos(dec) = {cd:.3f}")

    print("\n--- Pose max avant file (setup NON suivi) ---")
    npf_s = (35.0 * a.ouverture + 30.0 * a.pitch) / fl
    npf_e = (16.856 * a.ouverture + 0.0997 * fl + 13.713 * a.pitch) / (fl * cd)
    r500 = 500.0 / (fl * a.crop)
    print(f"NPF simplifiee       : {npf_s:.1f} s   (35N + 30p) / f")
    print(f"NPF etendue (k={a.k})   : {npf_e * a.k:.1f} s   avec correction cos(dec)")
    print(f"Regle des 500        : {r500:.1f} s   (repere historique, laxiste)")
    if a.tolerance_px:
        t_tol = a.tolerance_px * s / (SIDEREAL_ARCSEC_PER_SEC * cd)
        print(f"Pour <= {a.tolerance_px:.1f} px de trace : {t_tol:.1f} s   "
              f"(critere physique direct)")

    print("\n--- File d'etoiles intentionnel (empilement, mode eclaircir) ---")
    inter = a.intervalle
    n = a.duree_h * 3600.0 / (a.pose + inter)
    arc = SIDEREAL_ARCSEC_PER_SEC / 3600.0 * a.duree_h * 3600.0 * cd
    trace_px = SIDEREAL_ARCSEC_PER_SEC * a.pose * cd / s
    print(f"Pose unitaire        : {a.pose:.0f} s   (plage praticable : 20-30 s)")
    print(f"Intervalle           : {inter:.1f} s   "
          f"{'OK' if inter <= 1.0 else 'TROP LONG -> trous visibles dans les traces'}")
    print(f"Nombre d'images      : {n:.0f}")
    print(f"Arc obtenu           : {arc:.1f}deg  (15deg/h x {a.duree_h:.1f} h x cos(dec))")
    print(f"Trace par pose       : {trace_px:.0f} px")
    if a.taille_fichier_mo:
        print(f"Volume carte         : {n * a.taille_fichier_mo / 1024:.1f} Go")
    print("\nA verifier avant la sortie : autonomie batterie, place carte, buee.")
    print("Un file de 3 h echoue plus souvent par batterie vide que par erreur de pose.")


# ---------------------------------------------------------------------- cible

def cmd_cible(a) -> None:
    fl = a.focale * a.reducteur
    w = fov_deg(a.capteur_l, fl) * 60.0
    h = fov_deg(a.capteur_h, fl) * 60.0
    petit = min(w, h)
    frac = a.taille / petit

    print(f"Champ                : {w:.1f}' x {h:.1f}'  (petit cote {petit:.1f}')")
    print(f"Objet                : {a.taille:.1f}' -> occupe {frac * 100:.0f}% du petit cote")
    if frac > 1.0:
        print("Verdict              : NE RENTRE PAS - mosaique ou focale plus courte")
    elif frac > 0.66:
        print("Verdict              : TROP SERRE - aucune marge pour rotation ni gradients de bord")
    elif frac >= 0.33:
        print("Verdict              : BIEN CADRE")
    elif frac >= 0.20:
        print("Verdict              : PETIT - exploitable, recadrage necessaire")
    else:
        print("Verdict              : PERDU DANS LE CHAMP - focale plus longue")
    print(f"\nFocale ideale        : {fl * (petit * 0.4 / a.taille):.0f} mm "
          f"(pour occuper 40% du petit cote)")


# ------------------------------------------------------------------------ CLI

def main() -> None:
    p = argparse.ArgumentParser(
        description="Calculateur astro deterministe (aucune ephemeride).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("cadrage", help="champ, echantillonnage, resolution")
    c.add_argument("--focale", type=float, required=True, help="focale en mm")
    c.add_argument("--pitch", type=float, required=True, help="pitch pixel en um")
    c.add_argument("--capteur-l", type=float, required=True, help="largeur capteur en mm")
    c.add_argument("--capteur-h", type=float, required=True, help="hauteur capteur en mm")
    c.add_argument("--diametre", type=float, help="diametre optique en mm (optionnel)")
    c.add_argument("--reducteur", type=float, default=1.0, help="facteur reducteur/barlow")
    c.set_defaults(func=cmd_cadrage)

    o = sub.add_parser("pose", help="pose unitaire optimale et integration")
    o.add_argument("--rn", type=float, required=True, help="bruit de lecture en e- au gain utilise")
    o.add_argument("--fond-ciel", type=float, required=True,
                   help="flux de fond de ciel en e-/s/px (a MESURER sur site)")
    o.add_argument("--perte-snr", type=float, default=0.05,
                   help="perte de SNR toleree, 0.05 = 5%% (defaut)")
    o.add_argument("--integration-h", type=float, help="integration totale visee en heures")
    o.add_argument("--taille-fichier-mo", type=float, help="taille d'une pose en Mo")
    o.set_defaults(func=cmd_pose)

    f = sub.add_parser("file", help="pose max avant file, et file intentionnel")
    f.add_argument("--focale", type=float, required=True, help="focale en mm")
    f.add_argument("--ouverture", type=float, required=True, help="nombre d'ouverture N (le N de f/N)")
    f.add_argument("--pitch", type=float, required=True, help="pitch pixel en um")
    f.add_argument("--dec", type=float, default=0.0, help="declinaison de la cible en deg")
    f.add_argument("--crop", type=float, default=1.0, help="crop factor pour la regle des 500")
    f.add_argument("--k", type=float, default=1.0, help="tolerance NPF etendue (1 strict, 2-3 tolerant)")
    f.add_argument("--tolerance-px", type=float, help="trace max toleree en px")
    f.add_argument("--duree-h", type=float, default=1.0, help="duree totale du file en heures")
    f.add_argument("--pose", type=float, default=25.0, help="pose unitaire du file en s")
    f.add_argument("--intervalle", type=float, default=1.0, help="intervalle inter-poses en s")
    f.add_argument("--reducteur", type=float, default=1.0, help="facteur reducteur/barlow")
    f.add_argument("--taille-fichier-mo", type=float, help="taille d'une pose en Mo")
    f.set_defaults(func=cmd_file)

    t = sub.add_parser("cible", help="cadrage d'un objet de taille connue")
    t.add_argument("--focale", type=float, required=True, help="focale en mm")
    t.add_argument("--capteur-l", type=float, required=True, help="largeur capteur en mm")
    t.add_argument("--capteur-h", type=float, required=True, help="hauteur capteur en mm")
    t.add_argument("--taille", type=float, required=True,
                   help="dimension apparente de l'objet en arcmin")
    t.add_argument("--reducteur", type=float, default=1.0, help="facteur reducteur/barlow")
    t.set_defaults(func=cmd_cible)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
