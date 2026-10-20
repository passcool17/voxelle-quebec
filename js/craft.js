// Construire et miner : dureté des blocs, outils, recettes (à la main ou à l'établi).
// Les recettes prennent des blocs du sac de blocs (S.blocks) et des objets du sac (S.inv).
import { B } from './blocks.js';

// temps de minage à mains nues (s) ; bedrock = incassable
const SOFT = 0.22, WOOD = 0.55, ROCK = 0.95;
export const HARD = new Array(64).fill(0.4);
for (const b of [B.GRASS, B.DIRT, B.SAND, B.SNOW, B.GRAVEL, B.FIELD, B.PATH, B.SNOWGRASS, B.MOSS, B.PEBBLE, B.HAY, B.SPRUCE, B.MAPLE, B.MAPLE2, B.MAPLE3, B.BIRCH, B.SNOWLEAF, B.TUFT, B.FLOWR, B.FLOWY, B.FLOWV, B.BERRY, B.GLASS, B.CONE]) HARD[b] = SOFT;
for (const b of [B.LOG, B.SLOG, B.BIRCHLOG, B.BIRCHMARK, B.PLANK, B.DPLANK, B.BENCH, B.SIGN, B.BROWN, B.TORCH]) HARD[b] = WOOD;
for (const b of [B.STONE, B.COBBLE, B.BRICK, B.COPPER, B.IRON, B.GOLD, B.ICE, B.ROAD, B.STRIPE, B.TIN, B.REDROOF, B.SHINGLE]) HARD[b] = ROCK;
HARD[B.COAL] = 1.2; HARD[B.IRONORE] = 1.5; HARD[B.BEDROCK] = Infinity;
const KIND = new Uint8Array(64); // 0 = mou, 1 = bois, 2 = roche
for (let b = 0; b < 64; b++) KIND[b] = HARD[b] >= ROCK ? 2 : HARD[b] >= WOOD ? 1 : 0;

// meilleur outil possédé pour ce bloc : multiplicateur de vitesse
export function toolFor(S, ITEMS, b) {
  let best = 1, name = null; const k = KIND[b];
  for (const it of S.inv) { const D = ITEMS[it.id]; if (D.slot !== 'outil') continue;
    const m = D.tool === 'pic' ? (k === 2 ? D.pow : k === 0 ? 1 + (D.pow - 1) * 0.4 : 1) : D.tool === 'hache' ? (k === 1 ? D.pow : 1) : 1;
    if (m > best) { best = m; name = D.name; } }
  return { m: best, name };
}
export function mineTime(S, ITEMS, b, bonus = 0) { return HARD[b] / (toolFor(S, ITEMS, b).m * (1 + bonus)); }

