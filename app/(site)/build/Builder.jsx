'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect, useMemo, useState,
} from 'react';
import { useOrder } from '../../../lib/order/OrderProvider.jsx';
import { useDockSlot } from '../DockSlot.jsx';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// Stack render order is top-to-bottom; insertion (bottom-to-top) is base bread → sauce → veg →
// cheese → protein → top bread, so the filling order here is the reverse.
const FILLING_ORDER = ['protein', 'cheese', 'veg', 'sauce'];

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function bricksWord(n) {
  const label = NUM_WORDS[n] || String(n);
  return `${label} brick${n === 1 ? '' : 's'}`;
}

// Stable pseudo-random (width + rotation) keyed to an ingredient id, so bricks don't jitter
// between renders.
function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function brickWidth(id) {
  return 204 + (hashId(id) % 17); // 204–220px
}
function brickRotation(id) {
  return ((hashId(id) % 19) - 9) / 10; // −0.9°…0.9°
}

export default function Builder({ palette }) {
  const router = useRouter();
  const { addToOrder } = useOrder();
  const { setChromeless } = useDockSlot();

  const byKey = useMemo(() => Object.fromEntries(palette.map((c) => [c.key, c])), [palette]);
  const breads = byKey.bread?.items || [];
  const defaultBread = breads.find((b) => b.default) || breads[0] || null;

  const initialSelected = useMemo(() => {
    const set = new Set();
    palette.forEach((cat) => {
      if (cat.key === 'bread') return;
      cat.items.forEach((it) => { if (it.default) set.add(it.id); });
    });
    return set;
  }, [palette]);

  const [breadId, setBreadId] = useState(defaultBread?.id || '');
  const [selected, setSelected] = useState(initialSelected);

  // Focused flow: hide the shell's default header + tab bar; this component renders its own.
  useEffect(() => {
    setChromeless(true);
    return () => setChromeless(false);
  }, [setChromeless]);

  const bread = breads.find((b) => b.id === breadId) || defaultBread;

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const clearAll = () => {
    setBreadId(defaultBread?.id || '');
    setSelected(new Set());
  };

  // Top-to-bottom brick list: top bread, proteins, cheeses, vegs, sauces, base bread.
  const bricks = useMemo(() => {
    const rows = [];
    if (bread) rows.push({ key: 'bread-top', color: bread.color, bread: true });
    FILLING_ORDER.forEach((catKey) => {
      (byKey[catKey]?.items || []).forEach((it) => {
        if (selected.has(it.id)) rows.push({ key: it.id, color: it.color });
      });
    });
    if (bread) rows.push({ key: 'bread-base', color: bread.color, bread: true, base: true });
    return rows;
  }, [bread, byKey, selected]);

  const totalCents = (bread?.priceCents || 0)
    + palette.reduce((sum, cat) => (cat.key === 'bread' ? sum
      : sum + cat.items.reduce((s, it) => (selected.has(it.id) ? s + it.priceCents : s), 0)), 0);

  const brickCount = selected.size + (bread ? 2 : 0);

  const addAndGo = () => {
    addToOrder({ name: `Custom stack · ${bread?.name || 'sandwich'}`, unitPriceCents: totalCents });
    router.push('/order');
  };

  return (
    <div className="builder">
      <header className="builder-header">
        <div className="builder-header-inner">
          <Link href="/" className="builder-back" aria-label="Back to home">←</Link>
          <span className="builder-title">Build your own</span>
          <button type="button" className="builder-clear" onClick={clearAll}>Clear</button>
        </div>
        <div className="accent-strip" aria-hidden="true" />
      </header>

      <section className="builder-preview">
        <div className="stack-preview" aria-hidden="true">
          {bricks.map((b) => (
            <span
              key={b.key}
              className={`stack-brick${b.base ? ' stack-brick-base' : ''}`}
              style={{
                '--brick-color': b.color,
                '--brick-w': b.bread ? '220px' : `${brickWidth(b.key)}px`,
                '--brick-rot': b.bread ? '0deg' : `${brickRotation(b.key)}deg`,
              }}
            />
          ))}
        </div>
        <div className="preview-meta">
          <span className="preview-count">
            {`${bricksWord(brickCount)} · ${bread?.name?.toLowerCase() || 'no'} base`}
          </span>
          <span className="preview-total">{formatPrice(totalCents)}</span>
        </div>
      </section>

      <div className="builder-groups">
        {palette.map((cat) => (
          <section className="ing-group" key={cat.key}>
            <h2 className="ing-group-head">
              <span className="ing-group-label">{cat.label}</span>
              <span className="ing-group-note">{cat.note}</span>
            </h2>
            <div className="ing-pills">
              {cat.items.map((it) => {
                const isBread = cat.key === 'bread';
                const isOn = isBread ? bread?.id === it.id : selected.has(it.id);
                const delta = isBread ? it.priceCents - (defaultBread?.priceCents || 0) : it.priceCents;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`pill${isOn ? ' pill-on' : ''}`}
                    aria-pressed={isOn}
                    onClick={() => (isBread ? setBreadId(it.id) : toggle(it.id))}
                  >
                    <span className="pill-swatch" style={{ '--brick-color': it.color }} />
                    <span className="pill-name">{it.name}</span>
                    {isOn ? (
                      <span className="pill-check" aria-hidden="true">✓</span>
                    ) : (
                      delta > 0 && <span className="pill-price">{`+${formatPrice(delta)}`}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="builder-dock">
        <div className="dock-total">
          <span className="dock-total-cap">running total</span>
          <span className="dock-total-val">{formatPrice(totalCents)}</span>
        </div>
        <button type="button" className="btn btn-primary dock-add" onClick={addAndGo}>
          Add to order
        </button>
      </div>
    </div>
  );
}
