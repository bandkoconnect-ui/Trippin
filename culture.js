/**
 * Cultural novelty — an exploratory proxy, not a ranking of cultures.
 *
 * It compares four observable dimensions between the starting point and a
 * destination using hierarchical codes (e.g. "ie.germanic.west.de"): the more
 * leading segments two codes share, the more similar that dimension is.
 *   language  (family → branch → group → language)   weight 0.30
 *   script    (same writing system or not)            weight 0.15
 *   food      (culinary region)                       weight 0.25
 *   customs   (everyday social environment region)    weight 0.30
 * It says nothing about any individual's own background or identity.
 */
const WEIGHTS = { lang: 0.3, script: 0.15, food: 0.25, customs: 0.3 };

function prefixSimilarity(a, b) {
  const x = a.split('.'), y = b.split('.');
  const len = Math.max(x.length, y.length);
  let shared = 0;
  while (shared < len && x[shared] === y[shared]) shared++;
  return shared / len;
}

function scriptSimilarity(a, b) {
  if (a === b) return 1;
  const pair = [a, b].sort().join('+');
  if (pair === 'han+japanese') return 0.5; // kanji overlap
  return 0;
}

export const CULTURE_DIM_LABELS = { lang: 'Language', script: 'Writing', food: 'Food', customs: 'Everyday customs' };

export function cultureCompare(origin, dest) {
  const o = origin.culture, d = dest.culture;
  const sims = {
    lang: prefixSimilarity(o.lang, d.lang),
    script: scriptSimilarity(o.script, d.script),
    food: prefixSimilarity(o.food, d.food),
    customs: prefixSimilarity(o.customs, d.customs),
  };
  let sim = 0;
  for (const k in WEIGHTS) sim += WEIGHTS[k] * sims[k];
  const novelty = 1 - sim;
  const level = novelty < 0.3 ? 0 : novelty < 0.6 ? 1 : novelty < 0.88 ? 2 : 3;
  const describe = (k, s) => {
    if (k === 'script') return s === 1 ? 'Same alphabet' : s > 0 ? 'Partly shared characters' : 'Different writing system';
    if (s >= 0.99) return 'Very similar';
    if (s >= 0.5) return 'Related';
    if (s > 0) return 'Distantly related';
    return 'Different';
  };
  const dims = Object.keys(WEIGHTS).map((k) => ({ key: k, label: CULTURE_DIM_LABELS[k], sim: sims[k], text: describe(k, sims[k]) }));
  return { novelty, level, dims };
}
