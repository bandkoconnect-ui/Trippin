/**
 * Application state: the seven parameters, which one is active, the selected
 * place, the shortlist and the current view. A tiny observable store with
 * localStorage persistence (wrapped in try/catch — storage can be unavailable).
 */
import { defaultParams, blankParam, PARAM_ORDER } from './engine/params.js';
import { today, addDays } from './engine/season.js';

const KEY = 'trippin.v1';
const listeners = new Set();

const state = {
  params: defaultParams(),
  active: 'dates',
  editorOpen: true,
  selected: null,
  sheetMode: null, // 'place' | 'list' | null
  shortlist: [],
  compare: [],
  view: 'map', // 'map' | 'brief'
  briefTab: 'shortlist',
};

load();

export function getState() { return state; }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function emit(change) {
  save();
  listeners.forEach((fn) => fn(state, change));
}

export function setActive(key) {
  if (state.active === key && state.editorOpen) { state.editorOpen = false; emit({ type: 'editor' }); return; }
  state.active = key;
  state.editorOpen = true;
  // Activating a parameter applies its current (default) value straight away,
  // so the map responds immediately. Clearing is always one tap away.
  if (!state.params[key].set && key !== 'origin') state.params[key].set = true;
  emit({ type: 'active' });
}

export function setEditorOpen(open) { state.editorOpen = open; emit({ type: 'editor' }); }

export function updateParam(key, patch) {
  state.params[key] = { ...state.params[key], ...patch, set: patch.set === undefined ? true : patch.set };
  emit({ type: 'param', key });
}

export function clearParam(key) {
  state.params[key] = blankParam(key);
  emit({ type: 'param', key, cleared: true });
}

export function select(id, mode = 'place') {
  state.selected = id;
  state.sheetMode = id ? mode : null;
  emit({ type: 'select' });
}

export function openList() { state.sheetMode = 'list'; state.selected = null; emit({ type: 'select' }); }
export function closeSheet() { state.selected = null; state.sheetMode = null; emit({ type: 'select' }); }

export function toggleShortlist(id) {
  const i = state.shortlist.indexOf(id);
  if (i >= 0) {
    state.shortlist.splice(i, 1);
    state.compare = state.compare.filter((x) => x !== id);
  } else state.shortlist.push(id);
  emit({ type: 'shortlist' });
  return i < 0;
}

export function toggleCompare(id) {
  if (!state.shortlist.includes(id)) state.shortlist.push(id);
  const i = state.compare.indexOf(id);
  if (i >= 0) state.compare.splice(i, 1);
  else {
    state.compare.push(id);
    if (state.compare.length > 3) state.compare.shift();
  }
  emit({ type: 'shortlist' });
}

export function setView(view, tab) {
  state.view = view;
  if (tab) state.briefTab = tab;
  emit({ type: 'view' });
}

/* ───────────── persistence ───────────── */
function save() {
  try {
    const p = JSON.parse(JSON.stringify(state.params));
    const sd = addDays(today(), p.dates.start);
    p.dates.startISO = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
    localStorage.setItem(KEY, JSON.stringify({ params: p, shortlist: state.shortlist, compare: state.compare, active: state.active }));
  } catch (e) { /* storage unavailable — fine */ }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const defs = defaultParams();
    for (const k of PARAM_ORDER) {
      if (saved.params && saved.params[k]) state.params[k] = { ...defs[k], ...saved.params[k] };
    }
    const d = state.params.dates;
    if (d.startISO) {
      const [y, m, day] = d.startISO.split('-').map(Number);
      const diff = Math.round((new Date(y, m - 1, day) - today()) / 86400000);
      d.start = Math.min(364, Math.max(0, diff));
      delete d.startISO;
    }
    if (Array.isArray(saved.shortlist)) state.shortlist = saved.shortlist;
    if (Array.isArray(saved.compare)) state.compare = saved.compare;
    if (saved.active && PARAM_ORDER.includes(saved.active)) state.active = saved.active;
  } catch (e) { /* ignore corrupt storage */ }
}

export function resetAll() {
  state.params = defaultParams();
  state.active = 'dates';
  state.selected = null;
  state.sheetMode = null;
  emit({ type: 'reset' });
}
