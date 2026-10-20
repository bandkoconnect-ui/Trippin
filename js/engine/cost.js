/**
 * Cost estimation. Illustrative only — derived from typical mid-range daily
 * costs per destination, the chosen comfort level, trip length and a rough
 * round-trip travel estimate. Never a live price.
 */
import { COMFORT_LEVELS, BUDGET_BASIS } from './params.js';

export const DEFAULT_NIGHTS = 7;

export function comfortOf(params) {
  return COMFORT_LEVELS[params.comfort.set ? params.comfort.level : 1];
}

/**
 * @param dest destination
 * @param params all parameters
 * @param travelOption cheapest allowed journey option, or null
 */
export function estimateCost(dest, params, travelOption) {
  const comfort = comfortOf(params);
  const nights = params.dates.set ? params.dates.nights : DEFAULT_NIGHTS;
  const perDay = Math.round(dest.daily * comfort.mult);
  const stay = perDay * nights;
  const travel = travelOption ? Math.round(travelOption.cost * comfort.travelMult) : null;
  const perPerson = stay + (travel || 0);
  const travelers = params.budget.travelers || 2;
  return {
    nights, perDay, stay, travel, perPerson,
    group: perPerson * travelers, travelers,
    travelMode: travelOption ? travelOption.mode : null,
    comfort: comfort.label,
    assumptions: [
      `${nights} night${nights === 1 ? '' : 's'}${params.dates.set ? '' : ' (assumed — set dates to change)'}`,
      `${comfort.label} comfort: about €${perDay} per person per day for accommodation (sharing a double room), food and local transport`,
      travel != null
        ? `Round trip by ${travelOption.mode === 'bus' ? 'coach' : travelOption.mode}: about €${travel} per person`
        : 'Travel to the destination not included — choose a starting point to add it',
    ],
  };
}

export const AFFORD_BINS = [
  { id: 0, label: 'Comfortably within', max: 0.75 },
  { id: 1, label: 'Within budget', max: 1.0 },
  { id: 2, label: 'A stretch', max: 1.2 },
  { id: 3, label: 'Over budget', max: Infinity },
];

/** Compare an estimate to the budget on the selected basis. */
export function affordability(cost, budget) {
  const basis = BUDGET_BASIS.find((b) => b.id === budget.basis) || BUDGET_BASIS[0];
  let value;
  if (basis.id === 'daily') value = cost.perDay;
  else if (basis.id === 'total') value = cost.group;
  else value = cost.perPerson;
  const ratio = value / budget.amount;
  const bin = AFFORD_BINS.find((b) => ratio <= b.max);
  return { value, ratio, bin: bin.id, label: bin.label, basis: basis.id, excludesTravel: basis.id !== 'daily' && cost.travel == null };
}

export function euros(n) {
  if (n == null || !isFinite(n)) return '—';
  return '€' + Math.round(n).toLocaleString('en-GB');
}
