import { getHomeContent } from '../../lib/content.js';
import HomeDockCtas from './home/HomeDockCtas.jsx';
import PickAddButton from './home/PickAddButton.jsx';
import './home/home.css';

export const metadata = {
  title: 'Stacked — build your lunch, brick by brick',
  description: 'A sandwich counter with two ways to order: shop a signature menu or build your own, brick by brick.',
};

// Home (2a desktop / 3a mobile). Bespoke responsive layout; verbatim copy + the fixed annotated
// hero-stack illustration come from content/home.json. See the redesign spec.
export default function HomePage() {
  const c = getHomeContent();
  const { heroStack, twoWays, todaysPicks: picks, howItWorks: hiw, ctas, footer } = c;

  return (
    <main className="home">
      <section className="home-hero">
        <p className="overline">{c.overline}</p>
        <h1 className="wordmark">{c.wordmark}</h1>
        <p className="hero-tagline">{c.tagline}</p>

        <div className="annotated">
          <ul className="annotated-rows">
            {heroStack.rows.map((r) => (
              <li className="annotated-row" key={r.labelDesktop}>
                <span className="anno-label anno-label-d">{r.labelDesktop}</span>
                <span className="anno-label anno-label-m">{r.labelMobile}</span>
                <span
                  className={`anno-brick${r.base ? ' anno-brick-base' : ''}`}
                  style={{
                    '--brick-color': r.color,
                    '--h-d': `${r.heightDesktop}px`,
                    '--h-m': `${r.heightMobile}px`,
                    '--brick-radius': r.radius,
                  }}
                />
                <span className="anno-price">{r.priceDisplay}</span>
              </li>
            ))}
          </ul>
          <div className="annotated-total">
            <span className="anno-count">{heroStack.brickCountLabel}</span>
            <span className="anno-total-val">{heroStack.totalDisplay}</span>
          </div>
        </div>

        <div className="hero-ctas">
          <a className="btn btn-primary" href={ctas.shop.href}>{ctas.shop.label}</a>
          <a className="btn btn-ghost" href={ctas.build.href}>{ctas.build.label}</a>
        </div>
      </section>

      <section className="lede-band">
        <p className="lede">{c.lede}</p>
      </section>

      <section className="home-section two-ways">
        <h2 className="section-heading">{twoWays.heading}</h2>
        <ul className="two-ways-rows">
          {twoWays.rows.map((row) => (
            <li className="two-ways-row" key={row.index}>
              <span className={`tw-index tw-index-${row.indexColor}`}>{row.index}</span>
              <div className="tw-body">
                <h3 className="tw-title">{row.title}</h3>
                <p className="tw-desc">{row.description}</p>
              </div>
              <div className="tw-specimen">
                {row.specimen.map((b, j) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={j}
                    className="specimen-brick"
                    style={{ '--brick-color': b.color, '--sh': `${b.height}px` }}
                  />
                ))}
              </div>
              <a className="tw-cta" href={row.href}>{`${row.cta} →`}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section todays-picks">
        <h2 className="section-heading">{picks.heading}</h2>
        <div className="pick-card">
          <div className="pick-well">
            <span className="pick-badge">{picks.badge}</span>
            <div className="pick-stack">
              {picks.stackColors.map((col, i) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="pick-brick"
                  style={{ '--brick-color': col }}
                />
              ))}
            </div>
          </div>
          <div className="pick-body">
            <div className="pick-titlerow">
              <h3 className="pick-name">{picks.name}</h3>
              <span className="pick-price">{picks.priceDisplay}</span>
            </div>
            <p className="pick-desc">{picks.description}</p>
            <PickAddButton
              name={picks.name}
              priceDisplay={picks.priceDisplay}
              label={picks.addLabel}
            />
          </div>
        </div>
      </section>

      <section className="home-section how-it-works">
        <h2 className="section-heading">{hiw.heading}</h2>
        <ol className="hiw-steps">
          {hiw.steps.map((s, i) => (
            <li className={`hiw-step${i === 0 ? ' hiw-step-first' : ''}`} key={s.num}>
              <span className="hiw-num">{s.num}</span>
              <h3 className="hiw-title">{s.title}</h3>
              <p className="hiw-desc">{s.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="home-footer">
        <span className="foot-copy">{footer.copyright}</span>
        <nav className="foot-links" aria-label="Legal">
          {footer.links.map((l) => (
            <a className="foot-link" key={l.label} href={l.href}>{l.label}</a>
          ))}
        </nav>
      </footer>

      <HomeDockCtas
        shopHref={ctas.shop.href}
        shopLabel={ctas.shop.label}
        buildHref={ctas.build.href}
        buildLabel={ctas.build.label}
      />
    </main>
  );
}
