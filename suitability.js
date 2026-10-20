/**
 * Destination suitability & filtering.
 *
 * evaluate() computes every dimension for every destination from the current
 * parameters. Filtering (which selected parameters rule a place out) is kept
 * separate from visual encoding (how the *active* parameter colours the map),
 * so the same evaluation can be drawn in any visualisation mode.
 */
import { DESTINATIONS } from '../data/destinations.js';
import { ORIGINS } from '../data/origins.js';
import { PARAM_ORDER, PARAM_META, COMFORT_LEVELS, DISTANCE_LIMITS, CULTURE_LEVELS, MODES } from './params.js';
import { travelWindow, monthWeights, seasonScore, seasonBin, momentsInWindow, SEASON_LABELS, isCaution } from './season.js';
import { journeyOptions, allowedOptions, bestOption, cheapestOption, formatHours } from './transport.js';
import { estimateCost, affordability, euros } from './cost.js';
import { cultureCompare } from './culture.js';

export const PALETTE = {
  aqua: '#66D7D1', aquaLight: '#B8ECE9', amber: '#DBD56E', amberLight: '#EEEBBE',
  grapeLight: '#CDCAD8', land: '#E3DED5', coral: '#FC7753', grape: '#403D58',
};

export function originById(id) { return ORIGINS.find((o) => o.id === id) || null; }

export function evaluate(params) {
  const origin = params.origin.set ? originById(params.origin.id) : null;
  const win = params.dates.set ? travelWindow(params.dates) : null;
  const weights = win ? monthWeights(win) : null;
  const comfort = COMFORT_LEVELS[params.comfort.set ? params.comfort.level : 1];
  const limit = DISTANCE_LIMITS.find((d) => d.id === params.distance.limit) || DISTANCE_LIMITS[2];

  const map = new Map();
  for (const dest of DESTINATIONS) {
    const e = { dest, origin };
    // Season
    e.seasonScore = seasonScore(dest, weights);
    e.season = seasonBin(e.seasonScore);
    e.moments = win ? momentsInWindow(dest, win) : [];
    e.events = e.moments.filter((m) => !isCaution(m) && (m.kind === 'festival' || m.kind === 'culture'));
    // Journey
    if (origin) {
      e.journey = journeyOptions(origin, dest);
      e.allowed = allowedOptions(e.journey, params.transport);
      e.anyAvailable = e.journey.options.filter((o) => o.available);
      e.best = bestOption(e.allowed);
      e.cheapest = cheapestOption(e.allowed);
    } else {
      e.journey = null; e.allowed = []; e.best = null; e.cheapest = null; e.anyAvailable = [];
    }
    // Cost
    e.cost = estimateCost(dest, params, e.cheapest);
    e.afford = params.budget.set ? affordability(e.cost, params.budget) : null;
    // Culture
    e.culture = origin ? cultureCompare(origin, dest) : null;
    // Comfort
    const jH = e.best ? e.best.hours : null;
    const tol = comfort.complexityTol;
    if (dest.logistics <= tol - 1 && (jH == null || jH <= comfort.journeyTol * 0.6)) e.comfortFit = 0;
    else if (dest.logistics <= tol && (jH == null || jH <= comfort.journeyTol)) e.comfortFit = 1;
    else e.comfortFit = 2;
    // Distance
    e.limit = limit;
    e.withinRange = e.best ? e.best.hours <= limit.hours : null;

    e.checks = checks(e, params);
    map.set(dest.id, e);
  }
  return { map, origin, win, comfort, limit };
}

