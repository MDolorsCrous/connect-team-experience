// Recorregut públic complet al navegador: landing → formulari «Parlem?» → confirmació.
// Ús: node tests/e2e-public.mjs [url] [carpeta-captures]
// En mode demostració no s'envia res; contra un entorn real, crea una sol·licitud de prova.
import { launch } from './cdp.mjs';

const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = process.argv[3] || '.';
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) failures++;
};

for (const vp of [{ name: 'mobil', width: 390, height: 844, mobile: true }, { name: 'escriptori', width: 1440, height: 900 }]) {
  console.log(`\n— ${vp.name} (${vp.width}px)`);
  const p = await launch(vp);
  try {
    await p.goto(URL);
    await p.waitFor(`document.querySelector('h1') && document.querySelector('#parlem')`);
    check(await p.eval(`document.documentElement.scrollWidth <= window.innerWidth`), 'sense scroll horitzontal');
    check((await p.eval(`document.querySelector('h1').textContent`)).includes('Descobriu tot el que us connecta'), 'títol del catàleg final');
    const text = await p.eval(`document.body.innerText`);
    check(!/reserv|calendari/i.test(text.replace(/drets reservats/gi, '')), 'cap referència a reservar ni al calendari');
    check(!/jugar|juguem|celebr|taula|àpat|dinar|sopar|nadal|christmas/i.test(text), 'sense jugar, celebrar, taula, àpat, dinar, sopar ni Nadal');
    check(text.includes('CONNECT') && text.includes('TEAM EXPERIENCE'), 'marca CONNECT TEAM EXPERIENCE');
    check(['el gran repte', 'mateix producte. quatre interlocutors.', 'cap equip creix sol.'].every((s) => text.toLowerCase().includes(s)), 'seccions del catàleg final');
    await p.shot(`${OUT}/${vp.name}-full.png`, { full: true });

    // Enviament buit: errors
    await p.eval(`document.querySelector('#parlem').scrollIntoView()`);
    const form = `document.querySelector('section[aria-labelledby=parlem] form')`;
    await p.waitFor(form);
    await p.eval(`${form}.querySelector('button[type=submit]').click()`);
    await p.waitFor(`${form}.querySelector('[role=alert]')`);
    const errs = await p.eval(`${form}.querySelectorAll('[aria-invalid=true]').length`);
    check(errs >= 7, `validació de camps obligatoris (${errs} camps marcats)`);

    await p.sleep(2600); // supera el temps mínim antirobot
    await p.eval(`(() => {
      const f = ${form};
      const set = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const byLabel = (t) => f.querySelector('#' + CSS.escape([...f.querySelectorAll('label')].find(l => l.textContent.startsWith(t)).htmlFor));
      set(byLabel('Nom de l’empresa'), 'Prova QA <script>&"');
      set(byLabel('Nom i cognoms'), 'Persona de Prova');
      set(byLabel('Correu professional'), 'qa@example.com');
      set(byLabel('Telèfon'), '+34 600 000 000');
      set(byLabel('Municipi'), 'Sant Quirze de Besora');
      set(byLabel('Nombre aproximat'), '16');
      set(byLabel('Data o període'), 'Març, matins');
      set(f.querySelector('textarea'), 'Observació de prova');
      f.querySelector('input[type=checkbox]').click();
    })()`);
    await p.shot(`${OUT}/${vp.name}-form.png`);
    await p.eval(`${form}.querySelector('button[type=submit]').click()`);
    await p.waitFor(`document.body.textContent.includes('Hem rebut la vostra sol·licitud')`, 15000);
    check(true, 'confirmació mostrada');
    const conf = await p.eval(`document.querySelector('section[aria-labelledby=parlem]').innerText`);
    check(conf.includes('Prova QA <script>&"') && conf.includes('Març, matins'), 'resum amb les dades enviades, sense injecció');
    await p.shot(`${OUT}/${vp.name}-confirmacio.png`);
  } catch (e) {
    check(false, e.message);
    await p.shot(`${OUT}/${vp.name}-error.png`).catch(() => {});
  } finally {
    p.close();
  }
}
console.log(failures ? `\n${failures} comprovacions han fallat` : '\nTot correcte');
process.exit(failures ? 1 : 0);
