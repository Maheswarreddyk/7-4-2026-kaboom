# IndiaTV

**Anonymous Random Video Chat — deploy anywhere in minutes**

IndiaTV is a production-ready full-stack startup app: anonymous video chat with no login, a polished marketing site, and one-click deployment to Vercel + Supabase Cloud. No Docker, no DevOps required.

---

## What's Included

| Area | Features |
|------|----------|
| **Home** | Hero, live stats, feature cards, Start Chat CTA |
| **Video Chat** | WebRTC video/audio, mute, camera off, next, report, feedback |
| **About** | Product overview, how it works, community guidelines |
| **FAQ** | Expandable accordion with 8 common questions |
| **Privacy** | Full privacy policy |
| **Terms** | Terms of service |
| **Contact** | Contact form + email links |
| **404** | Custom not-found page |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, TailwindCSS, React Router |
| API | Vercel Serverless Functions (Node.js) |
| Realtime | Supabase Realtime Broadcast (matching + WebRTC signaling) |
| Database | Supabase PostgreSQL |
| Video | WebRTC peer-to-peer |

---

## Quick Start (Local)

### 1. Prerequisites

- **Node.js** 18+
- **Supabase Cloud** project ([supabase.com](https://supabase.com)) — free tier works

### 2. Install

```bash
git clone <your-repo>
cd indiaTV
npm install
```

### 3. Set Up Supabase Database

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **SQL Editor**
3. Run these files in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_realtime_indexes.sql`
4. Go to **Settings → API** and copy your credentials

### 4. Environment Variables

Create `.env` in the project root (or copy from `.env.example`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_API_URL=
```

> **Important:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend. It is only used by Vercel API routes.

### 5. Run Locally

```bash
npm run dev
```

Opens at **http://localhost:3000** (Vercel dev serves both frontend + API).

---

## Deploy to Vercel (Production)

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "Initial IndiaTV deploy"
git push origin main
```

### Step 2 — Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects settings from `vercel.json`

### Step 3 — Add Environment Variables

In Vercel Dashboard → **Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend only) |
| `VITE_SUPABASE_URL` | Same Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public key |
| `VITE_API_URL` | Leave **empty** (uses same-origin `/api`) |

### Step 4 — Deploy

Click **Deploy**. Your app will be live at `https://your-project.vercel.app`.

### Step 5 — Custom Domain (Optional)

In Vercel → **Settings → Domains**, add your domain (e.g. `indiatv.app`). Vercel handles SSL automatically.

---

## Project Structure

```
indiaTV/
├── api/                  # Vercel serverless API routes
│   ├── health.ts
│   ├── stats.ts
│   ├── start-session.ts
│   ├── match/            # Queue & matching endpoints
│   └── lib/              # Shared server logic
├── frontend/             # React + Vite SPA
│   └── src/
│       ├── pages/        # All app pages
│       ├── components/   # UI components
│       ├── services/     # API + Realtime clients
│       └── hooks/        # Video chat hook
├── supabase/
│   └── migrations/       # Database schema
├── vercel.json           # Vercel deployment config
└── .env.example
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Live platform stats |
| POST | `/api/start-session` | Create anonymous session |
| POST | `/api/end-session` | End session |
| POST | `/api/report` | Submit abuse report |
| POST | `/api/feedback` | Submit chat feedback |
| POST | `/api/match/join` | Join matching queue |
| POST | `/api/match/next` | Skip to next partner |
| POST | `/api/match/leave` | Leave queue |
| POST | `/api/match/disconnect` | Notify partner on disconnect |

---

## How Video Chat Works

1. User clicks **Start Chat** → anonymous session created via API
2. Camera/mic permission granted → user joins matching queue
3. Server pairs two waiting users → both notified via Supabase Realtime
4. WebRTC offer/answer/ICE exchanged on a private match channel
5. Peer-to-peer video/audio streams directly between browsers
6. **Next**, **Report**, **Mute**, **Leave**, and **Feedback** all fully functional

---

## Production Checklist

- [ ] Run Supabase migrations on your cloud project
- [ ] Set all environment variables in Vercel
- [ ] Enable **Realtime** in Supabase Dashboard (enabled by default on cloud)
- [ ] Add custom domain in Vercel (optional)
- [ ] Test video chat with two browser tabs or devices

---

## License

MIT
