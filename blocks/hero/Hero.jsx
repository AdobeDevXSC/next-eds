import './hero.css';

// Hero is a React Server Component — renders to HTML with ZERO client-side JavaScript,
// preserving the EDS performance profile. The single cell already holds the <picture> + <h1>;
// CSS layers the picture behind the heading (see hero.css).
export default function Hero({ rows }) {
  const html = rows?.[0]?.[0]?.html ?? '';
  return (
    // eslint-disable-next-line react/no-danger
    <div className="hero block" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
