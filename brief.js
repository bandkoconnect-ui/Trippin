/** Shortlist, side-by-side comparison and the final trip-discovery brief. */
import { h, clear, icon, toast } from './dom.js';
import { ICONS } from './icons.js';
import { PARAM_ORDER, PARAM_META, BUDGET_BASIS, MODES, CULTURE_LEVELS, COMFORT_LEVELS, DISTANCE_LIMITS } from '../engine/params.js';
import { SEASON_LABELS, formatRange, isCaution, travelWindow } from '../engine/season.js';
import { formatHours } from '../engine/transport.js';
import { euros } from '../engine/cost.js';
import { originById, modeLabel } from '../engine/suitability.js';
import { whyNow, fitCounts, unknowns, cultureLabel, badge } from './describe.js';
import * as store from '../store.js';

export function renderBrief(el, state, ctx) {
  const open = state.view === 'brief';
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) return;
  clear(el);
  const tabs = [
    { id: 'shortlist', label: `Shortlist (${state.shortlist.length})` },
    { id: 'compare', label: 'Compare' },
    { id: 'brief', label: 'Trip brief' },
  ];
  const panel = h('div', { class: 'brief-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'brief-title' },
    h('header', { class: 'brief-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back to the map', onclick: () => store.setView('map') }, icon(ICONS.back)),
      h('h2', { id: 'brief-title' }, 'Your discovery'),
      h('span', { class: 'spacer' })),
    h('nav', { class: 'tabs', role: 'tablist' }, tabs.map((t) => h('button', {
      class: `tab${state.briefTab === t.id ? ' on' : ''}`, role: 'tab', 'aria-selected': state.briefTab === t.id ? 'true' : 'false',
      onclick: () => store.setView('brief', t.id),
    }, t.label))));
  const body = h('div', { class: 'brief-body' });
  panel.appendChild(body);
  el.appendChild(panel);
  if (state.briefTab === 'shortlist') shortlistTab(body, state, ctx);
  else if (state.briefTab === 'compare') compareTab(body, state, ctx);
  else briefTab(body, state, ctx);
  const focusTarget = panel.querySelector('.tab.on');
  if (focusTarget && !el.contains(document.activeElement)) focusTarget.focus();
}

function emptyShortlist(body) {
  body.appendChild(h('div', { class: 'empty-box' },
    h('strong', null, 'Nothing shortlisted yet.'),
    h('p', null, 'Tap a place on the map and choose “Shortlist” to keep it here. You can compare up to three side by side.'),
    h('button', { class: 'pill-btn accent', onclick: () => store.setView('map') }, 'Explore the map')));
}

/* ─────────────────────────── Shortlist ─────────────────────────── */

function shortlistTab(body, state, ctx) {
  if (!state.shortlist.length) return emptyShortlist(body);
  const ul = h('ul', { class: 'cards' });
  state.shortlist.forEach((id) => {
    const e = ctx.evals.get(id);
    if (!e) return;
    const f = fitCounts(e);
    const inCompare = state.compare.includes(id);
    ul.appendChild(h('li', { class: 'card' },
      h('div', { class: 'card-top' },
        h('div', null, h('span', { class: 'kicker' }, e.dest.country), h('h3', null, e.dest.name)),
        h('span', { class: 'fit-pill' }, f.total ? `${f.ok} of ${f.total} choices fit` : 'No choices set')),
      h('p', null, whyNow(e, state.params)),
      h('div', { class: 'card-facts' },
        h('span', null, `≈ ${euros(e.cost.perPerson)} pp`),
        e.best ? h('span', null, `≈ ${formatHours(e.best.hours)} by ${modeLabel(e.best.mode)}`) : null,
        state.params.dates.set ? h('span', null, SEASON_LABELS[e.season]) : null),
      h('div', { class: 'card-actions' },
        h('button', { class: 'pill-btn', onclick: () => { store.setView('map'); store.select(id); } }, 'Show on map'),
        h('button', { class: `pill-btn${inCompare ? ' on' : ''}`, 'aria-pressed': inCompare ? 'true' : 'false', onclick: () => store.toggleCompare(id) }, inCompare ? 'In comparison' : 'Compare'),
        h('button', { class: 'link-btn', onclick: () => { store.toggleShortlist(id); toast(`${e.dest.name} removed`); } }, 'Remove'))));
  });
  body.appendChild(ul);
  body.appendChild(h('div', { class: 'brief-cta' },
    h('button', { class: 'btn btn-primary', onclick: () => store.setView('brief', 'brief') }, 'Create my trip brief', icon(ICONS.arrow, 'icon sm'))));
}

