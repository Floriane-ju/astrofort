# Base boîtiers — §5.1

Un boîtier par ligne. Ce fichier est lu tel quel par l'application (`boitiers.ts`) : l'éditer
suffit, il n'y a ni étape de build ni fichier généré à régénérer.

## Ajouter le sien

Copier une ligne de la table, changer les valeurs, garder l'ordre des colonnes. L'`id` doit
être unique — minuscules, chiffres et tirets. Un test vérifie chaque ligne au démarrage de la
suite : une valeur hors des bornes du registre échoue en nommant le champ fautif.

**Une colonne vide vaut « inconnu », jamais zéro.** Le registre fournit alors son repli et
toute sortie qui en dépend porte `[ESTIMÉ]` — c'est déjà le contrat de la saisie manuelle.
Mieux vaut une colonne vide qu'un chiffre plausible : une valeur inventée passe pour une mesure.

## Les colonnes

| Colonne | Ce que c'est | Où la lire |
|---|---|---|
| `id` | Identifiant stable, cité par le profil enregistré. Ne pas le changer après coup. | — |
| `Modèle` | Ce qui s'affiche dans le sélecteur. | — |
| `Format` | `PLEIN_FORMAT`, `APSC_NIKON`, `APSC_CANON`, `MICRO_4_3` ou `MOYEN_FORMAT`. Fixe les dimensions du capteur (`capteur-formats.ts`). | fiche produit |
| `Mpx` | **Pixels enregistrés** ÷ 10⁶, pas les mégapixels « effectifs » du marketing. 7008 × 4672 → 32.74. C'est de là que vient le pitch. | dimensions de l'image maximale |
| `Poids RAW (Mo)` | Taille d'un fichier brut. Dépend du réglage (compressé, sans perte, non compressé) : **à renseigner soi-même**, c'est un chiffre qu'on lit sur sa propre carte. Vide → générique du registre. | sa carte mémoire |
| `Seuil double gain (ISO)` | ISO où le bruit de lecture chute brutalement. C'est lui, et lui seul, qui fait recommander un ISO (§7.2). Vide → aucun ISO n'est recommandé. | courbe Photons to Photos |
| `Bruit de lecture (e⁻ par ISO)` | `ISO:valeur`, séparés par des espaces. Les paliers pleins jusqu'à 6400, plus le seuil. Un ISO absent de la liste retombe sur le repli du registre. | courbe Photons to Photos |
| `Capacité saturation (e⁻)` | Capacité de puits, au gain de base. | Photons to Photos (`fwc`) |
| `ZP sys (mag)` | Point zéro système §2.3. **Vide pour tous** : il n'est publié nulle part et ne se dérive pas d'une fiche produit. Le générique C-14 s'applique, la pose porte `[ESTIMÉ]`, et la plage utile absorbe l'écart. | — |
| `Source` | D'où viennent les chiffres de la ligne. Obligatoire (§2.1). | — |

## D'où viennent ces chiffres

