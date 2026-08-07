import { WebSocketServer } from 'ws';

export function createWsHub(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set();

  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));

    socket.on('close', () => {
      clients.delete(socket);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });
  });

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  return { wss, broadcast, clients };
}
