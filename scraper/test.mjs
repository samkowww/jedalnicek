// Rýchle testy priraďovania produktov (node scraper/test.mjs)
import { MAP } from './mapping.mjs';
import { matches, parseSize, parseTo } from './lib.mjs';
const find = t => Object.entries(MAP).filter(([, m]) => matches(t, m)).map(([k]) => k);
const cases = [
 ['Tesco Kuracie rezne 0,9 kg', ['kura_prsia']], ['Tesco Sous-Vide pomaly varené kuracie prsia 500 g', []],
 ['Bravčové plece bez kosti', ['bravc_pliecko']], ['Tesco Mleté bravčové mäso 500 g', ['mlete']],
 ['Tesco Mleté morčacie mäso 100% 500 g', []], ['Cibuľa voľná', ['cibula']], ['Paprika červená voľná', ['paprika']],
 ['Rajo Smotana na šľahanie 33% 250 ml', []], ['Tesco Tvaroh polotučný 250 g', ['tvaroh']], ['Tesco Dlhozrnná ryža 1 kg', ['ryza']],
 ['Bonduelle Gold Zlatá kukurica 340 g', ['kukurica']], ['Dr. Oetker Kypriaci prášok do pečiva 5 x 12 g', []],
 ['Rama Maslo 250 g', ['maslo']], ['Arašidové maslo 350 g', ['arasidove']], ['Vajcia M 10 ks', ['vajce']], ['Tesco Údená slanina s kožou', ['slanina']],
 ['Mlieko polotučné 1,5 % 1 l', ['mlieko']], ['Kokosové mlieko 400 ml', ['kokos']], ['Kuracie stehná horné', ['kura_stehna']],
 ['Evelina Jablká ukladané', ['jablko']], ['Tesco Mandarínky 1 kg', []], ['Hera Classic 250 g', []],
];
let bad = 0;
for (const [t, exp] of cases) { const got = find(t); const ok = JSON.stringify(got) === JSON.stringify(exp); if (!ok) bad++; console.log(ok ? '✓' : '✗', t, '→', got.join(',') || '—'); }
for (const t of ['Tesco Kuracie rezne 0,9 kg', '2 x 125 g', 'Vajcia M 10 ks', 'Mlieko 1 l']) console.log('  ', t, JSON.stringify(parseSize(t)));
console.log('  ', parseTo('platí do 24. 11. 2026'), parseTo('Platnosť od 19.11. do 25.11.'));
process.exit(bad ? 1 : 0);