/** Per-parameter verdicts: ok | stretch | fail | unknown, with a reason. */
function checks(e, params) {
  const c = {};
  const d = e.dest;
  if (params.dates.set) {
    c.dates = e.season >= 2 ? { s: 'ok', t: `${SEASON_LABELS[e.season]} time to go, based on typical conditions.` }
      : e.season === 1 ? { s: 'stretch', t: 'Fair time — not its best season.' }
        : { s: 'fail', t: 'Usually off-season in your window.' };
  }
  if (params.origin.set) {
    c.origin = e.anyAvailable.length
      ? { s: 'ok', t: `About ${formatHours(bestOption(e.anyAvailable).hours)} door to door at best · ${e.journey.km.toLocaleString('en-GB')} km straight line.` }
      : { s: 'fail', t: 'No practical way there in our network.' };
  }
  if (params.budget.set) {
    const a = e.afford;
    const s = a.bin <= 1 ? 'ok' : a.bin === 2 ? 'stretch' : 'fail';
    c.budget = { s, t: `${a.label}: about ${euros(a.value)} vs your ${euros(params.budget.amount)}${a.basis === 'daily' ? ' per day' : ''}${a.excludesTravel ? ' (travel not included)' : ''}.` };
  }
  if (params.transport.set) {
    if (!e.origin) c.transport = { s: 'unknown', t: 'Needs a starting point to check.' };
    else if (e.allowed.length) {
      const modes = e.allowed.map((o) => modeLabel(o.mode)).join(', ');
      c.transport = { s: 'ok', t: `Reachable by ${modes}.` };
    } else {
      const other = e.anyAvailable.map((o) => modeLabel(o.mode));
      c.transport = { s: 'fail', t: other.length ? `Not with your choices — only by ${other.join(', ')}.` : 'Not practical to reach.' };
    }
  }
  if (params.culture.set) {
    if (!e.culture) c.culture = { s: 'unknown', t: 'Needs a starting point to compare.' };
    else {
      const diff = Math.abs(e.culture.level - params.culture.level);
      const lbl = CULTURE_LEVELS[e.culture.level].feel;
      c.culture = diff === 0 ? { s: 'ok', t: `Likely to feel ${lbl} — as you asked.` }
        : diff === 1 ? { s: 'stretch', t: `Likely to feel ${lbl}, one step from your choice.` }
          : { s: 'fail', t: `Likely to feel ${lbl}.` };
    }
  }
  if (params.comfort.set) {
    const why = [];
    if (d.logistics >= 4) why.push('demanding logistics');
    if (e.best && e.best.hours > 14) why.push(`a ${formatHours(e.best.hours)} journey`);
    c.comfort = e.comfortFit === 0 ? { s: 'ok', t: 'Easy for your travel style.' }
      : e.comfortFit === 1 ? { s: 'ok', t: `Workable for your style${why.length ? ' despite ' + why.join(' and ') : ''}.` }
        : { s: 'fail', t: `Demanding for your style${why.length ? ': ' + why.join(' and ') : ''}.` };
  }
  if (params.distance.set) {
    if (!e.origin) c.distance = { s: 'unknown', t: 'Needs a starting point to measure.' };
    else if (!e.best) c.distance = { s: 'fail', t: 'No allowed way to get there.' };
    else c.distance = e.withinRange ? { s: 'ok', t: `About ${formatHours(e.best.hours)} door to door — within “${e.limit.label.toLowerCase()}”.` }
      : { s: 'fail', t: `About ${formatHours(e.best.hours)} door to door — beyond “${e.limit.label.toLowerCase()}”.` };
  }
  return c;
}

export function modeLabel(id) {
  const m = MODES.find((x) => x.id === id);
  return m ? m.label.toLowerCase() : id;
}

/** Which selected parameters (other than the active one) rule this place out? */
export function failedBy(e, active) {
  return Object.entries(e.checks).filter(([k, v]) => k !== active && v.s === 'fail').map(([k]) => k);
}

/* ─────────────────────── Visual encodings per mode ─────────────────────── */

