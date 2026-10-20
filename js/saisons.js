// Saisons : quatre saisons de DAYS jours de jeu chacune (hiver, printemps, été, automne), fondues aux changements.
// Fonctions pures (testables) : la saison d'un jour, les réglages du nuanceur du terrain et la météo pondérée.
export const SAISONS = ['Hiver', 'Printemps', 'Été', 'Automne'], DAYS = 3, YEAR = 4 * DAYS;
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = d => ((d % YEAR) + YEAR) % YEAR;
export const seasonOf = d => Math.floor(wrap(d) / DAYS);
export const dayInSeason = d => Math.floor(wrap(d) % DAYS) + 1;
// d : jour continu (S.day + heure du jour). snow : neige au sol, ice : eau gelée, green : feuillage vert,
// fall : couleurs d'automne (bouleaux jaunes, herbe jaunie), fresh : herbe tendre du printemps.
export function seasonParams(d) {
  const p = wrap(d), k = Math.floor(p / DAYS), f = (p - k * DAYS) / DAYS;
  if (k === 0) return { k, f, snow: 1, ice: sm(0, 0.08, f), green: 0, fall: 1, fresh: 0 };
  if (k === 1) return { k, f, snow: 1 - sm(0.02, 0.3, f), ice: 1 - sm(0.12, 0.3, f), green: sm(0.25, 0.6, f), fall: 1 - sm(0.05, 0.4, f), fresh: sm(0.25, 0.55, f) };
  if (k === 2) return { k, f, snow: 0, ice: 0, green: 1, fall: 0, fresh: 1 - sm(0, 0.35, f) };
  return { k, f, snow: sm(0.86, 1, f), ice: 0, green: 1 - sm(0, 0.3, f), fall: sm(0, 0.3, f), fresh: 0 };
}
// tirage de la météo selon la saison : r ∈ [0, 1) → 'neige' | 'pluie' | 'beau'
export const WEATHER = [{ neige: 0.5, pluie: 0 }, { neige: 0.08, pluie: 0.38 }, { neige: 0, pluie: 0.22 }, { neige: 0.06, pluie: 0.3 }];
export function weatherPick(k, r) { const w = WEATHER[k]; return r < w.neige ? 'neige' : r < w.neige + w.pluie ? 'pluie' : 'beau'; }
// ambiance : lucioles et feuilles qui tombent (multiplicateurs)
export const FLIES = [0, 0.5, 1.6, 0.35], LEAVES = [0, 0, 0.25, 1];
