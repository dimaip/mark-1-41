// Renders the whole page from content/data.json.
// Content lives only in the data file; this script handles layout and interaction.

const D = await fetch('content/data.json', { cache: 'no-cache' }).then(r => {
  if (!r.ok) throw new Error('Could not load content/data.json');
  return r.json();
});

/* ---------- helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GREEK = '\\u0370-\\u03FF\\u1F00-\\u1FFF';
const reGreek = new RegExp(`[${GREEK}](?:[${GREEK}\\u0300-\\u036F\\s·.,;:…’᾿-]*[${GREEK}])?`, 'g');
const reSyriac = /[܀-ݏ](?:[܀-ݏ\s]*[܀-ݏ])?/g;

// Escape and tag Greek and Syriac runs with the right language and direction.
function rich(s) {
  return esc(s)
    .replace(reSyriac, m => `<span lang="syr" dir="rtl" class="syr">${m}</span>`)
    .replace(reGreek, m => `<span lang="grc">${m}</span>`);
}

const READING_LABEL = {
  anger: 'anger', compassion: 'compassion', both: 'both', none: 'neither word',
  omit: 'neither word', open: 'open', disputed: 'disputed'
};
const readingClass = r => ({ omit: 'none', disputed: 'both' }[r] || r);

// Shape + colour marker: anger = diamond, compassion = circle, both = split circle, none/open = ring.
function marker(reading, size = 14) {
  const r = readingClass(reading);
  const s = size, h = s / 2;
  let inner;
  if (r === 'anger') inner = `<rect x="${h * 0.32}" y="${h * 0.32}" width="${s * 0.68}" height="${s * 0.68}" transform="rotate(45 ${h} ${h})" fill="var(--anger)"/>`;
  else if (r === 'compassion') inner = `<circle cx="${h}" cy="${h}" r="${h * 0.86}" fill="var(--comp)"/>`;
  else if (r === 'both') inner = `<path d="M${h} ${h * 0.14} A${h * 0.86} ${h * 0.86} 0 0 0 ${h} ${s - h * 0.14} Z" fill="var(--anger)"/><path d="M${h} ${h * 0.14} A${h * 0.86} ${h * 0.86} 0 0 1 ${h} ${s - h * 0.14} Z" fill="var(--comp)"/>`;
  else inner = `<circle cx="${h}" cy="${h}" r="${h * 0.7}" fill="none" stroke="var(--neutral)" stroke-width="${Math.max(1.6, s * 0.14)}"/>`;
  return `<svg class="mk" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">${inner}</svg>`;
}
const readingTag = (reading, label) =>
  `<span class="rtag r-${readingClass(reading)}">${marker(reading, 12)}<span>${esc(label ?? READING_LABEL[reading] ?? reading)}</span></span>`;

const BASIS = D.meta.basisLegend;
const basisTag = b => b ? `<span class="basis b-${esc(b)}" title="${esc(BASIS[b] || b)}" tabindex="0">${esc(b)}</span>` : '';

// Bibliography reference linking
const bibKeys = D.bibliography.map(b => b.key).sort((a, b) => b.length - a.length);
const slug = k => 'bib-' + k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const keyRe = k => new RegExp(`(^|[^\\w])(${k.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')})(?![\\w])`);

function refLinks(ref) {
  if (!ref) return '';
  return ref.split(/;\s*/).map(seg => {
    if (/^see table$/i.test(seg.trim())) return `<a href="#synoptic-table">${esc(seg)}</a>`;
    for (const k of bibKeys) {
      const m = seg.match(keyRe(k));
      if (m) {
        const i = m.index + m[1].length;
        return esc(seg.slice(0, i)) + `<a href="#${slug(k)}">${esc(k)}</a>` + esc(seg.slice(i + k.length));
      }
    }
    return esc(seg);
  }).join('; ');
}

// Find a bibliography entry for a person/edition named with a year.
function keyFor(name, year) {
  const plain = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const last = plain.split(/\s+/).pop();
  const cands = [plain, `${plain} ${year}`, `${last} ${year}`];
  return cands.find(c => D.bibliography.some(b => b.key === c));
}
const nameLink = (name, year) => {
  const k = keyFor(name, year);
  return k ? `<a href="#${slug(k)}">${esc(name)}</a>` : esc(name);
};

