// Silent auto-reload PWA registration.
// No toast, no user prompt — page reloads automatically when a new SW activates.

import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version detected — trigger SKIP_WAITING + reload immediately.
    // The true flag tells vite-plugin-pwa to reload the page after activation.
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    // Poll for updates every 60 seconds
    setInterval(() => { registration.update() }, 60 * 1000)
  },
  onRegisterError(error) {
    console.error('[SW] registration error', error)
  },
})