const LEGENDS = {
  dates: {
    title: 'Seasonal outlook',
    items: [
      { label: 'Great time to go', color: PALETTE.aqua },
      { label: 'Good', color: PALETTE.amber },
      { label: 'Fair', color: PALETTE.amberLight },
      { label: 'Off-season', color: PALETTE.grapeLight },
    ],
  },
  origin: {
    title: 'Journey time, door to door',
    items: [
      { label: 'Under 5 h', color: PALETTE.aqua },
      { label: '5–10 h', color: PALETTE.aquaLight },
      { label: '10–20 h', color: PALETTE.amber },
      { label: 'Over 20 h', color: PALETTE.grapeLight },
    ],
  },
  budget: {
    title: 'Estimated trip vs your budget',
    items: [
      { label: 'Comfortably within', color: PALETTE.aqua },
      { label: 'Within', color: PALETTE.aquaLight },
      { label: 'A stretch (up to +20%)', color: PALETTE.amber },
      { label: 'Over budget', color: PALETTE.grapeLight },
    ],
  },
  transport: {
    title: 'Reachable the way you like to travel',
    items: [
      { label: 'Your way, under 10 h', color: PALETTE.aqua },
      { label: 'Your way, longer', color: PALETTE.aquaLight },
      { label: 'Only by other means', color: PALETTE.amber },
      { label: 'Not practical', color: PALETTE.grapeLight },
    ],
  },
  culture: {
    title: 'Cultural difference vs your wish',
    items: [
      { label: 'Matches your choice', color: PALETTE.aqua },
      { label: 'One step away', color: PALETTE.amber },
      { label: 'Further away', color: PALETTE.grapeLight },
    ],
  },
  comfort: {
    title: 'Fit with your travel style',
    items: [
      { label: 'Easy fit', color: PALETTE.aqua },
      { label: 'Workable', color: PALETTE.aquaLight },
      { label: 'Demanding', color: PALETTE.amber },
    ],
  },
  distance: {
    title: 'Within your range',
    items: [
      { label: 'Well within', color: PALETTE.aqua },
      { label: 'Within', color: PALETTE.aquaLight },
      { label: 'Beyond your range', color: PALETTE.grapeLight },
    ],
  },
};

/** Parameters whose visualisation needs a starting point. */
export const NEEDS_ORIGIN = new Set(['origin', 'transport', 'culture', 'distance']);

export function legendFor(active) { return LEGENDS[active]; }

/**
 * Encode one evaluation for the active mode.
 * Returns { cat (legend index) | null when unknown, label, color, excluded, excludedBy }
 */
export function encode(e, active, params) {
  const excludedBy = failedBy(e, active);
  const L = LEGENDS[active].items;
  let cat = null, detail = '';
  switch (active) {
    case 'dates': {
      cat = 3 - e.season; // Great=0 … Off-season=3
      const hl = e.moments.find((m) => !isCaution(m));
      detail = params.dates.set ? (hl ? `${hl.name} in your window` : `${SEASON_LABELS[e.season]} time in your window`) : 'Average across the year';
      break;
    }
    case 'origin': {
      const b = e.anyAvailable.length ? bestOption(e.anyAvailable) : null;
      if (!e.origin) break;
      const h = b ? b.hours : Infinity;
      cat = h < 5 ? 0 : h < 10 ? 1 : h < 20 ? 2 : 3;
      detail = b ? `About ${formatHours(h)} by ${modeLabel(b.mode)}` : 'No practical route';
      break;
    }
    case 'budget': {
      const a = e.afford || affordability(e.cost, params.budget);
      cat = a.bin;
      detail = `${a.label} · about ${euros(a.value)}${a.basis === 'daily' ? '/day' : ''}`;
      break;
    }
    case 'transport': {
      if (!e.origin) break;
      if (e.allowed.length) { cat = e.best.hours < 10 ? 0 : 1; detail = `About ${formatHours(e.best.hours)} by ${modeLabel(e.best.mode)}`; }
      else if (e.anyAvailable.length) { cat = 2; detail = `Only by ${e.anyAvailable.map((o) => modeLabel(o.mode)).join(', ')}`; }
      else { cat = 3; detail = 'Not practical'; }
      break;
    }
    case 'culture': {
      if (!e.culture) break;
      const diff = Math.abs(e.culture.level - params.culture.level);
      cat = Math.min(diff, 2);
      detail = `Likely to feel ${CULTURE_LEVELS[e.culture.level].feel}`;
      break;
    }
    case 'comfort': {
      cat = e.comfortFit;
      detail = ['Easy fit for your style', 'Workable for your style', 'Demanding for your style'][cat];
      break;
    }
    case 'distance': {
      if (!e.origin) break;
      if (!e.best) { cat = 2; detail = 'No allowed way there'; break; }
      const lim = e.limit.hours;
      cat = e.best.hours <= lim * 0.6 || !isFinite(lim) ? 0 : e.best.hours <= lim ? 1 : 2;
      detail = `About ${formatHours(e.best.hours)} door to door`;
      break;
    }
    default: break;
  }
  return {
    cat,
    color: cat == null ? PALETTE.land : L[cat].color,
    label: cat == null ? '' : L[cat].label,
    detail,
    excluded: excludedBy.length > 0,
    excludedBy,
    // the active parameter itself rules this place out (shown by its own colour, not hatching)
    activeFail: !!(e.checks[active] && e.checks[active].s === 'fail'),
  };
}

