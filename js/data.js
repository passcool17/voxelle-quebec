// Données : objets, ennemis, PNJ, quêtes, répliques (français québécois, personnages fictifs).
export const ITEMS = {
  baton: { name: 'Bâton de hockey', slot: 'arme', kind: 'melee', dmg: 12, cd: 0.42, range: 2.7, arc: 2.0, desc: 'Ruban noir, palette usée. Un classique.' },
  baton_carbone: { name: 'Bâton en carbone', slot: 'arme', kind: 'melee', dmg: 18, cd: 0.36, range: 2.8, arc: 2.0, desc: 'Léger comme une plume, cher comme un loyer.', price: 140 },
  baton_or: { name: 'Bâton doré du Carnaval', slot: 'arme', kind: 'melee', dmg: 34, cd: 0.36, range: 3.0, arc: 2.3, desc: 'Brille tellement que les cônes se rendent.' },
  pelle: { name: 'Pelle à neige', slot: 'arme', kind: 'melee', dmg: 22, cd: 0.78, range: 3.0, arc: 2.8, kb: 9, desc: 'Grosse frappe, grand arc. Sent le mois de février.' },
  pelle_alu: { name: 'Pelle en alu', slot: 'arme', kind: 'melee', dmg: 30, cd: 0.7, range: 3.1, arc: 2.9, kb: 10, desc: 'Ne plie pas, même sur la glace.', price: 160 },
  lanceur: { name: 'Lance-balles de neige', slot: 'arme', kind: 'ranged', dmg: 11, cd: 0.34, speed: 30, desc: 'Tire des balles bien tapées. À distance!' },
  tuque: { name: 'Tuque à pompon', slot: 'tete', def: 2, desc: 'Tricotée par une tante.' },
  tuque_patrimoine: { name: 'Tuque du patrimoine', slot: 'tete', def: 5, desc: 'Approuvée par le formulaire B-52.' },
  mitaines: { name: 'Mitaines tricotées', slot: 'mains', def: 3, desc: 'Chaudes et un peu piquantes.' },
  mitaines_doublees: { name: 'Mitaines doublées', slot: 'mains', def: 5, desc: 'Double épaisseur, triple fierté.', price: 90 },
  manteau: { name: 'Manteau d’hiver', slot: 'corps', def: 6, desc: 'Coté pour -40.', price: 150 },
  bottes: { name: 'Bottes à crampons', slot: 'pieds', def: 3, spd: 0.06, desc: 'Ne glissent pas sur le trottoir (presque).', price: 70 },
  poutine: { name: 'Poutine', slot: 'conso', heal: 35, desc: 'Rend 35 PV. Fromage qui fait couic.', price: 12 },
  sirop: { name: 'Sirop d’érable', slot: 'conso', heal: 20, stam: 1, buff: 12, desc: 'Rend 20 PV, toute l’énergie et donne de la vitesse.', price: 18 },
  tourtiere: { name: 'Tourtière', slot: 'conso', heal: 80, desc: 'Rend 80 PV. Recette secrète de matante.', price: 35 },
  permis: { name: 'Formulaire B-52', slot: 'quete', desc: 'Permis de construire, en trois copies.' },
  chaudiere: { name: 'Chaudière de sirop', slot: 'quete', desc: 'Pleine d’eau d’érable.' },
  ble: { name: 'Canne de blé d’Inde en crème', slot: 'quete', desc: 'L’étage du milieu du pâté chinois. Sacré.' },
  gazette: { name: 'Gazette des remparts', slot: 'quete', desc: 'Les nouvelles de Québec, imprimées à matin (ou l’an passé).' },
  pate: { name: 'Pâté chinois', slot: 'conso', heal: 60, desc: 'Steak, blé d’Inde, patates. Rend 60 PV.', price: 24 },
  bleuets: { name: 'Casseau de bleuets', slot: 'conso', heal: 15, stam: 1, desc: 'Des bleuets du Lac, gros comme des billes. Rend 15 PV et l’énergie.', price: 10 },
  tarte: { name: 'Tarte aux bleuets', slot: 'conso', heal: 70, buff: 15, desc: 'Rend 70 PV et donne de la vitesse. Tache les dents.', price: 30 },
};
export const SHOPS = { etape: ['pate', 'poutine', 'tarte', 'sirop', 'tourtiere', 'bottes', 'manteau'], chicoutimi: ['bleuets', 'tarte', 'poutine', 'tourtiere', 'mitaines_doublees', 'pelle_alu', 'baton_carbone'] };
export const RARITY = [{ n: 'commun', c: '#e8e8e8', m: 1 }, { n: 'rare', c: '#5ab8ff', m: 1.25 }, { n: 'épique', c: '#d07aff', m: 1.55 }];
export const SHOP = ['poutine', 'sirop', 'tourtiere', 'bottes', 'mitaines_doublees', 'manteau', 'baton_carbone', 'pelle_alu'];

