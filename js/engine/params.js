/**
 * The seven travel parameters, their defaults and how they describe themselves.
 * Each parameter has `set` (has the person chosen a value?) plus its value fields.
 * Clearing a parameter returns it to these defaults with set = false.
 */
export const PARAM_ORDER = ['dates', 'origin', 'budget', 'transport', 'culture', 'comfort', 'distance'];

export const PARAM_META = {
  dates: { label: 'Dates', title: 'Travel dates', changes: 'Colours places by how good they usually are in your window, and surfaces festivals.' },
  origin: { label: 'From', title: 'Starting point', changes: 'Adds journey times and travel costs from here, and anchors culture and range.' },
  budget: { label: 'Budget', title: 'Budget', changes: 'Colours places by whether an estimated trip fits your budget.' },
  transport: { label: 'Travel', title: 'Getting there', changes: 'Keeps places you could plausibly reach the way you like to travel.' },
  culture: { label: 'Culture', title: 'Cultural difference', changes: 'Highlights places that feel as familiar — or as new — as you want.' },
  comfort: { label: 'Comfort', title: 'Comfort level', changes: 'Adjusts costs and favours places whose logistics suit your style.' },
  distance: { label: 'Range', title: 'How far', changes: 'Limits places by estimated door-to-door journey time.' },
};

export const FLEX = [
  { id: 'exact', label: 'Exact dates', days: 0 },
  { id: 'week', label: '± 1 week', days: 7 },
  { id: 'month', label: 'Any time that month', days: null },
];

export const BUDGET_BASIS = [
  { id: 'person', label: 'Per person', hint: 'Whole trip for one traveller, including getting there when a starting point is set.' },
  { id: 'total', label: 'Whole group', hint: 'Whole trip for everyone travelling together.' },
  { id: 'daily', label: 'Per day', hint: 'Daily spending on the ground per person — travel there excluded.' },
];

export const BUDGET_RANGE = {
  person: { min: 300, max: 6000, step: 50 },
  total: { min: 500, max: 20000, step: 100 },
  daily: { min: 30, max: 600, step: 5 },
};

export const MODES = [
  { id: 'plane', label: 'Plane' },
  { id: 'train', label: 'Train' },
  { id: 'car', label: 'Car' },
  { id: 'bus', label: 'Coach' },
  { id: 'ferry', label: 'Ferry' },
];

export const CULTURE_LEVELS = [
  { id: 0, label: 'Familiar', feel: 'familiar', hint: 'Similar language, food and everyday customs.' },
  { id: 1, label: 'Somewhat different', feel: 'somewhat different', hint: 'Some things will feel new, much will feel known.' },
  { id: 2, label: 'Very different', feel: 'very different', hint: 'New language and food; daily life works differently.' },
  { id: 3, label: 'Completely new to me', feel: 'completely new', hint: 'Little that resembles home — a full change of world.' },
];

export const COMFORT_LEVELS = [
  { id: 0, label: 'Simple', hint: 'Hostels and guesthouses, public transport, long journeys are fine.', mult: 0.6, travelMult: 0.9, complexityTol: 5, journeyTol: 30 },
  { id: 1, label: 'Balanced', hint: 'Good mid-range hotels, a mix of transport, some effort is fine.', mult: 1, travelMult: 1, complexityTol: 4, journeyTol: 24 },
  { id: 2, label: 'Comfortable', hint: 'Upper-mid hotels, short transfers, few connections, easy logistics.', mult: 1.6, travelMult: 1.35, complexityTol: 3, journeyTol: 14 },
  { id: 3, label: 'Premium', hint: 'Top hotels and premium cabins; money smooths the effort.', mult: 2.7, travelMult: 3, complexityTol: 4, journeyTol: 22 },
];

export const DISTANCE_LIMITS = [
  { id: 'nearby', label: 'Nearby', hours: 3, hint: 'Up to ~3 hours' },
  { id: 'hours', label: 'A few hours', hours: 6, hint: 'Up to ~6 hours' },
  { id: 'day', label: 'Within a day', hours: 14, hint: 'Up to ~14 hours' },
  { id: 'longhaul', label: 'Long-haul', hours: 30, hint: 'Up to ~30 hours, connections included' },
  { id: 'anywhere', label: 'Anywhere', hours: Infinity, hint: 'No limit' },
];

export function defaultParams() {
  return {
    dates: { set: true, start: 30, nights: 7, flex: 'week' },
    origin: { set: false, id: null },
    budget: { set: false, amount: 1500, basis: 'person', travelers: 2 },
    transport: { set: false, modes: ['plane', 'train'] },
    culture: { set: false, level: 2 },
    comfort: { set: false, level: 1 },
    distance: { set: false, limit: 'day' },
  };
}

export function blankParam(key) {
  const p = defaultParams()[key];
  p.set = false;
  return p;
}
