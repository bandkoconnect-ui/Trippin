/**
 * Stage B — focused research, behind a provider abstraction.
 *
 * Each provider declares what it can do and whether it is connected. The UI
 * only talks to `research`, so real services (flight search, hotel rates,
 * event calendars) can be added later without touching components.
 *
 * Connected in this prototype:
 *   • Weather check — Open-Meteo historical archive (free, no key, CORS-enabled):
 *     what the weather actually was on the same dates last year.
 * Not connected (shown honestly as such):
 *   • Live fares, hotel rates, event calendars. The UI offers search links
 *     so people can verify details themselves before booking.
 * API keys must never be placed in this client code; future keyed providers
 * belong behind a small server endpoint.
 */
import { addDays, today } from './season.js';

const cache = new Map();

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const openMeteoArchive = {
  id: 'open-meteo-archive',
  label: 'Open-Meteo historical weather',
  connected: true,
  /** Same calendar dates, shifted back by whole years until they are in the past. */
  async lastYearWeather(dest, win) {
    let from = new Date(win.start), to = new Date(win.end);
    const limit = addDays(today(), -7); // archive lags by a few days
    let years = 0;
    while (to > limit && years < 3) {
      from = new Date(from.getFullYear() - 1, from.getMonth(), from.getDate());
      to = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
      years++;
    }
    const key = `${dest.id}|${iso(from)}|${iso(to)}`;
    if (cache.has(key)) return cache.get(key);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${dest.lat}&longitude=${dest.lon}`
      + `&start_date=${iso(from)}&end_date=${iso(to)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Weather service replied ${res.status}`);
      const json = await res.json();
      const d = json.daily || {};
      const nums = (a) => (a || []).filter((x) => typeof x === 'number');
      const hi = nums(d.temperature_2m_max), lo = nums(d.temperature_2m_min), pr = nums(d.precipitation_sum);
      if (!hi.length) throw new Error('No observations for these dates');
      const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
      const result = {
        from, to,
        avgHigh: Math.round(avg(hi)), avgLow: Math.round(avg(lo)),
        wetDays: pr.filter((x) => x >= 1).length, days: pr.length,
        totalRain: Math.round(pr.reduce((s, x) => s + x, 0)),
        source: 'Open-Meteo historical archive (ERA5 reanalysis)',
        sourceUrl: 'https://open-meteo.com/',
      };
      cache.set(key, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  },
};

/** Not-yet-connected capabilities, listed so the interface can be honest about them. */
export const NOT_CONNECTED = [
  { id: 'fares', label: 'Live fares & schedules' },
  { id: 'hotels', label: 'Live accommodation rates' },
  { id: 'events', label: 'Confirmed event dates' },
];

/** Search links for people to verify details themselves. */
export function verifyLinks(dest, origin, win, events) {
  const enc = encodeURIComponent;
  const when = win ? `${win.start.toLocaleString('en-GB', { month: 'long' })} ${win.start.getFullYear()}` : '';
  const links = [];
  if (origin) {
    links.push({ label: `Flights & trains ${origin.name} → ${dest.name}`, url: `https://www.google.com/travel/flights?q=${enc(`Flights from ${origin.name} to ${dest.name}${win ? ' on ' + iso(win.start) + ' returning ' + iso(win.end) : ''}`)}` });
  }
  links.push({ label: `Places to stay in ${dest.name}`, url: `https://www.google.com/travel/hotels/${enc(dest.name)}` });
  (events || []).slice(0, 2).forEach((m) => {
    links.push({ label: `Confirm dates: ${m.name}`, url: `https://www.google.com/search?q=${enc(`${m.name} ${win ? win.start.getFullYear() : ''} dates`)}` });
  });
  links.push({ label: `Official travel advice for ${dest.country}`, url: `https://www.google.com/search?q=${enc(`official travel advice ${dest.country} ${when}`)}` });
  return links;
}

export const research = {
  weather: openMeteoArchive,
  notConnected: NOT_CONNECTED,
  verifyLinks,
};
