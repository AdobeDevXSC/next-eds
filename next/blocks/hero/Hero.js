import { parse } from 'node-html-parser';
import './hero.css';

// Hero is a React Server Component — it renders to HTML with ZERO client-side JavaScript,
// preserving the EDS performance profile. It receives the parsed block cells as props and
// emits its own JSX, rather than mutating decorated DOM the way aem.js would.
export default function Hero({ rows }) {
  // The auto-blocked hero packs <picture> + <h1> into a single cell.
  const cellHtml = rows?.[0]?.[0] ?? '';
  const cell = parse(cellHtml);

  const pictureHtml = cell.querySelector('picture')?.outerHTML ?? '';
  const heading = cell.querySelector('h1');

  return (
    <div className="hero block">
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: pictureHtml }} />
      {heading && (
        <h1 id={heading.getAttribute('id') || undefined}>{heading.text}</h1>
      )}
    </div>
  );
}
