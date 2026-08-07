# Deploy FieldPulse

FieldPulse has **three** pieces. Netlify only covers the first.

| Piece | Free host |
|-------|-----------|
| React client | **Netlify** |
| Express API | **Render** (or Railway / Fly) |
| PostgreSQL | **Render Postgres** (free tier) / Railway |

Netlify cannot run long-lived Express + Postgres. Use Netlify for the UI and Render (recommended) for API + DB.

---

## 1. Push to GitHub

Already done if you followed the agent steps. Otherwise:

```bash
cd /Users/macbook/Documents/Dev/field-pulse
git init
git add .
git commit -m "Initial FieldPulse division ops dashboard"
gh repo create field-pulse --public --source=. --remote=origin --push
```

Personal notes (`interview-prep/`, `my-thinking.md`) are gitignored and stay local.

---

## 2. Deploy API + DB on Render (required for a live UI)

1. Go to [render.com](https://render.com) → sign up with GitHub  
2. **New** → **Blueprint** → select `field-pulse` → uses [`render.yaml`](render.yaml)  
   - Or manually: create **PostgreSQL** (free) + **Web Service** from `server/`  
3. Web service settings if manual:  
   - Root directory: `server`  
   - Build: `npm install`  
   - Start: `npm run setup && npm start`  
4. Environment variables on the API service:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | from Render Postgres (auto if Blueprint) |
| `CLIENT_ORIGIN` | your Netlify URL, e.g. `https://your-app.netlify.app` |
| `GROQ_API_KEY` | your Groq key |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |
| `PORT` | `3001` (or leave Render’s `PORT` if they inject one — then set start to use `$PORT`) |

**PORT note:** Render often sets `PORT` itself. Prefer start command:

```bash
npm run setup && node src/index.js
```

and ensure the app listens on `process.env.PORT` (FieldPulse already does).

5. Copy the API URL, e.g. `https://fieldpulse-api.onrender.com`  
6. Open `/health` — should return `{"status":"ok","db":true}`

Free Render web services **spin down** after idle; first request may take ~30–60s.

---

## 3. Deploy frontend on Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git** → `field-pulse`  
2. Build settings (also in [`netlify.toml`](netlify.toml)):  
   - Base directory: `client`  
   - Build command: `npm install && npm run build`  
   - Publish directory: `client/dist`  
3. **Site settings → Environment variables**:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | `https://fieldpulse-api.onrender.com` (no trailing slash) |

4. Deploy. Open the Netlify URL.

5. On Render, set `CLIENT_ORIGIN` to that Netlify URL (and redeploy API) so CORS allows the browser.

---

## 4. Verify live

1. Netlify site loads the division dashboard  
2. Brigades click-through works  
3. Intelligence query returns `mode: groq` (or rules if no key)  
4. If UI loads but data fails: check `VITE_API_URL`, CORS `CLIENT_ORIGIN`, and Render logs  

---

## Local reminder

```bash
docker compose up -d --build
# UI http://localhost:8080
```

Never commit `.env` / `GROQ_API_KEY`.
