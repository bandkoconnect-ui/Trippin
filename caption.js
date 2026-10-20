/** Map caption: what the map shows, its legend, what's ruled out, empty states. */
import { h, clear, icon } from './dom.js';
import { ICONS } from './icons.js';
import { PARAM_META } from '../engine/params.js';
import { legendFor, relaxGain } from '../engine/suitability.js';
import * as store from '../store.js';

export function renderCaption(el, state, cap) {
  clear(el);
  const openParam = (k) => (k === state.active ? store.setEditorOpen(true) : store.setActive(k));
  const legend = legendFor(state.active);
  const head = h('div', { class: 'cap-head' },
    h('span', { class: 'cap-kicker' }, 'Showing'),
    h('h1', { class: 'cap-title' }, cap.title));
  const sentence = h('p', { class: 'cap-sentence' }, cap.sentence);

  const items = h('ul', { class: 'legend', 'aria-label': 'Legend' });
  if (!cap.needsOrigin) {
    legend.items.forEach((it) => items.appendChild(h('li', null, h('i', { class: 'sw', style: { background: it.color } }), it.label)));
  }
  if (cap.hidden.some((x) => x.param !== state.active)) items.appendChild(h('li', null, h('i', { class: 'sw sw-hatch' }), 'Ruled out by other choices'));
  if (state.active === 'dates' && state.params.dates.set) items.appendChild(h('li', null, h('i', { class: 'sw sw-event' }), 'Festival or event in window'));

  const foot = h('div', { class: 'cap-foot' });
  if (cap.needsOrigin) {
    foot.appendChild(h('button', { class: 'pill-btn accent', onclick: () => store.setActive('origin') }, icon(ICONS.origin, 'icon sm'), 'Choose starting point'));
  } else {
    foot.appendChild(h('button', { class: 'pill-btn', onclick: () => store.openList(), 'aria-label': `List ${cap.shown} matching places` }, icon(ICONS.list, 'icon sm'), `${cap.shown} place${cap.shown === 1 ? '' : 's'}`));
  }
  if (cap.hidden.length && cap.shown > 0) {
    const out = h('span', { class: 'ruled-out' }, 'Ruled out by ');
    cap.hidden.slice(0, 3).forEach((x, i) => {
      if (i) out.appendChild(document.createTextNode(' · '));
      out.appendChild(h('button', { class: 'link-btn', onclick: () => openParam(x.param) }, `${PARAM_META[x.param].label.toLowerCase()} (${x.count})`));
    });
    foot.appendChild(out);
  }

  el.append(head, sentence, items, foot);

  // Empty state: nothing satisfies every choice at once.
  if (cap.shown === 0 && !cap.needsOrigin) {
    const keys = Object.keys(state.params).filter((k) => state.params[k].set && k !== 'origin');
    const gains = keys.map((k) => ({ k, n: relaxGain(state.params, state.active, k) }))
      .filter((g) => g.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
    const box = h('div', { class: 'empty-box', role: 'status' },
      h('strong', null, 'Nothing fits all of these at once.'),
      h('p', null, gains.length ? 'Loosening one choice opens things up:' : 'Several choices pull against each other — try loosening two of them.'));
    const opts = h('div', { class: 'relax' });
    gains.forEach((g) => {
      opts.appendChild(h('button', { class: 'pill-btn', onclick: () => openParam(g.k) }, `${PARAM_META[g.k].label}: +${g.n} place${g.n === 1 ? '' : 's'}`));
    });
    if (!gains.length) opts.appendChild(h('button', { class: 'pill-btn', onclick: () => store.resetAll() }, 'Start again'));
    box.appendChild(opts);
    el.appendChild(box);
  }
}
