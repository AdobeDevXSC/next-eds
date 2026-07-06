import './callout.css';

// Callout is a React Server Component — renders to HTML with ZERO client-side JavaScript.
// Content model: one row, two cells — an icon/emoji and the message. Variants (info,
// warning, success) come from the block's class names and tint the left border.
export default function Callout({ rows, variants = [] }) {
  const [iconCell, bodyCell] = rows?.[0] ?? [];
  return (
    <div className={['callout', ...variants, 'block'].join(' ')}>
      {/* eslint-disable-next-line react/no-danger */}
      <span className="callout-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconCell?.html ?? '' }} />
      {/* eslint-disable-next-line react/no-danger */}
      <div className="callout-body" dangerouslySetInnerHTML={{ __html: bodyCell?.html ?? '' }} />
    </div>
  );
}
