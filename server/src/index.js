import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orgsRouter from './routes/orgs.js';
import queryRouter from './routes/query.js';
import { createWsHub } from './ws/hub.js';
import { pool } from './db/pool.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: clientOrigin.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: true });
  } catch {
    res.status(503).json({ status: 'degraded', db: false });
  }
});

app.use('/orgs', orgsRouter);
app.use('/query', queryRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

const server = http.createServer(app);
const hub = createWsHub(server);
app.locals.broadcast = hub.broadcast;

server.listen(port, host, () => {
  console.log(`FieldPulse API listening on http://${host}:${port}`);
  console.log(`WebSocket available at ws://${host}:${port}/ws`);
});
