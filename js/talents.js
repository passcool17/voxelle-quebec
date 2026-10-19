// Progression : arbre de talents en 3 branches. 1 point par niveau gagné (niveau 1 = 0 point).
// req = points déjà mis dans la branche pour débloquer le talent.
export const TALENTS = [
  { key: 'bagarreur', name: 'Bagarreur', col: '#ff7a5a', sub: 'Le combat', list: [
    { id: 'force', name: 'Bras de bûcheron', max: 3, req: 0, txt: r => `+${8 * r} % de dégâts` },
    { id: 'crit', name: 'Œil de lynx', max: 3, req: 1, txt: r => `+${5 * r} % de coups critiques` },
    { id: 'castor', name: 'Peau de castor', max: 3, req: 2, txt: r => `+${8 * r} % de PV max` },
    { id: 'patin', name: 'Coup de patin', max: 1, req: 4, txt: () => 'Le coup chargé est prêt 40 % plus vite et frappe plus large' },
  ] },
  { key: 'debrouillard', name: 'Débrouillard', col: '#8dff6a', sub: 'Survie et butin', list: [
    { id: 'jambes', name: 'Jambes de coureur des bois', max: 3, req: 0, txt: r => `+${4 * r} % de vitesse, la course fatigue ${10 * r} % moins` },
    { id: 'estomac', name: 'Estomac de fer', max: 3, req: 1, txt: r => `La bouffe soigne ${20 * r} % de plus` },
    { id: 'chance', name: 'Trèfle dans la tuque', max: 3, req: 2, txt: r => `Meilleur butin (objets plus rares, ${3 * r} % plus souvent) et +${10 * r} % de piasses` },
    { id: 'gardien', name: 'Roulade de gardien', max: 1, req: 4, txt: () => 'La roulade coûte moitié moins d’énergie et revient deux fois plus vite' },
  ] },
  { key: 'batisseur', name: 'Bâtisseur', col: '#ffd23a', sub: 'Construire et miner', list: [
    { id: 'pioche', name: 'Pioche agile', max: 3, req: 0, txt: r => `Mine ${25 * r} % plus vite` },
    { id: 'filon', name: 'Flair pour le filon', max: 3, req: 1, txt: r => `${20 * r} % de chances de doubler le minerai` },
    { id: 'ramasseux', name: 'Ramasseux', max: 3, req: 2, txt: r => `${15 * r} % de chances de récupérer un bloc de plus` },
    { id: 'contremaitre', name: 'Contremaître', max: 1, req: 4, txt: () => 'Les blocs fabriqués à l’établi sont doublés' },
  ] },
];
export const TAL = {}; for (const b of TALENTS) for (const t of b.list) TAL[t.id] = Object.assign({ branch: b.key }, t);
export const spentIn = (S, key) => TALENTS.find(b => b.key === key).list.reduce((a, t) => a + ((S.tal || {})[t.id] || 0), 0);
export const spent = S => Object.values(S.tal || {}).reduce((a, n) => a + n, 0);
export const points = S => Math.max(0, S.lvl - 1 - spent(S));
export function canLearn(S, id) { const t = TAL[id], r = (S.tal || {})[id] || 0; return points(S) > 0 && r < t.max && spentIn(S, t.branch) >= t.req; }
// effets cumulés (multiplicateurs ajoutés à 1, sauf indication)
export function talentFx(S) {
  const r = id => (S.tal || {})[id] || 0;
  return { dmg: 0.08 * r('force'), crit: 0.05 * r('crit'), hp: 0.08 * r('castor'), patin: r('patin') > 0,
    spd: 0.04 * r('jambes'), runCost: 1 - 0.1 * r('jambes'), food: 0.2 * r('estomac'), luck: 0.03 * r('chance'), cash: 0.1 * r('chance'), gardien: r('gardien') > 0,
    mine: 0.25 * r('pioche'), ore: 0.2 * r('filon'), extra: 0.15 * r('ramasseux'), foreman: r('contremaitre') > 0 };
}
