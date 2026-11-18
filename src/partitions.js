/* BITUME — partitions des circuits dessinés (génération 3, lot 22F) : données pures, lues par
   B.circuit.creer(graine, { partition }) (src/circuit.js). Une partition décrit le tour comme on le raconterait :
   « après les stands, une grande courbe le long de la rivière, la forêt en esses, le Mur à 30 %, trois lacets… ».
   Chaque séquence porte ce que le lieu impose au tracé. Rien n'y est tiré au hasard : toutes les machines
   construisent le même tracé (jeu en ligne) ; la graine du catalogue ne sert qu'au décor.

   Une séquence : D(l) droite de l mètres, C(r, a) courbe de rayon r et d'angle a en degrés (a > 0 : virage à droite).
   Options : p (pente en %, montée > 0, ou 'a' : palier ajusté pour refermer le profil), dv (dévers imposé en degrés,
   > 0 : côté droit plus bas), lg / ld (limite gauche / droite imposée, m depuis l'axe), vib (false : pas de
   vibreurs), stands, couvert { type, nom }, pont { type, nom }, bord ({ cote: 'G'|'D', type, nom } ou liste),
   rampe { nom } (portion où la pente peut dépasser le plafond du thème : `valider` ne l'accepte que là), croise (nom
   d'un croisement déclaré), lieu (numéro), ajuste (droite que la fermeture peut allonger), ajusteCap (courbe dont
   l'angle referme le cap). La première et la dernière séquence forment la ligne des stands (le départ est entre
   les deux).

   Les passages couverts autres que le premier tunnel, les ponts, les bords et les lieux sont gardés dans les données
   pour les étapes suivantes (passages couverts multiples, terrain, lieux) : le jeu ne bâtit aujourd'hui que le premier
   tunnel (c.tunnel). */
(function (B) {
  'use strict';

  const D = (l, o = {}) => ({ t: 'D', l, ...o });
  const C = (r, a, o = {}) => ({ t: 'C', r, a, ...o });
  const figer = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) figer(o[k]); } return o; };

  // ---------------------------------------------------------------- Route-des-Cimes : la grande route des cols
  // David, 18/11/2026 : « une partie avec pente à 20 30 et circuit long, plus ballade agreable que circuit limite avec
  // tunnels et joli paysage, dans les montages, passage en forent dense » ; « Huitième circuit » (Haut-Col garde son
  // tracé). Dessiné par l'étude 22F (docs/reprise/22F-CIRCUITS-MEMORABLES.md, § 3, sous le nom de Haut-Col).
  // Le tour fait le tour du cirque de l'Aiglière, dans le sens contraire des aiguilles d'une montre : la vallée et
  // les stands au sud, la montée par le Bois Noir et le Mur à l'est, les lacets, le tunnel du Rocher, la corniche
  // sur le rebord nord (le cirque est à gauche, à l'intérieur de la boucle), le col, la galerie et le tunnel des
  // Échelles à l'ouest, l'alpage, le pont de la Gorge et le virage du Vide pour redescendre à la vallée.
  // Écarts à l'étude : la bascule du Mur est allongée (100 m à 24 %, 110 m à 15 %, 100 m à 7 % au lieu de 80, 90 et
  // 70 m) pour que la crête n'allège pas de plus de 0,4 g à la vitesse de référence (l'étude mesurait 0,45 g) ; pour
  // garder la descente de la vallée sous 10 %, l'approche des Lacets monte à 4 % (6,5 %) et celle du tunnel à 3,5 %
  // (5 %). La pointe à 30 % reste (décision par défaut du 18/11).
  const ROUTE_DES_CIMES = {
    id: 'route-des-cimes', nom: 'Route-des-Cimes', theme: 'montagne', graine: 181, zoom: [{ lieu: 3, rayon: 240 }],
    lieux: [
      { n: 1, nom: 'Le Bois Noir', court: 'forêt dense de sapins, esses en montée, troncs à 3 m du bord' },
      { n: 2, nom: 'Le Mur', court: 'rampe droite, plus de 300 m au-delà de 20 % et une pointe à 30 %, après la gauche lente de la Scierie' },
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
      // le Mur : droit dans la pente, 340 m de 22 à 30 %, puis 210 m de bascule à 15 et 7 % : la crête est assez longue
      // pour qu'on ne s'y allège pas de plus de 0,4 g à la vitesse de référence
      D(110, { p: 22, lieu: 2, vib: false, rampe: { nom: 'Le Mur' } }),
      D(130, { p: 30, lieu: 2, vib: false, rampe: { nom: 'Le Mur' } }),
      D(100, { p: 24, lieu: 2, vib: false, rampe: { nom: 'Le Mur' } }),
      D(110, { p: 15, lieu: 2, vib: false, rampe: { nom: 'Le Mur' } }),
      D(100, { p: 7, lieu: 2, vib: false, rampe: { nom: 'Le Mur' } }),
      // replat, puis les lacets (branches à 7,5 %, épingles à 4 %)
      C(60, 90, { p: 2, lieu: 3 }),
      D(320, { p: 4, lieu: 3 }),
      C(32, -180, { p: 4, lieu: 3, dv: -3 }),
      D(230, { p: 7.5, lieu: 3, bord: { cote: 'D', type: 'muret', nom: 'Murs des Lacets' } }),
      C(32, 180, { p: 4, lieu: 3, dv: 3 }),
      D(230, { p: 7.5, lieu: 3, bord: { cote: 'G', type: 'muret', nom: 'Murs des Lacets' } }),
      C(34, -180, { p: 4, lieu: 3, dv: -3 }),
      D(200, { p: 3.5 }),
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

  B.partitions = figer({ 'route-des-cimes': ROUTE_DES_CIMES });
})(globalThis.BITUME = globalThis.BITUME || {});