/* ─────────────────────────── Compare ─────────────────────────── */

function compareTab(body, state, ctx) {
  if (!state.shortlist.length) return emptyShortlist(body);
  const ids = [...state.compare, ...state.shortlist.filter((id) => !state.compare.includes(id))].slice(0, 3).filter((id) => ctx.evals.has(id));
  const es = ids.map((id) => ctx.evals.get(id));
  body.appendChild(h('p', { class: 'micro pad' }, state.shortlist.length > 3 ? 'Comparing three places — choose which ones with “Compare” on the Shortlist tab.' : state.shortlist.length === 1 ? 'Shortlist another place to compare side by side.' : 'Your shortlisted places, side by side.'));
  const p = state.params;
  const rows = [
    ['Season in your window', (e) => (p.dates.set ? SEASON_LABELS[e.season] : 'Dates not set')],
    ['Happening then', (e) => (p.dates.set ? (e.events.map((m) => m.name).join(', ') || '—') : '—')],
    ['Heads-up', (e) => e.moments.filter(isCaution).map((m) => m.name).join(', ') || '—'],
    ['Est. cost per person', (e) => `${euros(e.cost.perPerson)}${e.cost.travel == null ? ' + travel' : ''}`],
    ['Budget', (e) => (e.afford ? e.afford.label : 'Not set')],
    ['Journey', (e) => (e.best ? `${formatHours(e.best.hours)} by ${modeLabel(e.best.mode)}` : e.origin ? 'Not with your choices' : 'Set a starting point')],
    ['Feels', (e) => (e.culture ? cultureLabel(e.culture.level) : 'Set a starting point')],
    ['Logistics', (e) => ['', 'Effortless', 'Easy', 'Moderate', 'Demanding', 'Very demanding'][e.dest.logistics]],
    ['Choices that fit', (e) => { const f = fitCounts(e); return f.total ? `${f.ok} of ${f.total}` : '—'; }],
  ];
  const table = h('table', { class: 'compare', style: { minWidth: `${110 + es.length * 140}px` } },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Attribute')), es.map((e) => h('th', { scope: 'col' }, e.dest.name, h('small', null, e.dest.country))))),
    h('tbody', null, rows.map(([label, fn]) => h('tr', null, h('th', { scope: 'row' }, label), es.map((e) => h('td', null, fn(e)))))));
  body.appendChild(h('div', { class: 'table-wrap' }, table));
  body.appendChild(h('div', { class: 'row-badges pad' }, badge('estimate'), h('span', { class: 'micro' }, 'Costs and journeys are modelled estimates; seasons are historical patterns.')));
}

/* ─────────────────────────── Trip brief ─────────────────────────── */

export function preferenceLines(p) {
  const o = p.origin.set ? originById(p.origin.id) : null;
  const lines = {};
  if (p.dates.set) {
    const w = travelWindow(p.dates);
    lines.dates = `${formatRange(w.start, w.end)} · ${p.dates.nights} nights · ${w.flex.label.toLowerCase()}`;
  } else lines.dates = 'Open — any time of year';
  lines.origin = o ? `${o.name}, ${o.country}` : 'Not chosen';
  lines.budget = p.budget.set ? `${euros(p.budget.amount)} ${BUDGET_BASIS.find((b) => b.id === p.budget.basis).label.toLowerCase()}${p.budget.basis === 'total' ? ` (${p.budget.travelers} people)` : ''}` : 'No limit set';
  lines.transport = p.transport.set ? p.transport.modes.map((m) => MODES.find((x) => x.id === m).label).join(', ') : 'Any way of travelling';
  lines.culture = p.culture.set ? CULTURE_LEVELS[p.culture.level].label : 'No preference';
  lines.comfort = p.comfort.set ? COMFORT_LEVELS[p.comfort.level].label : 'Balanced (default)';
  lines.distance = p.distance.set ? `${DISTANCE_LIMITS.find((d) => d.id === p.distance.limit).label} — ${DISTANCE_LIMITS.find((d) => d.id === p.distance.limit).hint.toLowerCase()}, door to door` : 'Anywhere';
  return lines;
}

