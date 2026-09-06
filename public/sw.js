self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Remi', {
      body: data.body ?? 'You have an update.',
      icon: '/icons.svg',
      badge: '/icons.svg',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client)

      if (existingClient) {
        return existingClient.focus()
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})