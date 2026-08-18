import { OrderProvider } from '../../lib/order/OrderProvider.jsx';
import { getFooter } from '../../lib/eds/fragments.js';
import { parseFooter } from '../../lib/eds/footer.js';
import { DockSlotProvider } from './DockSlot.jsx';
import AppShell from './AppShell.jsx';

// Redesigned app shell for all content routes. Fetches the DA-authored /footer fragment and passes
// the parsed model to the shell so a global footer renders under every non-chromeless page.
export default async function SiteLayout({ children }) {
  const footerModel = parseFooter(await getFooter());
  return (
    <OrderProvider>
      <DockSlotProvider>
        <AppShell footerModel={footerModel}>{children}</AppShell>
      </DockSlotProvider>
    </OrderProvider>
  );
}
