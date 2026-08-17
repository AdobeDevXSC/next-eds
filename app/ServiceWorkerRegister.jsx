'use client';

import { useEffect } from 'react';

// Registers the service worker after load. Renders nothing. Skipped in dev to avoid
// stale-cache confusion; only registers on the deployed origin.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;
    if (!('serviceWorker' in navigator)) return undefined;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    // This effect runs after hydration, so the window may have already finished loading by
    // the time we get here — `load` is a one-shot event and won't fire again, so register
    // right away in that case instead of waiting forever.
    if (document.readyState === 'complete') {
      onLoad();
      return undefined;
    }
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
