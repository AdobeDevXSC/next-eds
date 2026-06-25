import './cards.css';

// Server Component port of the native cards decorate(): each row → <li>, each cell classed
// as image or body. Picture markup arrives already optimized from EDS .plain.html, so (unlike
// the old block) there's no createOptimizedPicture step.
export default function Cards({ rows, variants = [] }) {
  return (
    <div className={['cards', ...variants, 'block'].join(' ')}>
      <ul>
        {rows.map((cells, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={i}>
            {cells.map((cell, j) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={j}
                className={cell.pictureOnly ? 'cards-card-image' : 'cards-card-body'}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: cell.html }}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
