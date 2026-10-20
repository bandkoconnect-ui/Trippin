/**
 * Transport accessibility: rough door-to-door journey estimates per mode.
 *
 * This is a curated network model, not a timetable. A mode is only offered
 * when the prototype's network data says it is plausible (same rail network,
 * a road connection, a known ferry crossing) — never just because two places
 * are geographically close. Times and costs are illustrative estimates.
 */

/** Known sea crossings between landmasses (hours, one way, typical). */
const FERRY_LINKS = [
  ['eurasia', 'ireland', 9],
  ['eurasia', 'crete', 9],
  ['eurasia', 'canary', 36],
  ['eurasia', 'iceland', 47],
  ['eurasia', 'africa', 1.5],
  ['africa', 'zanzibar', 2],
  ['japan', 'korea', 12],
];

export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Surface connection between two landmasses: {ferryHours, crossings} or null. */
function landLink(from, to) {
  if (!from || !to) return null;
  if (from === to) return { ferryHours: 0, crossings: 0 };
  // breadth-first search over ferry links (max two crossings)
  const queue = [{ node: from, hours: 0, n: 0 }];
  const seen = new Set([from]);
  while (queue.length) {
    const cur = queue.shift();
    for (const [a, b, h] of FERRY_LINKS) {
      const next = a === cur.node ? b : b === cur.node ? a : null;
      if (!next || seen.has(next)) continue;
      const step = { node: next, hours: cur.hours + h, n: cur.n + 1 };
      if (next === to) return { ferryHours: step.hours, crossings: step.n };
      if (step.n < 2) { seen.add(next); queue.push(step); }
    }
  }
  return null;
}

const round = (x) => Math.round(x * 2) / 2;

/**
 * All journey options between an origin and a destination, available or not.
 * Each: { mode, available, hours, cost (round trip, per person, EUR), needsFerry, why }
 */
export function journeyOptions(origin, dest) {
  const km = distanceKm(origin, dest);
  const roadKm = km * 1.3;
  const out = [];

  // Plane
  if (km < 300) {
    out.push({ mode: 'plane', available: false, why: 'Too close for flying to make sense.' });
  } else {
    let conn = 0;
    if (km > 9000) conn += 2;
    if (origin.air === 'regional') conn += 1.5;
    if (dest.air === 'regional') conn += 1.5;
    const hours = 2.5 + km / 780 + 0.5 + conn + (dest.ground || 0);
    out.push({
      mode: 'plane', available: true, hours: round(hours),
      cost: Math.round(70 + 0.085 * km + (conn > 0 ? 60 : 0)),
      why: conn > 0 ? 'Likely needs a connection.' : 'Direct flights are plausible.',
      ground: dest.ground || 0,
    });
  }

  // Train
  if (origin.rail && dest.rail && origin.rail === dest.rail && km <= 2400) {
    const hours = roadKm / 105 + 0.5 + (dest.railExtra || 0) + (dest.ground || 0) * 0.6;
    out.push({ mode: 'train', available: true, hours: round(hours), cost: Math.round(30 + 0.12 * roadKm), why: dest.railExtra ? 'Possible, with slower or awkward connections.' : 'On a connected rail network.' });
  } else {
    out.push({ mode: 'train', available: false, why: !dest.rail ? 'No useful rail link to this place.' : origin.rail !== dest.rail ? 'Not on a rail network connected to your start.' : 'Too far for a sensible rail trip.' });
  }

  // Car & coach share the road network
  const link = landLink(origin.road, dest.road);
  if (link && km <= 3200) {
    const ferryH = link.ferryHours;
    const carH = roadKm / 80 + Math.floor(roadKm / 400) * 0.5 + ferryH + (dest.ground || 0) * 0.3;
    out.push({ mode: 'car', available: true, hours: round(carH), cost: Math.round(0.13 * roadKm + (ferryH ? 80 : 0) + 20), needsFerry: ferryH > 0, ferryHours: ferryH, why: ferryH ? `Drive plus about ${ferryH} h by ferry.` : 'Connected by road. Cost assumes two people sharing fuel and tolls.' });
  } else {
    out.push({ mode: 'car', available: false, why: !link ? 'No road or ferry connection in our network.' : 'Too far to drive sensibly.' });
  }
  if (link && km <= 2500) {
    const ferryH = link.ferryHours;
    const busH = roadKm / 62 + 1 + ferryH + (dest.ground || 0) * 0.5;
    out.push({ mode: 'bus', available: true, hours: round(busH), cost: Math.round(25 + 0.07 * roadKm + (ferryH ? 60 : 0)), needsFerry: ferryH > 0, ferryHours: ferryH, why: ferryH ? 'Coach plus a ferry crossing.' : 'Long-distance coaches plausibly run this way.' });
  } else {
    out.push({ mode: 'bus', available: false, why: !link ? 'No road or ferry connection in our network.' : 'Too far for coach travel to be practical.' });
  }

  return { km: Math.round(km), options: out };
}

/**
 * Pick the options allowed by the chosen modes.
 * - No transport parameter set → every available mode counts.
 * - Ferry is an add-on that unlocks sea crossings for car and coach.
 * - Ferry on its own → surface routes that involve a crossing.
 */
export function allowedOptions(journey, transportParam) {
  const avail = journey.options.filter((o) => o.available);
  if (!transportParam || !transportParam.set) return avail;
  const modes = new Set(transportParam.modes);
  if (modes.size === 1 && modes.has('ferry')) return avail.filter((o) => o.needsFerry);
  return avail.filter((o) => modes.has(o.mode) && (!o.needsFerry || modes.has('ferry')));
}

export function bestOption(options) {
  if (!options.length) return null;
  return options.reduce((a, b) => (b.hours < a.hours ? b : a));
}

export function cheapestOption(options) {
  if (!options.length) return null;
  return options.reduce((a, b) => (b.cost < a.cost ? b : a));
}

export function formatHours(h) {
  if (h == null || !isFinite(h)) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  const whole = Math.floor(h), half = h - whole >= 0.5;
  return `${whole}${half ? '½' : ''} h`;
}
