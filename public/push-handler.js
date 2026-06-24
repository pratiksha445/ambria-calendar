// Push notification event handlers — imported by the generated service worker.
// Handles incoming push messages and notification click actions.

self.addEventListener('push', (event) => {
  let data = { title: 'Ambria Calendar', body: '', action_url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {}

  const iconUrl = (self.registration.scope || '/') + 'icons/icon-192.png'
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconUrl,
      badge: iconUrl,
      data: { action_url: data.action_url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.action_url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
