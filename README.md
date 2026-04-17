# Resource Management System

This repository contains a minimal full-stack foundation for the Resource Management application.

## Project structure

```text
.
├── backend/
│   ├── package.json
│   └── src/
│       ├── config/database.js
│       ├── db/syncSchema.js
│       ├── models/resource.model.js
│       ├── scripts/applySchema.js
│       └── server.js
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       └── main.jsx
└── README.md
```

## Local setup

### 1) Backend (Node.js + Express + MongoDB)

```bash
cd backend
cp .env.example .env
npm install
npm run db:schema:sync
npm run dev
```

Backend starts on `http://localhost:4000` by default.

Available endpoints:

- `GET /health` → service + database status (returns `200` when DB is connected, `503` otherwise)
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
- `MONGO_URI` - MongoDB connection URI (required, e.g. `mongodb://127.0.0.1:27017`)
- `MONGO_DB_NAME` - logical database name used by this service (default `resource_planning`)

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL` - backend base URL (default `http://localhost:4000`)

## Database schema strategy

- `Resource` is the initial baseline schema and lives in `backend/src/models/resource.model.js`.
- The server runs schema synchronization (`createCollection` + `syncIndexes`) during startup.
- The same synchronization can be run manually with `npm run db:schema:sync` for local initialization or CI checks.
- Startup and schema sync fail with clear error messages when MongoDB is not reachable or configuration is missing.
