// Entity-encode dynamic values before interpolating them into markup strings.
const ATTR = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export function escapeAttr(str) {
  return String(str ?? '').replace(/[&<>"]/g, (c) => ATTR[c]);
}
export function escapeText(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ATTR[c]);
}
