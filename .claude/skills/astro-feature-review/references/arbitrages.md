# Cadres d'arbitrage

À consulter quand la question porte sur un compromis plutôt que sur une formule. Chaque cadre
donne la question qui tranche, pas une réponse universelle.

## 1. Précision contre coût de calcul

Cinq niveaux de précision existent pour une position céleste, et ils ne coûtent pas la même chose.

| Niveau | Précision | Suffit pour |
|---|---|---|
| Approximations analytiques simples | quelques minutes d'arc | verdict de visibilité, lever/coucher affiché à la minute |
| VSOP87 / ELP tronquées | quelques secondes d'arc | tout usage grand public, cadrage large |
| Théories complètes + précession + nutation | sous la seconde d'arc | pointage GoTo, cadrage serré, occultations |
| Éphémérides numériques (DE440 et suivantes) | milliseconde d'arc | rasage lunaire, transits, science |
| SGP4 sur TLE frais | kilométrique, dégrade en heures | passages de satellites uniquement |

**Question qui tranche** : quelle est la plus petite erreur qui change une décision de
l'utilisateur ? Si l'app affiche un lever à la minute, une précision sous la seconde d'arc est du
calcul gratuit. Si elle pilote une monture, ce n'est plus négociable.

Corollaire : ne pas monter d'un niveau parce que c'est disponible. Monter parce qu'un cas d'usage
identifié le réclame — et écrire lequel dans le code.

## 2. Hors-ligne contre fraîcheur

L'astrophoto se pratique sans réseau, la nuit, à l'écart. Trois catégories de données, trois
politiques.

- **Calculable localement** — positions, levers, phases, champ, poses. Aucune raison de dépendre
  du réseau. Doit fonctionner en mode avion, indéfiniment.
- **Statique embarquable** — catalogues d'objets, atlas de pollution lumineuse, base matériel.
  À embarquer, avec une mise à jour opportuniste quand le réseau est là.
- **Périssable** — météo, seeing, éléments orbitaux de satellites, comètes récentes. Réseau
  obligatoire, avec cache daté et affichage explicite de l'âge de la donnée.

**Question qui tranche** : cette feature doit-elle marcher à 2h du matin dans un champ sans
couverture ? Si oui, elle ne peut pas dépendre d'un appel réseau, point.

## 3. Une audience ou trois

Trois profils cohabitent, avec des besoins qui divergent réellement.

- **Curieux** — veut voir Saturne ce soir. Attend un verdict, pas des paramètres. Le jargon le
  fait fuir.
- **Visuel** — connaît son télescope, cherche des cibles adaptées à son diamètre et à son ciel.
  Veut de la magnitude surfacique et de l'horizon local.
- **Imageur** — connaît son échantillonnage. Veut du cadrage, de la pose optimale, de
  l'intégration cumulée, et il vérifiera vos chiffres.

**Question qui tranche** : lequel des trois est déçu si cette feature n'existe pas ? Si la réponse
est « les trois un peu », c'est probablement une feature trop générique à retravailler.

Piège récurrent : servir les trois dans le même écran produit une interface qui déçoit les trois.
Préférer un socle commun et une révélation progressive du détail, avec un niveau d'expertise
choisi une fois.

## 4. Verdict tranché ou information brute

Tentation constante : afficher un score de 0 à 100, ou un « bon / moyen / mauvais ».

Un verdict est légitime quand la grandeur est **déterministe** et que le seuil est **justifiable
physiquement** — objet sous l'horizon, objet jamais visible d'ici, cadrage impossible avec ce
matériel. Là, trancher rend service.

Un verdict est trompeur quand il agrège de l'hétérogène. Un score unique qui mélange hauteur,
météo, Lune et pollution lumineuse cache lequel des quatre bloque — et c'est précisément
l'information dont l'utilisateur a besoin pour décider s'il sort.

**Cadre recommandé** : afficher les facteurs limitants nommés, classés par sévérité, plutôt qu'un
score composite. « Bloquant : culmine à 14° depuis votre site » est actionnable ; « score 34/100 »
ne l'est pas.

## 5. Étendre ou couper le scope

Sur ce domaine, chaque feature en appelle trois. Le calcul de champ appelle la base de matériel,
qui appelle la saisie manuelle, qui appelle la synchronisation multi-appareils.

**Test de la version dix fois moins chère** : avant de valider une feature, écrire la version qui
coûte un dixième et la proposer. Souvent elle capture l'essentiel de la valeur — un calcul de
champ avec saisie manuelle du capteur rend 80 % du service d'une base de mille capteurs.

**Test du chemin critique** : cette feature est-elle sur le trajet entre « j'ouvre l'app » et
« je sors observer » ? Si non, elle peut attendre, quelle que soit son élégance.

**Signal d'alerte** : si spécifier une feature exige d'inventer une donnée qu'on n'a pas
(précision réelle de la monture de l'utilisateur, transparence du ciel à son emplacement exact),
la feature est probablement prématurée — ou doit devenir un paramètre assumé plutôt qu'un calcul.

## 6. Modèle de données — les séparations à ne pas rater

Quatre séparations qui coûtent cher à introduire après coup :

- **Objet céleste** (identité, coordonnées J2000, type, magnitudes intégrée et surfacique,
  dimensions apparentes) séparé de **son état à un instant et un lieu** (alt/az, masse d'air,
  fenêtre de visibilité). Le premier est immuable, le second est calculé et jetable.
- **Site d'observation** (coordonnées, altitude, Bortle, profil d'horizon) séparé de
  **l'utilisateur**. Un utilisateur a plusieurs sites : jardin, spot nomade, séjour à la montagne.
- **Setup** (tube ou objectif, capteur, monture, réducteur, filtre) traité comme une composition
  nommée et réutilisable, pas comme des champs épars. Un utilisateur a deux ou trois setups et
  compare leurs cadrages.
- **Unités stockées de façon canonique** — mm, µm, arcsec, UTC, électrons — avec conversion au
  seul moment de l'affichage. Les unités mixtes dans le modèle sont la source de bugs la plus
  tenace du domaine.
