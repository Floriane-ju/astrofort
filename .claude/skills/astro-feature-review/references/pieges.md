# Pièges classiques

Catalogue des erreurs qui se glissent dans les apps d'astronomie. Chacune produit un résultat
plausible — c'est ce qui les rend coûteuses : rien ne plante, l'utilisateur constate juste sur le
terrain que l'app avait tort.

À chaque revue, identifier les pièges qui s'appliquent réellement au changement en cours.

## Sommaire

- [A. Temps et lieu](#a-temps-et-lieu)
- [B. Coordonnées](#b-coordonnées)
- [C. Visibilité et verdicts](#c-visibilité-et-verdicts)
- [D. Lune](#d-lune)
- [E. Optique et matériel](#e-optique-et-matériel)
- [F. Pose et capture](#f-pose-et-capture)
- [G. Données et catalogues](#g-données-et-catalogues)
- [H. Produit et UX](#h-produit-et-ux)

---

## A. Temps et lieu

**A1 — Fuseau appliqué deux fois.** Le classique absolu. Tout est stocké et calculé en UTC, la
conversion en heure locale se fait au seul moment de l'affichage. Un décalage d'une heure sur un
lever d'objet est presque toujours ça.

**A2 — « Ce soir » n'est pas une date.** La nuit du 15 au 16 août appartient à deux dates
calendaires. Une requête « ce soir » à 1h du matin doit renvoyer la nuit en cours, pas la nuit
suivante. Définir explicitement la frontière de journée observationnelle — le midi solaire local
est le choix habituel.

**A3 — Nuit astronomique inexistante.** Au-dessus d'environ 49° de latitude, une partie de l'été
n'a pas de nuit astronomique. Ce n'est pas une erreur : c'est le cas normal. L'app doit dégrader
vers le crépuscule nautique et le dire, pas renvoyer une fenêtre vide ni lever une exception.

**A4 — Nuit polaire, et son inverse.** Au-delà des cercles polaires, le soleil peut ne pas se
lever ou ne pas se coucher. Les algorithmes de lever/coucher n'ont alors pas de solution.
Prévoir le retour « jamais » et « toujours » comme valeurs légitimes.

**A5 — Changement d'heure au milieu de la nuit.** Une session à cheval sur le passage à l'heure
d'hiver contient une heure locale en double. Raisonner en UTC élimine le problème, l'affichage
doit rester cohérent.

**A6 — Altitude du lieu ignorée.** Elle abaisse l'horizon (dépression de l'horizon) et avance les
levers. Effet faible en plaine, sensible en montagne.

**A7 — GPS absent ou refusé.** Cas fréquent en pratique : l'astrophoto se fait en mode avion, à
l'écart, batterie ménagée. Prévoir une saisie manuelle de coordonnées et la mémoriser comme
« site favori ». Une app astro qui exige la géolocalisation active est inutilisable sur le
terrain.

## B. Coordonnées

**B1 — Epoch mélangées.** Les catalogues sont en J2000 ; la position réellement observée est
apparente à la date. L'écart dû à la précession atteint plusieurs minutes d'arc sur deux
décennies. Négligeable pour un verdict de visibilité, rédhibitoire pour du pointage GoTo ou du
cadrage serré. Décider explicitement du niveau requis et le documenter.

**B2 — Réfraction atmosphérique oubliée.** Près de l'horizon elle relève les objets d'environ un
demi-degré — soit plus que le diamètre apparent du Soleil. Un lever calculé sans réfraction est
en retard de plusieurs minutes.

**B3 — Confusion altitude/azimut et RA/Dec.** Deux systèmes, deux usages. RA/Dec identifie
l'objet, alt/az dit s'il est visible maintenant d'ici. Un champ nommé simplement `position` dans
le modèle de données finira par mélanger les deux.

**B4 — Azimut compté depuis le sud.** Convention astronomique historique contre convention
moderne (nord = 0°, sens horaire). Vérifier celle de la bibliothèque utilisée, et l'écrire dans
le code.

**B5 — Signe de longitude inversé.** Ouest négatif ou positif selon la source. Une erreur de
signe produit un ciel décalé de plusieurs heures, symétrique — donc pas absurde à l'œil.

## C. Visibilité et verdicts

**C1 — Magnitude intégrée utilisée comme critère de difficulté.** Le piège central du ciel
profond. Il faut la magnitude surfacique comparée au fond de ciel local. Sinon l'app annonce
M33 facile et M57 difficile, soit l'inverse de la réalité.

**C2 — Verdict unique pour tous les instruments.** « Visible » ne veut rien dire sans préciser :
œil nu, jumelles, télescope en visuel, ou photo longue pose. Un seul verdict global génère
systématiquement de la déception.

**C3 — Seuil de hauteur unique.** 30° convient à l'imagerie, 20° au visuel, et la Lune ou les
planètes brillantes restent intéressantes à 10°. Un seuil global mal choisi masque des cibles
valables ou en propose d'injouables.

**C4 — Horizon local ignoré.** L'horizon réel est fait d'arbres, de maisons et de relief. Un objet
à 25° derrière le toit du voisin n'est pas visible. Permettre un profil d'horizon par site est ce
qui distingue une app utilisable d'une app théorique.

**C5 — Objet jamais visible depuis cette latitude.** La circumpolarité a un inverse : certains
objets ne se lèvent jamais. Le dire clairement une fois vaut mieux que de renvoyer une fenêtre
vide que l'utilisateur interprétera comme un bug.

**C6 — Culmination confondue avec le milieu de la fenêtre de visibilité.** La hauteur maximale ne
tombe pas au centre du créneau nocturne. Les deux doivent être calculés séparément.

## D. Lune

**D1 — Phase utilisée sans tenir compte de la hauteur.** Une pleine Lune sous l'horizon ne gêne
personne. Vérifier d'abord si elle est levée à l'instant considéré, ensuite seulement pondérer
par l'illumination. C'est l'erreur la plus visible pour un utilisateur expérimenté : elle
discrédite l'app immédiatement.

**D2 — Phase nominale au lieu de fraction illuminée.** « Premier quartier » est une étiquette ;
la fraction éclairée est le nombre exploitable.

**D3 — Séparation angulaire non calculée.** Une Lune à 100° de la cible gêne bien moins qu'à 20°.
Sans ce terme, l'app rejette des nuits parfaitement exploitables.

**D4 — Gêne lunaire appliquée uniformément.** En narrowband dual-band, une Lune gibbeuse reste
exploitable sur les nébuleuses en émission. Appliquer la même pénalité à une galaxie et à une
nébuleuse Hα est faux.

## E. Optique et matériel

**E1 — Approximation petite-angle au grand-angle.** `57.3 × capteur / focale` dérive de plusieurs
pourcents sous 200 mm. Utiliser la forme exacte avec l'arctangente.

**E2 — Champ exprimé en une seule valeur.** Un capteur a deux dimensions et une orientation. Le
cadrage a besoin des deux, plus l'angle de rotation.

**E3 — Réducteur ou barlow non propagé.** Il modifie la focale **et** le f/D, donc le champ,
l'échantillonnage et la pose. Appliquer le facteur en amont de toute la chaîne de calcul.

**E4 — Crop factor et focale équivalente confondus avec la focale réelle.** La focale physique
gouverne la physique ; l'équivalent 24×36 ne sert qu'aux règles empiriques type 500. Mélanger
les deux fausse tout.

**E5 — Pitch pixel confondu avec la résolution du capteur.** Le pitch est en µm et c'est lui qui
entre dans l'échantillonnage et la NPF. Le nombre de mégapixels n'est pas un substitut.

**E6 — Binning ignoré.** Un binning 2×2 double le pitch effectif, donc l'échantillonnage. Il
change aussi le bruit de lecture effectif selon que le binning est matériel ou logiciel.

**E7 — Base matériel supposée exhaustive.** Elle ne l'est jamais. Prévoir la saisie manuelle des
caractéristiques (pitch, dimensions capteur, bruit de lecture) comme chemin de première classe,
pas comme rattrapage.

## F. Pose et capture

**F1 — cos(δ) oublié dans le calcul de filé.** La rotation apparente dépend de la déclinaison de
la cible. Sans ce terme, l'app donne la même pose max pour la Polaire et pour Orion.

**F2 — Pose optimale calculée sans flux de fond de ciel.** La formule exige les électrons de fond
par seconde et par pixel, qui dépendent du site et du filtre. Ce n'est pas devinable : soit
l'utilisateur le mesure, soit l'app l'estime à partir du Bortle en assumant l'approximation
ouvertement.

**F3 — « Ciel pollué donc poses longues ».** L'inverse. Un fond de ciel lumineux noie vite le
bruit de lecture, donc la pose optimale raccourcit. Contre-intuitif, et souvent codé à l'envers.

**F4 — Règle des 500 utilisée comme moteur de calcul.** Trop laxiste sur les capteurs denses.
Repère historique acceptable, référence non.

**F5 — NPF appliquée à un setup suivi.** Avec tracker, la limite vient de la mise en station et de
l'erreur périodique de la monture. Appliquer la NPF sous-estime alors grossièrement la pose
possible.

**F6 — Intervalle inter-poses non modélisé en filé.** Un intervalle supérieur à une seconde
produit des trous visibles dans les traces. C'est le défaut le plus fréquent des filés ratés, et
il est invisible dans un calcul qui ignore le temps de lecture et d'écriture.

**F7 — Contraintes logistiques absentes.** Nombre de fichiers, espace carte, autonomie batterie,
buée sur l'optique. Un filé de trois heures échoue plus souvent par batterie vide que par erreur
de pose.

**F8 — Retournement au méridien ignoré.** Sur monture équatoriale allemande, la session est
coupée en deux au passage au méridien, avec rotation de champ de 180°. Une fenêtre de capture
annoncée comme continue est fausse.

## G. Données et catalogues

**G1 — Identifiants d'objets non normalisés.** M31, NGC 224, « galaxie d'Andromède » désignent le
même objet. Sans table de correspondance, la recherche utilisateur échoue sur deux tentatives
sur trois.

**G2 — Éphémérides inventées.** Ne jamais coder en dur une heure de lever, une magnitude précise
ou une position issue de mémoire. Passer par une bibliothèque d'éphémérides. Une valeur inventée
finit en constante, puis en test unitaire faux, ce qui verrouille le bug.

**G3 — Pas de mode hors-ligne.** L'astrophoto se pratique sans réseau. Catalogues, éphémérides
sur une fenêtre glissante et cartes doivent fonctionner hors connexion ; seule la météo peut
raisonnablement l'exiger.

**G4 — Fraîcheur non affichée.** Météo, seeing, éléments orbitaux de satellites : leur date de
validité fait partie de l'information. Des TLE de satellite vieux de deux semaines donnent des
prédictions de passage inutilisables.

**G5 — Licences de données non vérifiées.** Atlas de pollution lumineuse, relevés d'images,
catalogues et bases matériel ont des conditions distinctes. À trancher avant l'intégration, pas
avant la publication.

## H. Produit et UX

**H1 — Précision affichée supérieure à la précision réelle.** Annoncer un lever à la seconde
quand le modèle ne garantit pas la minute est un mensonge que les utilisateurs avancés repèrent.
Arrondir à la précision réellement tenue.

**H2 — Verdict binaire sur une grandeur probabiliste.** La météo et le seeing ne se prêtent pas au
oui/non. Exposer une confiance, ou un intervalle.

**H3 — Donnée exacte mais inactionnable.** Si une information ne change aucune décision
d'observation, elle occupe de l'écran sans servir. Question à poser pour chaque champ ajouté :
qu'est-ce que l'utilisateur fait différemment en la lisant ?

**H4 — Mode nuit traité comme un thème sombre.** L'adaptation à l'obscurité demande du rouge
profond et une luminosité très basse, pas du gris foncé. Un écran blanc-sur-noir ruine trente
minutes d'adaptation visuelle.

**H5 — Une seule audience supposée.** Le débutant qui veut voir Saturne et l'imageur qui optimise
son échantillonnage n'ont pas les mêmes besoins. Trancher lequel est servi par défaut, plutôt que
de produire une interface qui déçoit les deux.

**H6 — Jargon non glosé à la première occurrence.** Bortle, seeing, échantillonnage, masse d'air :
transparents pour l'imageur, opaques pour le débutant. Une glose de cinq mots suffit.
