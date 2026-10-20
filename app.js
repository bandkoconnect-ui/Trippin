/**
 * Trippin — application shell. Wires state → evaluation → encodings → views.
 */
import * as store from './store.js';
import { loadWorld } from './data/world.js';
import { DESTINATIONS } from './data/destinations.js';
import { evaluate, encode, caption, rankOf } from './engine/suitability.js';
import { monthWeights } from './engine/season.js';
import { createMap } from './ui/map.js';
import { renderDock, renderEditor } from './ui/editors.js';
import { renderCaption } from './ui/caption.js';
import { renderSheet } from './ui/sheet.js';
import { renderBrief } from './ui/brief.js';
import { h, icon, toast } from './ui/dom.js';
import { ICONS } from './ui/icons.js';

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'), map: $('map'), dock: $('dock'), editor: $('editor'), caption: $('caption'),
  sheet: $('sheet'), brief: $('brief'), briefBtn: $('briefBtn'), status: $('mapstatus'), zoom: $('zoomctl'),
};

// Drop shortlisted ids that no longer exist in the data.
{
  const s = store.getState();
  const ids = new Set(DESTINATIONS.map((d) => d.id));
  s.shortlist = s.shortlist.filter((id) => ids.has(id));
  s.compare = s.compare.filter((id) => ids.has(id));
}

let ctx = null;

function compute(state) {
  const result = evaluate(state.params);
  const encoded = new Map();
  for (const [id, e] of result.map) encoded.set(id, encode(e, state.active, state.params));
  // country-level colour = best place in that country
  const byIso = new Map();
  for (const [id, enc] of encoded) {
    const dest = result.map.get(id).dest;
    const cur = byIso.get(dest.iso);
    if (!cur || rankOf(enc) < rankOf(cur.enc)) byIso.set(dest.iso, { enc, dest });
  }
  const cap = caption(state.params, state.active, result, encoded);
  return { result, evals: result.map, encoded, byIso, cap, weights: result.win ? monthWeights(result.win) : null };
}

/* ─────────────────────────── Map ─────────────────────────── */

const map = createMap(els.map, {
  onSelect: (id) => store.select(id),
  onCountry: (iso, name) => {
    if (!ctx) return;
    const options = [...ctx.encoded.entries()].filter(([id]) => ctx.evals.get(id).dest.iso === iso);
    if (!options.length) {
      toast(`${name || 'This country'} isn’t in Trippin’s curated set yet — ${DESTINATIONS.length} places are.`);
      return;
    }
    options.sort((a, b) => rankOf(a[1]) - rankOf(b[1]));
    store.select(options[0][0]);
  },
  onBackground: () => { if (store.getState().sheetMode) store.closeSheet(); },
});

function insets() {
  const W = window.innerWidth, H = window.innerHeight;
  const wide = W >= 900;
  const top = (els.caption.getBoundingClientRect().bottom || 0) + 8;
  if (wide) {
    const sheetOpen = !!store.getState().sheetMode;
    return { top: 16, left: 410, right: sheetOpen ? 440 : 70, bottom: 100 };
  }
  const st = store.getState();
  const sheetH = st.sheetMode ? Math.round(H * 0.6) : 0;
  // use untransformed heights: the editor may be mid-transition when we measure
  const dockH = els.dock.offsetHeight;
  const editorH = st.editorOpen && !st.sheetMode ? els.editor.offsetHeight : 0;
  const lower = sheetH || dockH + editorH;
  return { top: Math.min(top, H * 0.35), left: 8, right: 8, bottom: lower + 8 };
}

/* ─────────────────────────── Render ─────────────────────────── */

let prevSelected = null;
let prevSheetMode = null;
let prevOrigin = null;

