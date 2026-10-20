/**
 * Destination panel (bottom sheet on phones, side panel on larger screens)
 * and the list of matching places.
 */
import { h, clear, icon, toast } from './dom.js';
import { ICONS } from './icons.js';
import { MONTHS } from '../data/destinations.js';
import { MODES } from '../engine/params.js';
import { SEASON_LABELS, isCaution, formatRange } from '../engine/season.js';
import { formatHours } from '../engine/transport.js';
import { euros } from '../engine/cost.js';
import { rankOf, modeLabel } from '../engine/suitability.js';
import { research } from '../engine/research.js';
import { badge, whyNow, checkRows, CHECK_SYMBOL, CHECK_WORD, unknowns, cultureLabel, monthList } from './describe.js';
import * as store from '../store.js';

let lastRenderedId = null;

export function renderSheet(el, state, ctx) {
  const open = !!state.sheetMode;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) { lastRenderedId = null; el.classList.remove('tall'); return; }
  const scroller = el.querySelector('.sheet-scroll');
  const keepScroll = scroller && lastRenderedId === (state.selected || 'list') ? scroller.scrollTop : 0;
  clear(el);
  const handle = h('button', { class: 'sheet-handle', 'aria-label': 'Expand or collapse panel', onclick: () => el.classList.toggle('tall') }, h('i'));
  const body = h('div', { class: 'sheet-scroll' });
  el.append(handle, body);
  if (state.sheetMode === 'list') renderList(body, state, ctx);
  else renderPlace(body, state, ctx);
  lastRenderedId = state.selected || 'list';
  body.scrollTop = keepScroll;
  attachDrag(el, handle);
}

/* ─────────────────────────── Place ─────────────────────────── */

