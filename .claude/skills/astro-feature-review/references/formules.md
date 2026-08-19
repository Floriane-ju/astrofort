# Formules — optique, pose, visibilité

Unités toujours explicites. Une erreur d'unité dans ce domaine ne lève pas d'exception : elle
produit un résultat plausible et faux.

## Sommaire

- [1. Champ et cadrage](#1-champ-et-cadrage)
- [2. Échantillonnage et résolution](#2-échantillonnage-et-résolution)
- [3. Visibilité d'un objet](#3-visibilité-dun-objet)
- [4. Ciel profond — visibilité réelle](#4-ciel-profond--visibilité-réelle)
- [5. Pose unitaire optimale](#5-pose-unitaire-optimale)
- [6. Pose maximale sans suivi](#6-pose-maximale-sans-suivi)
- [7. Filé d'étoiles intentionnel](#7-filé-détoiles-intentionnel)
- [8. Intégration et SNR](#8-intégration-et-snr)

---

## 1. Champ et cadrage

Champ couvert par un capteur, exact :

```
FOV(°) = 2 × atan( dimension_capteur(mm) / (2 × focale(mm)) )
```

Approximation petite-angle, valable au-delà de ~200 mm de focale, fausse de plusieurs pourcents
au grand-angle :

```
FOV(°) ≈ 57.296 × dimension_capteur(mm) / focale(mm)
```

Calculer les deux dimensions séparément (largeur et hauteur du capteur) — un champ exprimé en une
seule valeur est inutilisable pour du cadrage.

**Règle de cadrage** : l'objet doit occuper environ 1/3 à 1/2 de la plus petite dimension du
champ. En dessous d'un quart, il se perd ; au-delà des deux tiers, plus de marge pour la rotation
de champ, le recadrage, ni les gradients de bord.

Réducteur ou barlow : multiplier la focale par le facteur avant tout calcul. Un réducteur 0.8x sur
un 500 mm donne 400 mm de focale et un f/D divisé par 0.8.

## 2. Échantillonnage et résolution

```
échantillonnage("/px) = 206.265 × pitch_pixel(µm) / focale(mm)
```

La constante 206.265 est le nombre d'arcsec par radian divisé par 1000 — elle encapsule la
conversion µm→mm. Ne pas la recalculer.

Cible en longue pose sous un seeing courant de 2 à 3" : **1 à 2 "/px**. Le critère physique est
d'échantillonner la FWHM par 2 à 3 pixels.

- Sous-échantillonné (> 3 "/px) : étoiles carrées, détail perdu définitivement.
- Sur-échantillonné (< 0.7 "/px) : on étale le même signal sur plus de pixels, on collecte du
  bruit de lecture supplémentaire pour rien.

Pouvoir séparateur théorique, diamètre D en mm :

```
Dawes("):    116 / D
Rayleigh("): 138 / D
```

En pratique le seeing plafonne à 1–3" quel que soit le diamètre, sauf en planétaire par
lucky imaging.

## 3. Visibilité d'un objet

Chaîne de calcul, dans cet ordre :

1. Instant en échelle de temps correcte (UTC en interne, toujours).
2. Coordonnées équatoriales de l'objet (RA/Dec) à l'epoch cohérente avec le catalogue.
3. Conversion en horizontales (altitude/azimut) pour le lieu et l'instant.
4. Filtres de praticabilité.

**Seuils de hauteur.** Masse d'air approximée :

```
masse_air ≈ 1 / sin(altitude)
```

- altitude > 30° → masse d'air < 2 : correct pour l'imagerie.
- 20° à 30° : dégradé, extinction et turbulence sensibles.
- < 20° : à écarter sauf objet austral inaccessible autrement.

**Fenêtre nocturne.** Le soleil doit être sous −18° (nuit astronomique). Repères :

```
crépuscule civil        : soleil de   0° à  −6°
crépuscule nautique     : soleil de  −6° à −12°
crépuscule astronomique : soleil de −12° à −18°
nuit astronomique       : soleil sous −18°
```

Au-dessus de ~49° de latitude, la nuit astronomique **n'existe pas** une partie de l'été. Ce n'est
pas une erreur de calcul, c'est le cas normal — voir `pieges.md`.

**Culmination** = passage au méridien = hauteur maximale = meilleur créneau. Sur monture
équatoriale allemande, signaler le retournement au méridien : la session est coupée en deux.

**Gêne lunaire.** Quatre facteurs, dans cet ordre de priorité :

1. La Lune est-elle au-dessus de l'horizon à cet instant ? Si non, aucune gêne, quelle que soit
   la phase.
2. Illumination (fraction éclairée, 0 à 1) — pas la phase nominale.
3. Hauteur de la Lune : basse sur l'horizon, la gêne est fortement réduite.
4. Séparation angulaire Lune–cible : en dessous de ~30°, gêne majeure ; au-delà de ~90°,
   supportable en large bande.

## 4. Ciel profond — visibilité réelle

**La magnitude intégrée ment.** Elle additionne toute la lumière de l'objet sans dire sur quelle
surface elle est étalée. M33 (mag 5.7) est nettement plus difficile que M57 (mag 8.8), parce que
sa lumière est diluée sur un demi-degré.

Ce qui décide, c'est la **magnitude surfacique** (mag/arcsec²) comparée au fond de ciel local.
Un objet dont la brillance de surface est plus faible que le fond de ciel est invisible en visuel,
quel que soit le diamètre.

Repères de fond de ciel :

| Bortle | Contexte | mag/arcsec² approx |
|---|---|---|
| 1–2 | site désertique, ciel exceptionnel | 21.8 – 21.9 |
| 3 | rural | 21.5 |
| 4 | rural–périurbain | 21.3 |
| 5 | périurbain | 20.5 |
| 6–7 | banlieue | 19.0 – 19.5 |
| 8–9 | centre-ville | 18.0 – 18.5 |

**Comportement par type d'objet** — détermine la stratégie de capture :

| Type | Pollution lumineuse | Lune | Filtre utile |
|---|---|---|---|
| Nébuleuse en émission (Hα, OIII) | tolérante avec filtre | tolérante | dual-band, narrowband |
| Nébuleuse en réflexion | très sensible | très sensible | aucun ne sauve |
| Galaxie | très sensible | très sensible | anti-PL large bande, effet limité |
| Amas ouvert / globulaire | peu sensible | peu sensible | inutile |
| Nébuleuse planétaire | tolérante | tolérante | OIII |
| Nébuleuse obscure | rédhibitoire hors site noir | rédhibitoire | aucun |

**Quatre verdicts distincts** à ne jamais fusionner : visible à l'œil nu / aux jumelles / au
télescope en visuel / seulement en photographie longue pose. Afficher un seul verdict global est
la première cause de déception utilisateur sur ce type d'app.

Magnitude limite visuelle approximative, diamètre D en mm, sous bon ciel :

```
mag_limite ≈ 2 + 5 × log10(D)
```

Ordre de grandeur seulement — dépend fortement du ciel, de l'oculaire et de l'observateur.

## 5. Pose unitaire optimale

Principe : la pose doit être assez longue pour que le **bruit de photons du fond de ciel domine
le bruit de lecture** du capteur. Une fois ce seuil franchi, allonger la pose n'améliore
pratiquement plus le SNR final et augmente le risque de perdre l'image.

```
C      = 1 / ( (1/(1 − perte_snr))² − 1 )
t_pose = C × RN² / flux_ciel(e⁻/s/px)
```

- `RN` = bruit de lecture en électrons, au gain utilisé.
- `flux_ciel` = électrons de fond de ciel par seconde et par pixel, mesuré sur le site avec le
  matériel réel. C'est la seule grandeur qu'on ne peut pas deviner.
- `perte_snr` = perte de SNR tolérée. 0.05 (5 %) donne C ≈ 9.3 ; 0.10 donne C ≈ 4.3.

Conséquences contre-intuitives à exposer à l'utilisateur :

- Sous un ciel pollué, le flux de fond est élevé donc la pose optimale est **courte**. Ciel de
  ville ne veut pas dire poses longues.
- En narrowband, le filtre coupe le fond de ciel, donc la pose optimale devient **longue**
  (souvent 300 s et plus) — c'est le filtre qui impose la pose, pas la cible.
- Un capteur à très faible bruit de lecture (RN < 1.5 e⁻) rend le seuil facile à atteindre :
  les poses courtes deviennent viables, ce qui change complètement la stratégie de session.

Plafond indépendant : ne pas saturer les étoiles brillantes du champ. En pratique, cumuler une
série courte pour récupérer les cœurs d'étoiles si nécessaire.

## 6. Pose maximale sans suivi

Le ciel tourne à **15.041 arcsec par seconde** à l'équateur céleste. La trace laissée par une
étoile pendant une pose :

```
trace(") = 15.041 × t(s) × cos(déclinaison)
trace(px) = trace(") / échantillonnage("/px)
```

Le `cos(δ)` est décisif : près de la Polaire (δ ≈ 89°) on tient des poses très longues ; sur
l'équateur céleste, non. Oublier ce terme est le bug classique du domaine.

**Règle NPF simplifiée** — N = nombre d'ouverture (le N de f/N), p = pitch pixel en µm,
f = focale en mm :

```
t(s) = (35 × N + 30 × p) / f
```

**Règle NPF étendue**, avec facteur de tolérance k et correction en déclinaison :

```
t(s) = k × (16.856 × N + 0.0997 × f + 13.713 × p) / (f × cos(δ))
```

k = 1 pour une netteté au pixel, k = 2 ou 3 pour une tolérance d'affichage. Vérifier cette forme
contre une source de référence avant de la coder en dur — elle circule en plusieurs variantes.

**Règle des 500** : `t = 500 / focale_équivalente_24×36`. Laxiste sur capteurs denses modernes.
À exposer comme repère historique, pas comme moteur de calcul.

**Avec tracker équatorial**, la NPF ne s'applique plus : la limite vient de la précision de mise
en station et de l'erreur périodique de la monture, pas de la rotation terrestre. Ordres de
grandeur usuels avec mise en station soignée : 1 à 4 minutes à 200–400 mm de focale. À traiter
comme paramètre utilisateur mesuré, pas comme constante.

## 7. Filé d'étoiles intentionnel

Deux voies techniques :

- **Pose unique très longue** — bruit thermique cumulé, fond de ciel saturé sous pollution
  lumineuse, aucune récupération possible en cas d'incident. À déconseiller par défaut.
- **Empilement de poses courtes en mode éclaircir** — la voie à implémenter.

```
N_images  = durée_totale(s) / (t_pose(s) + intervalle(s))
arc(°)    = 15.041 / 3600 × durée_totale(s) × cos(δ)
          ≈ 15 × durée_totale(h) × cos(δ)
```

Paramètres praticables :

- Pose unitaire 20 à 30 s. Plus court multiplie les fichiers sans gain ; plus long cuit le
  capteur et crame le fond de ciel.
- Intervalle inter-poses **≤ 1 s**. Au-delà, les traces présentent des trous visibles —
  c'est le défaut n°1 des filés ratés.
- 2 h à 25 s + 1 s d'intervalle ≈ 277 images.

Une prévisualisation utile ne montre pas seulement l'arc obtenu : elle montre aussi le nombre de
fichiers, l'espace carte nécessaire, et l'autonomie batterie requise. Un filé de 3 h échoue plus
souvent par batterie vide que par erreur de calcul.

## 8. Intégration et SNR

```
SNR ∝ √( N_poses × t_pose )
```

À flux constant, seul le temps total compte pour le SNR — la répartition entre nombre de poses et
durée unitaire n'intervient qu'à travers le bruit de lecture (section 5) et le risque de perte.

Conséquence à afficher clairement : **doubler le SNR demande quatre fois le temps total.** C'est
l'information qui recadre le mieux les attentes d'un débutant.

Calibration à rappeler dès qu'on parle d'intégration : darks (même température, même gain, même
durée), flats (même train optique, même orientation), offsets ou dark-flats selon le capteur, et
dithering entre poses pour casser le bruit à motif fixe.
