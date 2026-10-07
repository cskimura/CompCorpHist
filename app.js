// CompCorpHist renderer: loads data.yaml, computes an automatic row order
// (Reverse Cuthill-McKee + local adjacent-swap refinement) to minimize how
// far event lines have to span, then draws the SVG timeline and wires up
// click-to-highlight.

const BASE_H = 24;
const YEAR_WIDTH = 10; // px per month -> 120px per year
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const KIND_STYLE = {
  acquired:    { color: '#d6362b', dash: null,     width: 1.5 },
  merged:      { color: '#8e44ad', dash: null,     width: 2.5 },
  'spun-off':  { color: '#2e8b57', dash: '6 4',    width: 1.5 },
  'carved-out':{ color: '#1a8a8a', dash: '6 4',    width: 1.5 },
  invested:    { color: '#2563eb', dash: null,     width: 1.5 },
  partnership: { color: '#e08e0b', dash: '2 3',    width: 1.5 },
  transfer:    { color: '#8a5a2b', dash: null,     width: 1.5 },
  subsidiary:  { color: '#6b7280', dash: '6 4',    width: 1.5 },
  // a business unit changes hands but neither corporation's lifeline ends
  divested:    { color: '#5b7fa6', dash: '3 3',    width: 1.5 },
};

const RENAME_COLOR = '#444';

main();

async function main() {
  const text = await fetch('data.yaml').then(r => r.text());
  const data = jsyaml.load(text);

  const today = new Date();
  const nowStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  resolveCorporationDates(data.corporation, nowStr);
  const events = resolveEventDates(data.event, data.corporation);

  const order = computeOrder(data.corporation, events);
  render(data.corporation, events, order, nowStr);
}

function epoch1900(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return 0;
  let y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) || 1;
  if (y < 1900) y = 1900;
  return (y - 1900) * 12 + mo;
}

function minusYears(dateStr, years) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return `${String(parseInt(m[1], 10) - years).padStart(4, '0')}-${m[2]}-${m[3]}`;
}

function resolveCorporationDates(corporation, nowStr) {
  for (const name of Object.keys(corporation)) {
    const c = corporation[name];
    if (c.to === 'now' || !c.to) c.to = nowStr;
    c.unknownFounded = !c.from;
    if (!c.from) c.from = minusYears(c.to, 10);
    c.from1900 = epoch1900(c.from);
    c.to1900 = epoch1900(c.to);
  }
}

function resolveEventDates(rawEvents, corporation) {
  return rawEvents.map(e => {
    let date = e.date;
    const m = /^(.+):(start|end)$/.exec(date);
    if (m) {
      const corp = corporation[m[1]];
      date = corp ? (m[2] === 'start' ? corp.from : corp.to) : date;
    }
    return { ...e, date, x1900: epoch1900(date) };
  }).filter(e => corporation[e.source] && corporation[e.target]);
}

// --- automatic layout ---------------------------------------------------