/** Plain-language caption for the current view. */
export function caption(params, active, result, encoded) {
  const parts = [];
  const meta = PARAM_META[active];
  const all = [...encoded.values()];
  const shown = all.filter((x) => !x.excluded && !x.activeFail);
  const needsOrigin = NEEDS_ORIGIN.has(active) && !result.origin;

  const ctx = [];
  if (params.dates.set && active !== 'dates' && result.win) ctx.push('in your dates');
  if (params.budget.set && active !== 'budget') ctx.push('within budget');
  if (result.origin && active !== 'origin') ctx.push(`reachable from ${result.origin.name}`);
  if (params.distance.set && active !== 'distance' && result.origin) ctx.push(`in your range`);
  if (params.comfort.set && active !== 'comfort') ctx.push('suited to your comfort level');
  if (params.culture.set && active !== 'culture' && result.origin) ctx.push('near your culture choice');

  const hidden = {};
  for (const x of all) {
    for (const k of x.excludedBy) hidden[k] = (hidden[k] || 0) + 1;
    if (x.activeFail) hidden[active] = (hidden[active] || 0) + 1;
  }

  let sentence;
  if (needsOrigin) {
    sentence = active === 'origin' ? 'Choose where you’d set off from to see journey times across the map.'
      : `${meta.title} is measured from where you start. Choose a starting point to see it on the map.`;
  } else {
    const what = {
      dates: params.dates.set ? 'How good each place usually is in your travel window' : 'Year-round seasonal appeal (no dates chosen)',
      origin: `Estimated door-to-door journey time from ${result.origin ? result.origin.name : ''}`,
      budget: 'Estimated trip cost compared with your budget',
      transport: 'Where you can plausibly get to the way you like to travel',
      culture: 'How different each place may feel compared with home',
      comfort: 'How well each place suits your comfort level',
      distance: isFinite(result.limit.hours) ? `Places ${result.limit.hint.toLowerCase()} door to door (estimated journey time)` : 'Estimated journey time — no range limit set',
    }[active];
    sentence = `${what}${ctx.length ? ' — among places ' + joinList(ctx) : ''}.`;
  }
  return {
    title: LEGENDS[active].title,
    sentence,
    shown: shown.length,
    total: all.length,
    hidden: Object.entries(hidden).map(([param, count]) => ({ param, count })).sort((a, b) => b.count - a.count),
    needsOrigin,
  };
}

function joinList(a) {
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

/** Rank for ordering places within a country and in lists (lower = better). */
export function rankOf(x) {
  return (x.excluded ? 100 : 0) + (x.cat == null ? 50 : x.cat);
}

/** How many more places would appear if one parameter were cleared. */
export function relaxGain(params, active, key) {
  const relaxed = JSON.parse(JSON.stringify(params));
  relaxed[key].set = false;
  const r = evaluate(relaxed);
  let n = 0;
  for (const e of r.map.values()) if (!Object.values(e.checks).some((c) => c.s === 'fail')) n++;
  return n;
}

export { PARAM_ORDER };
