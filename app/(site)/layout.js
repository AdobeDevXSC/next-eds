import { OrderProvider } from '../../lib/order/OrderProvider.jsx';
import { getFooter } from '../../lib/eds/fragments.js';
import { parseFooter } from '../../lib/eds/footer.js';
import { getCurrentUser } from '../../lib/session.js';
import { getFlags } from '../../lib/flags.js';
import { DockSlotProvider } from './DockSlot.jsx';
import AppShell from './AppShell.jsx';

// Redesigned app shell for all content routes. Fetches the DA-authored /footer fragment plus the
// signed-in user and feature flags, and passes the resulting models to the shell so a global
// footer and the header's signed-in/loyalty state render on every non-chromeless page.
export default async function SiteLayout({ children }) {
  const [footerModel, user, flags] = await Promise.all([
    getFooter().then(parseFooter),
    getCurrentUser(),
    getFlags(),
  ]);
  return (
    <OrderProvider>
      <DockSlotProvider>
        <AppShell footerModel={footerModel} user={user} flags={flags}>{children}</AppShell>
      </DockSlotProvider>
    </OrderProvider>
  );
}
