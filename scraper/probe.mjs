// Diagnostika: skúsi stránky obchodov cez fetch aj cez skutočný prehliadač (Playwright) a vypíše výsledok.
import { chromium } from 'playwright';
const URLS = [
  'https://potravinydomov.itesco.sk/groceries/sk-SK/search?query=kuracie%20prsia&count=48',
  'https://www.kaufland.sk/ponuka/aktualny-tyzden/prehlad.html',
  'https://www.lidl.sk/',
];
for (const u of URLS) {
  try { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Accept-Language': 'sk-SK' } });
    const t = await r.text(); console.log('FETCH', r.status, u, '|', t.slice(0, 300).replace(/\s+/g, ' ')); }
  catch (e) { console.log('FETCH ERR', u, e.cause?.code || e.message); }
}
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'sk-SK', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
const p = await ctx.newPage();
for (const u of URLS) {
  try { const r = await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(4000);
    const html = await p.content(); console.log('BROWSER', r && r.status(), u, '| title:', await p.title(), '| len', html.length, '|', (await p.innerText('body')).slice(0, 300).replace(/\s+/g, ' ')); }
  catch (e) { console.log('BROWSER ERR', u, e.message.slice(0, 200)); }
}
await b.close();
