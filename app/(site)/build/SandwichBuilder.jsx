'use client';

import { useMemo, useState } from 'react';
import './build.css';

const TYPE_ORDER = ['bread', 'protein', 'cheese', 'veg', 'sauce', 'extra'];
const TYPE_LABELS = {
  bread: 'Bread', protein: 'Protein', cheese: 'Cheese', veg: 'Veggies', sauce: 'Sauce', extra: 'Extras',
};

/** Bread starts on its first `default: true` item (or its first item at all); every other
 * type starts with every `default: true` item pre-selected. */
function initialSelection(palette) {
  const selected = {};
  TYPE_ORDER.forEach((type) => {
    const items = palette[type] || [];
    if (type === 'bread') {
      selected.bread = items.find((item) => item.default) || items[0] || null;
    } else {
      selected[type] = items.filter((item) => item.default).map((item) => item.name);
    }
  });
  return selected;
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// The build-your-own configurator ("The Stack" — see docs/DESIGN.md). Bread is single-select
// (it sets the build's base price); every other type is multi-select (each an additive
// upcharge, 0 = included). The right column renders the current selection as a literal
// vertical stack of bricks with a running total — the signature component of the brand.
export default function SandwichBuilder({ palette }) {
  const [selected, setSelected] = useState(() => initialSelection(palette));

  const selectBread = (item) => setSelected((prev) => ({ ...prev, bread: item }));

  const toggle = (type, name) => setSelected((prev) => {
    const set = new Set(prev[type]);
    if (set.has(name)) set.delete(name); else set.add(name);
    return { ...prev, [type]: [...set] };
  });

  const stack = useMemo(() => {
    const rows = [];
    if (selected.bread) {
      rows.push({ type: 'bread', name: selected.bread.name, priceCents: selected.bread.priceCents });
    }
    TYPE_ORDER.slice(1).forEach((type) => {
      (palette[type] || [])
        .filter((item) => selected[type]?.includes(item.name))
        .forEach((item) => rows.push({ type, name: item.name, priceCents: item.priceCents }));
    });
    return rows;
  }, [selected, palette]);

  const totalCents = stack.reduce((sum, row) => sum + row.priceCents, 0);

  return (
    <div className="build-columns">
      <div className="build-palette">
        {TYPE_ORDER.map((type) => {
          const items = palette[type] || [];
          if (items.length === 0) return null;
          return (
            <div className="build-group" key={type}>
              <p className="build-group-label">{TYPE_LABELS[type]}</p>
              <div className="build-chips">
                {items.map((item) => {
                  const isSelected = type === 'bread'
                    ? selected.bread?.name === item.name
                    : selected[type]?.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className={`build-chip${isSelected ? ' build-chip-on' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => (type === 'bread' ? selectBread(item) : toggle(type, item.name))}
                    >
                      {isSelected && <span className="build-chip-stud" aria-hidden="true" />}
                      {item.name}
                      {item.priceCents > 0 && ` +${formatPrice(item.priceCents)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="build-stack-panel">
        <p className="build-stack-title">Your stack</p>
        <div className="build-stack">
          {stack.map((row) => (
            <div key={`${row.type}-${row.name}`} className={`build-slab build-slab-${row.type}`}>
              <span>{row.name}</span>
              <span>{row.priceCents > 0 ? formatPrice(row.priceCents) : 'incl.'}</span>
            </div>
          ))}
        </div>
        <div className="build-total">
          <span>Total</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