function render(state, change = {}) {
  ctx = compute(state);
  ctx.cap && (ctx.result.cap = ctx.cap);
  document.body.classList.toggle('has-sheet', !!state.sheetMode);
  document.body.classList.toggle('view-brief', state.view === 'brief');
  renderDock(els.dock, state);
  renderEditor(els.editor, state, ctx);
  document.body.classList.toggle('has-editor', state.editorOpen && !state.sheetMode);
  renderCaption(els.caption, state, ctx.cap);
  map.update({
    encoded: ctx.encoded, evals: ctx.evals, byIso: ctx.byIso,
    selected: state.sheetMode === 'place' ? state.selected : null,
    selectedIso: state.sheetMode === 'place' && state.selected ? ctx.evals.get(state.selected).dest.iso : null,
    origin: ctx.result.origin, active: state.active,
  });
  renderSheet(els.sheet, state, { ...ctx, result: ctx.result });
  renderBrief(els.brief, state, ctx);
  const n = state.shortlist.length;
  els.briefBtn.querySelector('.count').textContent = n ? String(n) : '';
  els.briefBtn.setAttribute('aria-label', `Shortlist and trip brief${n ? `, ${n} saved` : ''}`);

  // camera
  const sel = state.sheetMode === 'place' ? state.selected : null;
  if (sel && sel !== prevSelected) {
    requestAnimationFrame(() => map.focus(ctx.evals.get(sel).dest, insets()));
    const fromMarker = document.activeElement && document.activeElement.closest && document.activeElement.closest('.marker, .list-row');
    if (fromMarker) setTimeout(() => { const t = els.sheet.querySelector('.place-name'); if (t) { t.tabIndex = -1; t.focus(); } }, 50);
  } else if (!state.sheetMode && prevSheetMode === 'place') {
    map.restore();
  }
  if (state.sheetMode === 'list' && prevSheetMode !== 'list') map.forgetSaved();
  const originId = ctx.result.origin ? ctx.result.origin.id : null;
  if (change.type === 'param' && change.key === 'origin' && originId && originId !== prevOrigin && !state.sheetMode) {
    const o = ctx.result.origin;
    if (!isWide()) map.home([o.lon, Math.max(-20, Math.min(50, o.lat - 8))], insets());
  }
  prevOrigin = originId;
  prevSelected = sel;
  prevSheetMode = state.sheetMode;
}

store.subscribe(render);

/* ─────────────────────────── Chrome ─────────────────────────── */

els.briefBtn.addEventListener('click', () => store.setView('brief', 'shortlist'));
els.zoom.append(
  h('button', { class: 'icon-btn', 'aria-label': 'Zoom in', onclick: () => map.zoomBy(1.6) }, icon(ICONS.plus)),
  h('button', { class: 'icon-btn', 'aria-label': 'Zoom out', onclick: () => map.zoomBy(1 / 1.6) }, icon(ICONS.minus)),
  h('button', { class: 'icon-btn', 'aria-label': 'Show the whole world', onclick: () => map.home(homeCenter(), insets(), isWide()) }, icon(ICONS.home)),
);

function isWide() { return window.innerWidth >= 900; }

function homeCenter() {
  const o = ctx && ctx.result.origin;
  return o ? [o.lon, Math.max(-20, Math.min(50, o.lat - 8))] : [12, 28];
}

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const s = store.getState();
  if (s.view === 'brief') store.setView('map');
  else if (s.sheetMode) store.closeSheet();
  else if (s.editorOpen) store.setEditorOpen(false);
});

/* ─────────────────────────── Boot ─────────────────────────── */

function setStatus(kind, message, retry) {
  els.status.className = `map-status ${kind || ''}`;
  els.status.innerHTML = '';
  if (!kind) return;
  els.status.append(...[
    kind === 'loading' ? h('span', { class: 'spinner', 'aria-hidden': 'true' }) : null,
    h('span', null, message),
    retry ? h('button', { class: 'pill-btn', onclick: retry }, 'Try again') : null,
  ].filter(Boolean));
}

async function boot() {
  setStatus('loading', 'Unfolding the atlas…');
  try {
    const world = await loadWorld();
    map.setWorld(world);
    setStatus(null);
  } catch (err) {
    setStatus('error', 'Country outlines couldn’t load, so places are shown as points only.', () => boot());
  }
}

render(store.getState(), { type: 'init' });
requestAnimationFrame(() => map.home(homeCenter(), insets(), isWide()));
boot();

window.addEventListener('resize', () => { if (ctx) render(store.getState(), { type: 'resize' }); });
