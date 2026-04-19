import { useEffect } from 'react';
import { BuilderView } from './views/BuilderView';
import { AdminView } from './views/AdminView';
import { CeremonyView } from './views/CeremonyView';
import { PaymentStateView } from './views/PaymentStateView';
import { PublicCardView } from './views/PublicCardView';
import { OrderPortalView } from './views/OrderPortalView';
import { initI18n } from './lib/i18n';
import { initDarkMode } from './lib/darkMode';

// Initialize i18n and dark mode on app load
initI18n();
initDarkMode();

function App() {
  const currentPath = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const paymentParam = searchParams.get('payment');

  useEffect(() => {
    if (currentPath.startsWith('/admin')) {
      document.title = 'Tekko · Admin';
    } else if (currentPath.startsWith('/payment/')) {
      document.title = 'Paiement · Tapal';
    } else if (!currentPath.startsWith('/c/')) {
      document.title = 'Tapal Studio';
    }
    // PublicCardView sets its own title when the card loads
  }, [currentPath]);

  // ── Visitor tracking beacon ─────────────────────────────────
  useEffect(() => {
    // Skip admin pages and payment callbacks — those are not real visitor events
    if (currentPath.startsWith('/admin') || currentPath.startsWith('/payment') || currentPath.startsWith('/my-order')) return;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: currentPath,
        referrer: document.referrer,
        screen: `${window.screen.width}x${window.screen.height}`,
      }),
    }).catch(() => {});
  }, [currentPath]);

  if (currentPath.startsWith('/admin')) {
    return <AdminView />;
  }

  if (currentPath.startsWith('/my-order')) {
    return <OrderPortalView />;
  }

  if (currentPath.startsWith('/payment/success') || paymentParam === 'success') {
    return <PaymentStateView variant="success" />;
  }

  if (currentPath.startsWith('/payment/cancel') || paymentParam === 'cancel' || paymentParam === 'error') {
    return <PaymentStateView variant="cancel" />;
  }

  if (currentPath.startsWith('/c/')) {
    const slug = currentPath.replace('/c/', '').split('/')[0];
    return <PublicCardView slug={slug} />;
  }

  if (currentPath.startsWith('/ceremonies')) {
    document.title = 'Ceremonies - TEKKO';
    return <CeremonyView />;
  }

  return <BuilderView />;
}

export default App;