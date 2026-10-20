// Genera el PDF navegable de la landing (índex i enllaços clicables + marcadors laterals).
// Ús: node tests/pdf.mjs [url] [sortida.pdf]
import { writeFileSync } from 'node:fs';
import { launch } from './cdp.mjs';

const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = process.argv[3] || 'CONNECT_Team_Experience_IMPAUSA.pdf';

const p = await launch({ width: 1240, height: 1754 });
await p.goto(URL);
await p.waitFor(`document.querySelector('h1')`);
await p.send('Emulation.setEmulatedMedia', { media: 'print' });
// Sense aquesta espera Chrome imprimeix amb Segoe UI en lloc de Montserrat/Lato
await p.eval('document.fonts.ready.then(() => 1)');
await p.sleep(3000);
const r = await p.send('Page.printToPDF', {
  printBackground: true,
  paperWidth: 8.27, // A4
  paperHeight: 11.69,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  scale: 0.78, // amplada de maquetació ≈ 1000 px: disseny d'escriptori
  preferCSSPageSize: false,
  generateDocumentOutline: true, // marcadors a partir dels títols
  generateTaggedPDF: true, // accessible
});
const buf = Buffer.from(r.data, 'base64');
writeFileSync(OUT, buf);
const s = buf.toString('latin1');
console.log(`PDF: ${OUT} · ${Math.round(buf.length / 1024)} KB · pàgines: ${(s.match(/\/Type\s*\/Page[^s]/g) || []).length} · enllaços externs: ${(s.match(/\/URI\s*\(/g) || []).length} · enllaços interns: ${(s.match(/\/Dest\b/g) || []).length} · marcadors: ${s.includes('/Outlines') ? 'sí' : 'no'}`);
const fonts = [...new Set(s.match(/\/BaseFont\s*\/[A-Za-z+_-]+/g) || [])].map((f) => f.split('+')[1]);
console.log(`tipografies: ${fonts.join(', ')} + Montserrat (${(s.match(/\/Subtype\s*\/Type3/g) || []).length} subconjunts vectorials)`);
if (fonts.some((f) => /Segoe|Arial|Times/.test(f))) {
  console.error("✗ Hi ha tipografies de substitució: no s'han carregat les de marca");
  process.exitCode = 1;
}
p.close();
