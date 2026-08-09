import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orgsRouter from './routes/orgs.js';
import queryRouter from './routes/query.js';
import eventsRouter from './routes/events.js';
import { pool } from './db/pool.js';
import { startLocationTicker } from './events/locationTicker.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const publicUiUrl = process.env.PUBLIC_UI_URL || 'https://field-pulse-1.onrender.com';

app.use(
  cors({
    origin: clientOrigin.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    service: 'FieldPulse API',
    health: '/health',
    ui: publicUiUrl,
    events: '/events/locations',
    note: 'This host serves the API only. Open the UI URL for the dashboard.',
  });
});

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
app.use('/events', eventsRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`FieldPulse API listening on http://${host}:${port}`);
  startLocationTicker();
});
