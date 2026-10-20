// Revisió responsive: a cada amplada comprova desbordaments i fa captures de pàgina sencera.
// Ús: node tests/responsive.mjs [url] [carpeta-captures]
import { launch } from './cdp.mjs';

const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = process.argv[3] || '.';
const WIDTHS = [
  { w: 320, h: 640, mobile: true },
  { w: 375, h: 740, mobile: true },
  { w: 414, h: 860, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];
let fails = 0;

for (const v of WIDTHS) {
  const p = await launch({ width: v.w, height: v.h, mobile: v.mobile });
  try {
    await p.goto(URL);
    await p.waitFor(`document.querySelector('h1') && document.fonts.status === 'loaded'`, 10000);
    const r = await p.eval(`(() => {
      const vw = document.documentElement.clientWidth;
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (!b.width || getComputedStyle(el).position === 'fixed') continue;
        if (el.closest('[aria-hidden=true]') || el.closest('.absolute') && el.classList.contains('absolute')) continue;
        if (b.right > vw + 1 || b.left < -1) out.push((el.tagName + '.' + [...el.classList].slice(0, 3).join('.')).slice(0, 60) + ' [' + Math.round(b.left) + '→' + Math.round(b.right) + ']');
      }
      // Text que no hi cap dins del seu contenidor (paraules massa llargues)
      const clipped = [...document.querySelectorAll('h1,h2,h3,a.btn-primary,button')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map(e => e.textContent.trim().slice(0, 40));
      const h1 = document.querySelector('h1');
      const fs = parseFloat(getComputedStyle(h1).fontSize);
      const tap = [...document.querySelectorAll('button, a.btn-primary')].map(b => b.getBoundingClientRect().height);
      return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 8), clipped, h1: fs, minTap: Math.round(Math.min(...tap)) };
    })()`);
    const ok = r.sw <= r.vw && r.out.length === 0;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} ${v.w}px  scroll=${r.sw}/${r.vw}  h1=${r.h1}px  botó més petit=${r.minTap}px${r.out.length ? '\n    desborden: ' + r.out.join('\n               ') : ''}${r.clipped.length ? '\n    retallats: ' + r.clipped.join(' | ') : ''}`);
    await p.shot(`${OUT}/resp-${v.w}.png`, { full: true });
  } catch (e) {
    fails++;
    console.log(`✗ ${v.w}px  ${e.message}`);
  } finally {
    p.close();
  }
}
process.exit(fails ? 1 : 0);
