---
{
  "id": "T-0106",
  "titre": "La Grande Faille coupe la bande du Cygne au Sagittaire",
  "epic": "T-0101",
  "colonne": "a-specifier",
  "priorite": "basse",
  "charge": "l",
  "tags": [
    "planetarium",
    "rendu",
    "donnees"
  ],
  "cree": "2026-08-21",
  "maj": "2026-08-21",
  "plan": "2026-08-21-la-voie-lactee-se-rend-comme-une-brillance-pas-comme-un-calq.md"
}
---

## Contexte

T-0105 a livré la moitié analytique de la non-uniformité en longitude : le bulbe du Sagittaire
est maintenant une demi-magnitude au-dessus de l'anticentre, par un profil `(1 + cos l)/2` qui
n'a demandé aucune donnée nouvelle. Reste l'autre moitié, celle qui ne se dérive pas.

**La Grande Faille** est le nuage de poussière qui coupe la bande en deux du Cygne au
Sagittaire. C'est une structure sombre, pas une variation douce : aucun profil analytique en
(l, b) ne la produit. Elle exige une **carte de brillance**, donc une donnée à embarquer.

Conséquence pour l'utilisateur du grand champ : le repère qu'il cherche dans le viseur — « la
bande se sépare ici » — n'existe toujours pas dans le rendu.

## Ce que l'investigation a fermé — 21 août 2026

Les quatre questions ci-dessous ont été instruites, sources téléchargées et mesures faites. Le
ticket reste en « à spécifier », mais il ne reste plus qu'UNE question ouverte au lieu de quatre.

### 1. Quelle source ? — trois pistes essayées, deux écartées sur mesure

**Le paquet déjà embarqué (`hyg-1.bin`) — écarté, et c'est mesuré.** L'idée était séduisante :
la Faille est un déficit de comptage d'étoiles, et le dépôt embarque HYG. Le déficit EXISTE —
tranches de 10° de longitude à |b| < 6°, magnitude ≤ 7 (au-delà le paquet est incomplet : la
pente du comptage passe de 0,49 à 0,42 puis 0,30) : le comptage tombe à 0,61-0,73 fois la médiane
entre l = 0° et l = 40°, soit A_V ≈ 0,26 à 0,43 mag. Mais laissé LIBRE, l'ajustement d'un creux
gaussien ne trouve pas la Faille : il préfère la surdensité du bras de Carène à l = 283°
(−0,44 mag, 4,2σ contre ~3σ pour la Faille), et aucun creux unique n'explique plus de 17 % du
profil. À 70 étoiles par tranche, le bruit de Poisson vaut ±0,11 mag — du même ordre que le
signal. Forcer le creux sur l = 18° aurait produit l'amplitude que l'on attendait, pas celle que
les données donnent. Le paquet est trop peu profond, et la structure locale des bras le brouille.

**Le catalogue de nuages sombres de Dobashi (2011), PASJ 63, S1 — disponible mais hors sujet.**
VizieR `J/PASJ/63/S1`, `table8.dat.gz`, 150 ko compressés, 7614 nuages avec position galactique
au minute d'arc, surface, A_V au pic et rang de fiabilité. Tout est bon côté logistique : URL
stable chez cdsarc, épinglable par sha256 comme les autres sources, licence CDS (réutilisation
avec citation, même régime que OpenNGC et HYG), et environ 59 ko encodés à 8 octets par nuage.
Mais la mesure tue l'idée : dans le secteur de la Faille (l de 340° à 50°, |b| ≤ 20°) les 2790
nuages ont un rayon équivalent MÉDIAN de 0,06° — 3,6 minutes d'arc — et couvrent en tout 3 % de
la surface. C'est un catalogue de cœurs denses, pas la poussière diffuse qui fait la bande
sombre à l'œil nu. Peints, ces disques seraient invisibles à tout champ réaliste.

**Ce qu'il faut réellement**, et c'est la seule question qui reste : les CARTES de Dobashi — les
cartes A_J et E(J−H) au pas de 15′ à résolution 1°, décrites dans le même article — ou celles de
Dobashi et al. (2005) tirées du DSS. Elles ne sont pas dans VizieR, qui ne distribue que
`table8.dat` : il faut trouver leur distribution, vérifier la licence, et ajouter un lecteur FITS
minimal à `scripts/build-catalogs.ts` (une quarantaine de lignes pour une image 2D, sans
dépendance nouvelle).