export const ENEMIES = {
  cone: { name: 'Cône-golem', hp: 32, dmg: 8, spd: 3.3, range: 1.7, cd: 1.1, xp: 22, cash: [2, 6], aggro: 15, hw: 0.4, h: 1.6 },
  bureau: { name: 'Bureaucrate zombie', hp: 40, dmg: 7, spd: 2.3, range: 9, cd: 2.2, xp: 30, cash: [4, 9], aggro: 18, hw: 0.32, h: 1.8, ranged: true },
  plow: { name: 'Déneigeuse folle', hp: 95, dmg: 18, spd: 3.5, range: 2.2, cd: 3.2, xp: 55, cash: [8, 16], aggro: 22, hw: 1.0, h: 2.2 },
  raton: { name: 'Raton voleur de poutine', hp: 24, dmg: 4, spd: 6.2, range: 1.3, cd: 1.0, xp: 20, cash: [3, 7], aggro: 14, hw: 0.3, h: 0.8 },
  mouches: { name: 'Mouches noires', hp: 14, dmg: 2, spd: 4.4, range: 1.2, cd: 0.6, xp: 12, cash: [1, 3], aggro: 13, hw: 0.4, h: 1.2, fly: true },
  trou: { name: 'Nid-de-poule', hp: 46, dmg: 12, spd: 1.2, range: 1.8, cd: 1.4, xp: 32, cash: [4, 10], aggro: 5, hw: 0.9, h: 0.5 },
  orignal: { name: 'Orignal de mauvaise humeur', hp: 120, dmg: 15, spd: 4.0, range: 2.4, cd: 2.6, xp: 70, cash: [6, 14], aggro: 17, hw: 0.8, h: 2.6, charge: true },
  supreme: { name: 'Le Cône Suprême', hp: 650, dmg: 20, spd: 3.0, range: 3.6, cd: 1.6, xp: 600, cash: [120, 160], aggro: 26, hw: 1.0, h: 3.8, boss: true },
};
export const NPCS = {
  gaston: { name: 'Gaston, crieur public', look: { coat: 0x8a1c2a, hat: 0x2b2f3a, hatBand: 0xe8c040, pom: 0xe8c040, beard: 0x8a6a4a } },
  lapaperasse: { name: 'Mme Lapaperasse, Bureau des permis', look: { coat: 0x6a3a8a, hatType: 'bun', hair: 0xb8b8c0, glasses: true, sash: false, mitt: 0xf0c8a0 } },
  pepere: { name: 'Pépère Tremblay', look: { coat: 0xb02020, hat: 0x2c5a34, beard: 0xf2f2f2, hair: 0xe8e8e8 } },
  ginette: { name: 'Ginette, cantine du village', look: { coat: 0xe86a8a, hatType: 'filet', apron: 0xf8f8f8, hair: 0x8a3a1a, sash: false, mitt: 0xf0c8a0 } },
  aubergiste: { name: 'Aubergiste', look: { coat: 0x3a6a3a, apron: 0xf2e8d0, hat: 0x7a4a22 } },
  commercant: { name: 'Dépanneur', look: { coat: 0x1f6a8a, apron: 0x2c8a4a, hatType: 'none', hair: 0x2a2a2a, sash: false } },
  acericulteur: { name: 'Acériculteur', look: { coat: 0x8a2a1a, hat: 0xc07a20, beard: 0x5a3a22 } },
  garde: { name: 'Garde des remparts', look: { coat: 0x1f3f8a, hatType: 'kepi', hat: 0x1f3f8a, sash: false, mitt: 0xf2f2f2 } },
  villageois: { name: 'Villageois' },
  cuisiniere: { name: 'Rolande, cuisinière de L’Étape', look: { coat: 0xf2f2f2, hatType: 'filet', apron: 0xc8282e, hair: 0x8a8a90, sash: false, mitt: 0xf0c8a0 } },
  gardeparc: { name: 'Agente Bérubé, garde-parc', look: { coat: 0x3a5a2a, hatType: 'kepi', hat: 0x6a4026, sash: false, mitt: 0x3a2a1a } },
  pecheur: { name: 'Ti-Mé, pêcheur', look: { coat: 0xc02020, hat: 0x2c5a34, beard: 0x8a8a8a, hair: 0x8a8a8a } },
  saguenayen: { name: 'Gilles, du port de Chicoutimi', look: { coat: 0x1f3f8a, hat: 0xf2c12e, beard: 0x5a3a22, pom: 0x1f3f8a } },
  chauffeur: { name: 'Chauffeur d’autocar', look: { coat: 0x2e5fa8, hatType: 'kepi', hat: 0x2e5fa8, sash: false, mitt: 0xf0c8a0 } },
  guide: { name: 'Guide du Fjordorama', look: { coat: 0x2c8a8a, hatType: 'none', hair: 0x2a2a2a, glasses: true, sash: false } },
};
export const ROLE_CHAT = {
  cuisiniere: ['Ici, le café est chaud pis la tarte est frette. Comme il faut.', 'Les camionneurs disent que mon pâté chinois vaut le détour. Y’a pas de détour, c’est la seule route.'],
  gardeparc: ['Bienvenue dans la Réserve! Pas de feu en dehors des foyers, pis on flatte pas les orignaux.', 'Les orignaux ont priorité sur la 175. C’est pas écrit dans le code, mais essaye de leur dire.', 'Les mouches noires? On les compte plus. Elles, elles nous comptent.'],
  pecheur: ['La truite mord à matin. Les mouches noires, elles, mordent toute la journée.', 'J’ai pogné une truite grosse de même. Bon, de même. Correct, de même.', 'Aux Sept îles, y’a sept lacs. Ou six. Ça dépend du niveau d’eau pis de la bière.'],
  saguenayen: ['Icitte, on dit « Royaume ». Ça fait plus chic que « région ».', 'Le fjord, c’est de l’eau salée en dessous pis de l’eau douce en dessus. Comme moi le samedi.'],
  guide: ['Le vrai fjord a une centaine de kilomètres. Notre maquette en a trois mètres. On fait ce qu’on peut avec le budget.', 'Les falaises ici ont été creusées par un glacier. Le stationnement, lui, par une pépine.', 'Visite guidée gratuite! La sortie est payante. Non, je niaise.'],
};
export const CHATTER = [
  'Y fait frette en bonyenne à matin!', 'Les cônes orange, avant, ça restait tranquille. Astheure, ça marche!', 'Coudonc, t’as-tu vu le nid-de-poule sur le rang? Il m’a mangé un pneu.',
  'Mon beau-frère a demandé un permis en 1997. Il attend encore.', 'Les mouches noires, c’est pas des bibittes, c’est des p’tits vampires.', 'Une déneigeuse a passé à 3 h du matin. Dans ma cour. Sans raison.',
  'Si tu montes dans les Laurentides, prends ton cerf-volant. Ça plane en masse!', 'La nuit, regarde le ciel : les aurores dansent au-dessus du fleuve.', 'Le raton a volé ma poutine. Pis le gravy avec!',
  'Il paraît que le château a 400 marches. J’en ai compté 12 pis j’ai abandonné.', 'Moi, je mets ma tuque même en juillet. On sait jamais.', 'C’est pas un chantier, c’est un mode de vie.',
];
// Quêtes du récit (les contrats des villages sont générés)
export const QUESTS = {
  cones: { giver: 'gaston', title: 'L’invasion des cônes', type: 'kill', target: 'cone', n: 6, where: [0, -1], reward: { cash: 60, xp: 160, item: 'lanceur' },
    intro: 'Oyez, oyez! Des cônes orange ont pris vie au chantier au nord des remparts. Ils bloquent le chemin des Laurentides! Va en démolir six, pis reviens me voir.',
    wait: 'Le chantier est au nord, passe par la porte Nord. Six cônes, pas un de moins!', done: 'Six cônes au recyclage! Tiens, prends ce lance-balles de neige. Ça va te servir.' },
  permis: { giver: 'lapaperasse', requires: ['cones'], title: 'Le formulaire B-52', type: 'collect', item: 'permis', n: 1, reward: { cash: 80, xp: 200, item: 'tuque_patrimoine' },
    intro: 'Un bureaucrate zombie est parti avec le formulaire B-52, en trois copies. Sans lui, personne peut bâtir. Les zombies traînent la nuit, mais il y en a le jour aussi, dans la campagne.',
    wait: 'Le formulaire B-52 : en trois copies, agrafé en haut à gauche. Un bureaucrate zombie l’a sur lui.', done: 'Parfait, tout est en règle! Voici une tuque du patrimoine, approuvée par le comité.' },
  sirop: { giver: 'pepere', title: 'Le sirop de Pépère', type: 'collect', item: 'chaudiere', n: 5, reward: { cash: 50, xp: 150, item: 'mitaines', give: { sirop: 3 } },
    intro: 'Bonjour mon jeune! Mes chaudières d’eau d’érable sont restées accrochées aux érables autour de la cabane. Ramène-m’en cinq avant que les ratons les trouvent.',
    wait: 'Les chaudières sont autour de la cabane, au pied des érables.', done: 'Ça va faire du bon sirop! Tiens, des mitaines pis trois cannes de sirop.' },
  poutine: { giver: 'ginette', title: 'Les voleurs de poutine', type: 'kill', target: 'raton', n: 4, reward: { cash: 70, xp: 180, item: 'pelle' },
    intro: 'Mes poutines disparaissent! Des ratons laveurs masqués rôdent autour du village, surtout la nuit. Chasse-m’en quatre, pis je te donne ma vieille pelle.',
    wait: 'Les ratons, c’est des voleurs masqués. Ils sortent surtout le soir.', done: 'Merci! Tiens, ma pelle à neige. Elle a déneigé trois générations d’entrées.' },
  pate: { giver: 'cuisiniere', title: 'Le pâté chinois de Rolande', type: 'collect', item: 'ble', n: 3, reward: { cash: 90, xp: 260, give: { pate: 2 } },
    intro: 'Mon pâté chinois! J’ai le steak, j’ai les patates, mais le camion de blé d’Inde en crème est resté pogné dans les travaux de la 175, au sud. Les cônes ont « sécurisé » les cannes. Ramène-m’en trois, pis je te nourris.',
    wait: 'Les travaux sont sur la 175, au sud de L’Étape. Steak, blé d’Inde, patates : sans l’étage du milieu, c’est juste du hachis.', done: 'Steak, blé d’Inde, patates : l’ordre sacré est rétabli! Tiens, deux portions pour la route. Pis mets du ketchup, je regarde pas.' },
  nouvelles: { giver: 'saguenayen', title: 'Des nouvelles de Québec', type: 'collect', item: 'gazette', n: 1, reward: { cash: 120, xp: 300, give: { bleuets: 4, tarte: 1 } },
    intro: 'Salut l’étranger! Ça fait trois semaines qu’on a pas eu de nouvelles de Québec. Le tramway, y’é-tu fini? Le pont, y tient-tu encore? Va voir Gaston, le crieur de la Vieille-Ville, pis rapporte-moi sa gazette. Je te paye en bleuets!',
    wait: 'Gaston, le crieur, est sur la place de la Vieille-Ville. Prends l’autocar si t’as pas envie de rouler.', done: '« Tramway : les travaux avancent. Pont : il tient. Cônes : en hausse. » Rien de neuf, d’abord! Tiens, des bleuets pis une tarte. Des vrais, gros comme des billes.' },
  supreme: { giver: 'gaston', requires: ['cones', 'permis'], title: 'Le Grand Chantier', type: 'kill', target: 'supreme', n: 1, where: [2, -1], reward: { cash: 300, xp: 650, item: 'baton_or' },
    intro: 'Mauvaise nouvelle : le Cône Suprême dirige un grand chantier dans les hauteurs, au nord-est. Si on l’arrête pas, il va mettre des cônes jusque dans le fleuve!',
    wait: 'Le Grand Chantier est au nord-est, dans les hauteurs. Prends des poutines.', done: 'Tu as vaincu le Cône Suprême! Les rues sont libres. Voici le Bâton doré du Carnaval.' },
};
export const CONTRACT_TARGETS = { 1: ['trou', 'raton', 'bureau'], 2: ['mouches', 'raton', 'orignal'], 3: ['raton', 'mouches', 'bureau'], 4: ['plow', 'mouches'], 0: ['trou', 'raton'], 5: ['bureau'] };
