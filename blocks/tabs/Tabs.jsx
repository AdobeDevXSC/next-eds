'use client';

import { useState } from 'react';
import './tabs.css';

// Tabs — accessible tablist with selectable panels ('use client' island).
// Content model: each row is a tab; cell[0] is the label, cell[1] is the panel HTML.
export default function Tabs({ rows, variants = [] }) {
  const [active, setActive] = useState(0);
  const tabs = rows.map((cells) => ({
    label: cells[0]?.html ?? '',
    panel: cells[1]?.html ?? '',
  }));

  return (
    <div className={['tabs', ...variants, 'block'].join(' ')}>
      <div className="tabs-list" role="tablist">
        {tabs.map((t, i) => (
          <button
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            type="button"
            role="tab"
            className="tabs-tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: t.label }}
          />
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          role="tabpanel"
          className="tabs-panel"
          aria-hidden={i !== active}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: t.panel }}
        />
      ))}
    </div>
  );
}