// recettes : out { b, n } (bloc) ou { i, n } (objet) ; inb = blocs requis ; ini = objets requis ; bench = établi à proximité
export const RECIPES = [
  { id: 'planches', name: 'Planches', out: { b: B.PLANK, n: 4 }, inb: { [B.LOG]: 1 } },
  { id: 'etabli', name: 'Établi', out: { b: B.BENCH, n: 1 }, inb: { [B.PLANK]: 4 }, note: 'Pose-le pour débloquer les recettes avancées.' },
  { id: 'flambeau', name: 'Flambeaux', out: { b: B.TORCH, n: 4 }, inb: { [B.PLANK]: 1 }, ini: { charbon: 1 } },
  { id: 'tire', name: 'Tire sur la neige', out: { i: 'tire', n: 2 }, inb: { [B.SNOW]: 2 }, ini: { sirop: 1 } },
  // v5c : le temps des sucres de Pépère (visibles seulement pendant la quête) ; at = à faire sur place
  { id: 'bouillir', name: 'Faire bouillir l’eau d’érable', out: { i: 'sirop_coulee', n: 1 }, ini: { eau_erable: 3 }, at: 'cabane', quest: 'tire_printemps', note: 'À l’évaporateur de la cabane à sucre de Pépère.' },
  { id: 'tire_pepere', name: 'Tire de Pépère', out: { i: 'tire', n: 2 }, inb: { [B.SNOW]: 2 }, ini: { sirop_coulee: 1 }, quest: 'tire_printemps', note: 'Avec ton propre sirop de la coulée, sur ta neige.' },
  { id: 'pave', name: 'Pavé', out: { b: B.COBBLE, n: 2 }, inb: { [B.STONE]: 2 }, bench: true },
  { id: 'vitre', name: 'Fenêtres', out: { b: B.GLASS, n: 2 }, inb: { [B.SAND]: 2 }, ini: { charbon: 1 }, bench: true },
  { id: 'brique', name: 'Briques', out: { b: B.BRICK, n: 3 }, inb: { [B.DIRT]: 2, [B.SAND]: 1 }, ini: { charbon: 1 }, bench: true },
  { id: 'fanal', name: 'Fanal', out: { b: B.LAMP, n: 2 }, inb: { [B.GLASS]: 1 }, ini: { fer: 1, charbon: 1 }, bench: true },
  { id: 'pic_bois', name: 'Pic en bois', out: { i: 'pic_bois' }, inb: { [B.PLANK]: 5 }, bench: true },
  { id: 'hache', name: 'Hache de bûcheron', out: { i: 'hache' }, inb: { [B.PLANK]: 2, [B.STONE]: 3 }, bench: true },
  { id: 'pic_fer', name: 'Pic en fer', out: { i: 'pic_fer' }, inb: { [B.PLANK]: 2 }, ini: { fer: 3 }, bench: true },
  { id: 'grattoir', name: 'Grattoir à pare-brise', out: { i: 'grattoir' }, inb: { [B.PLANK]: 1 }, ini: { fer: 2 }, bench: true },
  { id: 'raquettes', name: 'Raquettes', out: { i: 'raquettes' }, inb: { [B.PLANK]: 3, [B.LOG]: 1 }, bench: true },
  { id: 'cone', name: 'Cône recyclé', out: { b: B.CONE, n: 2 }, ini: { plastique: 2 }, bench: true, note: 'Les cônes-golems laissent du plastique orange.' },
  // meubles de ta cabane (à installer sur ton terrain, depuis le sac)
  { id: 'lit', name: 'Lit à courtepointe', out: { i: 'lit' }, inb: { [B.PLANK]: 6, [B.HAY]: 2 }, bench: true, note: 'Meuble : installe-le sur ton terrain (sac → INSTALLER).' },
  { id: 'coffre_m', name: 'Coffre de cèdre', out: { i: 'coffre_m' }, inb: { [B.PLANK]: 8 }, ini: { fer: 1 }, bench: true, note: 'Meuble : installe-le sur ton terrain.' },
  { id: 'poele', name: 'Poêle à bois', out: { i: 'poele' }, inb: { [B.COBBLE]: 2 }, ini: { fer: 4 }, bench: true, note: 'Meuble : installe-le sur ton terrain.' },
  { id: 'table', name: 'Table de cuisine', out: { i: 'table' }, inb: { [B.PLANK]: 4 }, bench: true, note: 'Meuble : installe-le sur ton terrain.' },
  { id: 'chaise', name: 'Chaise berçante', out: { i: 'chaise' }, inb: { [B.PLANK]: 3 }, bench: true, note: 'Meuble : installe-la sur ton terrain.' },
  { id: 'cadre', name: 'Cadre des trophées', out: { i: 'cadre' }, inb: { [B.PLANK]: 3, [B.GLASS]: 1 }, bench: true, note: 'Montre un trophée par boss vaincu.' },
  { id: 'tapis', name: 'Tapis tressé', out: { i: 'tapis' }, inb: { [B.HAY]: 2 }, bench: true, note: 'Meuble : installe-le sur ton terrain.' },
];
const cnt = (S, id) => S.inv.filter(i => i.id === id).reduce((a, i) => a + (i.n || 1), 0);
export function missing(S, r, nearBench, nearCab) {
  const out = [];
  if (r.bench && !nearBench) out.push('établi');
  if (r.at === 'cabane' && !nearCab) out.push('cabane');
  for (const b in r.inb || {}) if ((S.blocks[b] || 0) < r.inb[b]) out.push('b' + b);
  for (const id in r.ini || {}) if (cnt(S, id) < r.ini[id]) out.push(id);
  return out;
}
// retire les ingrédients (vérifiés avant) ; l'appelant ajoute le résultat
export function consume(S, r) {
  for (const b in r.inb || {}) { S.blocks[b] -= r.inb[b]; if (S.blocks[b] <= 0) delete S.blocks[b]; }
  for (const id in r.ini || {}) { let n = r.ini[id]; for (let k = S.inv.length - 1; k >= 0 && n > 0; k--) { const it = S.inv[k]; if (it.id !== id) continue; const t = Math.min(n, it.n || 1); n -= t; if (it.n) it.n -= t; if (!it.n || it.n <= 0) S.inv.splice(k, 1); } }
}
