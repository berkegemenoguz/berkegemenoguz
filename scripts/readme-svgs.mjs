#!/usr/bin/env node
/**
 * README için SVG kartları üretir (koyu tema).
 * Renkler ve tipografi berkegemenoguz.com ile aynı.
 *
 * Kullanım: node scripts/readme-svgs.mjs
 * Çıktı:    assets/<ad>.svg
 */

import { writeFileSync, mkdirSync } from 'node:fs';

/* ────────────────── Tema ────────────────── */

const THEME = {
  panel: '#191817', panel2: '#201f1d', line: '#2c2a27',
  text: '#ece8e2', dim: '#bdb6ad', faint: '#8b847c',
  accent: '#d98757', accentSoft: 'rgba(217,135,87,.13)',
};

// GitHub SVG içinden web fontu yükletmez; Newsreader yoksa Georgia'ya düşer.
const SERIF = `Newsreader, Georgia, 'Times New Roman', serif`;
const SANS  = `Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const MONO  = `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

const W = 840;

/* ────────────────── Yardımcılar ────────────────── */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const text = (x, y, cls, size, s, extra = '') =>
  `<text x="${x}" y="${y}" class="${cls}" font-size="${size}"${extra}>${esc(s)}</text>`;

function frame(T, w, h, body, { panel = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>
.serif{font-family:${SERIF};fill:${T.text}}
.sans{font-family:${SANS};fill:${T.dim}}
.mono{font-family:${MONO};fill:${T.faint}}
.accent{fill:${T.accent}}
.dim{fill:${T.dim}}
.line{stroke:${T.line};stroke-width:1;fill:none}
.box{fill:${T.panel2};stroke:${T.line};stroke-width:1}
</style>
${panel ? `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${T.panel}" stroke="${T.line}"/>` : ''}
${body}
</svg>`;
}

function sectionTitle(title, index) {
  return text(40, 58, 'serif', 26, title) +
    text(W - 40, 58, 'mono', 11, index, ' text-anchor="end" letter-spacing="1.5"');
}

function wrap(s, max) {
  const lines = [];
  let cur = '';
  for (const word of s.split(' ')) {
    if (cur && (cur + ' ' + word).length > max) { lines.push(cur); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ────────────────── 1. Başlık ────────────────── */

function header(T) {
  const H = 260;
  const ys = [78, 130, 182];                     // api kutularının merkezleri
  const route = y => `M524,130 L610,130 C650,130 657,${y} 697,${y} C737,${y} 744,130 776,130`;

  const left = [
    text(40, 56, 'mono', 11, `İSTANBUL · BSc COMPUTER ENGINEERING '27`, ' letter-spacing="1.5"'),
    text(40, 112, 'serif', 46, 'Berk Egemen Oğuz'),
    text(40, 146, 'serif dim', 21, 'Computer Engineering · Backend & Data', ' font-style="italic"'),
    `<line x1="40" x2="76" y1="172" y2="172" stroke="${T.accent}" stroke-width="2"/>`,
    text(40, 202, 'sans', 14, 'I build the parts users never see —'),
    text(40, 224, 'sans', 14, 'load balancers, APIs, databases and data tools.'),
  ];

  // İstek akışı: client → balancer → api (round-robin) → postgres
  const edges = ys.map(y => `<path class="line" d="${route(y)}"/>`);
  const packets = ys.map((y, i) => {
    const anim = `dur="3.6s" begin="${(i * 1.2).toFixed(1)}s" repeatCount="indefinite"`;
    return `<circle r="3.2" class="accent" opacity="0">` +
      `<animateMotion ${anim} path="${route(y)}"/>` +
      `<animate attributeName="opacity" ${anim} values="0;1;1;0" keyTimes="0;.06;.92;1"/></circle>`;
  });
  const node = (x, y, w, h, label, dx = 0) =>
    `<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>` +
    text(x + w / 2 + dx, y + h / 2 + 3.5, 'mono', 10, label, ' text-anchor="middle"');
  const apis = ys.map((y, i) =>
    node(672, y - 12, 50, 24, `api·${i + 1}`, -4) +
    `<circle cx="716" cy="${y}" r="1.8" class="accent">` +
    `<animate attributeName="opacity" dur="2.4s" begin="${i * 0.8}s" repeatCount="indefinite" values="1;.25;1"/></circle>`);
  const db =
    `<path class="box" d="M752,108 v44 a24,7 0 0 0 48,0 v-44"/>` +
    `<ellipse class="box" cx="776" cy="108" rx="24" ry="7"/>` +
    text(776, 138, 'mono', 10, 'pg', ' text-anchor="middle"');

  const right = [
    `<line class="line" x1="470" x2="470" y1="40" y2="220"/>`,
    ...edges, ...packets,
    node(500, 118, 48, 24, 'client'),
    node(578, 112, 64, 36, 'balancer'),
    ...apis, db,
    text(650, 230, 'mono', 10, 'round-robin · health checks · postgres', ' text-anchor="middle"'),
  ];

  return frame(T, W, H, [...left, ...right].join('\n'));
}

