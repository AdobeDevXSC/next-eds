import './steps.css';

// Steps renders a numbered sequence. Each row is [title | description].
// Server Component — zero client JavaScript.
export default function Steps({ rows, variants = [] }) {
  return (
    <div className={['steps', ...variants, 'block'].join(' ')}>
      <ol className="steps-list">
        {rows.map((cells, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <li className="steps-step" key={i}>
            <span className="steps-num" aria-hidden="true">{i + 1}</span>
            <div className="steps-body">
              {/* eslint-disable-next-line react/no-danger */}
              <div className="steps-title" dangerouslySetInnerHTML={{ __html: cells[0]?.html ?? '' }} />
              {/* eslint-disable-next-line react/no-danger */}
              <div className="steps-desc" dangerouslySetInnerHTML={{ __html: cells[1]?.html ?? '' }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
