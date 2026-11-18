// Pomocník na zľavy – zbiera akciové ceny z obchodov a zapisuje ich do zlavy.json.
// Spúšťa ho GitHub Actions (.github/workflows/zlavy.yml). Bez externých knižníc, Node 20+.
// DEBUG=1 uloží surové stránky do priečinka debug/ (na ladenie parserov).
import { writeFile, mkdir } from 'node:fs/promises';
import { MAP } from './mapping.mjs';
import { norm, matches, parseSize, sizeFor, parseTo, parseFrom, decodeEntities, stripTags } from './lib.mjs';

const DEBUG = process.env.DEBUG === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean); // napr. ONLY=T,K
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 jedalnicek-bot/1.0 (+https://github.com/samkowww/jedalnicek)';
const DELAY = 1500; // ohľaduplne: max. ~1 požiadavka za 1,5 s

const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date();
const iso = d => d.toISOString().slice(0, 10);
const plusDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
const num = v => { if (v == null) return null; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; };

let dbgN = 0;
async function dbg(name, content) {
  if (!DEBUG) return;
  await mkdir('debug', { recursive: true });
  await writeFile(`debug/${String(++dbgN).padStart(3, '0')}-${name.replace(/[^a-z0-9-]+/gi, '_').slice(0, 60)}`, content);
}

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      await sleep(DELAY);
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'sk-SK,sk;q=0.9' }, redirect: 'follow' });
      const t = await r.text();
      if (!r.ok) { console.log(`  ${r.status} ${url}`); if (r.status === 403 || r.status === 404) return { status: r.status, text: t }; continue; }
      return { status: r.status, text: t };
    } catch (e) { console.log(`  chyba ${url}: ${e.message}`); }
  }
  return { status: 0, text: '' };
}

// Nájde všetky JSON objekty vložené v HTML (script tagy, data-* atribúty, window.__X__ = {...})
function jsonBlobs(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = m[1].trim();
    if (body.startsWith('{') || body.startsWith('[')) { try { out.push(JSON.parse(body)); } catch { } }
    for (const w of body.matchAll(/=\s*(\{[\s\S]*\})\s*;?\s*$/g)) { try { out.push(JSON.parse(w[1])); } catch { } }
  }
  for (const m of html.matchAll(/data-[a-z-]+="(\{[^"]*\}|\[[^"]*\])"/g)) { try { out.push(JSON.parse(decodeEntities(m[1]))); } catch { } }
  return out;
}
function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 40) return;
  fn(o);
  for (const k in o) walk(o[k], fn, depth + 1);
}

