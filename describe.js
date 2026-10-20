/** Shared wording for places: reasons, badges, fit summaries. */
import { h } from './dom.js';
import { SEASON_LABELS, isCaution, bestMonths } from '../engine/season.js';
import { PARAM_META, PARAM_ORDER, CULTURE_LEVELS } from '../engine/params.js';
import { MONTHS } from '../data/destinations.js';

export const STATUS = {
  'annual-date': { label: 'Same date most years · verify', cls: 'b-recurring' },
  recurring: { label: 'Recurring · dates vary, verify', cls: 'b-recurring' },
  pattern: { label: 'Historical pattern', cls: 'b-pattern' },
  estimate: { label: 'Illustrative estimate', cls: 'b-estimate' },
  proxy: { label: 'Exploratory proxy', cls: 'b-estimate' },
  observed: { label: 'Observed data', cls: 'b-observed' },
};

export function badge(kind) {
  const s = STATUS[kind];
  return h('span', { class: `badge ${s.cls}` }, s.label);
}

/** One or two sentences on why this place is worth a look right now. */
export function whyNow(e, params) {
  const d = e.dest;
  const parts = [];
  if (params.dates.set) {
    const hi = e.moments.filter((m) => !isCaution(m));
    const caution = e.moments.find((m) => isCaution(m));
    if (e.season >= 2) parts.push(`${SEASON_LABELS[e.season]} time to go in your window, going by typical conditions.`);
    else if (e.season === 1) parts.push('A fair, not peak, time to go in your window.');
    else parts.push('Usually off-season in your window.');
    if (hi.length) {
      const names = hi.slice(0, 2).map((m) => m.name);
      parts.push(`${names.join(' and ')} ${names.length === 1 ? 'usually overlaps' : 'usually overlap'} with your dates.`);
    }
    if (caution) parts.push(`Heads-up: ${caution.name.toLowerCase()}.`);
  } else {
    const best = bestMonths(d);
    parts.push(best.length ? `At its best in ${listMonths(best)}.` : 'No single peak season — fair most of the year.');
  }
  return parts.join(' ');
}

function listMonths(ms) {
  if (ms.length <= 3) return ms.join(', ');
  return `${ms[0]}–${ms[ms.length - 1]}`;
}

export function fitCounts(e) {
  const vals = Object.values(e.checks);
  return {
    ok: vals.filter((v) => v.s === 'ok').length,
    stretch: vals.filter((v) => v.s === 'stretch').length,
    fail: vals.filter((v) => v.s === 'fail').length,
    unknown: vals.filter((v) => v.s === 'unknown').length,
    total: vals.length,
  };
}

export function checkRows(e, params) {
  return PARAM_ORDER.map((k) => {
    const c = e.checks[k];
    if (!c) return { key: k, s: 'unset', t: 'Not set', title: PARAM_META[k].title };
    return { key: k, s: c.s, t: c.t, title: PARAM_META[k].title };
  });
}

export const CHECK_SYMBOL = { ok: '✓', stretch: '~', fail: '✕', unknown: '?', unset: '·' };
export const CHECK_WORD = { ok: 'Fits', stretch: 'Partly', fail: 'Doesn’t fit', unknown: 'Unknown', unset: 'Not set' };

/** Things to check before booking, specific to this place. */
export function unknowns(e, params) {
  const out = [];
  out.push('Costs are illustrative estimates — check real fares and room rates.');
  e.moments.filter((m) => m.status !== 'pattern' && !isCaution(m)).forEach((m) => out.push(`Confirm this year’s dates for ${m.name} (${m.when}).`));
  if (e.best) out.push(`Check actual ${e.best.mode === 'bus' ? 'coach' : e.best.mode} routes and timetables — journey times are modelled.`);
  Object.entries(e.checks).forEach(([k, c]) => { if (c.s === 'unknown') out.push(`${PARAM_META[k].title}: ${c.t}`); });
  if (e.dest.logistics >= 4) out.push('Logistics are demanding here (remote transfers, altitude or permits) — plan the ground route carefully.');
  out.push(`Check official travel advice and entry requirements for ${e.dest.country}.`);
  return out;
}

export function cultureLabel(level) { return CULTURE_LEVELS[level].label; }

export function monthList(m) { return m.map((x) => MONTHS[x - 1]).join(', '); }
