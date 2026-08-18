// Phase-2 seam: keep the interface stable so delivery slots in without reshaping Phase 1.
// eslint-disable-next-line no-unused-vars
export async function send({ to, subject, html } = {}) {
  throw new Error('send() is Phase 2 — not implemented');
}
