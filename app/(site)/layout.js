import { OrderProvider } from '../../lib/order/OrderProvider.jsx';
import { DockSlotProvider } from './DockSlot.jsx';
import AppShell from './AppShell.jsx';

// Redesigned app shell for all content routes: sticky header + orange strip on desktop, docked
// bottom tab bar on mobile. The order store (localStorage-backed) and the docked-action slot are
// provided here so any page can add to the order or inject a mobile action row.
export default function SiteLayout({ children }) {
  return (
    <OrderProvider>
      <DockSlotProvider>
        <AppShell>{children}</AppShell>
      </DockSlotProvider>
    </OrderProvider>
  );
}
