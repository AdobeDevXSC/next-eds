import './hero.css';

// Hero is a React Server Component — renders to HTML with ZERO client-side JavaScript,
// preserving the EDS performance profile. The cell holds the <picture> plus the heading and
// any optional subhead / call-to-action links; CSS layers the picture and a contrast scrim
// behind the text (see hero.css).
export default function Hero({ rows, variants = [] }) {
  const html = rows?.[0]?.[0]?.html ?? '';
  return (
    <div className={['hero', ...variants, 'block'].join(' ')}>
      {/* eslint-disable-next-line react/no-danger */}
      <div className="hero-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
