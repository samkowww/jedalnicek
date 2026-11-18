import { STD_NOT } from './mapping.mjs';
export const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const today = new Date();
// ---------- spoločné pomôcky ----------
export function matches(name, m) {
  const n = ' ' + norm(name) + ' ';
  if (!m.must.some(w => n.includes(norm(w)))) return false;
  if (m.must2 && !m.must2.some(w => n.includes(norm(w)))) return false;
  if ((m.not || []).some(w => n.includes(norm(w)))) return false;
  if (STD_NOT.some(w => n.includes(w))) return false;
  return true;
}
// "Kuracie rezne 0,9 kg" -> {amt:900, unit:'g'}; "2 x 125 g" -> 250 g; "10 ks" -> 10 ks
export function parseSize(text) {
  const t = norm(text).replace(/(\d),(\d)/g, '$1.$2');
  let m = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (m) return conv(+m[1] * +m[2], m[3]);
  const all = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|ks)\b/g)];
  if (!all.length) return null;
  const last = all[all.length - 1];
  return conv(+last[1], last[2]);
}
function conv(v, u) {
  if (u === 'kg') return { amt: v * 1000, unit: 'g' };
  if (u === 'l') return { amt: v * 1000, unit: 'ml' };
  if (u === 'ks') return { amt: v, unit: 'ks' };
  return { amt: v, unit: u };
}
export function sizeFor(sz, u) {
  if (!sz) return null;
  if (u === 'ks') return sz.unit === 'ks' ? sz.amt : null;
  if (sz.unit === 'ks') return null;
  return sz.amt; // g a ml berieme 1:1
}
// "platí do 24. 11. 2026" / "do 24.11." -> 2026-11-24
export function parseTo(text) {
  const t = norm(text);
  const m = t.match(/do\s*(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/);
  if (!m) return null;
  const y = m[3] ? +m[3] : today.getFullYear() + ((+m[2] < today.getMonth() + 1 - 6) ? 1 : 0);
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
export function parseFrom(text) {
  const t = norm(text);
  const m = t.match(/od\s*(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{4}))?/);
  if (!m) return null;
  const y = m[3] ? +m[3] : today.getFullYear();
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
export const decodeEntities = s => s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export const stripTags = s => decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