function renderPlace(body, state, ctx) {
  const e = ctx.evals.get(state.selected);
  if (!e) return;
  const enc = ctx.encoded.get(state.selected);
  const d = e.dest;
  const p = state.params;
  const listed = state.shortlist.includes(d.id);
  const siblings = [...ctx.evals.values()].filter((x) => x.dest.iso === d.iso && x.dest.id !== d.id);

  const head = h('header', { class: 'place-head' },
    h('div', { class: 'place-titles' },
      h('span', { class: 'kicker' }, `${d.country} · ${d.continent}`),
      h('h2', { class: 'place-name', id: 'place-name' }, d.name),
      h('p', { class: 'place-hook' }, d.hook)),
    h('button', { class: 'icon-btn', 'aria-label': 'Close and return to the map', onclick: () => store.closeSheet() }, icon(ICONS.close)));

  const status = h('div', { class: `place-status${enc.excluded ? ' excluded' : ''}` },
    enc.excluded
      ? [h('strong', null, 'Ruled out by your choices'), h('span', null, ` — ${enc.excludedBy.map((k) => checkTitle(k)).join(', ')}. Still worth a look if you’re flexible.`)]
      : [h('i', { class: 'sw', style: { background: enc.color } }), h('strong', null, enc.label), enc.detail ? h('span', null, ` · ${enc.detail}`) : null]);

  const sections = [];

  // Why now
  sections.push(section(p.dates.set ? 'Why consider it for your dates' : 'Why consider it', [h('p', { class: 'lead' }, whyNow(e, p))]));

  // Moments in window
  if (p.dates.set) {
    const win = ctx.result.win;
    const list = h('ul', { class: 'moments' });
    if (!e.moments.length) list.appendChild(h('li', { class: 'muted' }, 'No major recurring events in our data for these dates.'));
    e.moments.forEach((m) => list.appendChild(h('li', { class: isCaution(m) ? 'caution' : '' },
      h('div', { class: 'm-top' }, h('strong', null, isCaution(m) ? `Heads-up: ${m.name}` : m.name), badge(m.status)),
      h('span', { class: 'm-when' }, m.when),
      h('p', null, m.note))));
    sections.push(section(`In your window · ${formatRange(win.from, win.to)}`, [list]));
  }
  const others = d.moments.filter((m) => !e.moments.some((x) => x.name === m.name));
  if (others.length) {
    const det = h('details', { class: 'others' }, h('summary', null, p.dates.set ? `Other times of year (${others.length})` : `Through the year (${others.length})`));
    const ul = h('ul', { class: 'moments compact' });
    others.forEach((m) => ul.appendChild(h('li', null, h('strong', null, m.name), h('span', { class: 'm-when' }, ` · ${monthList(m.m)}`))));
    det.appendChild(ul);
    sections.push(det);
  }

  // Climate
  sections.push(section('Typical conditions', [climateChart(d, ctx.weights), h('div', { class: 'row-badges' }, badge('pattern'), h('span', { class: 'micro' }, 'Rounded long-term monthly averages.'))]));

  // Cost
  const c = e.cost;
  const costRows = h('dl', { class: 'kv' },
    h('dt', null, `Stay · ${c.nights} nights × ${euros(c.perDay)}`), h('dd', null, euros(c.stay)),
    h('dt', null, c.travel != null ? `Round trip by ${modeLabel(c.travelMode)}` : 'Travel there'), h('dd', null, c.travel != null ? euros(c.travel) : 'not included'),
    h('dt', { class: 'total' }, 'Per person'), h('dd', { class: 'total' }, euros(c.perPerson)));
  const costKids = [costRows];
  if (p.budget.set && p.budget.basis === 'total') costKids.push(h('p', { class: 'micro' }, `For ${c.travelers} travelling together: about ${euros(c.group)}.`));
  if (e.afford) costKids.push(h('p', { class: 'micro' }, `${e.afford.label} — your budget is ${euros(p.budget.amount)}${p.budget.basis === 'daily' ? ' per day' : p.budget.basis === 'total' ? ' for the group' : ' per person'}.`));
  costKids.push(h('ul', { class: 'assumptions' }, c.assumptions.map((a) => h('li', null, a))));
  costKids.push(h('div', { class: 'row-badges' }, badge('estimate')));
  sections.push(section('Estimated trip cost', costKids));

  // Getting there
  if (e.origin) {
    const allowed = new Set(e.allowed.map((o) => o.mode));
    const rows = h('ul', { class: 'modes' });
    e.journey.options.forEach((o) => {
      const label = MODES.find((m) => m.id === o.mode).label;
      rows.appendChild(h('li', { class: `${o.available ? '' : 'na'}${allowed.has(o.mode) ? ' allowed' : ''}` },
        icon(ICONS[o.mode], 'icon sm'),
        h('span', { class: 'mode-name' }, label),
        o.available ? h('span', { class: 'mode-time' }, `~${formatHours(o.hours)}`) : h('span', { class: 'mode-time' }, '—'),
        o.available ? h('span', { class: 'mode-cost' }, `~${euros(o.cost)}`) : null,
        h('small', null, o.why)));
    });
    sections.push(section(`Getting there from ${e.origin.name}`, [
      rows,
      h('p', { class: 'micro' }, `${e.journey.km.toLocaleString('en-GB')} km in a straight line. Times are door-to-door, one way; costs are round trip per person. Ferry crossings are included in car and coach routes only when you’ve picked Ferry.`),
      h('div', { class: 'row-badges' }, badge('estimate')),
    ]));
    // Culture
    const cu = e.culture;
    sections.push(section('Cultural difference', [
      h('p', { class: 'lead' }, `Likely to feel ${cultureLabel(cu.level).toLowerCase()} coming from ${e.origin.name}.`),
      h('ul', { class: 'dims' }, cu.dims.map((x) => h('li', null, h('span', null, x.label), h('i', { class: 'meter', style: { '--v': String(1 - x.sim) } }), h('small', null, x.text)))),
      h('div', { class: 'row-badges' }, badge('proxy'), h('span', { class: 'micro' }, 'A prompt to explore, not a verdict about anyone’s culture.')),
    ]));
  } else {
    sections.push(section('Getting there', [h('p', null, 'Add a starting point to estimate journey times, travel costs and cultural difference.'),
      h('button', { class: 'pill-btn accent', onclick: () => { store.closeSheet(); store.setActive('origin'); } }, 'Choose starting point')]));
  }

  // Fit
  const fit = h('ul', { class: 'checks' });
  checkRows(e, p).forEach((r) => fit.appendChild(h('li', { class: `c-${r.s}` },
    h('span', { class: 'c-sym', 'aria-hidden': 'true' }, CHECK_SYMBOL[r.s]),
    h('span', { class: 'c-title' }, r.title, h('span', { class: 'sr-only' }, `: ${CHECK_WORD[r.s]}`)),
    h('span', { class: 'c-text' }, r.t))));
  sections.push(section('How it fits your choices', [fit]));

  // Stage B — research
  sections.push(researchSection(e, state, ctx));

  // Siblings in same country
  if (siblings.length) {
    sections.push(section(`Also in ${d.country}`, [h('div', { class: 'quick' }, siblings.map((s) => h('button', { class: 'pill-btn', onclick: () => store.select(s.dest.id) }, s.dest.name)))]));
  }

  const actions = h('div', { class: 'place-actions' },
    h('button', {
      class: `btn ${listed ? 'btn-on' : 'btn-primary'}`, 'aria-pressed': listed ? 'true' : 'false',
      onclick: () => { const added = store.toggleShortlist(d.id); toast(added ? `${d.name} added to your shortlist` : `${d.name} removed from your shortlist`); },
    }, icon(listed ? ICONS.starFill : ICONS.star, 'icon sm'), listed ? 'Shortlisted' : 'Shortlist'),
    h('button', { class: 'btn', onclick: () => { if (!state.compare.includes(d.id)) store.toggleCompare(d.id); store.setView('brief', 'compare'); } }, icon(ICONS.compare, 'icon sm'), 'Compare'),
    h('button', { class: 'btn btn-ghost', onclick: () => store.closeSheet() }, 'Keep exploring'));

  body.append(head, status, ...sections, actions);
  body.parentElement.setAttribute('aria-labelledby', 'place-name');
}