**Écartées d'avance :** Schlegel, Finkbeiner & Davis (1998) est saturé dans le plan galactique,
c'est-à-dire exactement là où la Faille se trouve. GAMBONS (Masana et al. 2021, MNRAS 501, 5443)
donne la bonne grandeur — lumière stellaire intégrée en HEALPix nside 256 — mais se génère à la
demande par un formulaire web, sans licence annoncée.

### 2. Quel budget d'octets ? — chiffré

Une carte au degré sur |b| ≤ 30° fait 360 × 60 = 21 600 valeurs, un octet chacune (A_V au
centième de magnitude jusqu'à 2,55 mag, ou au dixième jusqu'à 25 mag) : 21 ko avant compression.
À comparer aux paquets existants : `deepsky-1.bin` 17 ko, `openngc-1.bin` 350 ko,
`constellations-1.bin` 270 ko, `hyg-1.bin` 1 Mo. Le budget n'est pas le sujet — il est
négligeable devant ce que le dépôt embarque déjà.

### 3. Module, ne remplace pas — tranché

Le modèle analytique de T-0102 et T-0105 reste autorité sur la brillance ; la carte n'apporte
qu'une atténuation, en magnitudes, qui s'ajoute à celle de la latitude. Trois raisons :

- §12.5 l'exige : sans le paquet, la bande doit rester exactement celle de T-0105 ;
- l'atténuation d'une carte d'EXTINCTION se compose par addition en magnitudes, ce que
  `brillanceVoieLacteeNl` fait déjà pour le profil de latitude — aucune règle nouvelle ;
- la fraction de la lumière de la bande située DERRIÈRE la poussière est le paramètre libre qui
  gâche l'affaire avec une carte de poussière générale. Avec les nuages du complexe d'Aquila,
  dont le bord avant est à 225 ± 55 pc (Straižys et al. 2003, A&A 405, 585), il vaut 1 à la
  précision qui nous intéresse : la bande est presque entièrement derrière. C'est un argument, pas
  une constante à caler.

### 4. Le découpage du planétarium ne tient PAS — c'est le vrai coût

`dessine-ciel.ts` peint la bande en tranches de latitude × segments de longitude de 18°, un trait
épais par segment. Une structure sombre à bord net ne s'y rend pas, et l'affiner ne suffit pas :
un déficit qui COUPE la bande demande de la peindre comme un champ à deux dimensions, pas comme
une pile de traits. C'est là que passe la charge « l » de ce ticket, pas dans les octets.

## Critères d'acceptation

- [ ] La carte est au registre avec sa citation complète, sa résolution, ses bornes en latitude
      et l'interdiction d'extrapoler hors de son domaine — même régime que `TABLE_BORTLE` et que
      la table du crépuscule de T-0099.
- [ ] Sans le paquet, la bande est exactement celle de T-0105, au pixel près : §12.5 le vérifie,
      et la matrice de dégradation nomme ce qui manque.
- [ ] La bande apparaît SÉPARÉE en deux du Cygne au Sagittaire : c'est le repère que l'on cherche
      au viseur, et c'est ce que ni un creux en longitude ni un catalogue de cœurs ne donnent.
- [ ] Le planétarium et l'aperçu de champ montrent la même Faille au même endroit, par le même
      moteur — la parité de T-0104.
- [ ] Aucune marche visible aux raccords : le passage au champ 2D se juge là, pas sur la finesse
      du pas de longitude.
- [ ] La limite est dite dans l'app comme les autres : ce qui est rendu est une extinction
      moyennée au degré, pas la dentelle des nuages.

## Ce qui reste ouvert — une seule question

Où se distribue la carte diffuse — les cartes A_J / E(J−H) de Dobashi (2011) au pas de 15′, ou
les cartes A_V de Dobashi et al. (2005) tirées du DSS — et sous quelle licence ? Tant que
l'adresse n'est pas épinglable avec son empreinte et la licence lue, rien n'est codé : c'est la
règle que `scripts/build-catalogs.ts` applique déjà à ses six sources.
