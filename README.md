# Resource Management System

This repository now contains a minimal full-stack foundation for the Resource Management application.

## Project structure

```text
.
├── backend/
│   ├── package.json
│   └── src/server.js
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       └── main.jsx
└── README.md
```

## Local setup

### 1) Backend (Node.js + Express)

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend starts on `http://localhost:4000` by default.

Available endpoints:

- `GET /health` → `{ "status": "ok" }`
- `GET /api/ping` → `{ "message": "Backend is reachable" }`

### 2) Frontend (React + Vite)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend starts on `http://localhost:5173` and calls backend using `VITE_API_BASE_URL`.

## Environment variables

### Backend (`backend/.env`)

- `PORT` - backend server port (default `4000`)
- `CORS_ORIGIN` - allowed frontend origin (default `http://localhost:5173`)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL` - backend base URL (default `http://localhost:4000`)
