/**
 * Seasonal insight: turns a travel window into month weights, a seasonal
 * suitability score and the recurring moments that overlap the window.
 * All of this is based on historical patterns, never confirmed schedules.
 */
import { FLEX } from './params.js';
import { MONTHS } from '../data/destinations.js';

const DAY = 86400000;

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Resolve the dates parameter into concrete dates (core trip + flexible span). */
export function travelWindow(dates, base = today()) {
  const start = addDays(base, dates.start);
  const end = addDays(start, dates.nights);
  const flex = FLEX.find((f) => f.id === dates.flex) || FLEX[0];
  let from = start, to = end;
  if (flex.days === null) {
    from = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    to = end > monthEnd ? end : monthEnd;
  } else if (flex.days > 0) {
    from = addDays(start, -flex.days);
    to = addDays(end, flex.days);
  }
  if (from < base) from = base;
  return { start, end, from, to, flex };
}

/** Days per calendar month (index 0–11) across the window span. */
export function monthWeights(win) {
  const w = new Array(12).fill(0);
  for (let t = win.from.getTime(); t <= win.to.getTime(); t += DAY) {
    w[new Date(t).getMonth()] += 1;
  }
  return w;
}

/** 0–3 seasonal suitability averaged over the window (uniform if no dates). */
export function seasonScore(dest, weights) {
  const digits = dest.season.split('').map(Number);
  const w = weights || new Array(12).fill(1);
  let s = 0, n = 0;
  digits.forEach((v, i) => { s += v * w[i]; n += w[i]; });
  return n ? s / n : 0;
}

export function seasonBin(score) {
  if (score >= 2.5) return 3;
  if (score >= 1.75) return 2;
  if (score >= 0.9) return 1;
  return 0;
}

export const SEASON_LABELS = ['Off-season', 'Fair', 'Good', 'Great'];

/**
 * Recurring moments overlapping the window.
 * status: 'annual-date' (same date every year — still verify),
 *         'recurring' (moves year to year — verify),
 *         'pattern' (historical seasonal pattern).
 */
export function momentsInWindow(dest, win) {
  if (!win) return [];
  const out = [];
  for (const m of dest.moments) {
    let hit = false;
    if (m.fixed && m.d) {
      for (let y = win.from.getFullYear() - 1; y <= win.to.getFullYear(); y++) {
        const first = m.m[0], last = m.m[m.m.length - 1];
        const s = new Date(y, first - 1, m.d[0]);
        const e = new Date(last < first ? y + 1 : y, last - 1, m.d[1]);
        if (s <= win.to && e >= win.from) { hit = true; break; }
      }
    } else {
      for (let t = win.from.getTime(); t <= win.to.getTime(); t += DAY) {
        if (m.m.includes(new Date(t).getMonth() + 1)) { hit = true; break; }
      }
    }
    if (hit) out.push({ ...m, status: momentStatus(m) });
  }
  // events first, then seasonal patterns; cautionary 'season' notes last
  const rank = (x) => (isCaution(x) ? 4 : x.kind === 'festival' ? 0 : x.kind === 'culture' ? 1 : x.kind === 'nature' ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

export function momentStatus(m) {
  if (m.kind === 'nature' || m.kind === 'season') return 'pattern';
  return m.fixed ? 'annual-date' : 'recurring';
}

export function bestMonths(dest) {
  return dest.season.split('').map(Number)
    .map((v, i) => ({ v, i })).filter((x) => x.v === 3).map((x) => MONTHS[x.i]);
}

/** Is this moment a caution (heat, monsoon, closures…) rather than a reason to go? */
const CAUTION = /heat|rain|monsoon|smoke|typhoon|flood|closure|closed|shutdown|cold|melt|winds|acqua alta|winter timetables|wettest|between-season/i;
export function isCaution(m) {
  return m.kind === 'season' && CAUTION.test(m.name);
}

export function formatRange(a, b) {
  const sameYear = a.getFullYear() === b.getFullYear();
  const f = (d, withYear) => `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
  return `${f(a, !sameYear)} – ${f(b, true)}`;
}