/* ────────────────── 2. Odak alanları ────────────────── */

const FOCUS = [
  { tag: 'BACKEND', title: 'Services & APIs',
    items: ['REST APIs · Go, Node.js, Flask', 'Auth, RBAC & JWT sessions', 'Reverse proxy · load balancing'] },
  { tag: 'DATA', title: 'Analysis & tooling',
    items: ['Python · NumPy · Plotly', 'Market data & indicators', 'Image pipelines with OpenCV'] },
  { tag: 'INFRASTRUCTURE', title: 'Storage & operations',
    items: ['PostgreSQL schema design', 'Docker & Prometheus metrics', 'Route optimisation · TSP'] },
];

function focus(T) {
  const H = 230;
  const body = [sectionTitle('What I work on', '01')];
  FOCUS.forEach((col, i) => {
    const x = 40 + i * 260;
    if (i > 0) body.push(`<line class="line" x1="${x - 20}" x2="${x - 20}" y1="90" y2="204"/>`);
    body.push(text(x, 100, 'mono accent', 11, col.tag, ' letter-spacing="1.5"'));
    body.push(text(x, 128, 'serif', 19, col.title));
    col.items.forEach((it, j) => body.push(text(x, 156 + j * 22, 'sans', 13, it)));
  });
  return frame(T, W, H, body.join('\n'));
}

/* ────────────────── 3. Projeler ────────────────── */

const PROJECTS = [
  { name: 'ege-balancer', lang: 'Go', kind: 'featured',
    desc: 'Modular HTTP reverse proxy and load balancer. Round-robin, least-connections and weighted strategies, health checks and Prometheus metrics.',
    tags: ['Go', 'Docker', 'Prometheus'] },
  { name: 'TOROS', lang: 'Python', kind: 'featured',
    desc: 'Traffic-oriented route optimisation for an İstanbul delivery fleet. Assigns deliveries to days and vehicles, orders stops with TSP.',
    tags: ['Flask', 'PostgreSQL', 'TSP'] },
  { name: 'borsadostu', lang: 'Python', kind: 'live',
    desc: 'Stock-market analysis web app for students and small investors. Price history and technical indicators, visualised.',
    tags: ['Python', 'Plotly', 'Flask'] },
  { name: 'go-trkit', lang: 'Go', kind: 'library',
    desc: 'Dependency-free Go package for validating and normalising Türkiye-specific data: TCKN/VKN, IBAN, plates and phone numbers.',
    tags: ['Go', 'zero deps', 'stdlib'] },
];

function projectCard(T, p, i) {
  const CW = 410, H = 196;
  const lines = wrap(p.desc, 52).slice(0, 3);
  const langX = CW - 28 - p.lang.length * 6.6;
  const body = [
    text(28, 40, 'mono', 11, `${String(i + 1).padStart(2, '0')} — ${p.kind}`, ' letter-spacing="1"'),
    `<circle cx="${(langX - 9).toFixed(1)}" cy="36" r="4" class="accent"/>`,
    text(CW - 28, 40, 'mono', 11, p.lang, ' text-anchor="end"'),
    text(28, 80, 'serif', 26, p.name),
    ...lines.map((l, j) => text(28, 108 + j * 19, 'sans', 13, l)),
    `<line class="line" x1="28" x2="${CW - 28}" y1="164" y2="164"/>`,
    text(28, 183, 'mono', 11, p.tags.join('  ·  ')),
  ];
  return frame(T, CW, H, body.join('\n'));
}

