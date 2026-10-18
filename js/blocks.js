// Types de blocs : nom, couleurs [dessus, côté, dessous], drapeaux.
export const CS = 16, WH = 96, SEA = 30;
export const B = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, SNOW: 6, ICE: 7, LOG: 8, SPRUCE: 9, MAPLE: 10, MAPLE2: 11, BIRCHLOG: 12, BIRCH: 13,
  PLANK: 14, COBBLE: 15, COPPER: 16, BRICK: 17, WHITE: 18, GLASS: 19, ROAD: 20, GRAVEL: 21, DPLANK: 22, REDROOF: 23, TIN: 24, HAY: 25, CONE: 26, LAMP: 27,
  BEDROCK: 28, FIELD: 29, PATH: 30, SNOWGRASS: 31, STRIPE: 32, BLUE: 33, SLOG: 34, GOLD: 35, YELLOW: 36, SNOWLEAF: 37 };
const D = [
  ['Air'], ['Gazon', 0x5fa83a, 0x6f6a34, 0x7a5434], ['Terre', 0x7a5434], ['Pierre', 0x8a8a8e], ['Sable', 0xdccb8c], ['Eau', 0x2f6fb3], ['Neige', 0xf2f6fb], ['Glace', 0xa9d8f2],
  ['Bûche', 0x9b7a4d, 0x6b4a2b, 0x9b7a4d], ['Sapinage', 0x2c5a34], ['Feuilles d’érable', 0xc8361e], ['Feuilles d’érable', 0xe7862a], ['Bouleau', 0xd8d2c0, 0xe8e4d8, 0xd8d2c0], ['Feuilles de bouleau', 0x8fbf4a],
  ['Planches', 0xb98b52], ['Pavé', 0x9a958a], ['Cuivre vert', 0x4fa58c], ['Brique', 0xa8553e], ['Clin blanc', 0xeeeae0], ['Fenêtre', 0xffe7a0], ['Asphalte', 0x3d3f44], ['Gravier', 0x8f877c],
  ['Planches foncées', 0x6e4b2e], ['Tôle rouge', 0xb8322a], ['Tôle', 0xc9ced6], ['Ballot de foin', 0xd9b44a], ['Cône', 0xff7a1a, 0xff7a1a, 0xff7a1a], ['Lanterne', 0xffd86b],
  ['Roc-mère', 0x303034], ['Champ', 0x6f8a32, 0x7a5434, 0x7a5434], ['Sentier', 0x9c7a4e], ['Neige', 0xf2f6fb, 0x8a7458, 0x7a5434], ['Barrière', 0xf2f2f2], ['Bleu', 0x1f4fa8], ['Bûche d’épinette', 0x7a5a3a, 0x4a3322, 0x7a5a3a],
  ['Or', 0xe8c040], ['Jaune chantier', 0xf2c12e], ['Sapinage enneigé', 0xe8eef2, 0x3b6440, 0x2c5a34],
];
export const NAME = D.map(d => d[0]);
export const COL = D.map(d => d.length < 2 ? [0, 0, 0] : [d[1], d[2] ?? d[1], d[3] ?? d[2] ?? d[1]]);
export const OPAQUE = new Uint8Array(64), SOLID = new Uint8Array(64), GLOW = new Uint8Array(64), LEAF = new Uint8Array(64);
for (let i = 1; i < D.length; i++) { OPAQUE[i] = i !== B.WATER ? 1 : 0; SOLID[i] = i !== B.WATER ? 1 : 0; }
GLOW[B.GLASS] = GLOW[B.LAMP] = 1;
for (const b of [B.SPRUCE, B.MAPLE, B.MAPLE2, B.BIRCH, B.SNOWLEAF]) { LEAF[b] = 1; SOLID[b] = 0; } // on traverse le feuillage
// Blocs que l'on peut poser (dans la barre)
export const PLACEABLE = [B.PLANK, B.COBBLE, B.BRICK, B.WHITE, B.GLASS, B.REDROOF, B.COPPER, B.LAMP, B.LOG, B.STONE, B.DIRT, B.SNOW, B.SAND, B.GRAVEL, B.TIN, B.DPLANK, B.HAY, B.BLUE, B.GOLD, B.CONE, B.ICE];
// Ce qu'on récupère en cassant
export const DROP = b => ({ [B.GRASS]: B.DIRT, [B.SNOWGRASS]: B.DIRT, [B.FIELD]: B.DIRT, [B.PATH]: B.DIRT, [B.SPRUCE]: 0, [B.MAPLE]: 0, [B.MAPLE2]: 0, [B.BIRCH]: 0, [B.SNOWLEAF]: 0, [B.BEDROCK]: 0, [B.SLOG]: B.LOG, [B.BIRCHLOG]: B.LOG, [B.ROAD]: B.STONE, [B.STRIPE]: B.WHITE }[b] ?? b);