function checkTitle(k) {
  return { dates: 'dates', origin: 'starting point', budget: 'budget', transport: 'ways of travelling', culture: 'cultural difference', comfort: 'comfort', distance: 'range' }[k];
}

function section(title, kids) {
  return h('section', { class: 'psec' }, h('h3', null, title), ...kids);
}

function climateChart(d, weights) {
  const W = 300, H = 92, pad = 18, bw = (W - 8) / 12;
  const maxT = 42, minT = -15;
  const y = (t) => H - pad - ((t - minT) / (maxT - minT)) * (H - pad - 8);
  const maxR = Math.max(150, ...d.rain);
  let bars = '';
  d.hi.forEach((t, i) => {
    const x = 4 + i * bw;
    const on = weights && weights[i] > 0;
    const rh = (d.rain[i] / maxR) * 22;
    bars += `<rect x="${x + 2}" y="${H - pad - rh}" width="${bw - 4}" height="${rh}" fill="#66D7D1" opacity="${on ? 0.9 : 0.35}"/>`;
    bars += `<circle cx="${x + bw / 2}" cy="${y(t)}" r="${on ? 3.4 : 2.4}" fill="${on ? '#FC7753' : '#403D58'}"/>`;
    bars += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" class="ax${on ? ' on' : ''}">${MONTHS[i][0]}</text>`;
    if (on) bars += `<text x="${x + bw / 2}" y="${y(t) - 6}" text-anchor="middle" class="tv">${t}°</text>`;
  });
  const pts = d.hi.map((t, i) => `${4 + i * bw + bw / 2},${y(t)}`).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="climate" role="img" aria-label="Average high temperature and rainfall by month for ${d.name}">
    <polyline points="${pts}" fill="none" stroke="#403D58" stroke-opacity=".35" stroke-width="1.2"/>${bars}</svg>`;
  const legend = h('div', { class: 'climate-legend' },
    h('span', null, h('i', { class: 'dot' }), 'Avg. high °C'),
    h('span', null, h('i', { class: 'bar' }), 'Rain'),
    weights ? h('span', null, h('i', { class: 'dot on' }), 'Your window') : null);
  return h('div', null, h('div', { html: svg }), legend);
}

function researchSection(e, state, ctx) {
  const win = ctx.result.win;
  const out = h('div', { class: 'research-out', 'aria-live': 'polite' });
  const kids = [];
  if (win) {
    const btn = h('button', { class: 'btn' }, 'Check last year’s actual weather for these dates');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      clear(out).appendChild(h('p', { class: 'loading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Fetching observations…'));
      try {
        const r = await research.weather.lastYearWeather(e.dest, win);
        clear(out).append(
          h('p', { class: 'lead' }, `${formatRange(r.from, r.to)}: highs averaged ${r.avgHigh}°C, lows ${r.avgLow}°C, with ${r.wetDays} wet day${r.wetDays === 1 ? '' : 's'} out of ${r.days} (${r.totalRain} mm).`),
          h('div', { class: 'row-badges' }, badge('observed'), h('a', { href: r.sourceUrl, target: '_blank', rel: 'noopener', class: 'micro' }, r.source)),
          h('p', { class: 'micro' }, 'One past year is an indication, not a forecast.'));
      } catch (err) {
        clear(out).appendChild(h('p', { class: 'research-error' }, `Couldn’t reach the weather service (${err.name === 'AbortError' ? 'timed out' : err.message}). The typical-conditions chart above still applies.`));
      } finally { btn.disabled = false; }
    });
    kids.push(btn, out);
  } else {
    kids.push(h('p', { class: 'micro' }, 'Set travel dates to check what the weather was actually like on those dates last year.'));
  }
  kids.push(h('p', { class: 'micro' }, `Not connected in this prototype: ${research.notConnected.map((x) => x.label.toLowerCase()).join(', ')}. Verify these yourself:`));
  kids.push(h('ul', { class: 'links' }, research.verifyLinks(e.dest, e.origin, win, e.events).map((l) => h('li', null,
    h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label, icon(ICONS.external, 'icon xs'))))));
  const unk = h('details', { class: 'others' }, h('summary', null, 'Before you book, check'), h('ul', { class: 'assumptions' }, unknowns(e, state.params).map((u) => h('li', null, u))));
  kids.push(unk);
  return section('Check the details', kids);
}

/* ─────────────────────────── List ─────────────────────────── */

function renderList(body, state, ctx) {
  const rows = [...ctx.encoded.entries()].map(([id, enc]) => ({ id, enc, e: ctx.evals.get(id) }))
    .sort((a, b) => rankOf(a.enc) - rankOf(b.enc) || b.e.seasonScore - a.e.seasonScore || a.e.dest.name.localeCompare(b.e.dest.name));
  const fits = rows.filter((r) => !r.enc.excluded && !r.enc.activeFail);
  const out = rows.filter((r) => r.enc.excluded || r.enc.activeFail);
  body.append(
    h('header', { class: 'place-head' },
      h('div', { class: 'place-titles' }, h('span', { class: 'kicker' }, ctx.cap.title), h('h2', { class: 'place-name', id: 'place-name' }, `${fits.length} place${fits.length === 1 ? '' : 's'} fit your choices`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Close list', onclick: () => store.closeSheet() }, icon(ICONS.close))),
    h('p', { class: 'micro pad' }, `Ordered by the map’s current view. This prototype covers ${rows.length} curated places, not the whole world.`),
  );
  const ul = h('ul', { class: 'place-list' });
  fits.forEach((r) => ul.appendChild(listRow(r, state)));
  if (!fits.length) ul.appendChild(h('li', { class: 'muted pad' }, 'Nothing fits every choice right now — see “ruled out” below.'));
  body.appendChild(ul);
  if (out.length) {
    const det = h('details', { class: 'others pad' }, h('summary', null, `Ruled out (${out.length})`));
    const ul2 = h('ul', { class: 'place-list' });
    out.forEach((r) => ul2.appendChild(listRow(r, state)));
    det.appendChild(ul2);
    body.appendChild(det);
  }
}

function listRow(r, state) {
  const d = r.e.dest;
  return h('li', null, h('button', { class: 'list-row', onclick: () => store.select(d.id) },
    h('i', { class: `sw${r.enc.excluded ? ' sw-hatch' : ''}`, style: r.enc.excluded ? null : { background: r.enc.color } }),
    h('span', { class: 'lr-main' }, h('strong', null, d.name), h('small', null, `${d.country}${r.enc.detail ? ' · ' + r.enc.detail : ''}`)),
    state.shortlist.includes(d.id) ? icon(ICONS.starFill, 'icon xs star') : null,
    r.e.events.length && state.params.dates.set ? h('span', { class: 'ev-tag' }, r.e.events[0].name) : null));
}

/* ─────────────────────────── Drag to resize (phones) ─────────────────────────── */

function attachDrag(sheet, handle) {
  let startY = null, startTall = false, moved = false;
  handle.addEventListener('pointerdown', (ev) => { startY = ev.clientY; startTall = sheet.classList.contains('tall'); moved = false; handle.setPointerCapture(ev.pointerId); });
  handle.addEventListener('pointermove', (ev) => { if (startY != null && Math.abs(ev.clientY - startY) > 6) moved = true; });
  handle.addEventListener('pointerup', (ev) => {
    if (startY == null) return;
    const dy = ev.clientY - startY;
    startY = null;
    if (!moved) return; // a tap is handled by click
    if (dy < -30) sheet.classList.add('tall');
    else if (dy > 60 && startTall) sheet.classList.remove('tall');
    else if (dy > 60) store.closeSheet();
    handle.dataset.dragged = '1';
    setTimeout(() => { delete handle.dataset.dragged; }, 50);
  }, { capture: true });
  handle.addEventListener('click', (ev) => { if (handle.dataset.dragged) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, { capture: true });
}
