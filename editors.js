/**
 * Parameter dock (the seven chips) and the parameter editors.
 * Editors are built once per activation and then updated in place, so drags
 * and text input keep working while the map responds live.
 */
import { h, clear, icon, escapeHtml } from './dom.js';
import { ICONS } from './icons.js';
import {
  PARAM_ORDER, PARAM_META, FLEX, BUDGET_BASIS, BUDGET_RANGE, MODES,
  CULTURE_LEVELS, COMFORT_LEVELS, DISTANCE_LIMITS,
} from '../engine/params.js';
import { travelWindow, today, addDays, formatRange } from '../engine/season.js';
import { MONTHS } from '../data/destinations.js';
import { ORIGINS } from '../data/origins.js';
import { euros } from '../engine/cost.js';
import { NEEDS_ORIGIN, originById, failedBy } from '../engine/suitability.js';
import * as store from '../store.js';

const HORIZON = 365;

/* ─────────────────────────── Dock ─────────────────────────── */

export function chipValue(key, p) {
  const v = p[key];
  if (!v.set) return key === 'dates' ? 'Any time' : 'Add';
  switch (key) {
    case 'dates': {
      const w = travelWindow(v);
      const a = w.start, b = w.end;
      return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
    }
    case 'origin': { const o = originById(v.id); return o ? o.name.split(' /')[0] : 'Add'; }
    case 'budget': return `${euros(v.amount)}${v.basis === 'daily' ? '/day' : v.basis === 'total' ? ' all' : ' pp'}`;
    case 'transport': return v.modes.length === 1 ? MODES.find((m) => m.id === v.modes[0]).label : `${v.modes.length} ways`;
    case 'culture': return ['Familiar', 'Bit new', 'Very new', 'All new'][v.level];
    case 'comfort': return ['Simple', 'Balanced', 'Comfy', 'Premium'][v.level];
    case 'distance': return DISTANCE_LIMITS.find((d) => d.id === v.limit).label;
    default: return '';
  }
}

export function renderDock(el, state) {
  const focusedKey = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.param;
  clear(el);
  for (const key of PARAM_ORDER) {
    const p = state.params[key];
    const isActive = state.active === key;
    const btn = h('button', {
      class: `chip${isActive ? ' is-active' : ''}${p.set ? ' is-set' : ''}`,
      'data-param': key,
      role: 'tab',
      'aria-selected': isActive ? 'true' : 'false',
      'aria-controls': 'editor',
      'aria-label': `${PARAM_META[key].title}: ${chipValue(key, state.params)}${isActive ? ' (showing on map)' : ''}`,
      onclick: () => store.setActive(key),
    },
    h('span', { class: 'chip-icon' }, icon(ICONS[key])),
    h('span', { class: 'chip-label' }, PARAM_META[key].label),
    h('span', { class: 'chip-value' }, chipValue(key, state.params)));
    el.appendChild(btn);
  }
  if (focusedKey) { const f = el.querySelector(`[data-param="${focusedKey}"]`); if (f) f.focus(); }
}

/* ─────────────────────────── Editor frame ─────────────────────────── */

let current = null; // { key, update }