const sectionHead = (n, title, intro) => `
  <header class="sec-head wrap-wide">
    <p class="sec-num">${n}</p>
    <h2>${esc(title)}</h2>
    ${intro ? `<p class="sec-intro">${rich(intro)}</p>` : ''}
  </header>`;

/* ---------- state ---------- */

const state = {
  model: new URLSearchParams(location.search).get('model') || '',
  filter: 'all',
  sort: 'order',
  open: new Set()
};
if (!['A', 'B', 'C'].includes(state.model)) state.model = '';

/* ---------- masthead & footer ---------- */

document.title = `${D.meta.title} ${D.variant.reference}`;
$('#kicker').textContent = D.variant.reference;
$('#title').textContent = D.meta.title;
$('#subtitle').innerHTML = rich(D.meta.subtitle);
$('#lede').innerHTML = rich(D.meta.lede);

const legendHTML = () => `
  <span class="legend-title">How each item was checked</span>
  ${Object.entries(BASIS).map(([k, v]) => `<span class="legend-item">${basisTag(k)} ${esc(v)}</span>`).join('')}`;
$('#basis-legend').innerHTML = legendHTML();

/* ---------- 1. the variant ---------- */

function renderVariant() {
  const V = D.variant;
  const order = ['anger', 'compassion'];
  const readings = order.map(id => V.readings.find(r => r.id === id)).filter(Boolean);

  const hero = `
    <div class="hero wrap-wide">
      ${readings.map(r => `
        <article class="reading r-${r.id}">
          <p class="reading-label">${marker(r.id, 18)} ${esc(r.id === 'anger' ? 'Anger' : 'Compassion')}</p>
          <p class="reading-greek" lang="grc">${esc(r.greek)}</p>
          <p class="reading-translit">${esc(r.translit)}</p>
          <p class="reading-gloss">“${esc(r.gloss)}”</p>
          <dl class="reading-meta">
            <div><dt>Latin</dt><dd lang="la">${esc(r.latin)}</dd></div>
            <div><dt>Printed by</dt><dd>${esc(r.printedBy)}</dd></div>
          </dl>
        </article>`).join('<div class="hero-or" aria-hidden="true">or</div>')}
    </div>`;

  const altIds = V.readings.map(r => r.id);
  const alts = (s, lang) => {
    const parts = s.split(/(\{[^}]*\})/);
    return parts.map(p => {
      const m = p.match(/^\{(.*)\}$/);
      if (!m) return lang === 'grc' ? `<span lang="grc">${esc(p)}</span>` : rich(p);
      const opts = m[1].split('|').map(x => x.trim());
      return `<span class="alt">${opts.map((o, i) =>
        `<span class="alt-opt r-${altIds[i]}">${marker(altIds[i], 11)}<span${lang === 'grc' ? ' lang="grc"' : ''}>${esc(o)}</span></span>`
      ).join('<span class="alt-sep" aria-label="or">|</span>')}</span>`;
    }).join('');
  };

  const passage = `
    <div class="block wrap-wide">
      <h3>The passage, verses 40–45 <span class="src">(${esc(V.passage.source)})</span></h3>
      <ol class="passage">
        ${V.passage.verses.map(v => `
          <li class="verse${v.focus ? ' focus' : ''}">
            <span class="vnum">${v.n}</span>
            <p class="v-greek">${alts(v.greek, 'grc')}</p>
            <p class="v-eng">${alts(v.english, 'en')}</p>
            ${v.note ? `<p class="v-note">${rich(v.note)}</p>` : ''}
          </li>`).join('')}
      </ol>
    </div>`;

  const N = V.na28;
  const na28 = `
    <figure class="block wrap-wide na28" id="na28">
      <h3>The printed edition: Nestle–Aland 28</h3>
      <div class="na28-images">
        ${N.images.map(img => `
          <div class="na28-img">
            <img src="${esc(img.file)}" alt="${esc(img.caption)}" loading="lazy" decoding="async">
            <p class="caption">${rich(img.caption)}</p>
          </div>`).join('')}
      </div>
      <figcaption>
        <h4>The apparatus line, transcribed</h4>
        <p class="app-line">${rich(N.apparatusTranscription)}</p>
        <h4>How to read it</h4>
        <ol class="howto">${N.howToRead.map(t => `<li>${rich(t)}</li>`).join('')}</ol>
        <p class="credit">${esc(N.credit)}</p>
      </figcaption>
    </figure>`;

  const parallels = `
    <div class="block wrap-wide">
      <h3>The parallels in Matthew and Luke</h3>
      <div class="parallels">
        ${V.parallels.map(p => `
          <div class="par">
            <p class="par-ref">${esc(p.ref)}</p>
            <p class="par-greek" lang="grc">${esc(p.greek)}</p>
            <p class="par-emo">${p.emotion === 'none' ? readingTag('none', 'no emotion word') : readingTag('both', 'disputed')}</p>
          </div>`).join('')}
      </div>
      <p class="note">${rich(V.parallelsNote)}</p>
    </div>`;

  $('#variant').innerHTML = sectionHead('1', 'The variant') + hero + passage + na28 + parallels;
}

