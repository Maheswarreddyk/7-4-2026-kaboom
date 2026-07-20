# Cloudflare Deployment Configuration

**Project:** 7-4-2026-kaboom
**Date:** July 20, 2026

This document serves as the master reference for the Cloudflare Pages (Frontend) and Cloudflare Workers (Backend) deployment configuration.

---

## 🏗️ Frontend: Cloudflare Pages (`7-4-2026-kaboom`)

### Build & Deployment Settings
* **Framework preset:** React (Vite)
* **Root directory (Path):** `frontend`
* **Build command:** `npm run build`
* **Build output directory:** `dist`

### Environment Variables
These variables are compiled directly into the React/Vite web application during `npm run build`.

| Variable Name | Value |
| --- | --- |
| `VITE_API_URL` | `https://indiatv-backend.maheswarreddykanala999.workers.dev/api` |
| `VITE_SUPABASE_URL` | `https://dirocenpssdilkztizps.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTY1MzUsImV4cCI6MjA5ODMzMjUzNX0.P1NX8cfS4rTafIINUONBrWH3wI4DaUYrQJJUCJXvU9Y` |
| `VITE_VAPID_PUBLIC_KEY` | `BDJuUTaQOAjOgnFEtto0jKQJi6dMmrIDAE3Ch1LivMs1hm_696SrjMih6yaQs7DPiJTHTc89czp3dtqc16N9Hbg` |

---

## ⚙️ Backend: Cloudflare Workers (`indiatv-backend`)

### Environment Variables & Secrets
These variables provide the backend API with administrative access and push notification capabilities.

| Variable Name | Value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Defines the environment mode. |
| `SUPABASE_URL` | `https://dirocenpssdilkztizps.supabase.co` | Connects backend to the Supabase database. |
| `SUPABASE_ANON_KEY` | *(Set in Cloudflare Dashboard)* | Client public key for basic requests. |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Set in Cloudflare Dashboard)* | Elevated key to bypass Row Level Security (RLS) for server actions. |
| `ADMIN_TOKEN` | `Mahes123457890` | Custom security token for authenticating administrative backend endpoints. |
| `VAPID_PUBLIC_KEY` | `BDJuUTaQOAjOgnFEtto0jKQJi6dMmrIDAE3Ch1LivMs1hm_696SrjMih6yaQs7DPiJTHTc89czp3dtqc16N9Hbg` | Public VAPID key to identify your push notification server. |
| `VAPID_PRIVATE_KEY` | *(Set in Cloudflare Dashboard)* | Secret key used to sign web push notifications. |
| `VAPID_SUBJECT` | `mailto:admin@kaboom-tv.com` | Contact URI for push notification services. |

---

## 🔒 CI/CD & Authentication (GitHub Actions)

These credentials allow your GitHub repository to authenticate with Cloudflare and automatically deploy updates to your backend whenever you push code.

| Secret Name | Value | Location to Add |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | *(Set in GitHub Secrets)* | GitHub > Settings > Secrets and variables > Actions |
| `CLOUDFLARE_API_TOKEN` | *(Set in GitHub Secrets)* | GitHub > Settings > Secrets and variables > Actions |

### Token Generation Details:
* **Template Used:** Edit Cloudflare Workers
* **Account Resource:** maheswarreddykanala999@gmail.com
* **Zone Resource:** kaboom-tv.com (All zones)