export function renderEditor(el, state, ctx) {
  const key = state.active;
  el.classList.toggle('open', state.editorOpen && !state.sheetMode);
  if (!current || current.key !== key || !el.firstChild) {
    clear(el);
    const factory = EDITORS[key];
    const body = h('div', { class: 'editor-body' });
    const clearBtn = h('button', { class: 'text-btn clear-btn', onclick: () => store.clearParam(key) }, key === 'dates' ? 'Any time' : 'Clear');
    const header = h('div', { class: 'editor-head' },
      h('span', { class: 'editor-icon' }, icon(ICONS[key])),
      h('div', { class: 'editor-titles' },
        h('h2', { class: 'editor-title', id: 'editor-title' }, PARAM_META[key].title),
        h('p', { class: 'editor-changes' }, PARAM_META[key].changes)),
      clearBtn,
      h('button', { class: 'icon-btn', 'aria-label': 'Hide editor', onclick: () => store.setEditorOpen(false) }, icon(ICONS.chevronDown)));
    const originNote = h('div', { class: 'origin-note', hidden: true },
      h('span', null, 'Measured from your starting point.'),
      h('button', { class: 'pill-btn', onclick: () => store.setActive('origin') }, 'Choose starting point'));
    el.setAttribute('aria-labelledby', 'editor-title');
    el.append(header, originNote, body);
    const inst = factory(body, state, ctx);
    current = {
      key,
      update: (s, c) => {
        clearBtn.hidden = !s.params[key].set;
        originNote.hidden = !(NEEDS_ORIGIN.has(key) && key !== 'origin' && !s.params.origin.set);
        inst.update(s, c);
      },
    };
  }
  current.update(state, ctx);
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function segmented(name, options, getValue, onPick) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': name });
  const buttons = options.map((o) => {
    const b = h('button', { class: 'seg', role: 'radio', 'data-id': String(o.id), onclick: () => onPick(o.id) }, o.label);
    wrap.appendChild(b);
    return b;
  });
  wrap.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const i = options.findIndex((o) => String(o.id) === String(getValue()));
    const n = (i + (ev.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onPick(options[n].id);
    setTimeout(() => buttons[n].focus(), 0);
    ev.preventDefault();
  });
  return {
    el: wrap,
    update() {
      const v = String(getValue());
      buttons.forEach((b) => {
        const on = b.dataset.id === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    },
  };
}

function optionList(name, options, getValue, onPick) {
  const wrap = h('div', { class: 'option-list', role: 'radiogroup', 'aria-label': name });
  const buttons = options.map((o) => {
    const b = h('button', { class: 'option', role: 'radio', 'data-id': String(o.id), onclick: () => onPick(o.id) },
      h('span', { class: 'option-dot' }),
      h('span', { class: 'option-text' }, h('strong', null, o.label), h('small', null, o.hint || '')));
    wrap.appendChild(b);
    return b;
  });
  wrap.addEventListener('keydown', (ev) => {
    if (!['ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    const i = options.findIndex((o) => String(o.id) === String(getValue()));
    const n = Math.max(0, Math.min(options.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
    onPick(options[n].id);
    setTimeout(() => buttons[n].focus(), 0);
    ev.preventDefault();
  });
  return {
    el: wrap,
    update(isSet) {
      const v = String(getValue());
      buttons.forEach((b) => {
        const on = isSet && b.dataset.id === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    },
  };
}

function rafThrottle(fn) {
  let args = null, pending = false;
  return (...a) => {
    args = a;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fn(...args); });
  };
}

/* ─────────────────────────── 1 · Dates ─────────────────────────── */

function datesEditor(body) {
  const base = today();
  const summary = h('div', { class: 'big-value' });
  const sub = h('div', { class: 'value-sub' });
  const bars = h('div', { class: 'tl-bars', 'aria-hidden': 'true' });
  const monthsRow = h('div', { class: 'tl-months', 'aria-hidden': 'true' });
  const flexBand = h('div', { class: 'tl-flex' });
  const band = h('div', {
    class: 'tl-band', role: 'slider', tabindex: 0,
    'aria-label': 'Travel window. Use arrow keys to move by a day, Page Up and Page Down to move by a week.',
    'aria-valuemin': 0, 'aria-valuemax': HORIZON,
  });
  const track = h('div', { class: 'tl-track' }, bars, flexBand, band, monthsRow);
  const legend = h('p', { class: 'micro' }, 'Drag the window or tap a month. Bars show how many places are at their best each month, given your other choices.');

  // months strip
  const monthStarts = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const off = Math.round((d - base) / 86400000);
    if (off >= HORIZON) break;
    monthStarts.push({ d, off: Math.max(0, off) });
  }
  monthStarts.forEach((m, i) => {
    const next = monthStarts[i + 1] ? monthStarts[i + 1].off : HORIZON;
    const narrow = (next - m.off) < 20;
    const btn = h('button', {
      class: `tl-month${narrow ? ' narrow' : ''}`, tabindex: -1, 'aria-hidden': 'true',
      style: { left: `${(m.off / HORIZON) * 100}%`, width: `${((next - m.off) / HORIZON) * 100}%` },
      onclick: (ev) => {
        ev.stopPropagation();
        const p = store.getState().params.dates;
        const start = Math.min(HORIZON - p.nights, Math.max(0, m.off + (i === 0 ? 3 : 7)));
        store.updateParam('dates', { start });
      },
    }, MONTHS[m.d.getMonth()], m.d.getMonth() === 0 ? h('small', { class: 'yr' }, ` ’${String(m.d.getFullYear()).slice(2)}`) : null);
    monthsRow.appendChild(btn);
    const bar = h('div', { class: 'tl-bar', style: { left: `${(m.off / HORIZON) * 100}%`, width: `${((next - m.off) / HORIZON) * 100}%` } }, h('i'));
    bars.appendChild(bar);
  });

  // drag
  let drag = null;
  const setFromX = rafThrottle((clientX) => {
    const r = track.getBoundingClientRect();
    const p = store.getState().params.dates;
    const day = Math.round(((clientX - r.left) / r.width) * HORIZON - (drag ? drag.grab : p.nights / 2));
    const start = Math.max(0, Math.min(HORIZON - p.nights, day));
    if (start !== p.start || !p.set) store.updateParam('dates', { start });
  });
  track.addEventListener('pointerdown', (ev) => {
    if (ev.target.classList.contains('tl-month')) return;
    const r = track.getBoundingClientRect();
    const p = store.getState().params.dates;
    const dayAt = ((ev.clientX - r.left) / r.width) * HORIZON;
    const onBand = ev.target === band;
    drag = { grab: onBand ? dayAt - p.start : p.nights / 2 };
    track.setPointerCapture(ev.pointerId);
    track.classList.add('dragging');
    setFromX(ev.clientX);
  });
  track.addEventListener('pointermove', (ev) => { if (drag) setFromX(ev.clientX); });
  const end = () => { drag = null; track.classList.remove('dragging'); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  band.addEventListener('keydown', (ev) => {
    const p = store.getState().params.dates;
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: 7, PageDown: -7, Home: -HORIZON, End: HORIZON }[ev.key];
    if (step == null) return;
    ev.preventDefault();
    store.updateParam('dates', { start: Math.max(0, Math.min(HORIZON - p.nights, p.start + step)) });
  });

  // nights + flex
  const nightsOut = h('output', { class: 'num' });
  const nights = h('input', {
    type: 'range', min: 2, max: 28, step: 1, 'aria-label': 'Trip length in nights',
    oninput: (ev) => {
      const n = Number(ev.target.value);
      const p = store.getState().params.dates;
      store.updateParam('dates', { nights: n, start: Math.min(p.start, HORIZON - n) });
    },
  });
  const flex = segmented('Date flexibility', FLEX, () => store.getState().params.dates.flex, (id) => store.updateParam('dates', { flex: id }));

  const moreSummary = h('span', { class: 'more-sum' });
  const more = h('details', { class: 'more', open: window.matchMedia('(min-width: 900px)').matches },
    h('summary', null, h('span', null, 'Trip length & flexibility'), moreSummary),
    h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Trip length ', nightsOut), nights),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How flexible are you?'), flex.el));
  body.append(
    h('div', { class: 'value-row' }, summary, sub),
    track, legend, more,
  );

  return {
    update(state, ctx) {
      const p = state.params.dates;
      const w = travelWindow(p);
      summary.textContent = p.set ? formatRange(w.start, w.end) : 'Any time of year';
      sub.textContent = p.set
        ? (w.flex.id === 'exact' ? 'Exact dates' : `Flexible: ${formatRange(w.from, w.to)}`)
        : 'Showing year-round appeal. Move the window to pick a time.';
      band.style.left = `${(p.start / HORIZON) * 100}%`;
      band.style.width = `${Math.max(0.8, (p.nights / HORIZON) * 100)}%`;
      band.setAttribute('aria-valuenow', p.start);
      band.setAttribute('aria-valuetext', formatRange(w.start, w.end));
      band.classList.toggle('inactive', !p.set);
      const fFrom = Math.round((w.from - base) / 86400000), fTo = Math.round((w.to - base) / 86400000);
      flexBand.style.left = `${(fFrom / HORIZON) * 100}%`;
      flexBand.style.width = `${((fTo - fFrom) / HORIZON) * 100}%`;
      flexBand.hidden = !p.set || w.flex.id === 'exact';
      nights.value = p.nights;
      nightsOut.textContent = `${p.nights} nights`;
      moreSummary.textContent = `${p.nights} nights · ${w.flex.label.toLowerCase()}`;
      flex.update();
      // month histogram among places that survive the other constraints
      const counts = monthStarts.map((m) => {
        const mi = m.d.getMonth();
        let n = 0;
        for (const e of ctx.evals.values()) {
          if (failedBy(e, 'dates').length) continue;
          if (e.dest.season[mi] === '3') n++;
        }
        return n;
      });
      const max = Math.max(1, ...counts);
      [...bars.children].forEach((b, i) => {
        b.firstChild.style.height = `${(counts[i] / max) * 100}%`;
        b.title = `${counts[i]} places at their best`;
      });
    },
  };
}

/* ─────────────────────────── 2 · Origin ─────────────────────────── */

function originEditor(body) {
  const selected = h('div', { class: 'selected-origin' });
  const input = h('input', {
    type: 'search', class: 'search', placeholder: 'City, country or airport code',
    'aria-label': 'Search departure city or airport', autocomplete: 'off', enterkeyhint: 'search',
  });
  const results = h('ul', { class: 'results', role: 'listbox', 'aria-label': 'Matching starting points' });
  const locate = h('button', { class: 'text-btn locate-btn', onclick: useLocation }, icon(ICONS.locate, 'icon sm'), 'Use my location');
  const note = h('p', { class: 'micro' }, `${ORIGINS.length} departure cities in this prototype. Location is only used if you tap “Use my location”, and only to pick the nearest city.`);

  function pick(o) {
    store.updateParam('origin', { id: o.id, set: true });
    input.value = '';
    renderResults();
  }

  function renderResults() {
    const q = input.value.trim().toLowerCase();
    clear(results);
    if (!q) return;
    const matches = ORIGINS.filter((o) => `${o.name} ${o.country} ${o.codes}`.toLowerCase().includes(q)).slice(0, 6);
    if (!matches.length) {
      results.appendChild(h('li', { class: 'empty' }, 'No match in this prototype’s list — try a nearby major city.'));
      return;
    }
    matches.forEach((o, i) => results.appendChild(h('li', { role: 'option' },
      h('button', { class: 'result', 'data-i': i, onclick: () => pick(o) },
        h('strong', null, o.name), h('span', null, `${o.country} · ${o.codes}`)))));
  }
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { const first = results.querySelector('button'); if (first) first.click(); }
    if (ev.key === 'ArrowDown') { const first = results.querySelector('button'); if (first) { first.focus(); ev.preventDefault(); } }
  });
  results.addEventListener('keydown', (ev) => {
    const btns = [...results.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown' && i < btns.length - 1) { btns[i + 1].focus(); ev.preventDefault(); }
    if (ev.key === 'ArrowUp') { (i > 0 ? btns[i - 1] : input).focus(); ev.preventDefault(); }
  });

  function useLocation() {
    if (!navigator.geolocation) { locate.textContent = 'Location not available on this device'; return; }
    locate.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      locate.disabled = false;
      const { latitude: lat, longitude: lon } = pos.coords;
      let best = null, bd = Infinity;
      for (const o of ORIGINS) {
        const d = (o.lat - lat) ** 2 + ((o.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) pick(best);
    }, () => { locate.disabled = false; locate.lastChild.textContent = 'Location permission declined — search instead'; }, { timeout: 8000, maximumAge: 600000 });
  }

  const quick = h('div', { class: 'quick' });
  ['london', 'berlin', 'paris', 'amsterdam-o', 'madrid', 'newyork-o', 'dubai-o', 'singapore'].forEach((id) => {
    const o = ORIGINS.find((x) => x.id === id);
    quick.appendChild(h('button', { class: 'pill-btn', onclick: () => pick(o) }, o.name));
  });

  body.append(selected, h('div', { class: 'search-wrap' }, input, results), quick, locate, note);

  return {
    update(state) {
      const o = state.params.origin.set ? originById(state.params.origin.id) : null;
      clear(selected);
      if (o) {
        selected.append(
          h('div', { class: 'big-value' }, o.name),
          h('div', { class: 'value-sub' }, `${o.country} · ${o.codes} · journeys and costs are now estimated from here`));
      } else {
        selected.append(h('div', { class: 'big-value muted' }, 'Where would you set off from?'));
      }
      quick.hidden = !!o;
    },
  };
}

/* ─────────────────────────── 3 · Budget ─────────────────────────── */

function budgetEditor(body) {
  const amount = h('div', { class: 'big-value' });
  const sub = h('div', { class: 'value-sub' });
  const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' });
  const slider = h('input', {
    type: 'range', 'aria-label': 'Budget amount in euros',
    oninput: (ev) => store.updateParam('budget', { amount: Number(ev.target.value) }),
  });
  const basis = segmented('What the budget covers', BUDGET_BASIS, () => store.getState().params.budget.basis, (id) => {
    const st = store.getState();
    const b = st.params.budget;
    if (id === b.basis) return;
    const nights = st.params.dates.set ? st.params.dates.nights : 7;
    // convert the current amount roughly, so switching basis doesn't jump wildly
    const perPerson = b.basis === 'total' ? b.amount / b.travelers : b.basis === 'daily' ? b.amount * nights * 1.25 : b.amount;
    let next = id === 'daily' ? (perPerson / nights) * 0.8 : id === 'total' ? perPerson * b.travelers : perPerson;
    const r = BUDGET_RANGE[id];
    next = Math.round(Math.min(r.max, Math.max(r.min, next)) / r.step) * r.step;
    store.updateParam('budget', { basis: id, amount: next });
  });
  const basisHint = h('p', { class: 'micro' });
  const travOut = h('output', { class: 'num' });
  const trav = h('div', { class: 'stepper' },
    h('button', { class: 'icon-btn', 'aria-label': 'Fewer travellers', onclick: () => { const b = store.getState().params.budget; store.updateParam('budget', { travelers: Math.max(1, b.travelers - 1) }); } }, icon(ICONS.minus)),
    travOut,
    h('button', { class: 'icon-btn', 'aria-label': 'More travellers', onclick: () => { const b = store.getState().params.budget; store.updateParam('budget', { travelers: Math.min(8, b.travelers + 1) }); } }, icon(ICONS.plus)));
  const travField = h('div', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Travelling together'), trav);
  const assumptions = h('p', { class: 'micro assumptions' });

  body.append(
    h('div', { class: 'value-row' }, amount, sub),
    h('div', { class: 'slider-wrap' }, ticks, slider),
    h('div', { class: 'field' }, basis.el, basisHint),
    travField,
    assumptions,
  );

  return {
    update(state, ctx) {
      const b = state.params.budget;
      const r = BUDGET_RANGE[b.basis];
      slider.min = r.min; slider.max = r.max; slider.step = r.step; slider.value = b.amount;
      slider.setAttribute('aria-valuetext', euros(b.amount));
      amount.textContent = `${euros(b.amount)}`;
      basis.update();
      basisHint.textContent = BUDGET_BASIS.find((x) => x.id === b.basis).hint;
      travField.hidden = b.basis !== 'total';
      travOut.textContent = `${b.travelers} ${b.travelers === 1 ? 'person' : 'people'}`;
      let fit = 0, total = 0;
      clear(ticks);
      for (const e of ctx.evals.values()) {
        if (failedBy(e, 'budget').length) continue;
        total++;
        const v = b.basis === 'daily' ? e.cost.perDay : b.basis === 'total' ? e.cost.group : e.cost.perPerson;
        if (v <= b.amount) fit++;
        const x = Math.max(0, Math.min(1, (v - r.min) / (r.max - r.min)));
        ticks.appendChild(h('i', { class: v <= b.amount ? 'in' : '', style: { left: `${x * 100}%` } }));
      }
      sub.textContent = b.set ? `${fit} of ${total} places fit${state.params.origin.set ? '' : ' (before travel costs)'}` : 'Not applied yet';
      const nights = state.params.dates.set ? state.params.dates.nights : 7;
      assumptions.textContent = `Illustrative estimates, not prices: ${nights} nights${state.params.dates.set ? '' : ' (assumed)'}, ${COMFORT_LEVELS[state.params.comfort.set ? state.params.comfort.level : 1].label.toLowerCase()} comfort, sharing a double room${state.params.origin.set ? ', plus a rough round-trip fare' : '; travel there not included until you choose a starting point'}. Each tick is a place.`;
    },
  };
}

/* ─────────────────────────── 4 · Transport ─────────────────────────── */

function transportEditor(body) {
  const grid = h('div', { class: 'mode-grid', role: 'group', 'aria-label': 'Ways of travelling' });
  const btns = MODES.map((m) => {
    const b = h('button', {
      class: 'mode', 'data-id': m.id, 'aria-pressed': 'false',
      onclick: () => {
        const t = store.getState().params.transport;
        const has = t.modes.includes(m.id);
        const modes = has ? t.modes.filter((x) => x !== m.id) : [...t.modes, m.id];
        if (!modes.length) store.clearParam('transport');
        else store.updateParam('transport', { modes });
      },
    }, icon(ICONS[m.id]), h('span', null, m.label));
    grid.appendChild(b);
    return b;
  });
  const status = h('p', { class: 'value-sub' });
  body.append(grid, status,
    h('p', { class: 'micro' }, 'Ferry adds sea crossings to car and coach routes. Availability comes from a simplified network model — a route is never assumed just because places are close. Always check real timetables.'));
  return {
    update(state, ctx) {
      const t = state.params.transport;
      btns.forEach((b) => {
        const on = t.set && t.modes.includes(b.dataset.id);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (!t.set) status.textContent = 'Any way of travelling. Pick one or more to narrow it down.';
      else if (!state.params.origin.set) status.textContent = 'Choose a starting point to see what these reach.';
      else {
        let n = 0;
        for (const e of ctx.evals.values()) if (e.allowed.length) n++;
        status.textContent = `${n} of ${ctx.evals.size} places are plausibly reachable this way.`;
      }
    },
  };
}

/* ─────────────────────────── 5 · Culture ─────────────────────────── */

function cultureEditor(body) {
  const list = optionList('How different should it feel?', CULTURE_LEVELS, () => store.getState().params.culture.level, (id) => store.updateParam('culture', { level: id }));
  const how = h('details', { class: 'how' },
    h('summary', null, 'How is this estimated?'),
    h('p', null, 'A rough, exploratory comparison between your starting point and each place across four everyday dimensions: language family, writing system, food traditions and everyday customs. It is not a ranking of cultures, and it can’t know your own background or experience — treat it as a prompt, not a verdict.'));
  body.append(list.el, how);
  return { update(state) { list.update(state.params.culture.set); } };
}

/* ─────────────────────────── 6 · Comfort ─────────────────────────── */

function comfortEditor(body) {
  const list = optionList('Travel style', COMFORT_LEVELS, () => store.getState().params.comfort.level, (id) => store.updateParam('comfort', { level: id }));
  const note = h('p', { class: 'micro' });
  body.append(list.el, note);
  return {
    update(state) {
      list.update(state.params.comfort.set);
      const c = COMFORT_LEVELS[state.params.comfort.level];
      note.textContent = `Comfort considers logistics (remoteness, altitude, long transfers) and journey length, not only luxury. ${c.label}: costs × ${c.mult}, journeys up to about ${c.journeyTol} h feel fine.`;
    },
  };
}

/* ─────────────────────────── 7 · Distance ─────────────────────────── */

function distanceEditor(body) {
  const value = h('div', { class: 'big-value' });
  const sub = h('div', { class: 'value-sub' });
  const steps = h('div', { class: 'steps', role: 'radiogroup', 'aria-label': 'Maximum journey' });
  const btns = DISTANCE_LIMITS.map((d) => {
    const b = h('button', { class: 'step', role: 'radio', 'data-id': d.id, onclick: () => store.updateParam('distance', { limit: d.id }) }, h('i'), h('span', null, d.label));
    steps.appendChild(b);
    return b;
  });
  steps.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const cur = DISTANCE_LIMITS.findIndex((d) => d.id === store.getState().params.distance.limit);
    const n = Math.max(0, Math.min(DISTANCE_LIMITS.length - 1, cur + (ev.key === 'ArrowRight' ? 1 : -1)));
    store.updateParam('distance', { limit: DISTANCE_LIMITS[n].id });
    setTimeout(() => btns[n].focus(), 0);
    ev.preventDefault();
  });
  body.append(h('div', { class: 'value-row' }, value, sub), steps,
    h('p', { class: 'micro' }, 'Measured as estimated door-to-door journey time, one way, using the fastest way you allow — not straight-line distance.'));
  return {
    update(state, ctx) {
      const d = state.params.distance;
      const lim = DISTANCE_LIMITS.find((x) => x.id === d.limit);
      value.textContent = lim.label;
      let n = 0;
      if (state.params.origin.set) for (const e of ctx.evals.values()) if (e.withinRange) n++;
      sub.textContent = state.params.origin.set ? `${lim.hint} · ${n} places in range` : lim.hint;
      const idx = DISTANCE_LIMITS.indexOf(lim);
      btns.forEach((b, i) => {
        const on = d.set && i === idx;
        b.classList.toggle('on', on);
        b.classList.toggle('within', d.set && i <= idx);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = i === idx ? 0 : -1;
      });
    },
  };
}

const EDITORS = {
  dates: datesEditor,
  origin: originEditor,
  budget: budgetEditor,
  transport: transportEditor,
  culture: cultureEditor,
  comfort: comfortEditor,
  distance: distanceEditor,
};

export { escapeHtml, addDays };