function computeOrder(corporation, events) {
  const names = Object.keys(corporation);
  const weight = new Map(); // "a|b" -> count
  const adj = new Map(names.map(n => [n, new Set()]));

  for (const e of events) {
    if (e.source === e.target) continue;
    adj.get(e.source).add(e.target);
    adj.get(e.target).add(e.source);
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`;
    weight.set(key, (weight.get(key) || 0) + 1);
  }

  const order = reverseCuthillMcKee(names, adj);
  refineByAdjacentSwap(order, adj, weight);
  return order;
}

function reverseCuthillMcKee(names, adj) {
  const degree = n => adj.get(n).size;
  const visited = new Set();
  const components = [];

  for (const start of names) {
    if (visited.has(start)) continue;
    const comp = [];
    // pick the lowest-degree node in this component as the BFS root
    const compNodes = new Set();
    const stack = [start];
    const seen = new Set([start]);
    while (stack.length) {
      const n = stack.pop();
      compNodes.add(n);
      for (const nb of adj.get(n)) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    let root = start;
    for (const n of compNodes) if (degree(n) < degree(root)) root = n;

    const bfsVisited = new Set([root]);
    let frontier = [root];
    comp.push(root);
    while (comp.length < compNodes.size) {
      let next = [];
      for (const n of frontier) {
        const children = [...adj.get(n)].filter(c => !bfsVisited.has(c));
        children.sort((a, b) => degree(a) - degree(b));
        for (const c of children) {
          if (bfsVisited.has(c)) continue;
          bfsVisited.add(c);
          comp.push(c);
          next.push(c);
        }
      }
      if (next.length === 0) {
        // disconnected remainder within "component" bookkeeping shouldn't happen
        break;
      }
      frontier = next;
    }
    comp.reverse(); // reverse-CM
    components.push(comp);
    for (const n of comp) visited.add(n);
  }

  components.sort((a, b) => b.length - a.length);
  return components.flat();
}

function refineByAdjacentSwap(order, adj, weight) {
  const pos = new Map(order.map((n, i) => [n, i]));
  const w = (a, b) => weight.get(a < b ? `${a}|${b}` : `${b}|${a}`) || 0;

  const MAX_PASSES = 25;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i], b = order[i + 1];
      let delta = 0;
      for (const c of adj.get(a)) {
        if (c === b) continue;
        const p = pos.get(c);
        delta += (p < i ? 1 : -1) * w(a, c);
      }
      for (const c of adj.get(b)) {
        if (c === a) continue;
        const p = pos.get(c);
        delta += (p < i ? -1 : 1) * w(b, c);
      }
      if (delta < 0) {
        order[i] = b; order[i + 1] = a;
        pos.set(a, i + 1); pos.set(b, i);
        improved = true;
      }
    }
    if (!improved) break;
  }
}

// --- rendering -----------------------------------------------------------

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function render(corporation, events, order, nowStr) {
  const totalCorp = order.length;
  const maxHeight = (totalCorp + 2) * BASE_H;
  const endYear = parseInt(nowStr.slice(0, 4), 10) + 1;
  const width = (endYear - 1900) * YEAR_WIDTH + 200;

  const svg = svgEl('svg', { width, height: maxHeight, id: 'chart' });

  const defs = svgEl('defs');
  for (const [kind, style] of Object.entries(KIND_STYLE)) {
    const marker = svgEl('marker', {
      id: `arrow-${kind}`, markerWidth: 8, markerHeight: 8, refx: 7, refy: 3,
      orient: 'auto', markerUnits: 'strokeWidth',
    });
    marker.appendChild(svgEl('path', { d: 'M0,0 L0,6 L7,3 z', fill: style.color }));
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  // year grid
  for (let year = 1900; year <= endYear; year += 5) {
    const xPos = (year - 1900) * YEAR_WIDTH;
    svg.appendChild(svgEl('text', { x: xPos, y: BASE_H - 6, class: 'year-label' })).textContent = year;
    svg.appendChild(svgEl('line', {
      x1: xPos, y1: BASE_H, x2: xPos, y2: maxHeight, class: 'grid-line',
    }));
  }

  const pos = new Map(order.map((n, i) => [n, i]));
  const rowY = name => (pos.get(name) + 1.5) * BASE_H;
  const colX1900 = v => v / 12 * YEAR_WIDTH;

  const neighbors = buildNeighborIndex(events);

  // corporation lifelines
  for (const name of order) {
    const c = corporation[name];
    const y = rowY(name);
    const x1 = colX1900(c.from1900);
    const x2 = colX1900(c.to1900);

    const g = svgEl('g', { class: 'corp', 'data-corp': name });

    const line = svgEl('line', {
      x1, y1: y, x2, y2: y, class: 'corp-line',
      'stroke-dasharray': c.unknownFounded ? '4 4' : '',
    });
    g.appendChild(line);

    const wrapIfWiki = (el, wiki) => {
      if (!wiki) return el;
      const a = svgEl('a');
      a.setAttributeNS(XLINK_NS, 'href', wiki);
      a.setAttribute('target', '_blank');
      a.appendChild(el);
      return a;
    };

    const labelStart = svgEl('text', { x: x1 + 3, y: y - 4, class: 'corp-label' });
    labelStart.textContent = name;
    g.appendChild(wrapIfWiki(labelStart, c.wiki));

    // if the company was renamed, the lifeline keeps going but the end
    // label and its link should reflect the most recent name.
    const renames = c.renames || [];
    const latest = renames[renames.length - 1];
    const currentName = latest ? latest.name : name;
    const currentWiki = latest ? (latest.wiki || c.wiki) : c.wiki;
    const endLabel = c.end_reason ? `${currentName} (${c.end_reason})` : currentName;
    const labelEnd = svgEl('text', { x: x2 + 3, y: y - 4, class: 'corp-label' });
    labelEnd.textContent = endLabel;
    g.appendChild(wrapIfWiki(labelEnd, currentWiki));

    for (const r of renames) {
      const rx = colX1900(epoch1900(r.date));
      g.appendChild(svgEl('line', {
        x1: rx, y1: y - 6, x2: rx, y2: y + 6, class: 'rename-tick', stroke: RENAME_COLOR,
      }));
      const rLabel = svgEl('text', { x: rx + 3, y: y - 4, class: 'corp-label', fill: RENAME_COLOR });
      rLabel.textContent = `renamed to ${r.name}`;
      g.appendChild(wrapIfWiki(rLabel, r.wiki || c.wiki));
    }

    svg.appendChild(g);
  }

  // events
  for (const e of events) {
    const style = KIND_STYLE[e.kind] || KIND_STYLE.acquired;
    const x = colX1900(e.x1900);
    const y1 = rowY(e.source);
    const y2 = rowY(e.target);
    // stop short of the target's lifeline so the arrowhead tip touches it
    // instead of overlapping/piercing through its stroke.
    const ARROW_GAP = 6;
    const y2Arrow = y2 + (y1 < y2 ? -ARROW_GAP : ARROW_GAP);

    const g = svgEl('g', {
      class: 'event', 'data-source': e.source, 'data-target': e.target, 'data-kind': e.kind,
    });
    g.appendChild(svgEl('line', {
      x1: x, y1, x2: x, y2: y2Arrow, class: 'event-line',
      stroke: style.color, 'stroke-width': style.width,
      'stroke-dasharray': style.dash || '',
      'marker-end': `url(#arrow-${e.kind})`,
    }));
    g.appendChild(svgEl('circle', { cx: x, cy: y1, r: 3, fill: style.color }));
    const label = svgEl('text', { x: x + 4, y: (y1 + y2) / 2, class: 'event-label', fill: style.color });
    label.textContent = e.label;
    g.appendChild(label);

    svg.appendChild(g);
  }

  document.getElementById('app').appendChild(svg);
  setupInteraction(svg, neighbors);
}