function projectsTitle(T) {
  return frame(T, W, 72, [
    text(40, 44, 'serif', 26, 'Selected work'),
    text(W - 40, 44, 'mono', 11, '02', ' text-anchor="end" letter-spacing="1.5"'),
  ].join('\n'), { panel: false });
}

/* ────────────────── 4. Araç kutusu ────────────────── */

const STACK = [
  { label: 'LANGUAGES', items: ['Go', 'Python', 'Java', 'JavaScript', 'C++', 'SQL'], primary: ['Go', 'Python'] },
  { label: 'BACKEND',   items: ['Node.js', 'Express', 'Flask', 'REST', 'JWT'],       primary: ['Node.js'] },
  { label: 'DATA',      items: ['PostgreSQL', 'NumPy', 'OpenCV', 'Plotly', 'Matplotlib'], primary: ['PostgreSQL'] },
  { label: 'OPS',       items: ['Docker', 'Prometheus', 'Git', 'Render', 'Postman'], primary: ['Docker'] },
];

function stack(T) {
  const H = 84 + STACK.length * 40 + 12;
  const body = [sectionTitle('Toolbox', '03')];
  STACK.forEach((row, r) => {
    const y = 84 + r * 40;
    body.push(text(40, y + 18, 'mono', 11, row.label, ' letter-spacing="1.5"'));
    let x = 170;
    for (const item of row.items) {
      const w = Math.round(item.length * 7.2 + 28);
      const on = row.primary.includes(item);
      body.push(`<rect x="${x}" y="${y}" width="${w}" height="28" rx="14" fill="${on ? T.accentSoft : T.panel2}" stroke="${on ? T.accent : T.line}"/>`);
      body.push(text(x + w / 2, y + 18.5, on ? 'sans accent' : 'sans', 13, item, ' text-anchor="middle"'));
      x += w + 8;
    }
  });
  return frame(T, W, H, body.join('\n'));
}

/* ────────────────── 5. Deneyim ────────────────── */

const EXPERIENCE = [
  { role: 'IS Intern', where: 'Horoz Lojistik · distributed systems, TOROS & ege-balancer', when: 'AUG – SEP 2026' },
  { role: 'IT Software Development Intern', where: 'Anadolu Sigorta · web project, internal systems, agile', when: 'JUL – AUG 2026' },
  { role: 'Sales & Business Development Intern', where: 'Enocta · data cleaning and analysis in CRM & Excel', when: 'JUL – AUG 2025' },
  { role: 'BSc Computer Engineering', where: 'İstanbul Arel University', when: '2023 – 2027' },
];

function experience(T) {
  const top = 104, gap = 64;
  const H = top + (EXPERIENCE.length - 1) * gap + 50;
  const body = [
    sectionTitle('Experience', '04'),
    `<line class="line" x1="48" x2="48" y1="${top - 5}" y2="${top + (EXPERIENCE.length - 1) * gap - 5}"/>`,
  ];
  EXPERIENCE.forEach((e, i) => {
    const y = top + i * gap;
    body.push(`<circle cx="48" cy="${y - 6}" r="5" fill="${i === 0 ? T.accent : T.panel}" stroke="${T.accent}" stroke-width="1.5"/>`);
    body.push(text(72, y, 'serif', 19, e.role));
    body.push(text(72, y + 22, 'sans', 13, e.where));
    body.push(text(W - 40, y, 'mono', 11, e.when, ' text-anchor="end" letter-spacing="1"'));
  });
  return frame(T, W, H, body.join('\n'));
}

/* ────────────────── Çalıştır ────────────────── */

const outputs = {
  header, focus, 'projects': projectsTitle, stack, experience,
  ...Object.fromEntries(PROJECTS.map((p, i) => [`project-${p.name.toLowerCase()}`, T => projectCard(T, p, i)])),
};

mkdirSync('assets', { recursive: true });
for (const [name, render] of Object.entries(outputs)) {
  const file = `assets/${name}.svg`;
  writeFileSync(file, render(THEME), 'utf8');
  console.log(`${file} yazıldı`);
}
