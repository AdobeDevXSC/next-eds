// add delayed functionality here

// Register the PWA service worker. This module is imported in the delayed phase
// (~3s after load), so it has no impact on LCP — and because `load` has almost
// certainly already fired by now, register immediately rather than waiting on an
// event that won't fire again. Failures are swallowed so a service-worker
// problem can never break the page.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