function briefTab(body, state, ctx) {
  const p = state.params;
  const lines = preferenceLines(p);
  const doc = h('article', { class: 'brief-doc' });
  doc.appendChild(h('header', null,
    h('span', { class: 'kicker' }, 'Trippin · discovery brief'),
    h('h3', { class: 'brief-h' }, state.shortlist.length ? `${state.shortlist.length} place${state.shortlist.length === 1 ? '' : 's'} worth a closer look` : 'Your preferences so far'),
    h('p', { class: 'micro' }, 'A summary of what you explored — not a booking. Prices and dates below are estimates and recurring patterns to verify.')));

  const prefs = h('dl', { class: 'prefs' });
  PARAM_ORDER.forEach((k) => {
    prefs.append(
      h('dt', null, PARAM_META[k].title),
      h('dd', null, h('span', null, lines[k]), h('button', { class: 'link-btn', onclick: () => { store.setView('map'); store.setActive(k); } }, 'Edit')));
  });
  doc.appendChild(h('section', { class: 'bsec' }, h('h4', null, 'What you’re looking for'), prefs));

  if (!state.shortlist.length) {
    doc.appendChild(h('section', { class: 'bsec' }, h('h4', null, 'Shortlist'), h('p', null, 'No places shortlisted yet — add a few from the map and they’ll appear here with reasons and costs.')));
  }
  state.shortlist.forEach((id) => {
    const e = ctx.evals.get(id);
    if (!e) return;
    const c = e.cost;
    const fits = Object.entries(e.checks).filter(([, v]) => v.s === 'ok').map(([, v]) => v.t);
    const partly = Object.entries(e.checks).filter(([, v]) => v.s === 'stretch' || v.s === 'fail').map(([k, v]) => `${PARAM_META[k].title}: ${v.t}`);
    const highlights = e.moments.filter((m) => !isCaution(m));
    doc.appendChild(h('section', { class: 'bsec dest' },
      h('h4', null, e.dest.name, h('small', null, ` · ${e.dest.country}`)),
      h('p', { class: 'lead' }, `${e.dest.hook} ${whyNow(e, p)}`),
      fits.length ? h('div', null, h('h5', null, 'Why it fits'), h('ul', null, fits.map((t) => h('li', null, t)))) : null,
      partly.length ? h('div', null, h('h5', null, 'Trade-offs'), h('ul', null, partly.map((t) => h('li', null, t)))) : null,
      highlights.length ? h('div', null, h('h5', null, 'Expected during your window'), h('ul', null, highlights.map((m) => h('li', null, `${m.name} — ${m.when}. `, h('em', null, m.status === 'pattern' ? 'Seasonal pattern.' : 'Recurring; confirm dates.'))))) : null,
      h('div', null, h('h5', null, 'Estimated cost'),
        h('p', null, `About ${euros(c.perPerson)} per person${p.budget.basis === 'total' && p.budget.set ? `, ${euros(c.group)} for ${c.travelers}` : ''} (${euros(c.stay)} stay${c.travel != null ? ` + ${euros(c.travel)} travel` : ', travel not included'}).`),
        h('ul', { class: 'assumptions' }, c.assumptions.map((a) => h('li', null, a)))),
      h('div', null, h('h5', null, 'Verify before booking'), h('ul', null, unknowns(e, p).map((u) => h('li', null, u)))),
    ));
  });

  doc.appendChild(h('section', { class: 'bsec' }, h('h4', null, 'About this brief'),
    h('p', { class: 'micro' }, `Built from a curated set of ${ctx.evals.size} places using rounded climate averages, recurring events and modelled costs and journeys. Nothing here has been reserved or checked against live availability.`)));

  const actions = h('div', { class: 'brief-actions' },
    h('button', { class: 'btn', onclick: () => copyBrief(state, ctx) }, 'Copy as text'),
    h('button', { class: 'btn', onclick: () => window.print() }, 'Print / save PDF'),
    h('button', { class: 'btn btn-primary', onclick: () => store.setView('map') }, 'Back to the map'));
  body.append(doc, actions);
}

function copyBrief(state, ctx) {
  const p = state.params;
  const lines = preferenceLines(p);
  const out = ['TRIPPIN — DISCOVERY BRIEF (not a booking; estimates to verify)', ''];
  PARAM_ORDER.forEach((k) => out.push(`${PARAM_META[k].title}: ${lines[k]}`));
  state.shortlist.forEach((id) => {
    const e = ctx.evals.get(id);
    if (!e) return;
    out.push('', `■ ${e.dest.name}, ${e.dest.country}`, whyNow(e, p));
    e.moments.filter((m) => !isCaution(m)).forEach((m) => out.push(`  • ${m.name} — ${m.when}`));
    out.push(`  Est. ${euros(e.cost.perPerson)} per person (${e.cost.assumptions.join('; ')})`);
  });
  const text = out.join('\n');
  const done = () => toast('Brief copied');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
  const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Copy not available here'); }
  ta.remove();
}