Bruit de lecture et capacité de saturation sont relevés sur les courbes de
[Photons to Photos](https://www.photonstophotos.net/Charts/RN_e.htm), la source que le PRD
nomme déjà en §2.3 et §7.2. Le nom de la série y est cité par ligne, pour pouvoir refaire
la lecture.

Le seuil de double gain se lit sur la même courbe : une chute brutale en un tiers de
diaphragme, suivie d'un bruit de lecture qui ne descend plus. C'est la signature du double
gain de conversion — au-delà, amplifier davantage ne réduit plus le bruit en électrons.
Un capteur qui descend régulièrement marche après marche n'a pas de seuil : sa colonne reste
vide, et aucun ISO n'est recommandé. C'est le cas des Canon EOS R, Ra, RP, 6D Mark II,
5D Mark IV, 90D et R10, des Nikon D750, D5600, Z 50 et Z fc, des Sony α7 II et α6000, et des
Panasonic G9, G9 II et GH5.

Format et résolution viennent des spécifications constructeur.

## La table

| id | Modèle | Format | Mpx | Poids RAW (Mo) | Seuil double gain (ISO) | Bruit de lecture (e⁻ par ISO) | Capacité saturation (e⁻) | ZP sys (mag) | Source |
|---|---|---|---|---|---|---|---|---|---|
| sony-a7-2 | Sony α7 II | PLEIN_FORMAT | 24.0 |  |  | 100:5.13 200:3.89 400:3.36 800:3.05 1600:2.99 3200:2.97 6400:2.99 | 65656 |  | Photons to Photos `Sony ILCE-7M2` |
| sony-a7-3 | Sony α7 III | PLEIN_FORMAT | 24.0 |  | 640 | 100:6.41 200:5.39 400:4.99 640:1.44 800:1.34 1600:1.37 3200:1.26 6400:1.19 | 93703 |  | Photons to Photos `Sony ILCE-7M3` |
| sony-a7-4 | Sony α7 IV | PLEIN_FORMAT | 32.74 | 33 | 400 | 100:4.59 200:4.11 400:1.35 800:1.32 1600:1.32 3200:1.25 6400:1.22 | 65432 |  | Photons to Photos `Sony ILCE-7M4` |
| sony-a7c | Sony α7C | PLEIN_FORMAT | 24.0 |  | 640 | 100:6.11 200:5.17 400:4.92 640:1.36 800:1.29 1600:1.25 3200:1.18 6400:1.09 | 93917 |  | Photons to Photos `Sony ILCE-7C` |
| sony-a7c-2 | Sony α7C II | PLEIN_FORMAT | 32.74 | 60 | 400 | 100:4.72 200:4.29 400:1.47 800:1.39 1600:1.31 3200:1.37 6400:1.31 | 69634 |  | Photons to Photos `Sony ILCE-7CM2` |
| sony-a7r-4 | Sony α7R IV | PLEIN_FORMAT | 60.21 |  | 320 | 100:2.91 200:2.87 320:1.3 400:1.25 800:1.21 1600:1.17 3200:1.13 6400:1.13 | 34452 |  | Photons to Photos `Sony ILCE-7RM4` |
| sony-a7r-5 | Sony α7R V | PLEIN_FORMAT | 60.21 |  | 320 | 100:3.41 200:3.23 320:1.47 400:1.48 800:1.39 1600:1.42 3200:1.33 6400:1.28 | 36950 |  | Photons to Photos `Sony ILCE-7RM5` |
| sony-a7s-3 | Sony α7S III | PLEIN_FORMAT | 12.0 |  | 1600 | 100:13.09 200:10.93 400:10.06 800:9.32 1600:1.13 3200:1.06 6400:0.86 | 227834 |  | Photons to Photos `Sony ILCE-7SM3` |
| sony-a1 | Sony α1 | PLEIN_FORMAT | 49.77 |  | 500 | 100:4.08 200:4.14 400:4.06 500:0.95 800:0.93 1600:0.98 3200:0.94 6400:0.95 | 39579 |  | Photons to Photos `Sony ILCE-1` |
| sony-a9-3 | Sony α9 III | PLEIN_FORMAT | 24.0 |  | 800 | 400:5.82 800:2.45 1600:2.38 3200:2.38 6400:2.35 | 37313 |  | Photons to Photos `Sony ILCE-9M3` |
| sony-a6000 | Sony α6000 | APSC_NIKON | 24.0 |  |  | 100:4.96 200:3.66 400:3.1 800:2.71 1600:2.41 3200:2.19 6400:2.04 | 32205 |  | Photons to Photos `Sony ILCE-6000` |
| sony-a6400 | Sony α6400 | APSC_NIKON | 24.0 |  | 400 | 100:3.25 200:2.91 400:1.17 800:1.09 1600:1.05 3200:1.03 6400:0.78 | 36443 |  | Photons to Photos `Sony ILCE-6400` |
| sony-a6600 | Sony α6600 | APSC_NIKON | 24.0 |  | 400 | 100:3.18 200:2.83 400:1.17 800:1.09 1600:1.06 3200:0.99 | 39381 |  | Photons to Photos `Sony ILCE-6600` |
| sony-a6700 | Sony α6700 | APSC_NIKON | 25.56 |  | 320 | 100:3.68 200:3.36 320:1.53 400:1.51 800:1.42 1600:1.44 3200:1.36 6400:1.31 | 39378 |  | Photons to Photos `Sony ILCE-6700` |
| canon-r | Canon EOS R | PLEIN_FORMAT | 30.1 |  |  | 100:11.39 200:6.32 400:3.89 800:2.93 1600:2.33 3200:2.01 6400:1.71 | 66292 |  | Photons to Photos `Canon EOS R` |
| canon-ra | Canon EOS Ra | PLEIN_FORMAT | 30.1 |  |  | 100:9.06 200:4.96 400:3.18 800:2.41 1600:1.91 3200:1.67 6400:1.38 | 75089 |  | Photons to Photos `Canon EOS Ra` |
| canon-rp | Canon EOS RP | PLEIN_FORMAT | 25.96 |  |  | 100:36.25 200:19.7 400:10.2 800:5.86 1600:3.86 3200:2.83 6400:2.62 | 79455 |  | Photons to Photos `Canon EOS RP` |
| canon-r5 | Canon EOS R5 | PLEIN_FORMAT | 44.76 |  | 400 | 100:4.14 200:4.76 400:1.25 800:1.67 1600:1.59 3200:1.54 6400:1.46 | 49605 |  | Photons to Photos `Canon EOS R5` |
| canon-r6 | Canon EOS R6 | PLEIN_FORMAT | 19.96 |  | 400 | 100:7.62 200:5.31 400:2.75 800:2.08 1600:1.91 3200:1.67 6400:1.31 | 100012 |  | Photons to Photos `Canon EOS R6` |
| canon-r6-2 | Canon EOS R6 Mark II | PLEIN_FORMAT | 24.0 |  | 400 | 100:6.23 200:4.82 400:1.96 800:1.64 1600:1.56 3200:1.4 6400:1.21 | 95315 |  | Photons to Photos `Canon EOS R6 Mark II` |
| canon-r8 | Canon EOS R8 | PLEIN_FORMAT | 24.0 |  | 400 | 100:6.06 200:4.41 400:1.84 800:1.53 1600:1.42 3200:1.32 6400:1.11 | 92859 |  | Photons to Photos `Canon EOS R8` |
| canon-6d-2 | Canon EOS 6D Mark II | PLEIN_FORMAT | 25.96 |  |  | 100:36.5 200:19.97 400:10.13 800:5.86 1600:3.81 3200:2.73 6400:2.5 | 79343 |  | Photons to Photos `Canon EOS 6D Mark II` |
| canon-5d-4 | Canon EOS 5D Mark IV | PLEIN_FORMAT | 30.1 |  |  | 100:11.47 200:5.86 400:3.97 800:2.89 1600:2.35 3200:1.99 6400:1.71 | 67871 |  | Photons to Photos `Canon EOS 5D Mark IV` |
| canon-r7 | Canon EOS R7 | APSC_CANON | 32.29 |  | 400 | 100:3.97 200:2.93 400:1.67 800:1.45 1600:1.28 3200:1.08 6400:0.93 | 25499 |  | Photons to Photos `Canon EOS R7` |
| canon-r10 | Canon EOS R10 | APSC_CANON | 24.0 |  |  | 100:4.14 200:2.87 400:2.43 800:2.39 1600:2.22 3200:2.0 6400:1.35 | 32681 |  | Photons to Photos `Canon EOS R10` |
| canon-90d | Canon EOS 90D | APSC_CANON | 32.29 |  |  | 100:6.5 200:3.89 400:2.43 800:1.74 1600:1.45 3200:1.25 6400:1.09 | 26435 |  | Photons to Photos `Canon EOS 90D` |
| nikon-z6 | Nikon Z 6 | PLEIN_FORMAT | 24.34 |  | 800 | 100:6.87 200:5.98 400:5.31 800:1.62 1600:1.37 3200:1.27 6400:1.21 | 80359 |  | Photons to Photos `Nikon Z 6` |
| nikon-z6-2 | Nikon Z 6II | PLEIN_FORMAT | 24.34 |  | 800 | 100:8.51 200:5.54 400:4.99 800:1.67 1600:1.3 3200:1.23 6400:1.13 | 78155 |  | Photons to Photos `Nikon Z 6II` |
| nikon-z6-3 | Nikon Z 6III | PLEIN_FORMAT | 24.39 |  | 800 | 100:11.88 200:10.7 400:9.25 800:1.96 1600:1.8 3200:1.66 6400:1.56 | 79728 |  | Photons to Photos `Nikon Z 6III` |
| nikon-z8 | Nikon Z 8 | PLEIN_FORMAT | 45.44 |  | 500 | 100:6.19 200:6.06 400:5.5 500:1.26 800:1.19 1600:1.2 3200:1.13 6400:1.11 | 54323 |  | Photons to Photos `Nikon Z 8` |
| nikon-z9 | Nikon Z 9 | PLEIN_FORMAT | 45.44 |  | 500 | 100:5.78 200:5.86 400:5.31 500:1.18 800:1.15 1600:1.13 3200:1.05 6400:1.05 | 52458 |  | Photons to Photos `Nikon Z 9` |
| nikon-zf | Nikon Z f | PLEIN_FORMAT | 24.39 |  | 800 | 100:8.28 200:6.15 400:5.74 800:1.57 1600:1.45 3200:1.32 6400:1.23 | 82262 |  | Photons to Photos `Nikon Z f` |
| nikon-d750 | Nikon D750 | PLEIN_FORMAT | 24.16 |  |  | 100:5.21 200:4.32 400:3.78 800:3.32 1600:3.03 3200:2.57 6400:2.31 | 78478 |  | Photons to Photos `Nikon D750` |
| nikon-d780 | Nikon D780 | PLEIN_FORMAT | 24.34 |  | 800 | 100:7.84 200:6.15 400:5.43 800:1.83 1600:1.51 3200:1.4 6400:1.27 | 87028 |  | Photons to Photos `Nikon D780` |
| nikon-d850 | Nikon D850 | PLEIN_FORMAT | 45.44 |  | 400 | 100:4.11 200:3.71 400:1.48 800:1.34 1600:1.24 3200:1.22 6400:1.11 | 59126 |  | Photons to Photos `Nikon D850` |
| nikon-z50 | Nikon Z 50 | APSC_NIKON | 20.67 |  |  | 100:4.66 200:4.14 400:2.17 800:1.67 1600:1.52 3200:1.42 6400:1.34 | 49634 |  | Photons to Photos `Nikon Z 50` |
| nikon-zfc | Nikon Z fc | APSC_NIKON | 20.67 |  |  | 100:5.03 200:5.1 400:2.27 800:1.74 1600:1.59 3200:1.47 6400:1.39 | 55261 |  | Photons to Photos `Nikon Z fc` |
| nikon-d5600 | Nikon D5600 | APSC_NIKON | 24.0 |  |  | 100:3.05 200:2.68 400:2.41 800:2.16 1600:2.07 | 32718 |  | Photons to Photos `Nikon D5600` |
| fuji-xt4 | Fujifilm X-T4 | APSC_NIKON | 25.96 |  | 500 | 200:5.21 400:4.79 500:2.28 800:2.25 1600:2.0 3200:1.89 6400:1.69 | 46164 |  | Photons to Photos `FujiFilm X-T4` |
| fuji-xt5 | Fujifilm X-T5 | APSC_NIKON | 39.82 |  | 500 | 200:2.38 400:2.25 500:1.31 800:1.26 1600:1.19 3200:1.14 6400:1.13 | 23211 |  | Photons to Photos `FujiFilm X-T5` |
| fuji-xh2 | Fujifilm X-H2 | APSC_NIKON | 39.82 |  | 500 | 200:2.45 400:2.28 500:1.3 800:1.26 1600:1.19 3200:1.17 6400:1.16 | 23893 |  | Photons to Photos `FujiFilm X-H2` |
| fuji-xh2s | Fujifilm X-H2S | APSC_NIKON | 25.96 |  | 500 | 200:4.5 400:3.94 500:1.61 800:1.47 1600:1.37 3200:1.27 6400:1.22 | 28483 |  | Photons to Photos `FujiFilm X-H2S` |
| fuji-xs10 | Fujifilm X-S10 | APSC_NIKON | 25.96 |  | 500 | 200:3.71 400:3.36 500:1.59 800:1.49 1600:1.45 3200:1.34 6400:1.23 | 29632 |  | Photons to Photos `FujiFilm X-S10` |
| fuji-gfx100s | Fujifilm GFX 100S | MOYEN_FORMAT | 101.76 |  | 500 | 100:3.03 200:2.36 400:2.23 500:1.09 800:0.99 1600:0.97 3200:0.91 6400:0.88 | 38467 |  | Photons to Photos `FujiFilm GFX 100S` |
| fuji-gfx100-2 | Fujifilm GFX 100 II | MOYEN_FORMAT | 101.76 |  | 500 | 100:3.39 200:2.93 400:2.89 500:1.07 800:1.03 1600:0.97 3200:0.9 6400:0.87 | 53625 |  | Photons to Photos `FujiFilm GFX 100 II` |
| om-1 | OM System OM-1 | MICRO_4_3 | 20.16 |  | 1000 | 200:3.97 400:3.14 800:2.66 1000:1.71 1600:1.6 3200:1.44 6400:1.31 | 19491 |  | Photons to Photos `Olympus System OM-1` |
| om-1-2 | OM System OM-1 Mark II | MICRO_4_3 | 20.16 |  | 1000 | 200:3.94 400:3.12 800:2.62 1000:1.69 1600:1.6 3200:1.37 6400:1.27 | 20188 |  | Photons to Photos `Olympus System OM-1 Mark II` |
| pana-g9 | Panasonic Lumix G9 | MICRO_4_3 | 20.16 |  |  | 200:3.92 400:2.97 800:2.55 1600:1.87 3200:1.64 6400:1.49 | 22741 |  | Photons to Photos `Panasonic Lumix DC-G9` |
| pana-g9-2 | Panasonic Lumix G9 II | MICRO_4_3 | 25.04 |  |  | 100:2.51 200:1.33 400:0.91 800:0.71 1600:0.65 3200:0.5 6400:0.5 | 16380 |  | Photons to Photos `Panasonic Lumix DC-G9M2` |
| pana-gh5 | Panasonic Lumix GH5 | MICRO_4_3 | 20.16 |  |  | 200:3.18 400:2.6 800:2.28 1600:1.69 3200:1.48 6400:1.44 | 15641 |  | Photons to Photos `Panasonic Lumix DC-GH5` |
| pana-s5 | Panasonic Lumix S5 | PLEIN_FORMAT | 24.0 |  | 640 | 100:8.94 200:6.68 400:5.5 640:1.87 800:1.73 1600:1.47 3200:1.34 6400:1.21 | 90466 |  | Photons to Photos `Panasonic Lumix DC-S5` |
| pana-s5-2 | Panasonic Lumix S5 II | PLEIN_FORMAT | 24.0 |  | 640 | 100:6.59 200:5.5 400:4.86 640:1.47 800:1.43 1600:1.25 3200:1.21 6400:1.09 | 88605 |  | Photons to Photos `Panasonic Lumix DC-S5M2` |
| pentax-k1-2 | Pentax K-1 Mark II | PLEIN_FORMAT | 36.15 |  | 640 | 100:3.29 200:2.85 400:2.53 640:1.13 800:1.1 1600:0.98 3200:1.01 6400:1.06 | 48634 |  | Photons to Photos `Pentax K-1 II` |
