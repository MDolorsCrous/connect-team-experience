// Captura cada secció de la landing per separat a una amplada donada (per revisar-les de prop).
// Ús: node tests/sections.mjs <url> <carpeta> <amplada>
import { launch } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const [URL = 'http://localhost:5173/', OUT = '.', W = '390'] = process.argv.slice(2);
const width = Number(W);
const p = await launch({ width, height: 900, mobile: width < 768 });
await p.goto(URL);
await p.waitFor(`document.querySelector('h1') && document.fonts.status === 'loaded'`, 10000);
const rects = await p.eval(`[...document.querySelectorAll('header, main > section, footer')].map((s, i) => {
  const b = s.getBoundingClientRect();
  return { i, y: b.top + scrollY, h: b.height };
})`);
for (const r of rects) {
  const res = await p.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: r.y, width, height: Math.min(r.h, 2400), scale: 1 },
  });
  writeFileSync(`${OUT}/s${width}-${String(r.i).padStart(2, '0')}.png`, Buffer.from(res.data, 'base64'));
}
console.log(rects.map((r) => `${r.i}:${Math.round(r.h)}`).join(' '));
p.close();
