# Queue Management System – Run Guide

Use these steps to run the demo locally and avoid the “invalid admin-key” issue.

## 1) Backend
```bash
cd "/Users/sandeshparit/MY Mac/Coding/queue-management/backend"
cat <<'EOF' > .env
PORT=4000
ADMIN_KEY=changeme-admin-key
CLIENT_ORIGIN=http://localhost:5173
EOF
npm install
npm run dev
```
- The server prints: `Queue Management API running on http://localhost:4000`.
- Admin requests must send header `x-admin-key: changeme-admin-key`.

## 2) Frontend
```bash
cd "/Users/sandeshparit/MY Mac/Coding/queue-management/frontend"
npm install
npm run dev -- --host
```
Open http://localhost:5173. In the Admin tab, paste the same admin key you set in `.env`.

## 3) Quick admin actions
- Create office (Admin tab): set fields + admin key → “Create office”.
- Update availability: edit “Available today”, press “Update availability”.
- Call next: “Call next”.
- Complete / No-show / Cancel: buttons in the queue list (Complete/No-show require admin key; Cancel works for anyone).

## 4) Customer actions
- Pick an office, enter name/contact, click “Book now” (if seats) or “Join virtual queue” (if full).
- See live token list and status.

## 5) If you see “invalid admin key”
- Ensure `.env` exists in `/backend` and the `ADMIN_KEY` value matches what you enter in the UI.
- Restart backend after changing `.env`: `npm run dev`.
- Confirm you are calling the right API URL. Default frontend base: `http://localhost:4000`. To change, set `VITE_API_BASE` in `/frontend/.env`.
- Header name must be exactly `x-admin-key`.

