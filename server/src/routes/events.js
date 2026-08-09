import { Router } from 'express';
import { subscribe } from '../events/hub.js';

const router = Router();

/**
 * Server-Sent Events stream of location.batch / location.updated payloads.
 * Clients keep a single long-lived connection; the ticker publishes every minute.
 */
router.get('/locations', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'location.subscribed', at: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribe(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
