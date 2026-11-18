// Diagnostika Lidl: nájde stránky s akciovým jedlom a vypíše, aké dáta obsahujú.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const get = async u => { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'sk-SK' } }); return { s: r.status, t: await r.text() }; };
const home = await get('https://www.lidl.sk/');
console.log('HOME', home.s, home.t.length);
const links = [...new Set([...home.t.matchAll(/href="(\/[a-z]\/[^"#?]+)"/g)].map(m => m[1]))];
console.log('LINKS', links.length);
for (const l of links) if (/akci|ponuk|zlav|letak|jedlo|potrav|tyzd|pondel|stvrt|lidl-plus|cena/i.test(l)) console.log('  L', l);
const dec = s => s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&');
const cand = links.filter(l => /akci|ponuk|zlav|jedlo|potrav|tyzd|pondel|stvrt/i.test(l)).slice(0, 12);
for (const l of cand) {
  try { const r = await get('https://www.lidl.sk' + l); const g = [...r.t.matchAll(/data-grid-data="([^"]+)"/g)];
    console.log('PAGE', r.s, l, 'grid:', g.length);
    for (const m of g.slice(0, 3)) { try { const d = JSON.parse(dec(m[1])); console.log('   ', JSON.stringify({ t: d.fullTitle, cat: d.category, price: d.price, lp: d.lidlPlus, badges: d.stockAvailability, ribbons: d.ribbons }).slice(0, 700)); } catch (e) { console.log('   parse err'); } }
    if (!g.length) { const n = r.t.match(/data-[a-z-]*="\{&quot;[^"]{0,300}/); console.log('    other data:', n ? n[0].slice(0, 300) : '-'); }
  } catch (e) { console.log('PAGE ERR', l, e.cause?.code || e.message); }
  await new Promise(r => setTimeout(r, 1200));
}