/* ---------- 2. witnesses ---------- */

function renderWitnesses() {
  const W = D.witnesses;
  const g = id => W.groups.find(x => x.id === id);

  const item = w => `
    <li class="wit">
      <details>
        <summary>
          <span class="wit-sig">${rich(w.siglum)}</span>
          <span class="wit-name">${rich(w.name)}</span>
          <span class="wit-meta">${esc(w.date)} · ${esc(w.language)} · ${esc(w.region)}</span>
        </summary>
        <div class="wit-more">
          ${w.attests ? `<p><span class="lbl">Wording</span> ${rich(w.attests)}</p>` : ''}
          ${w.note ? `<p>${rich(w.note)}</p>` : ''}
          <p class="wit-src"><span class="lbl">Source</span> ${refLinks(w.source)} ${basisTag(w.basis)}</p>
        </div>
      </details>
    </li>`;

  const group = (grp, extra = '') => `
    <section class="wgroup r-${readingClass(grp.id)} ${extra}">
      <header>
        <h3>${marker(grp.id, 16)} ${esc(grp.title)} <span class="count">${grp.items.length}</span></h3>
        <p class="wgroup-reading">${rich(grp.reading)}</p>
      </header>
      <ul class="wlist">${grp.items.map(item).join('')}</ul>
    </section>`;

  const all = W.groups.flatMap(grp => grp.items.map(w => ({ ...w, reading: grp.id })));

  $('#witnesses').innerHTML = sectionHead('2', 'Witnesses', W.summary) + `
    <div class="wrap-wide">
      <p class="count-line">${rich(W.count.text)} <span class="src">(${refLinks(W.count.source)})</span> ${basisTag(W.count.basis)}</p>
      <p class="helper">Four outcomes, not two. Select a row to see its wording, notes and source.</p>
      <div class="wgrid">
        ${group(g('anger'), 'col-anger')}
        <div class="col-mid">${group(g('both'))}${group(g('omit'))}</div>
        ${group(g('compassion'), 'col-comp')}
      </div>
      <h3 class="sub">When and where: the witnesses by language and date</h3>
      ${timeline(all)}
      <h3 class="sub">What this shows</h3>
      <ol class="takeaways">${W.takeaways.map(t => `<li>${rich(t)}</li>`).join('')}</ol>
    </div>`;
}

