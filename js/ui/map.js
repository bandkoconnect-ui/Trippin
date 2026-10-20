/**
 * Interactive world map — d3-geo projection + d3-zoom, rendered to SVG.
 * Draws country boundaries, data encodings for the active parameter,
 * destination markers, the starting point and the selected route.
 * Rendering only: it receives already-evaluated, already-encoded data.
 */
import { PALETTE } from '../engine/suitability.js';
import { reducedMotion } from './dom.js';

const d3 = window.d3;

export function createMap(container, handlers) {
  let width = 0, height = 0;
  let features = null;
  let featureByIso = new Map();
  let lastData = null;
  let savedTransform = null;
  let currentK = 1;

  const projection = d3.geoNaturalEarth1();
  const path = d3.geoPath(projection);

  const svg = d3.select(container).append('svg')
    .attr('class', 'map-svg')
    .attr('role', 'img')
    .attr('aria-label', 'World map of destinations');

  const defs = svg.append('defs');
  const hatch = defs.append('pattern').attr('id', 'hatch').attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  hatch.append('rect').attr('width', 5).attr('height', 5).attr('fill', PALETTE.land);
  hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 5).attr('stroke', PALETTE.grape).attr('stroke-opacity', 0.28).attr('stroke-width', 1.4);

  const root = svg.append('g').attr('class', 'map-root');
  const sphere = root.append('path').attr('class', 'sphere');
  const graticule = root.append('path').attr('class', 'graticule');
  const countriesG = root.append('g').attr('class', 'countries');
  const hatchG = root.append('g').attr('class', 'hatches');
  const routeG = root.append('g').attr('class', 'route');
  const originG = root.append('g').attr('class', 'origin');
  const markersG = root.append('g').attr('class', 'markers');

  const zoom = d3.zoom().scaleExtent([0.6, 14])
    .on('zoom', (ev) => {
      root.attr('transform', ev.transform);
      currentK = ev.transform.k;
      scaleMarkers();
    });
  svg.call(zoom).on('dblclick.zoom', null);
  svg.on('click', (ev) => { if (ev.target === svg.node() || ev.target.classList.contains('sphere') || ev.target.classList.contains('graticule')) handlers.onBackground && handlers.onBackground(); });

  const tooltip = document.getElementById('tooltip');

  function dur(ms) { return reducedMotion() ? 0 : ms; }

  function layout() {
    width = container.clientWidth;
    height = container.clientHeight;
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
    const pad = 12;
    projection.fitExtent([[pad, pad], [width - pad, height - pad]], { type: 'Sphere' });
    zoom.translateExtent([[-width * 0.6, -height * 0.6], [width * 1.6, height * 1.6]]).extent([[0, 0], [width, height]]);
    sphere.attr('d', path({ type: 'Sphere' }));
    graticule.attr('d', path(d3.geoGraticule10()));
    countriesG.selectAll('path').attr('d', path);
    hatchG.selectAll('path').attr('d', path);
    if (lastData) drawMarkers(lastData, true);
  }

  function setWorld(f) {
    features = f;
    featureByIso = new Map();
    if (!f) return;
    f.forEach((ft) => { if (ft.id) featureByIso.set(ft.id, ft); });
    countriesG.selectAll('path').data(f, (d) => d.id || d.properties.name).join('path')
      .attr('class', 'country')
      .attr('d', path)
      .attr('fill', PALETTE.land)
      .on('click', (ev, d) => { ev.stopPropagation(); handlers.onCountry && handlers.onCountry(d.id, d.properties.name); })
      .on('pointerenter', (ev, d) => showTip(ev, d))
      .on('pointermove', (ev) => moveTip(ev))
      .on('pointerleave', hideTip);
    if (lastData) update(lastData);
  }

  /** data: { encoded: Map(id→enc), evals: Map(id→eval), byIso: Map(iso→{enc, dest}), selected, origin, active } */
  function update(data) {
    lastData = data;
    const t = d3.transition().duration(dur(450)).ease(d3.easeCubicOut);
    if (features) {
      countriesG.selectAll('path.country')
        .classed('has-dest', (d) => data.byIso.has(d.id))
        .classed('selected', (d) => data.selectedIso === d.id)
        .transition(t)
        .attr('fill', (d) => {
          const g = data.byIso.get(d.id);
          if (!g) return PALETTE.land;
          return g.enc.excluded ? PALETTE.land : g.enc.color;
        });
      const hatched = features.filter((ft) => data.byIso.has(ft.id) && data.byIso.get(ft.id).enc.excluded);
      hatchG.selectAll('path').data(hatched, (d) => d.id).join(
        (enter) => enter.append('path').attr('d', path).attr('fill', 'url(#hatch)').attr('opacity', 0)
          .call((e) => e.transition(t).attr('opacity', 1)),
        (upd) => upd.call((u) => u.transition(t).attr('opacity', 1)),
        (exit) => exit.call((x) => x.transition(t).attr('opacity', 0).remove()),
      ).attr('pointer-events', 'none');
    }
    drawMarkers(data);
    drawOrigin(data);
    drawRoute(data);
  }

  function drawMarkers(data, instant) {
    const items = [...data.encoded.entries()].map(([id, enc]) => ({ id, enc, e: data.evals.get(id) }));
    // draw excluded first so viable places sit on top
    items.sort((a, b) => (b.enc.excluded - a.enc.excluded));
    const sel = markersG.selectAll('g.marker').data(items, (d) => d.id).join((enter) => {
      const g = enter.append('g').attr('class', 'marker')
        .attr('tabindex', 0).attr('role', 'button');
      g.append('circle').attr('class', 'halo');
      g.append('circle').attr('class', 'ring');
      g.append('circle').attr('class', 'dot');
      g.append('path').attr('class', 'event-mark');
      g.append('text').attr('class', 'label');
      g.on('click', (ev, d) => { ev.stopPropagation(); handlers.onSelect(d.id); })
        .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handlers.onSelect(d.id); } })
        .on('pointerenter', (ev, d) => showTipDest(ev, d))
        .on('pointermove', (ev) => moveTip(ev))
        .on('pointerleave', hideTip);
      return g;
    });
    sel.order();
    sel.attr('transform', (d) => { const p = projection([d.e.dest.lon, d.e.dest.lat]); return `translate(${p[0]},${p[1]})`; })
      .classed('excluded', (d) => d.enc.excluded)
      .classed('unknown', (d) => d.enc.cat == null)
      .classed('selected', (d) => d.id === data.selected)
      .classed('has-event', (d) => data.active === 'dates' && d.e.events.length > 0 && !d.enc.excluded)
      .attr('aria-label', (d) => `${d.e.dest.name}, ${d.e.dest.country}. ${d.enc.excluded ? 'Ruled out by your other choices. ' : ''}${d.enc.detail || ''}`);
    const t = d3.transition().duration(instant ? 0 : dur(450));
    sel.select('circle.dot').transition(t).attr('fill', (d) => (d.enc.excluded ? PALETTE.land : d.enc.color));
    sel.select('text.label').text((d) => d.e.dest.name);
    scaleMarkers();
  }

  function scaleMarkers() {
    const k = currentK;
    const inv = 1 / k;
    markersG.selectAll('g.marker').each(function (d) {
      const g = d3.select(this);
      const ex = d.enc.excluded;
      const r = (ex ? 3 : 5) * inv;
      g.select('circle.dot').attr('r', r).attr('stroke-width', (ex ? 1 : 1.3) * inv);
      g.select('circle.ring').attr('r', r + (ex ? 1 : 2) * inv);
      g.select('circle.halo').attr('r', 13 * inv);
      const s = 3.2 * inv, off = 7 * inv;
      g.select('path.event-mark').attr('d', `M${off},${-off - s} L${off + s},${-off} L${off},${-off + s} L${off - s},${-off} Z`).attr('stroke-width', 1 * inv);
      g.select('text.label').attr('x', 9 * inv).attr('y', 3.6 * inv).style('font-size', `${11.5 * inv}px`).style('stroke-width', `${3 * inv}px`);
      g.classed('show-label', d.id === (lastData && lastData.selected) || (!ex && k >= 3.2));
    });
    originG.selectAll('rect').attr('width', 10 * inv).attr('height', 10 * inv).attr('x', -5 * inv).attr('y', -5 * inv).attr('stroke-width', 1.5 * inv);
    originG.selectAll('text').attr('x', 9 * inv).attr('y', 4 * inv).style('font-size', `${11 * inv}px`).style('stroke-width', `${3 * inv}px`);
    routeG.selectAll('path').attr('stroke-width', 1.8 * inv).attr('stroke-dasharray', `${4 * inv} ${4 * inv}`);
  }

  function drawOrigin(data) {
    const o = data.origin;
    const g = originG.selectAll('g.origin-mark').data(o ? [o] : [], (d) => d.id).join((enter) => {
      const e = enter.append('g').attr('class', 'origin-mark');
      e.append('rect');
      e.append('text').attr('class', 'label origin-label');
      return e;
    });
    g.attr('transform', (d) => { const p = projection([d.lon, d.lat]); return `translate(${p[0]},${p[1]})`; });
    g.select('text').text((d) => d.name);
    scaleMarkers();
  }

  function drawRoute(data) {
    const e = data.selected && data.evals.get(data.selected);
    const show = data.origin && e;
    const line = show ? [{ type: 'LineString', coordinates: [[data.origin.lon, data.origin.lat], [e.dest.lon, e.dest.lat]] }] : [];
    routeG.selectAll('path').data(line).join('path').attr('d', path);
    scaleMarkers();
  }

  /* ───────── tooltips (mouse only; touch taps select directly) ───────── */
  function showTip(ev, d) {
    if (ev.pointerType !== 'mouse' || !lastData) return;
    const g = lastData.byIso.get(d.id);
    const name = d.properties.name;
    tooltip.innerHTML = g
      ? `<strong>${g.dest.name}</strong><span>${name}</span><em>${g.enc.excluded ? 'Ruled out by your other choices' : g.enc.detail || ''}</em>`
      : `<strong>${name}</strong><span>Not in this prototype’s curated set yet</span>`;
    tooltip.classList.add('show');
    moveTip(ev);
  }
  function showTipDest(ev, d) {
    if (ev.pointerType !== 'mouse') return;
    tooltip.innerHTML = `<strong>${d.e.dest.name}</strong><span>${d.e.dest.country}</span><em>${d.enc.excluded ? 'Ruled out by your other choices' : d.enc.detail || ''}</em>`;
    tooltip.classList.add('show');
    moveTip(ev);
  }
  function moveTip(ev) {
    if (!tooltip.classList.contains('show')) return;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
    const y = Math.max(8, ev.clientY - tooltip.offsetHeight - 10);
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }
  function hideTip() { tooltip.classList.remove('show'); }

  /* ───────── camera ───────── */
  function boxOf(inset) {
    const i = inset || { top: 0, right: 0, bottom: 0, left: 0 };
    return { x0: i.left, y0: i.top, x1: width - i.right, y1: height - i.bottom };
  }

  function focus(dest, inset) {
    if (!savedTransform) savedTransform = d3.zoomTransform(svg.node());
    const b = boxOf(inset);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const pt = projection([dest.lon, dest.lat]);
    let k = 4.5, cx = pt[0], cy = pt[1];
    const ft = featureByIso.get(dest.iso);
    if (ft) {
      const [[x0, y0], [x1, y1]] = path.bounds(ft);
      const inside = pt[0] >= x0 && pt[0] <= x1 && pt[1] >= y0 && pt[1] <= y1;
      const fitK = 0.8 * Math.min(bw / Math.max(1, x1 - x0), bh / Math.max(1, y1 - y0));
      if (inside && fitK >= 2.2) { k = Math.min(9, fitK); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; }
    }
    k = Math.min(k, 9);
    const tx = (b.x0 + bw / 2) - k * cx;
    const ty = (b.y0 + bh / 2) - k * cy;
    svg.transition().duration(dur(750)).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  function restore() {
    if (!savedTransform) return;
    const t = savedTransform;
    savedTransform = null;
    svg.transition().duration(dur(600)).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }

  function forgetSaved() { savedTransform = null; }

  function zoomBy(f) { svg.transition().duration(dur(250)).call(zoom.scaleBy, f); }

  function home(center, inset, fitWhole) {
    savedTransform = null;
    const b = boxOf(inset);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const sb = path.bounds({ type: 'Sphere' });
    const mapW = sb[1][0] - sb[0][0], mapH = sb[1][1] - sb[0][1];
    let k, p;
    if (fitWhole) {
      // large screens: show the whole world beside the panels
      k = Math.max(0.6, Math.min(1.6, Math.min(bw / mapW, bh / mapH) * 0.98));
      p = [(sb[0][0] + sb[1][0]) / 2, (sb[0][1] + sb[1][1]) / 2];
    } else {
      // phones: fill the visible height and centre on a region; pan for the rest
      k = Math.max(1, Math.min(2.4, (bh * 0.92) / mapH));
      p = projection(center || [12, 28]);
    }
    const tx = (b.x0 + bw / 2) - k * p[0];
    const ty = (b.y0 + bh / 2) - k * p[1];
    svg.transition().duration(dur(600)).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  layout();
  const ro = new ResizeObserver(() => layout());
  ro.observe(container);

  return { setWorld, update, focus, restore, forgetSaved, zoomBy, home, layout, hasWorld: () => !!features, featureFor: (iso) => featureByIso.get(iso) };
}