function buildNeighborIndex(events) {
  const idx = new Map();
  for (const e of events) {
    if (!idx.has(e.source)) idx.set(e.source, new Set());
    if (!idx.has(e.target)) idx.set(e.target, new Set());
    idx.get(e.source).add(e.target);
    idx.get(e.target).add(e.source);
  }
  return idx;
}

function setupInteraction(svg, neighbors) {
  function clear() {
    svg.querySelectorAll('.dim').forEach(el => el.classList.remove('dim'));
    svg.querySelectorAll('.focus').forEach(el => el.classList.remove('focus'));
  }

  function focusOn(corpName) {
    clear();
    const related = new Set([corpName, ...(neighbors.get(corpName) || [])]);
    svg.querySelectorAll('.corp').forEach(g => {
      const name = g.getAttribute('data-corp');
      g.classList.add(related.has(name) ? 'focus' : 'dim');
    });
    svg.querySelectorAll('.event').forEach(g => {
      const touches = g.getAttribute('data-source') === corpName || g.getAttribute('data-target') === corpName;
      g.classList.add(touches ? 'focus' : 'dim');
    });
  }

  svg.querySelectorAll('.corp').forEach(g => {
    g.addEventListener('click', ev => {
      ev.stopPropagation();
      focusOn(g.getAttribute('data-corp'));
    });
  });

  svg.addEventListener('click', clear);
}
