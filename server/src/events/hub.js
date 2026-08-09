/** In-process SSE hub for location update events. */

const clients = new Set();

export function subscribe(res) {
  clients.add(res);
  return () => clients.delete(res);
}

export function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}

export function clientCount() {
  return clients.size;
}
