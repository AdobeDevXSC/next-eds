import { getPersonas } from '../../../lib/db.js';
import './signin.css';

export const metadata = { title: 'Sign in — Stacked' };
// getPersonas() calls getCloudflareContext(), which only resolves inside a real request —
// force this route to render per-request rather than let Next try to prerender it statically
// at build time (where no Cloudflare binding context exists yet).
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const personas = await getPersonas();

  return (
    <main className="signin-page">
      <div className="signin-card">
        <h1>Sign in</h1>
        <p className="signin-lede">Pick a demo account to explore Stacked as a returning customer.</p>
        <div className="signin-personas">
          {personas.map((persona) => (
            <form key={persona.id} action="/api/auth/persona" method="POST" className="signin-persona">
              <input type="hidden" name="personaId" value={persona.id} />
              <span className="signin-avatar" aria-hidden="true">{persona.avatar_initials}</span>
              <span className="signin-persona-info">
                <span className="signin-persona-name">{persona.name}</span>
                <span className="signin-persona-meta">{persona.loyalty_stamps} loyalty stamp{persona.loyalty_stamps === 1 ? '' : 's'}</span>
              </span>
              <button type="submit" className="button primary signin-persona-btn">Sign in as {persona.name.split(' ')[0]}</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
