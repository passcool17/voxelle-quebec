// Plein écran (surtout mobile) : API Fullscreen (avec préfixes webkit), verrouillage paysage,
// repli iPhone (Safari ne permet pas le plein écran d'un élément : on suggère « Ajouter à l'écran d'accueil »).
const D = document, EL = D.documentElement;
const req = EL.requestFullscreen || EL.webkitRequestFullscreen || EL.webkitRequestFullScreen;
const exitF = D.exitFullscreen || D.webkitExitFullscreen || D.webkitCancelFullScreen;
const ua = navigator.userAgent;
export const isIOS = /iPhone|iPod|iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// déjà lancé depuis l'écran d'accueil (manifest display: fullscreen / apple-mobile-web-app-capable)
export const standalone = !!navigator.standalone || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;
const enabled = D.fullscreenEnabled !== undefined ? D.fullscreenEnabled : D.webkitFullscreenEnabled !== undefined ? D.webkitFullscreenEnabled : !!req;
export const supported = !!req && enabled !== false;
export const isFull = () => !!(D.fullscreenElement || D.webkitFullscreenElement || D.webkitCurrentFullScreenElement);
// 'api' : bouton bascule ; 'ios' : bouton qui montre l'astuce écran d'accueil ; 'none' : pas de bouton
export const mode = standalone ? 'none' : supported ? 'api' : isIOS ? 'ios' : 'none';
export const HINT = 'Ajoute à l’écran d’accueil pour le plein écran (Partager → Sur l’écran d’accueil)';

function lockLandscape() {
  try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* non pris en charge */ }
}
export async function enter() {
  if (!supported || isFull()) return isFull();
  try { const r = req.call(EL, { navigationUI: 'hide' }); if (r && r.then) await r; } catch (e) { return false; }
  lockLandscape(); return isFull();
}
export async function exit() {
  if (!isFull() || !exitF) return;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* rien */ }
  try { const r = exitF.call(D); if (r && r.then) await r; } catch (e) { /* rien */ }
}
export const toggle = () => isFull() ? exit() : enter();
// icônes pixel (coins « agrandir » / « réduire »)
const ICON_IN = '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>';
const ICON_OUT = '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"/></svg>';
const ICON_IOS = '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M8 1v9M5 4l3-3 3 3M4 7H2v8h12V7h-2"/></svg>';
// branche les boutons ; onChange est appelé à chaque entrée/sortie (redimensionnement du rendu)
export function setup(buttons, { hint, onChange } = {}) {
  const paint = () => { const f = isFull(); for (const b of buttons) { if (!b) continue; if (b.classList.contains('fsb')) b.innerHTML = mode === 'ios' ? ICON_IOS : f ? ICON_OUT : ICON_IN; else b.textContent = mode === 'ios' ? 'PLEIN ÉCRAN (ÉCRAN D’ACCUEIL)' : f ? 'QUITTER LE PLEIN ÉCRAN' : 'PLEIN ÉCRAN'; b.title = mode === 'ios' ? 'Plein écran' : f ? 'Quitter le plein écran' : 'Plein écran'; b.setAttribute('aria-pressed', f ? 'true' : 'false'); b.classList.toggle('on', f); } };
  for (const b of buttons) {
    if (!b) continue;
    if (mode === 'none') { b.classList.add('hidden'); continue; }
    b.classList.remove('hidden'); b.dataset.fs = mode;
    b.addEventListener('click', e => { e.stopPropagation(); if (mode === 'ios') { if (hint) hint(HINT); } else toggle(); });
    b.addEventListener('pointerdown', e => e.stopPropagation());
  }
  const ch = () => { paint(); if (onChange) { onChange(isFull()); setTimeout(() => onChange(isFull()), 250); } }; // la taille finale arrive parfois après l'événement
  D.addEventListener('fullscreenchange', ch); D.addEventListener('webkitfullscreenchange', ch);
  paint();
}