// ---------- TESCO (potravinydomov.itesco.sk) ----------
// Pre každú surovinu jedno vyhľadávanie, z výsledkov berieme len produkty v akcii.
function tescoProducts(html) {
  const prods = [];
  const seen = new Set();
  for (const blob of jsonBlobs(html)) {
    walk(blob, o => {
      const title = o.title || o.name;
      if (typeof title !== 'string' || title.length < 3) return;
      const pr = o.price || o.actualPrice || (o.sellers && o.sellers.results && o.sellers.results[0] && o.sellers.results[0].price);
      const promos = o.promotions || (o.sellers && o.sellers.results && o.sellers.results[0] && o.sellers.results[0].promotions);
      if (pr == null && !promos) return;
      const key = (o.id || o.tpnc || o.tpnb || '') + title;
      if (seen.has(key)) return; seen.add(key);
      const price = typeof pr === 'object' ? num(pr.actual ?? pr.price ?? pr.value) : num(pr);
      const unitPrice = typeof pr === 'object' ? num(pr.unitPrice) : num(o.unitPrice);
      const unitOfMeasure = typeof pr === 'object' ? pr.unitOfMeasure : o.unitOfMeasure;
      prods.push({ title, price, unitPrice, unitOfMeasure, promos: Array.isArray(promos) ? promos : [], raw: o });
    });
  }
  return prods;
}
async function tesco(log) {
  const offers = [];
  let pages = 0, found = 0;
  for (const [id, m] of Object.entries(MAP)) {
    const url = `https://potravinydomov.itesco.sk/groceries/sk-SK/search?query=${encodeURIComponent(m.q)}&count=48`;
    const { status, text } = await get(url);
    if (!text) continue;
    pages++;
    if (pages <= 2) await dbg(`tesco-${id}.html`, text);
    const prods = tescoProducts(text);
    found += prods.length;
    for (const p of prods) {
      if (!matches(p.title, m)) continue;
      for (const pr of p.promos) {
        const desc = [pr.description, pr.offerText, pr.promotionText, pr.text].filter(Boolean).join(' ');
        const attrs = (pr.attributes || []).join(' ');
        const card = /CLUBCARD/i.test(attrs) || /clubcard/i.test(desc);
        let after = num(pr.price?.afterDiscount ?? pr.afterDiscount);
        const before = num(pr.price?.beforeDiscount ?? pr.beforeDiscount) ?? p.price;
        if (after == null) { const mm = norm(desc).match(/(\d+[.,]\d{2})\s*€/); if (mm) after = num(mm[1]); }
        if (after == null) after = p.price;
        if (after == null || before == null || after >= before - 0.004 && !card) continue;
        const to = pr.endDate ? String(pr.endDate).slice(0, 10) : parseTo(desc) || plusDays(6);
        const from = pr.startDate ? String(pr.startDate).slice(0, 10) : iso(today);
        const loose = /kg/i.test(p.unitOfMeasure || '') && /voln|na vahu|vazen/.test(norm(p.title));
        const size = sizeFor(parseSize(p.title), m.u);
        if (loose) { if (!card && p.unitPrice) offers.push({ id, ch: 'T', name: p.title, perKg: p.unitPrice, from, to, regular: before }); }
        else if (size) offers.push({ id, ch: 'T', name: p.title, size, price: card ? before : after, cardPrice: card ? after : null, card, regular: before, from, to });
      }
    }
  }
  log.T = { ok: pages > 0 && found > 0, pages, products: found };
  return offers;
}

