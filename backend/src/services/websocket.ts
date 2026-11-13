import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Logger } from '../utils/logger.js';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    // Authenticate WS connection via query string token
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Unauthorized: Missing token');
      return;
    }

    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      ws.close(4002, 'Unauthorized: Invalid token');
      return;
    }

    clients.add(ws);
    Logger.debug(`[WebSocket] Client connected. Total active clients: ${clients.size}`);

    // Send immediate welcome & initial ping
    ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() }));

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore unparseable frames
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      Logger.debug(`[WebSocket] Client disconnected. Total active clients: ${clients.size}`);
    });

    ws.on('error', (err) => {
      Logger.error(`[WebSocket] Client error: ${err.message}`);
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcastWS(eventType: string, payload: any) {
  if (!wss || clients.size === 0) return;

  const message = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err: any) {
        Logger.error(`[WebSocket] Broadcast error: ${err.message}`);
      }
    }
  }
}

