# Deploy FieldPulse (Render)

Live stack (all on Render):

| Piece | URL |
|-------|-----|
| **UI (Static Site)** | https://field-pulse-1.onrender.com |
| **API (Web Service)** | https://field-pulse.onrender.com |
| **Database** | Render Postgres (linked to the API) |

- UI → API via `VITE_API_URL=https://field-pulse.onrender.com`
- API CORS → `CLIENT_ORIGIN=https://field-pulse-1.onrender.com`
- Open the **static site** for the dashboard. The API root (`/`) is not a webpage; use `/health` to check the API.

---

## Architecture (production)

```text
Browser
   │
   ├─ REST ──► Static Site UI ──VITE_API_URL──► Express API ──► Postgres
   │                                      │
   └─ SSE ──► GET /events/locations ──────┘
              (location.batch: Kafka locally, in-process on Render)
```

API runs the **location ticker** (producer). With `KAFKA_BROKERS` it publishes to Kafka and a consumer persists + SSE-fans-out. On Render leave Kafka unset — same events, in-process bus. Dashboard REST stays a snapshot; the map updates from SSE.
---

## Recreate from scratch

### 1. Postgres
Render → **New** → **PostgreSQL** (free) → note the **Internal Database URL**.

### 2. API Web Service
| Setting | Value |
|---------|--------|
| Repo | `tlashaz95/field-pulse` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm run setup && npm start` |

**Environment variables:**

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Internal Database URL from Postgres (or link the DB in the UI) |
| `HOST` | `0.0.0.0` |
| `GROQ_API_KEY` | your Groq key |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `CLIENT_ORIGIN` | `https://field-pulse-1.onrender.com` (set after UI exists) |
| `PUBLIC_UI_URL` | `https://field-pulse-1.onrender.com` (optional; shown on API `/`) |
| `LOCATION_TICK_MS` | `60000` (optional; location heartbeat interval) |

Leave `PORT` unset — Render injects it.

Verify: https://field-pulse.onrender.com/health → `{"status":"ok","db":true}`

Free web services **sleep when idle**; the first request after idle can take 30–60s.

### 3. Static Site (UI)
`dist` is **not** in GitHub — Render creates it at build time.

**Preferred settings:**

| Setting | Value |
|---------|--------|
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**If that fails, use:**

| Setting | Value |
|---------|--------|
| Root Directory | *(empty)* |
| Build Command | `cd client && npm install && npm run build` |
| Publish Directory | `client/dist` |

**Do not** set Root = `client` and Publish = `client/dist` (looks for `client/client/dist`).

**Environment variable on the static site:**

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://field-pulse.onrender.com` (no trailing slash) |

Add an SPA rewrite if needed: `/*` → `/index.html`.

Verify: https://field-pulse-1.onrender.com loads the division dashboard.

### 4. CORS
After the static site URL is known, set `CLIENT_ORIGIN` on the API and **redeploy** the API.

---

## Local Docker

```bash
cp .env.example .env   # set GROQ_API_KEY
docker compose up --build -d
# UI  http://localhost:8080
# API http://localhost:3001/health
```

---

## Checklist

- [ ] `/health` on API returns ok + db true  
- [ ] Static site loads ORBAT / charts / **deployment map**  
- [ ] Brigade drill-down works  
- [ ] Map shows **SSE live** and a pulse within ~1 minute  
- [ ] Local Docker: `/health` shows `kafka.enabled: true` (Render may show `enabled: false`)  
- [ ] Intelligence query returns `mode: groq` (or `rules` without a key)  
- [ ] `CLIENT_ORIGIN` matches the static site URL  

Never commit `.env` or API keys. See also [`render.yaml`](render.yaml) for a Blueprint-style definition.