// ---------- KAUFLAND (kaufland.sk – aktuálna ponuka) ----------
async function kaufland(log) {
  const offers = [];
  const urls = ['https://www.kaufland.sk/ponuka/aktualny-tyzden/prehlad.html', 'https://www.kaufland.sk/ponuka/buduci-tyzden/prehlad.html'];
  let tiles = 0, status = [];
  for (const url of urls) {
    const r = await get(url); status.push(r.status);
    await dbg('kaufland-' + url.split('/')[4] + '.html', r.text || '');
    if (!r.text) continue;
    const html = r.text;
    const valid = stripTags((html.match(/(platnos[\s\S]{0,120}?\d{1,2}\.\s*\d{1,2}\.[\s\S]{0,40}?\d{1,2}\.\s*\d{1,2}\.)/i) || [])[1] || '');
    const from = parseFrom(valid), to = parseTo(valid) || plusDays(6);
    // dlaždice ponuky
    const parts = html.split(/class="[^"]*m-offer-tile(?:\s|")/).slice(1);
    for (const part of parts) {
      const chunk = part.slice(0, 4000);
      const pick = cls => { const mm = chunk.match(new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/`, 'i')); return mm ? stripTags(mm[1]) : ''; };
      const title = [pick('m-offer-tile__subtitle'), pick('m-offer-tile__title')].filter(Boolean).join(' ');
      const qty = pick('m-offer-tile__quantity');
      const price = num(pick('a-pricetag__price'));
      const old = num(pick('a-pricetag__old-price'));
      const basic = pick('m-offer-tile__basic-price');
      if (!title || price == null) continue;
      tiles++;
      const card = /k-card|kaufland card/i.test(chunk);
      for (const [id, m] of Object.entries(MAP)) {
        if (!matches(title, m)) continue;
        const size = sizeFor(parseSize(qty || title), m.u);
        const perKg = /1\s*kg/.test(norm(basic)) && /cena za|na vahu|vazen|100 g/.test(norm(qty + ' ' + basic)) ? num((norm(basic).match(/=\s*(\d+[.,]\d+)/) || [])[1]) : null;
        if (perKg) offers.push({ id, ch: 'K', name: title, perKg, from, to, card, regular: old });
        else if (size) offers.push({ id, ch: 'K', name: title, size, price, card, cardPrice: card ? price : null, regular: old, from, to });
        break;
      }
    }
  }
  log.K = { ok: tiles > 0, tiles, status };
  return offers;
}

// ---------- LIDL (lidl.sk – produkty v akcii, dáta v atribúte data-grid-data) ----------
async function lidl(log) {
  const offers = [];
  const home = await get('https://www.lidl.sk/');
  await dbg('lidl-home.html', home.text || '');
  const links = new Set();
  for (const mm of (home.text || '').matchAll(/href="(\/c\/[^"#?]+)"/g)) {
    const l = mm[1];
    if (/akci|ponuk|zlav|tyzd|od-pondel|od-stvrt|super|cena/i.test(l)) links.add('https://www.lidl.sk' + l);
  }
  let tiles = 0, pages = 0;
  for (const url of [...links].slice(0, 8)) {
    const r = await get(url); if (!r.text) continue; pages++;
    if (pages <= 2) await dbg('lidl-' + url.split('/').pop(), r.text);
    for (const mm of r.text.matchAll(/data-grid-data="([^"]+)"/g)) {
      let d; try { d = JSON.parse(decodeEntities(mm[1])); } catch { continue; }
      const title = d.fullTitle || d.title || '';
      const p = d.price || {};
      const price = num(p.price); const old = num(p.oldPrice);
      const pack = (p.packaging && (p.packaging.text || p.packaging)) || '';
      const lp = d.lidlPlus && (Array.isArray(d.lidlPlus) ? d.lidlPlus.length : true);
      const range = stripTags(d.stockAvailability?.badgeInfo?.badgeText || d.ribbons?.map?.(x => x.text).join(' ') || '');
      if (!title || price == null) continue;
      tiles++;
      for (const [id, m] of Object.entries(MAP)) {
        if (!matches(title, m)) continue;
        const size = sizeFor(parseSize(String(pack) + ' ' + title), m.u);
        const perKg = /1\s*kg\s*=/.test(norm(pack)) && !size ? num((norm(pack).match(/=\s*(\d+[.,]\d+)/) || [])[1]) : null;
        const from = parseFrom(range), to = parseTo(range) || plusDays(6);
        if (!(old && old > price) && !lp) break; // len skutočné akcie
        if (perKg) offers.push({ id, ch: 'L', name: title, perKg, from, to, card: !!lp, regular: old });
        else if (size) offers.push({ id, ch: 'L', name: title, size, price, card: !!lp, cardPrice: lp ? price : null, regular: old, from, to });
        break;
      }
    }
  }
  log.L = { ok: tiles > 0, pages, tiles, links: links.size };
  return offers;
}

// ---------- hlavný beh ----------
const SOURCES = { T: tesco, K: kaufland, L: lidl };
const log = { B: { ok: false, note: 'Billa zverejňuje akcie len v obrázkových letákoch' } };
let offers = [];
for (const [k, fn] of Object.entries(SOURCES)) {
  if (ONLY.length && !ONLY.includes(k)) continue;
  console.log('Zdroj', k);
  try { offers = offers.concat(await fn(log)); } catch (e) { console.log('  zlyhal:', e.message); log[k] = { ok: false, error: e.message }; }
  console.log('  ', JSON.stringify(log[k]));
}
// necháme len 3 najvýhodnejšie ponuky na surovinu a obchod
const unit = o => o.perKg ? o.perKg / 1000 : (o.cardPrice ?? o.price) / o.size;
const byKey = {};
for (const o of offers) { if (!(unit(o) > 0)) continue; (byKey[o.id + o.ch] ||= []).push(o); }
const final = Object.values(byKey).flatMap(a => a.sort((x, y) => unit(x) - unit(y)).slice(0, 3))
  .map(o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)));
for (const k of Object.keys(log)) if (log[k].ok) log[k].count = final.filter(o => o.ch === k).length;
const out = { updated: new Date().toISOString(), sources: log, offers: final };
await writeFile('zlavy.json', JSON.stringify(out, null, 1));
console.log(`Hotovo: ${final.length} akciových ponúk`);
