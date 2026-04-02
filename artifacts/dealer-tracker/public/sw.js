const APP_NAME = "Maintenance Tracker";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: APP_NAME, body: event.data ? event.data.text() : "New notification" };
  }

  // Resolve URLs relative to this SW's scope so they work regardless of deploy path
  const scope = self.registration.scope;
  const iconUrl = new URL("favicon.png", scope).href;
  const targetUrl = data.url
    ? new URL(data.url, scope).href
    : scope;

  const title = data.title ?? APP_NAME;
  const options = {
    body: data.body ?? "",
    icon: iconUrl,
    badge: iconUrl,
    data: { url: targetUrl },
    tag: data.type ?? "general",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
