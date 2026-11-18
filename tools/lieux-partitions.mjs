/* BITUME — lot 22F : partitions des circuits proposés (données d'étude, lues par tools/lieux-plans.mjs).

   Une partition décrit le tour comme on le raconterait : « après les stands, une grande courbe le long de la
   rivière, la forêt en esses, le Mur à 25 %, trois lacets… ». Chaque séquence porte ce que le lieu impose au tracé.
   Conventions : a > 0 = virage à droite ; p en % (montée > 0) ou 'a' (palier ajusté pour refermer le profil) ;
   dv en degrés (> 0 = côté droit plus bas) ; la première et la dernière séquence forment la ligne des stands
   (le départ est entre les deux). La fermeture ajuste `ajusteCap` (angle) et deux droites `ajuste` (longueur). */

const D = (l, o = {}) => ({ t: 'D', l, ...o });
const C = (r, a, o = {}) => ({ t: 'C', r, a, ...o });

// ------------------------------------------------------------------ Haut-Col : la grande boucle de montagne
// Le tour fait le tour du cirque de l'Aiglière, dans le sens contraire des aiguilles d'une montre : la vallée et
// les stands au sud, la montée par le Bois Noir et le Mur à l'est, les lacets, le tunnel du Rocher, la corniche
// sur le rebord nord (le cirque est à gauche, à l'intérieur de la boucle), le col, la galerie et le tunnel des
// Échelles à l'ouest, l'alpage, le pont de la Gorge et le virage du Vide pour redescendre à la vallée.
const HAUT_COL = {
  id: 'haut-col', nom: 'Haut-Col', theme: 'montagne', graine: 47, zoom: [{ lieu: 3, rayon: 240 }],
  lieux: [
    { n: 1, nom: 'Le Bois Noir', court: 'forêt dense de sapins, esses en montée, troncs à 3 m du bord' },
    { n: 2, nom: 'Le Mur', court: 'rampe droite, près de 300 m au-delà de 20 % et une pointe à 30 %, après la gauche lente de la Scierie' },
    { n: 3, nom: 'Les Lacets', court: 'trois épingles empilées, murs de pierre sèche entre les branches' },
    { n: 4, nom: 'Le Balcon du Cirque', court: 'corniche taillée dans la paroi, grand virage, le vide à gauche' },
    { n: 5, nom: "Col de l'Aiglière", court: 'replat sommital, lac, refuge, galerie paravalanche' },
    { n: 6, nom: 'Pont de la Gorge', court: 'arche de pierre au-dessus de la gorge, cascade en aval' },
    { n: 7, nom: 'Virage du Vide', court: 'gauche convexe, contre-dévers, parapet bas au-dessus de la vallée' },
  ],
  seq: [
    D(300, { p: 0, stands: true, dv: 0 }),
    C(260, -30, { p: 1 }),
    D(240, { p: 1, ajuste: true }),
    C(130, -50, { p: 2 }),
    // le Bois Noir : la forêt dense, esses en montée douce
    D(180, { p: 3.5, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(90, 50, { p: 4.5, lieu: 1 }),
    C(80, -70, { p: 4.5, lieu: 1 }),
    D(220, { p: 3.5, lieu: 1, bord: { cote: 'G', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(110, 45, { p: 4.5, lieu: 1 }),
    C(95, -45, { p: 3.5, lieu: 1 }),
    D(160, { p: 3.5, lieu: 1 }),
    C(130, 35, { p: 3.5, lieu: 1 }),
    D(260, { p: 3.5, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Sapins du Bois Noir' } }),
    C(130, 65, { p: 4, lieu: 1, ajusteCap: true }),
    D(100, { p: 4 }),
    // la Scierie : gauche lente au pied du Mur, on l'attaque à 70 km/h
    C(45, -90, { p: 4 }),
    // le Mur : droit dans la pente, 320 m de 22 à 30 % (26 % de moyenne), puis 160 m de bascule à 14 et 7 % : la crête
    // est assez longue pour qu'on ne s'y allège pas de plus de 0,4 g à 190 km/h
    D(110, { p: 22, lieu: 2, vib: false }),
    D(130, { p: 30, lieu: 2, vib: false }),
    D(80, { p: 24, lieu: 2, vib: false }),
    D(90, { p: 14, lieu: 2, vib: false }),
    D(70, { p: 7, lieu: 2, vib: false }),
    // replat, puis les lacets (branches à 7,5 %, épingles à 4 %)
    C(60, 90, { p: 2, lieu: 3 }),
    D(320, { p: 6.5, lieu: 3 }),
    C(32, -180, { p: 4, lieu: 3, dv: -3 }),
    D(230, { p: 7.5, lieu: 3, bord: { cote: 'D', type: 'muret', nom: 'Murs des Lacets' } }),
    C(32, 180, { p: 4, lieu: 3, dv: 3 }),
    D(230, { p: 7.5, lieu: 3, bord: { cote: 'G', type: 'muret', nom: 'Murs des Lacets' } }),
    C(34, -180, { p: 4, lieu: 3, dv: -3 }),
    D(200, { p: 5 }),
    // tunnel du Rocher, en légère courbe
    C(300, 20, { p: 4, couvert: { type: 'tunnel', nom: 'Tunnel du Rocher' } }),
    D(200, { p: 4, couvert: { type: 'tunnel', nom: 'Tunnel du Rocher' } }),
    // le Balcon du Cirque : corniche, le cirque à gauche (dans le virage), la paroi à droite
    C(420, -110, { p: 1.5, lieu: 4, dv: -2.5, vib: false, ld: 8.2, bord: { cote: 'G', type: 'vide', nom: 'Balcon du Cirque' } }),
    D(160, { p: 1, lieu: 4, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Balcon du Cirque' } }),
    // le col
    C(180, 40, { p: .5, lieu: 5 }),
    D(260, { p: 0, lieu: 5 }),
    C(180, -40, { p: -3, lieu: 5 }),
    // galerie paravalanche (ouverte à gauche sur le cirque) et tunnel des Échelles
    D(300, { p: -7, couvert: { type: 'galerie', nom: 'Galerie des Avalanches', ouvert: 'G' } }),
    C(250, 40, { p: -8 }),
    D(170, { p: -8, couvert: { type: 'tunnel', nom: 'Tunnel des Échelles' } }),
    C(250, 80, { p: -8 }),
    // l'alpage : la traversée vers l'ouest-nord-ouest, rapide et ouverte, en balcon au-dessus de la vallée
    D(200, { p: -9, ajuste: true }),
    C(170, -40, { p: -9 }),
    C(170, 35, { p: -10 }),
    D(160, { p: -9 }),
    C(160, -125, { p: -8 }),
    // pont de la Gorge, les Mélèzes (forêt claire en descente), puis le virage du Vide (le vide à droite)
    D(130, { p: -1, lieu: 6, pont: { type: 'arche', nom: 'Pont de la Gorge' } }),
    C(150, 40, { p: -8 }),
    D(180, { p: -9, ajuste: true }),
    C(150, -40, { p: -9 }),
    D(120, { p: -7, ajuste: true }),
    C(140, -80, { p: -5, lieu: 7, dv: 2, vib: false, bord: { cote: 'D', type: 'vide', nom: 'Virage du Vide' } }),
    // la vallée : dernière descente le long de la rivière, puis le replat des stands
    D(560, { p: 'a', ajuste: true }),
    D(220, { p: -1.5 }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Val-Brûlé : forêt, lac, cascade, brûlis
// Sens des aiguilles d'une montre. Les stands longent le lac du Moulin ; la Futaie referme ses hêtres sur la piste ;
// deux épingles montent à côté de la cascade ; le Brûlis ouvre la vue sur le val avant de redescendre au lac.
const VAL_BRULE = {
  id: 'val-brule', nom: 'Val-Brûlé', theme: 'foret', graine: 11, zoom: [{ lieu: 2, rayon: 200 }],
  lieux: [
    { n: 1, nom: 'Lac du Moulin', court: 'stands au bord de l\'eau, moulin, pont de pierre sur le déversoir' },
    { n: 2, nom: 'La Cascade', court: 'deux épingles au pied et au flanc de la chute, embruns, chaussée humide' },
    { n: 3, nom: 'La Futaie', court: 'voûte de hêtres fermée sur la piste, rais de lumière' },
    { n: 4, nom: 'Le Brûlis', court: 'versant brûlé, troncs noirs et épilobes, vue sur tout le val' },
  ],
  seq: [
    D(280, { p: 0, stands: true, dv: 0, lieu: 1 }),
    C(200, 45, { p: 0, lieu: 1 }),
    D(120, { p: 0, lieu: 1, pont: { type: 'pierre', nom: 'Pont du Moulin' } }),
    C(140, 45, { p: 2 }),
    D(200, { p: 2, ajuste: true }),
    C(100, -40, { p: 3, lieu: 3 }),
    D(200, { p: 2, lieu: 3, couvert: { type: 'voute', nom: 'Voûte des Hêtres' }, bord: { cote: 'D', type: 'arbres', nom: 'Hêtres de la Futaie' } }),
    C(110, 60, { p: 2, lieu: 3 }),
    C(110, 70, { p: 2 }),
    D(300, { p: 1.5, ajuste: 'ouest' }),
    C(34, 180, { p: 4, lieu: 2, dv: 3 }),
    D(240, { p: 5, lieu: 2, bord: { cote: 'G', type: 'rochers', nom: 'Rochers de la Cascade' } }),
    C(34, -180, { p: 4, lieu: 2, dv: -3 }),
    D(300, { p: .5, ajuste: 'ouest' }),
    C(160, 50, { p: 0, lieu: 4 }),
    D(300, { p: -7, lieu: 4, bord: { cote: 'G', type: 'vide', nom: 'Rebord du Brûlis' } }),
    C(150, 40, { p: -5, lieu: 4 }),
    D(200, { p: -7, ajuste: true }),
    C(180, 90, { p: -3, ajusteCap: true }),
    D(200, { p: 'a', ajuste: true }),
    // fin de la ligne des stands (elle se poursuit au départ) ; pas de marque de lieu ici, sinon la pastille du Lac
    // du Moulin se placerait au milieu du tour
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Port-Sable : môle du phare, salins, dunes, canal
// Sens des aiguilles d'une montre, la mer au nord. Le tour part du quai, file sur le Grand Môle jusqu'au phare et
// en revient, traverse les salins sur une digue, longe le cordon dunaire, et rentre au port par le pont du canal.
const PORT_SABLE = {
  id: 'port-sable', nom: 'Port-Sable', theme: 'cote', graine: 29, zoom: [{ lieu: 1, rayon: 260 }],
  lieux: [
    { n: 1, nom: 'Le Grand Môle', court: 'aller et retour sur la digue, épingle autour du phare, embruns' },
    { n: 2, nom: 'Les Salins', court: 'digue droite entre les bassins roses, l\'eau des deux côtés' },
    { n: 3, nom: 'Le Cordon dunaire', court: 'dos-d\'âne sans visibilité, sable sur les bas-côtés, ganivelles' },
    { n: 4, nom: 'Pont du Canal', court: 'pont tournant à poutres d\'acier, on passe sous le treillis' },
  ],
  seq: [
    D(280, { p: 0, stands: true, dv: 0 }),
    C(60, -90, { p: 0, lieu: 1 }),
    D(280, { p: 0, lieu: 1, bord: { cote: 'G', type: 'vide', nom: 'Quai du Môle' } }),
    C(32, 180, { p: 0, lieu: 1, dv: 2 }),
    D(280, { p: 0, lieu: 1, bord: { cote: 'D', type: 'vide', nom: 'Quai du Môle' } }),
    C(60, -90, { p: 0, lieu: 1 }),
    D(120, { p: 1, ajuste: 'est' }),
    C(150, 90, { p: 1 }),
    D(360, { p: 0, lieu: 2, bord: [{ cote: 'G', type: 'fosse', nom: 'Bassins des Salins' }, { cote: 'D', type: 'fosse', nom: 'Bassins des Salins (est)' }] }),
    C(120, 60, { p: 0 }),
    C(120, -30, { p: 1 }),
    C(200, 60, { p: 1, lieu: 3 }),
    D(150, { p: 3, lieu: 3 }),
    D(150, { p: -3, lieu: 3 }),
    D(300, { p: 0, ajuste: true }),
    C(180, 60, { p: 0 }),
    C(140, 30, { p: 0 }),
    D(260, { p: 0, ajuste: true }),
    C(100, 90, { p: 0, ajusteCap: true }),
    D(160, { p: 0, lieu: 4, couvert: { type: 'pont-couvert', nom: 'Pont du Canal' }, pont: { type: 'treillis', nom: 'Pont du Canal' } }),
    D(140, { p: 'a', ajuste: 'est' }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Lande-Noire : coulée, tube de lave, geysers, faille
// Sens contraire des aiguilles d'une montre. Le tour monte par une tranchée dans la coulée noire, passe dans un tube
// de lave éclairé par ses trous de voûte, traverse le plateau des geysers, plonge dans la Faille entre deux murs de
// basalte et franchit une fissure d'eau claire sur un pont.
const LANDE_NOIRE = {
  id: 'lande-noire', nom: 'Lande-Noire', theme: 'islande', graine: 83,
  lieux: [
    { n: 1, nom: 'La Faille', court: 'la piste au fond d\'un rift entre deux murs de basalte, pont sur une fissure d\'eau claire' },
    { n: 2, nom: 'Les Geysers', court: 'plateau fumant, la vapeur traverse la piste, un geyser jaillit à heure fixe' },
    { n: 3, nom: 'La Coulée', court: 'tranchée dans la lave noire, blocs au bord, fissure rougeoyante la nuit' },
    { n: 4, nom: 'Virage de la Cascade', court: 'la chute sur les orgues de basalte, vue du virage' },
  ],
  seq: [
    D(260, { p: 0, stands: true, dv: 0 }),
    C(180, -50, { p: 1 }),
    D(200, { p: 2, lieu: 3, lg: 9, ld: 9, bord: [{ cote: 'G', type: 'rochers', nom: 'Blocs de la Coulée' }, { cote: 'D', type: 'rochers', nom: 'Blocs de la Coulée (est)' }] }),
    C(120, 40, { p: 2, lieu: 3 }),
    C(120, -70, { p: 3, lieu: 3 }),
    D(180, { p: 2, couvert: { type: 'tunnel', nom: 'Tube de lave' } }),
    C(200, -20, { p: 2, couvert: { type: 'tunnel', nom: 'Tube de lave' } }),
    D(200, { p: 1, ajuste: true }),
    C(150, -60, { p: 0, lieu: 2 }),
    D(300, { p: 0, lieu: 2, ajuste: 'ouest' }),
    C(160, 40, { p: 0, lieu: 2 }),
    C(160, -50, { p: 0, lieu: 2 }),
    D(500, { p: 1, ajuste: 'ouest' }),
    C(50, -110, { p: -2, lieu: 4, dv: -2.5, bord: { cote: 'D', type: 'vide', nom: 'Rebord de la Cascade' } }),
    D(120, { p: -4 }),
    D(420, { p: -3, lieu: 1, vib: false, lg: 8.5, ld: 8.5, bord: [{ cote: 'G', type: 'rochers', nom: 'Murs de la Faille' }, { cote: 'D', type: 'rochers', nom: 'Murs de la Faille (est)' }] }),
    C(300, -20, { p: -3, lieu: 1, vib: false, lg: 8.5, ld: 8.5 }),
    D(100, { p: -1, lieu: 1, pont: { type: 'basalte', nom: 'Pont de la Fissure' } }),
    C(200, 20, { p: -2 }),
    D(200, { p: -2, ajuste: true }),
    C(150, -80, { p: -1, ajusteCap: true }),
    D(200, { p: 'a', ajuste: true }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Roche-Fauve : baobabs, arche, canyon, kopje
// Sens des aiguilles d'une montre sur le plateau. L'allée des baobabs descend droit au sud, la piste passe sous
// une arche de grès, plonge dans le canyon, traverse l'oued sur un radier, remonte par une rampe à 12 % et rentre
// par les esses du kopje, entre les boules de granit.
const ROCHE_FAUVE = {
  id: 'roche-fauve', nom: 'Roche-Fauve', theme: 'desert', graine: 107,
  lieux: [
    { n: 1, nom: "L'Arche", court: 'arche de grès rouge de 40 m au-dessus de la piste, vue de loin dans l\'allée' },
    { n: 2, nom: 'Le Canyon', court: 'descente entre les strates, radier dans l\'oued, rampe de sortie à 12 %' },
    { n: 3, nom: "L'Allée des Baobabs", court: '600 m droits entre les baobabs, le soleil couchant dans l\'axe' },
    { n: 4, nom: 'Le Kopje', court: 'esses entre les boules de granit, rochers à trois mètres du bord' },
  ],
  seq: [
    D(300, { p: 0, stands: true, dv: 0 }),
    C(180, 90, { p: 0 }),
    D(700, { p: -1, lieu: 3, ajuste: true }),
    C(160, 60, { p: -1 }),
    D(80, { p: -1, lieu: 1, couvert: { type: 'arche', nom: 'Arche de Roche-Fauve' } }),
    C(160, 30, { p: -2, lieu: 1 }),
    D(180, { p: -9, lieu: 2 }),
    C(80, -60, { p: -6, lieu: 2, bord: { cote: 'D', type: 'rochers', nom: 'Parois du Canyon' } }),
    C(80, 60, { p: -4, lieu: 2, bord: { cote: 'G', type: 'rochers', nom: 'Parois du Canyon (nord)' } }),
    D(90, { p: 0, lieu: 2, vib: false }),
    C(70, 50, { p: 6, lieu: 2 }),
    D(220, { p: 12, lieu: 2, vib: false }),
    C(150, -50, { p: 6 }),
    D(350, { p: 2, ajuste: true }),
    C(150, 90, { p: 1 }),
    C(100, -40, { p: 2, lieu: 4, bord: { cote: 'D', type: 'rochers', nom: 'Boules du Kopje' } }),
    C(100, 80, { p: 2, lieu: 4, bord: { cote: 'G', type: 'rochers', nom: 'Boules du Kopje (ouest)' } }),
    C(120, -40, { p: 2, lieu: 4 }),
    D(300, { p: 2, ajuste: true }),
    C(180, 90, { p: 1, ajusteCap: true }),
    D(450, { p: 'a', ajuste: true }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Brume-de-Jade : terrasses, pont couvert, grotte, spirale
// Sens des aiguilles d'une montre, avec une boucle de plus : la Spirale tourne de 270° autour du piton du temple en
// descendant à 5 % et repasse sous sa propre approche (14 m plus bas) ; le tour compte donc 720° de virage.
const BRUME_DE_JADE = {
  id: 'brume-de-jade', nom: 'Brume-de-Jade', theme: 'asie', graine: 131, tours: 2, zoom: [{ lieu: 4, rayon: 230 }],
  lieux: [
    { n: 1, nom: 'Les Terrasses', court: 'courbes de niveau à travers les rizières, miroirs d\'eau au printemps' },
    { n: 2, nom: 'Pont du Vent et de la Pluie', court: 'pont couvert de bois, galerie ouverte sur la rivière' },
    { n: 3, nom: 'La Grotte', court: 'tunnel naturel, stalactites, lanternes de couleur' },
    { n: 4, nom: 'La Spirale', court: 'boucle de 270° autour du piton du temple, on repasse sous l\'approche' },
  ],
  seq: [
    D(260, { p: 0, stands: true, dv: 0 }),
    C(150, 30, { p: 2 }),
    C(110, -50, { p: 3, lieu: 1 }),
    C(100, 80, { p: 3, lieu: 1, bord: { cote: 'G', type: 'muret', nom: 'Murets des Terrasses' } }),
    C(110, -60, { p: 3, lieu: 1, bord: { cote: 'D', type: 'muret', nom: 'Murets des Terrasses (bas)' } }),
    C(100, 75, { p: 3, lieu: 1 }),
    C(120, -55, { p: 3, lieu: 1, bord: { cote: 'G', type: 'muret', nom: 'Murets des Terrasses (haut)' } }),
    C(120, 45, { p: 2, lieu: 1 }),
    D(200, { p: 2, ajuste: true }),
    C(150, 100, { p: 0 }),
    D(100, { p: 0, lieu: 2, couvert: { type: 'pont-couvert', nom: 'Pont du Vent et de la Pluie' }, pont: { type: 'bois', nom: 'Pont du Vent et de la Pluie' } }),
    C(180, 20, { p: 2 }),
    D(200, { p: 3, lieu: 3, couvert: { type: 'tunnel', nom: 'La Grotte' } }),
    C(150, -20, { p: 2, lieu: 3, couvert: { type: 'tunnel', nom: 'La Grotte' } }),
    D(200, { p: 4, ajuste: true }),
    D(150, { p: 4, lieu: 4, croise: 'Spirale' }),
    C(60, 270, { p: -5, lieu: 4, croise: 'Spirale', bord: { cote: 'G', type: 'vide', nom: 'Bord de la Spirale' } }),
    D(160, { p: -5, lieu: 4, croise: 'Spirale' }),
    C(120, 90, { p: -3 }),
    D(320, { p: -2, ajuste: true }),
    C(160, 90, { p: -1 }),
    D(300, { p: -2, ajuste: true }),
    C(260, -25, { p: -1 }),
    C(260, 25, { p: -1 }),
    C(150, 90, { p: -1, ajusteCap: true }),
    D(220, { p: 'a', ajuste: true }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

// ------------------------------------------------------------------ Cap-Séquoia : géants, tronc couché, pointe, corniche, anse
// Sens des aiguilles d'une montre, l'océan à l'ouest. On part de la clairière des stands, on serpente entre les
// séquoias géants et sous le Tronc couché, on descend vers la côte, on traverse la pointe en tunnel, on longe la
// corniche au-dessus de l'océan et on franchit l'anse sur un pont en arc avant de remonter dans la forêt.
const CAP_SEQUOIA = {
  id: 'cap-sequoia', nom: 'Cap-Séquoia', theme: 'pacifique', graine: 157,
  lieux: [
    { n: 1, nom: 'Bosquet des Géants', court: 'esses entre les troncs de séquoias, passage sous le Tronc couché' },
    { n: 2, nom: 'Corniche du Pacifique', court: 'route en balcon à 100 m au-dessus de l\'océan, muret bas, contre-dévers' },
    { n: 3, nom: "Pont de l'Anse", court: 'arc de béton ajouré au-dessus de l\'embouchure, la plage 60 m plus bas' },
    { n: 4, nom: 'Tunnel de la Pointe', court: 'on entre dans la roche face à la forêt, on sort face à l\'océan' },
  ],
  seq: [
    D(260, { p: 0, stands: true, dv: 0 }),
    C(150, 60, { p: -1, lieu: 1 }),
    D(240, { p: -1, lieu: 1, ajuste: 'sud' }),
    C(70, -55, { p: -2, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Troncs des Géants' } }),
    C(65, 80, { p: -2, lieu: 1, bord: { cote: 'G', type: 'arbres', nom: 'Troncs des Géants (ouest)' } }),
    D(50, { p: -1, lieu: 1, couvert: { type: 'arche', nom: 'Le Tronc couché' } }),
    C(70, -70, { p: -2, lieu: 1, bord: { cote: 'D', type: 'arbres', nom: 'Troncs des Géants (sud)' } }),
    C(80, 85, { p: -3, lieu: 1 }),
    D(280, { p: -1.5, ajuste: 'sud' }),
    C(200, 90, { p: -2 }),
    D(240, { p: -1.5, ajuste: true }),
    C(160, -30, { p: -2 }),
    D(190, { p: -1, lieu: 4, couvert: { type: 'tunnel', nom: 'Tunnel de la Pointe' } }),
    C(180, 60, { p: 0, lieu: 4 }),
    C(300, 60, { p: 1, lieu: 2, dv: -1.5, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    D(200, { p: 3, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    C(160, -40, { p: 1, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    C(160, 40, { p: 1, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    D(250, { p: 1, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    C(150, -45, { p: 0, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    C(150, 45, { p: 0, lieu: 2, vib: false, bord: { cote: 'G', type: 'vide', nom: 'Corniche du Pacifique' } }),
    D(220, { p: 0, lieu: 3, pont: { type: 'arc', nom: "Pont de l'Anse" } }),
    D(180, { p: 4, ajuste: true }),
    C(160, 90, { p: 3, ajusteCap: true }),
    D(300, { p: 'a', ajuste: true }),
    D(120, { p: 0, stands: true, dv: 0 }),
  ],
};

export const PARTITIONS = [HAUT_COL, VAL_BRULE, PORT_SABLE, LANDE_NOIRE, ROCHE_FAUVE, BRUME_DE_JADE, CAP_SEQUOIA];
export const PARTITION = Object.fromEntries(PARTITIONS.map(p => [p.id, p]));
