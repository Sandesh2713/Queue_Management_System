# Queue Management System

Web-based queue and token system for offices and customers. Offices publish capacity and call the next visitor; customers book instantly or join a virtual queue and track their status.

## Stack
- Backend: Node.js + Express, SQLite (better-sqlite3), REST API
- Frontend: React (Vite)
- Live updates: refresh/controls via API (no external services required for demo)

## Quick start
1) Backend
```bash
cd /Users/sandeshparit/MY\ Mac/Coding/queue-management/backend
echo "PORT=4000\nADMIN_KEY=changeme-admin-key\nCLIENT_ORIGIN=http://localhost:5173" > .env
npm install
npm run dev
```

2) Frontend
```bash
cd /Users/sandeshparit/MY\ Mac/Coding/queue-management/frontend
npm install
npm run dev -- --host
```
Open http://localhost:5173. Set the admin key in the UI to match `ADMIN_KEY`.

## Core API (simplified)
- `POST /api/offices` (admin) – create office `{ name, serviceType, dailyCapacity, operatingHours, avgServiceMinutes }`
- `GET /api/offices` – list offices with availability and queue counts
- `GET /api/offices/:id` – office detail + tokens
- `PATCH /api/offices/:id/availability` (admin) – set `availableToday`
- `PATCH /api/offices/:id/settings` (admin) – update office settings
- `POST /api/offices/:id/book` – customer books or joins queue `{ customerName, customerContact, note }`
- `POST /api/offices/:id/call-next` (admin) – calls next booked/queued token (requires available seats for queued)
- `POST /api/tokens/:id/cancel` – cancel token; frees a seat if booked/called
- `POST /api/tokens/:id/complete` (admin) – mark done; frees seat
- `POST /api/tokens/:id/no-show` (admin) – mark no-show; frees seat
- `GET /api/tokens/:id` – token detail + events

Admin auth: send header `x-admin-key: <ADMIN_KEY>`.

## Notes
- SQLite file lives in `backend/data/queue.db` (auto-created).
- Available seats decrement on booking or when a queued visitor is called; they increment on complete/cancel/no-show.
- ETA is approximated by queue position × average service minutes.