function timeline(items) {
  const rows = [
    { label: 'Greek', test: l => l === 'Greek' },
    { label: 'Latin', test: l => l === 'Latin' },
    { label: 'Syriac', test: l => l === 'Syriac' },
    { label: 'Coptic, Gothic, Ethiopic', test: l => !['Greek', 'Latin', 'Syriac'].includes(l) }
  ];
  const W = 1000, L = 150, R = 980, y0 = 300, y1 = 1150;
  const x = yr => L + (yr - y0) / (y1 - y0) * (R - L);
  const rowH = 112, top = 34;
  const lane = { anger: -24, both: 0, omit: 0, compassion: 24 };
  const H = top + rows.length * rowH + 30;
  const short = s => s.split(/[\s,(]/)[0] + (s.includes(',') ? ' …' : '');

  let out = '';
  // grid
  for (let yr = 300; yr <= 1100; yr += 100) {
    out += `<line x1="${x(yr)}" x2="${x(yr)}" y1="${top - 8}" y2="${H - 26}" class="tl-grid"/>`;
    out += `<text x="${x(yr)}" y="${H - 8}" class="tl-axis" text-anchor="middle">${yr}</text>`;
  }
  out += `<rect x="${x(350)}" y="${top - 8}" width="${x(400) - x(350)}" height="${H - 26 - top + 8}" class="tl-band"/>`;
  out += `<text x="${(x(350) + x(400)) / 2}" y="${top - 14}" class="tl-band-label" text-anchor="middle">c. 350–400</text>`;

  rows.forEach((row, ri) => {
    const cy = top + ri * rowH + rowH / 2;
    out += `<line x1="${L - 6}" x2="${R}" y1="${top + (ri + 1) * rowH}" y2="${top + (ri + 1) * rowH}" class="tl-rowrule"/>`;
    out += `<text x="0" y="${cy + 5}" class="tl-row">${esc(row.label)}</text>`;
    const placed = [];
    items.filter(w => row.test(w.language)).sort((a, b) => a.year - b.year).forEach(w => {
      const px = x(w.year);
      let py = cy + lane[w.reading], k = 0;
      const dir = w.reading === 'anger' ? -1 : 1;
      while (placed.some(p => Math.abs(p.x - px) < 15 && Math.abs(p.y - py) < 15) && k < 6) {
        k++; py = cy + lane[w.reading] + dir * 15 * k * (w.reading === 'both' || w.reading === 'omit' ? (k % 2 ? 1 : -1) : 1);
      }
      placed.push({ x: px, y: py });
      const tip = `${w.siglum} — ${w.name}; ${w.date}; ${w.region}; ${READING_LABEL[w.reading]}`;
      out += `<g class="tl-pt" transform="translate(${px - 8} ${py - 8})"><title>${esc(tip)}</title>${marker(w.reading, 16).replace('<svg class="mk"', '<svg')}</g>`;
      if (w.reading !== 'compassion') {
        out += `<text x="${px + 11}" y="${py + 5}" class="tl-lbl">${esc(short(w.siglum))}</text>`;
      }
    });
  });

  const legend = ['anger', 'both', 'omit', 'compassion'].map(r => readingTag(r)).join(' ');
  const keyList = items.filter(w => w.reading !== 'compassion').sort((a, b) => a.year - b.year).map(w =>
    `<li>${marker(w.reading, 10)} <b>${rich(w.siglum)}</b> ${esc(w.date)}, ${esc(w.region)}</li>`).join('');
  return `<figure class="timeline">
    <p class="helper scroll-hint">Scroll sideways to see the whole timeline.</p>
    <div class="scroll-x"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Witnesses plotted by language and approximate date, marked by reading">${out}</svg></div>
    <figcaption>${legend}<ul class="tl-key">${keyList}</ul><span class="helper">Plotted at each item's approximate date; hover a mark for details. Labels name the witnesses that do not read compassion; their places are listed above.</span></figcaption>
  </figure>`;
}

/* ---------- 3. models ---------- */

function wrapText(s, max) {
  const words = s.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function stemma(st, nLayersMax) {
  const nodes = st.nodes.map(n => ({ ...n, parents: [], children: [] }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  st.edges.forEach(([a, b]) => { byId[a].children.push(b); byId[b].parents.push(a); });
  // longest-path layering
  const depth = id => byId[id].parents.length ? 1 + Math.max(...byId[id].parents.map(depth)) : 0;
  nodes.forEach(n => n.layer = depth(n.id));
  const layers = [];
  nodes.forEach(n => (layers[n.layer] ||= []).push(n));

  const W = 360, padX = 4;
  const lh = 16, markerR = 7;
  layers.forEach((layer, li) => {
    if (li > 0) {
      layer.forEach((n, i) => {
        const px = n.parents.map(p => byId[p]._order);
        n._bary = px.reduce((a, b) => a + b, 0) / px.length + i * 1e-3;
      });
      layer.sort((a, b) => a._bary - b._bary);
    }
    const colW = (W - padX * 2) / layer.length;
    layer.forEach((n, i) => {
      n._order = i;
      n.x = padX + colW * (i + 0.5);
      n.lines = wrapText(n.label, Math.max(12, Math.floor(colW / 7.4)));
      n.colW = colW;
    });
  });
  // a node with one parent and alone in its layer sits under its parent
  layers.forEach((layer, li) => {
    if (li && layer.length === 1 && layer[0].parents.length >= 1) {
      const p = layer[0].parents.map(id => byId[id]).sort((a, b) => b.layer - a.layer)[0];
      layer[0].x = p.x;
    }
  });
  let y = 14;
  layers.forEach(layer => {
    const h = Math.max(...layer.map(n => n.lines.length)) * lh + (layer.some(n => n.date) ? lh : 0);
    layer.forEach(n => { n.y = y; n.bottom = y + markerR + 6 + h; });
    y += markerR * 2 + h + 34;
  });
  const H = y - 20;

  let edges = '';
  st.edges.forEach(([a, b]) => {
    const p = byId[a], c = byId[b];
    const x1 = p.x, y1 = p.bottom + 2, x2 = c.x, y2 = c.y - markerR - 3;
    if (c.layer - p.layer > 1) {
      const bow = (x2 >= W / 2 ? 1 : -1) * W * 0.17;
      edges += `<path d="M${x1} ${y1} C${x1 + bow} ${y1 + 40}, ${x2 + bow} ${y2 - 40}, ${x2} ${y2}" class="st-edge st-skip"/>`;
    } else {
      const my = (y1 + y2) / 2;
      edges += `<path d="M${x1} ${y1} C${x1} ${my}, ${x2} ${my}, ${x2} ${y2}" class="st-edge"/>`;
    }
  });
  const ns = nodes.map(n => {
    const tip = [n.label, n.date, n.note].filter(Boolean).join(' — ');
    const text = n.lines.map((l, i) => `<tspan x="${n.x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('');
    return `<g class="st-node"><title>${esc(tip)}</title>
      <g transform="translate(${n.x - markerR} ${n.y - markerR})">${marker(n.reading, markerR * 2).replace('<svg class="mk"', '<svg')}</g>
      <text class="st-label" x="${n.x}" y="${n.y + markerR + 15}" text-anchor="middle">${text}</text>
      ${n.date ? `<text class="st-date" x="${n.x}" y="${n.y + markerR + 15 + n.lines.length * lh}" text-anchor="middle">${esc(n.date)}</text>` : ''}
    </g>`;
  }).join('');
  const notes = nodes.filter(n => n.note);
  return `<svg class="stemma" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stemma">${edges}${ns}</svg>
    ${notes.length ? `<ul class="st-notes">${notes.map(n => `<li>${marker(n.reading, 10)} <b>${esc(n.label)}:</b> ${rich(n.note)}</li>`).join('')}</ul>` : ''}`;
}

function renderModels() {
  const M = D.models;
  const legend = ['anger', 'compassion', 'both', 'none'].map(r => readingTag(r, r === 'none' ? 'no emotion word' : undefined)).join(' ');
  $('#models').innerHTML = sectionHead('3', 'Transmission models', M.intro) + `
    <div class="wrap-wide">
      <p class="legend-row">${legend}</p>
      <div class="models">
        ${M.items.map(m => `
          <article class="model" data-model-card="${m.id}">
            <header class="model-head">
              <span class="model-letter">${m.id}</span>
              <h3>${rich(m.title)}</h3>
              <button type="button" class="trace-btn" data-model-select="${m.id}">Trace model ${m.id}</button>
            </header>
            <p class="model-short">${rich(m.short)}</p>
            <div class="model-stemma">${stemma(m.stemma)}</div>
            <div class="model-explains"><h4>What it explains</h4><ul>${m.explains.map(t => `<li>${rich(t)}</li>`).join('')}</ul></div>
            <div class="model-costs"><h4>What it costs</h4><ul>${m.costs.map(t => `<li>${rich(t)}</li>`).join('')}</ul></div>
            <div class="model-holders"><h4>Who holds it</h4>
              <ul class="holders">${[...m.holders].sort((a, b) => a.year - b.year).map(h => `
                <li><span class="h-year">${h.year}</span><span class="h-body"><span class="h-name">${nameLink(h.name, h.year)}</span> ${basisTag(h.basis)}${h.note ? `<span class="h-note">${rich(h.note)}</span>` : ''}</span></li>`).join('')}
              </ul>
            </div>
            <div class="model-variants">${(m.variants || []).map(v => `<aside class="variant-note"><h4>${rich(v.title)}</h4><p>${rich(v.text)}</p></aside>`).join('')}</div>
          </article>`).join('')}
      </div>
    </div>`;
}

/* ---------- 4. arguments ---------- */

const BEAR = {
  supports: { sym: '+', label: 'supports' },
  strains: { sym: '−', label: 'strains' },
  neutral: { sym: '·', label: 'neutral for' }
};
const bearTag = (b, m) => `<span class="bear bear-${b}"><span class="bear-sym" aria-hidden="true">${BEAR[b].sym}</span>${BEAR[b].label} ${m}</span>`;

function point(p) {
  return `<li>${rich(p.text)}${p.ref ? ` <span class="ref">— ${refLinks(p.ref)}</span>` : ''} ${basisTag(p.basis)}</li>`;
}

function argItem(a) {
  const open = state.open.has(a.id);
  const bear = state.model ? a.bearsOn[state.model] : null;
  return `
  <li class="arg${open ? ' open' : ''}${bear ? ' has-bear bear-row-' + bear : ''}" id="arg-${a.id}">
    <button type="button" class="arg-head" aria-expanded="${open}" aria-controls="argb-${a.id}" data-arg="${a.id}">
      <span class="arg-id">${a.id}</span>
      <span class="arg-main">
        <span class="arg-title">${rich(a.title)}</span>
        <span class="arg-claim">${rich(a.claim)}</span>
      </span>
      <span class="arg-tags">
        ${readingTag(a.favours, a.favours === 'open' ? 'favours neither' : 'favours ' + a.favours)}
        ${bear ? bearTag(bear, state.model) : ''}
      </span>
      <span class="arg-chev" aria-hidden="true"></span>
    </button>
    <div class="arg-body" id="argb-${a.id}" ${open ? '' : 'hidden'}>
      ${a.options ? `<div class="options"><h4>Proposed objects of the anger</h4><ol>${a.options.map(o => `<li>${rich(o.text)} <span class="ref">— ${esc(o.who)}</span></li>`).join('')}</ol></div>` : ''}
      <div class="procon">
        <div class="pro"><h4>For</h4>${a.pro.length ? `<ul>${a.pro.map(point).join('')}</ul>` : '<p class="empty">—</p>'}</div>
        <div class="contra"><h4>Against</h4>${a.contra.length ? `<ul>${a.contra.map(point).join('')}</ul>` : '<p class="empty">None listed.</p>'}</div>
      </div>
      ${a.rejoinder ? `<div class="rejoinder"><h4>Rejoinder</h4><ul>${a.rejoinder.map(point).join('')}</ul></div>` : ''}
      <p class="status"><span class="lbl">Where it stands</span> ${rich(a.status)}</p>
      <p class="bears-all"><span class="lbl">Bearing on the models</span> ${['A', 'B', 'C'].map(m => bearTag(a.bearsOn[m], m)).join(' ')}</p>
    </div>
  </li>`;
}

function synTable(t) {
  return `<p class="helper scroll-hint">Scroll sideways to see the whole table.</p><div class="scroll-x" id="synoptic-table"><table class="syn">
    <caption>${esc(t.caption)} <span class="src">(${esc(t.basis)})</span></caption>
    <thead><tr>${t.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${t.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function renderArguments() {
  const A = D.arguments;
  const all = A.groups.flatMap(g => g.items);
  const m = state.model;
  const rank = { supports: 0, neutral: 1, strains: 2 };

  let tally = '';
  if (m) {
    const c = { supports: 0, strains: 0, neutral: 0 };
    all.forEach(a => c[a.bearsOn[m]]++);
    const model = D.models.items.find(x => x.id === m);
    tally = `<p class="tally"><b>Model ${m}</b>: ${rich(model.title)}. <span class="tally-n">${bearTag('supports', '')} ${c.supports}</span> <span class="tally-n">${bearTag('strains', '')} ${c.strains}</span> <span class="tally-n">${bearTag('neutral', '')} ${c.neutral}</span></p>`;
  }

  const controls = `
    <div class="arg-controls">
      ${m ? `
        <div class="seg" role="group" aria-label="Filter by bearing on model ${m}">
          <span class="seg-label">Show</span>
          ${['all', 'supports', 'strains', 'neutral'].map(f => `<button type="button" data-filter="${f}" aria-pressed="${state.filter === f}">${f === 'all' ? 'all' : f}</button>`).join('')}
        </div>
        <div class="seg" role="group" aria-label="Order">
          <span class="seg-label">Order</span>
          <button type="button" data-sort="order" aria-pressed="${state.sort === 'order'}">as argued</button>
          <button type="button" data-sort="supports" aria-pressed="${state.sort === 'supports'}">supports first</button>
          <button type="button" data-sort="strains" aria-pressed="${state.sort === 'strains'}">strains first</button>
        </div>` : `<p class="helper">Pick model A, B or C in the bar above to see how each argument bears on it.</p>`}
      <div class="seg">
        <button type="button" data-expand="all">expand all</button>
        <button type="button" data-expand="none">collapse all</button>
      </div>
    </div>`;

  const groups = A.groups.map(g => {
    let items = [...g.items];
    if (m && state.filter !== 'all') items = items.filter(a => a.bearsOn[m] === state.filter);
    if (m && state.sort !== 'order') {
      const dir = state.sort === 'supports' ? 1 : -1;
      items.sort((a, b) => dir * (rank[a.bearsOn[m]] - rank[b.bearsOn[m]]));
    }
    return `
      <section class="agroup" id="group-${g.id}">
        <header class="agroup-head">
          <h3>${esc(g.title)}</h3>
          <p>${rich(g.question)}</p>
        </header>
        ${g.table ? synTable(g.table) : ''}
        ${items.length ? `<ol class="args">${items.map(argItem).join('')}</ol>` : `<p class="empty">No arguments in this group match the filter.</p>`}
      </section>`;
  }).join('');

  $('#arguments').innerHTML = sectionHead('4', 'Arguments', A.intro) + `
    <div class="wrap-wide">${tally}${controls}${groups}</div>`;
}

/* ---------- 5. positions ---------- */

function renderPositions() {
  const P = D.positions;
  $('#positions').innerHTML = sectionHead('5', 'Who stands where', P.intro) + `
    <div class="wrap-wide">
      <div class="pos-key" aria-hidden="true"><span>${readingTag('anger')}</span><span>${readingTag('open')}</span><span>${readingTag('compassion')}</span></div>
      <div class="pos-grid">
        ${P.groups.map(g => {
          const items = [...g.items].sort((a, b) => a.year - b.year);
          const n = s => items.filter(i => i.side === s).length;
          const total = items.length;
          const bar = ['anger', 'open', 'compassion'].map(s => n(s) ? `<span class="pb pb-${s}" style="flex:${n(s)}" title="${READING_LABEL[s]}: ${n(s)}">${n(s)}</span>` : '').join('');
          const entry = i => `<span class="p-name">${nameLink(i.name, i.year)} ${basisTag(i.basis)}</span>${i.note ? `<span class="p-note">${rich(i.note)}</span>` : ''}`;
          return `
          <section class="pos">
            <h3>${esc(g.title)}</h3>
            <div class="pos-bar" role="img" aria-label="${n('anger')} anger, ${n('open')} open, ${n('compassion')} compassion, of ${total}">${bar}</div>
            <div class="pos-cols" aria-hidden="true"><span>${marker('anger', 11)} anger</span><span>year</span><span>${marker('compassion', 11)} compassion</span></div>
            <ol class="pos-rows">
              ${items.map(i => `
                <li class="prow side-${i.side}">
                  <span class="pc pc-anger">${i.side === 'anger' ? entry(i) : ''}</span>
                  <span class="pc pc-year">${i.year}</span>
                  <span class="pc pc-comp">${i.side === 'compassion' ? entry(i) : ''}</span>
                  ${i.side === 'open' ? `<span class="pc pc-open">${marker('open', 10)} ${entry(i)} <span class="p-open">open</span></span>` : ''}
                  <span class="sr">${READING_LABEL[i.side]}</span>
                </li>`).join('')}
            </ol>
          </section>`;
        }).join('')}
      </div>
    </div>`;
}

/* ---------- 6. corrections, assessment, bibliography ---------- */

function renderRest() {
  const C = D.corrections;
  $('#corrections').innerHTML = sectionHead('6', C.title) + `
    <div class="wrap-wide">
      <ol class="corrections">
        ${C.items.map(c => `
          <li>
            <p class="c-claim"><span class="lbl">Often said</span> ${rich(c.claim)}</p>
            <p class="c-fact"><span class="lbl">In fact</span> ${rich(c.fact)}</p>
          </li>`).join('')}
      </ol>
    </div>`;

  const S = D.assessment;
  $('#assessment').innerHTML = `
    <div class="wrap-wide">
      <article class="assess">
        <p class="assess-label">${esc(S.label)}</p>
        <h2>${esc(S.title)}</h2>
        <p class="assess-verdict">${rich(S.verdict)}</p>
        <p class="assess-odds">${rich(S.odds)}</p>
        <ol class="assess-steps">${S.steps.map(s => `
          <li class="r-${esc(s.reading)}"><span class="st-when">${esc(s.when)}</span><span class="st-text">${rich(s.text)}</span></li>`).join('')}
        </ol>
        <div class="assess-cols">
          <div><h3>Where this story is weakest</h3><ul>${S.weakLinks.map(q => `<li>${rich(q)}</li>`).join('')}</ul></div>
          <div><h3>What would change it</h3><ul>${S.wouldChange.map(q => `<li>${rich(q)}</li>`).join('')}</ul></div>
        </div>
        <div class="assess-close">
          <h3>${esc(S.closingTitle)}</h3>
          ${S.closing.map(p => `<p>${rich(p)}</p>`).join('')}
        </div>
      </article>
    </div>`;

  $('#bibliography').innerHTML = sectionHead('7', 'Bibliography') + `
    <div class="wrap-wide">
      <ol class="bib">
        ${D.bibliography.map(b => `
          <li id="${slug(b.key)}">
            <span class="bib-key">${esc(b.key)}</span>
            <span class="bib-cite">${rich(b.cite)} ${b.url ? `<a class="bib-url" href="${esc(b.url)}" rel="noopener" target="_blank">link</a>` : ''} ${basisTag(b.basis)}</span>
          </li>`).join('')}
      </ol>
    </div>`;

  $('#footer').innerHTML = `
    <div class="legend">${legendHTML()}</div>
    <p class="credit">${esc(D.variant.na28.credit)}</p>
    <p class="helper"><a href="#top">Back to top</a></p>`;
}

/* ---------- interaction ---------- */

function applyModel() {
  $$('.model-picker button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.model === state.model)));
  $$('[data-model-card]').forEach(c => c.classList.toggle('selected', c.dataset.modelCard === state.model));
  $$('[data-model-select]').forEach(b => {
    const on = b.dataset.modelSelect === state.model;
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? `Tracing model ${b.dataset.modelSelect}` : `Trace model ${b.dataset.modelSelect}`;
  });
  document.body.dataset.model = state.model;
  const u = new URL(location.href);
  state.model ? u.searchParams.set('model', state.model) : u.searchParams.delete('model');
  history.replaceState(null, '', u);
  renderArguments();
}

function setModel(m) {
  state.model = m;
  if (!m) { state.filter = 'all'; state.sort = 'order'; }
  applyModel();
}

document.addEventListener('click', e => {
  const pick = e.target.closest('.model-picker button');
  if (pick) return setModel(pick.dataset.model);
  const sel = e.target.closest('[data-model-select]');
  if (sel) return setModel(state.model === sel.dataset.modelSelect ? '' : sel.dataset.modelSelect);

  const head = e.target.closest('.arg-head');
  if (head && !e.target.closest('a')) {
    const id = head.dataset.arg;
    const li = head.parentElement, body = li.querySelector('.arg-body');
    const open = !state.open.has(id);
    open ? state.open.add(id) : state.open.delete(id);
    li.classList.toggle('open', open);
    head.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    return;
  }
  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; return renderArguments(); }
  const s = e.target.closest('[data-sort]');
  if (s) { state.sort = s.dataset.sort; return renderArguments(); }
  const x = e.target.closest('[data-expand]');
  if (x) {
    const ids = D.arguments.groups.flatMap(g => g.items.map(a => a.id));
    state.open = x.dataset.expand === 'all' ? new Set(ids) : new Set();
    return renderArguments();
  }
  // internal links: open a collapsed argument or witness that contains the target
  const a = e.target.closest('a[href^="#"]');
  if (a) {
    const t = document.getElementById(a.getAttribute('href').slice(1));
    if (t) {
      t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    }
  }
});

// keyboard arrows within the model radiogroup
$('.model-picker').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const btns = $$('.model-picker button');
  const i = btns.findIndex(b => b.dataset.model === state.model);
  const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
  setModel(n.dataset.model); n.focus(); e.preventDefault();
});

// highlight the current section in the bar
const links = $$('.bar-links a');
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) links.forEach(l => l.classList.toggle('current', l.getAttribute('href') === '#' + en.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });

/* ---------- boot ---------- */

renderVariant();
renderWitnesses();
renderModels();
renderPositions();
renderRest();
applyModel();
$$('main > section').forEach(s => io.observe(s));
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
