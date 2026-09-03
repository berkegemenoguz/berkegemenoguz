#!/usr/bin/env node
/**
 * Gerçek GitHub katkı verisinden animasyonlu SVG üretir.
 * Figür her sütunun dolu bloklarına alttan üste zıplar, sonraki sütuna
 * geçip yukarıdan aşağı iner — S çizerek ilerler. Bastığı bloklar işaretlenir.
 *
 * Kullanım: node scripts/generate.mjs <github-kullanici-adi>
 * Ortam:    GITHUB_TOKEN (read:user yetkisi yeterli)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const LOGIN = process.argv[2];
const TOKEN = process.env.GITHUB_TOKEN;

if (!LOGIN) { console.error('Kullanım: node scripts/generate.mjs <kullanici-adi>'); process.exit(1); }
if (!TOKEN) { console.error('GITHUB_TOKEN tanımlı değil.'); process.exit(1); }

/* ────────────────── 1. Veriyi çek ────────────────── */

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount weekday }
        }
      }
    }
  }
}`;

async function fetchCalendar() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'contrib-hopper',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });

  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const cal = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error(`"${LOGIN}" için katkı takvimi bulunamadı.`);
  return cal;
}

/* ────────────────── 2. Ölçüler ────────────────── */

const CELL = 12, GAP = 3, STEP = CELL + GAP;
const PAD_L = 30;          // gün etiketleri için sol boşluk
const PAD_R = 8;
const HEAD  = 52;          // figürün zıplaması için üst boşluk
const MONTH_H = 14;        // ay etiketi satırı
const DAYS = 7;

const GRID_Y = HEAD + MONTH_H;

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

const THEMES = {
  light: {
    bg:     '#ffffff',
    text:   '#57606a',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    ink:    '#12203a',
    accent: '#0891b2',   // bastığı blokların rengi
    eye:    '#4ade80',
    shadow: 'rgba(15,23,42,.20)',
  },
  dark: {
    bg:     '#0d1117',
    text:   '#7d8590',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    ink:    '#eaf1fc',
    accent: '#22d3ee',
    eye:    '#4ade80',
    shadow: 'rgba(0,0,0,.45)',
  },
};

const levelOf = c => c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : c < 10 ? 3 : 4;

/* ────────────────── 3. Izgara + rota ────────────────── */

function buildGrid(cal) {
  const weeks = cal.weeks;
  const grid = weeks.map(wk => {
    const col = new Array(DAYS).fill(null);
    for (const day of wk.contributionDays) {
      col[day.weekday] = { count: day.contributionCount, date: day.date };
    }
    return col;
  });
  return grid;
}

/**
 * S rotası: çift sütunlar alttan üste, tek sütunlar üstten alta.
 * Sadece katkı olan hücrelere basılır.
 */
function buildPath(grid) {
  const path = [];
  for (let w = 0; w < grid.length; w++) {
    for (let i = 0; i < DAYS; i++) {
      const d = (w % 2 === 0) ? (DAYS - 1 - i) : i;
      const cell = grid[w][d];
      if (cell && cell.count > 0) path.push({ w, d });
    }
  }
  return path;
}

/* ────────────────── 4. SVG üret ────────────────── */

const cellX = w => PAD_L + w * STEP;
const cellY = d => GRID_Y + d * STEP;
const footX = w => cellX(w) + CELL / 2;   // figürün ayak x'i (hücre ortası)
const footY = d => cellY(d);              // figürün ayak y'si (hücre üst kenarı)

function buildSVG(cal, grid, path, themeName) {
  const T = THEMES[themeName];
  const WEEKS = grid.length;
  const W = PAD_L + WEEKS * STEP + PAD_R;
  const H = GRID_Y + DAYS * STEP + 10;

  const N = Math.max(1, path.length - 1);          // zıplama sayısı
  const DUR = Math.min(60, Math.max(12, N * 0.13)); // toplam tur süresi (sn)

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">`);

  /* ---- stiller ---- */
  const styles = [];
  styles.push(`.bg{fill:${T.bg}}`);
  styles.push(`.lbl{fill:${T.text};font-size:9px;font-weight:500}`);
  styles.push(`.cell{rx:2;ry:2}`);
  styles.push(`.hl{fill:${T.accent};fill-opacity:.34;stroke:${T.accent};stroke-width:1.6;rx:2;ry:2;opacity:0}`);
  styles.push(`.sh{fill:${T.shadow}}`);
  styles.push(`.ink{fill:${T.ink}}`);
  styles.push(`.an{stroke:${T.ink};stroke-width:1.4;stroke-linecap:round;fill:none}`);
  styles.push(`.eye{fill:${T.eye}}`);
  styles.push(`.dot{fill:${T.eye}}`);

  // Figürün hareketi: her zıplama için 2 keyframe (kalkış + tepe).
  // Kalkışta ease-out, tepeden inişte ease-in → parabolik yay.
  const kf = [];
  for (let i = 0; i < N; i++) {
    const a = path[i], b = path[i + 1];
    const x0 = footX(a.w), y0 = footY(a.d);
    const x1 = footX(b.w), y1 = footY(b.d);
    const rise = 9 + Math.abs(y1 - y0) * 0.22;
    const apexY = Math.min(y0, y1) - rise;
    const apexX = (x0 + x1) / 2;

    const p0 = (i / N) * 100;
    const pm = ((i + 0.5) / N) * 100;

    kf.push(`${p0.toFixed(3)}%{transform:translate(${x0}px,${y0}px);animation-timing-function:ease-out}`);
    kf.push(`${pm.toFixed(3)}%{transform:translate(${apexX.toFixed(1)}px,${apexY.toFixed(1)}px);animation-timing-function:ease-in}`);
  }
  const last = path[path.length - 1];
  kf.push(`100%{transform:translate(${footX(last.w)}px,${footY(last.d)}px)}`);

  styles.push(`@keyframes hop{${kf.join('')}}`);
  styles.push(`.char{animation:hop ${DUR}s linear infinite}`);

  // Bastığı blokların yanması: yüzdeyi 0.5'e yuvarlayıp keyframe'leri paylaştırıyoruz
  // (binlerce kural yerine en fazla 201 kural).
  const litPcts = new Set();
  const litOf = i => Math.round(((i / N) * 100) * 2) / 2;
  for (let i = 0; i < path.length; i++) litPcts.add(litOf(i));
  for (const p of litPcts) {
    const name = 'l' + String(p).replace('.', '_');
    const at = Math.min(99.9, p);
    styles.push(`@keyframes ${name}{0%,${at}%{opacity:0}${(at + 0.05).toFixed(2)}%,100%{opacity:1}}`);
    styles.push(`.${name}{animation:${name} ${DUR}s linear infinite}`);
  }

  styles.push(`@media (prefers-reduced-motion:reduce){.char{animation:none}[class^="l"]{animation:none;opacity:1}}`);

  out.push(`<style>${styles.join('')}</style>`);
  out.push(`<rect class="bg" width="${W}" height="${H}"/>`);

  /* ---- ay etiketleri ---- */
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const ref = grid[w].find(Boolean);
    if (!ref) continue;
    const m = new Date(ref.date + 'T00:00:00Z').getUTCMonth();
    if (m !== lastMonth) {
      out.push(`<text class="lbl" x="${cellX(w)}" y="${HEAD + 10}">${MONTHS[m]}</text>`);
      lastMonth = m;
    }
  }

  /* ---- gün etiketleri ---- */
  const dayLabels = { 1: 'Pzt', 3: 'Çar', 5: 'Cum' };
  for (const [d, label] of Object.entries(dayLabels)) {
    out.push(`<text class="lbl" x="${PAD_L - 4}" y="${cellY(+d) + 9.5}" text-anchor="end">${label}</text>`);
  }

  /* ---- hücreler ---- */
  out.push('<g>');
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const cell = grid[w][d];
      if (!cell) continue;
      const fill = T.levels[levelOf(cell.count)];
      out.push(`<rect class="cell" x="${cellX(w)}" y="${cellY(d)}" width="${CELL}" height="${CELL}" fill="${fill}"><title>${cell.date} · ${cell.count} katkı</title></rect>`);
    }
  }
  out.push('</g>');

  /* ---- basılan blokların vurgusu ---- */
  out.push('<g>');
  for (let i = 0; i < path.length; i++) {
    const { w, d } = path[i];
    const name = 'l' + String(litOf(i)).replace('.', '_');
    out.push(`<rect class="hl ${name}" x="${cellX(w)}" y="${cellY(d)}" width="${CELL}" height="${CELL}"/>`);
  }
  out.push('</g>');

  /* ---- figür (ayaklar 0,0'da) ---- */
  out.push(`<g class="char">
<ellipse class="sh" cx="0" cy="1.5" rx="6" ry="2"/>
<ellipse class="ink" cx="-3.2" cy="-0.5" rx="2.4" ry="1.7"/>
<ellipse class="ink" cx="3.2" cy="-0.5" rx="2.4" ry="1.7"/>
<path class="an" d="M0,-11 L2.5,-17"/>
<circle class="dot" cx="2.5" cy="-18" r="2"/>
<circle class="ink" cx="0" cy="-6" r="6"/>
<circle class="eye" cx="-2.4" cy="-6.5" r="1.7"/>
<circle class="eye" cx="2.4" cy="-6.5" r="1.7"/>
</g>`);

  out.push('</svg>');
  return out.join('\n');
}

/* ────────────────── 5. Çalıştır ────────────────── */

const cal   = await fetchCalendar();
const grid  = buildGrid(cal);
const path  = buildPath(grid);

if (path.length < 2) {
  console.error('Katkı bulunamadı — animasyon üretilemedi.');
  process.exit(1);
}

for (const theme of ['light', 'dark']) {
  const svg = buildSVG(cal, grid, path, theme);
  const file = `dist/contrib-${theme}.svg`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg, 'utf8');
  console.log(`${file} yazıldı (${(svg.length / 1024).toFixed(1)} KB)`);
}

console.log(`Toplam ${cal.totalContributions} katkı · ${path.length} blok · ${grid.length} hafta`);
