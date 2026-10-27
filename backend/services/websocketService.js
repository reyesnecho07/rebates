import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const WS_PATH = '/permission-ws';
let wss;

export function initWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  // Accept only /permission-ws connections that carry a valid JWT (?token=...)
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== WS_PATH) return socket.destroy();

    try {
      const user = jwt.verify(url.searchParams.get('token'), process.env.JWT_SECRET);
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.user = user;
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Drop dead connections every 30s
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log(`🔌 WebSocket ready on ${WS_PATH}`);
}

// Send a message to every connected client
export function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((c) => c.readyState === 1 && c.send(msg));
}