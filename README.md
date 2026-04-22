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
│       ├── models/allocation.model.js
│       ├── models/project.model.js
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
- `POST /api/resources` → create resource (`name` required, `capacity_hours` default `8`, `is_active` default `true`)
- `PATCH /api/resources/:id` → update an existing resource
- `GET /projects` → list all projects
- `GET /projects/:id` → get project by id
- `POST /projects` → create project (`name` required, `is_active` default `true`)
- `PUT /projects/:id` → update an existing project
- `GET /api/projects` → list all projects (API namespace alias)
- `GET /api/projects/:id` → get project by id (API namespace alias)
- `POST /api/projects` → create project (`name` required, `is_active` default `true`)
- `PUT /api/projects/:id` → update an existing project
- `PATCH /api/projects/:id` → partially update an existing project
- `GET /allocations` → list all allocations
- `POST /allocations` → create allocation (`resource_id`, `project_id`, `start_date`, `end_date`, and `hours_per_day` required)
- `PUT /allocations/:id` → update an existing allocation
- `DELETE /allocations/:id` → delete an allocation
- `GET /api/allocations` → list all allocations (API namespace alias)
- `POST /api/allocations` → create allocation (API namespace alias)
- `PUT /api/allocations/:id` → update an existing allocation (API namespace alias)
- `DELETE /api/allocations/:id` → delete an allocation (API namespace alias)

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

- `Resource` model: baseline catalog of assignable people with role and capacity.
- `Project` model: tracks project identity and active status.
- `Allocation` model: joins `Resource` and `Project` with date-bounded allocation percentage.
- All three models use Mongoose `timestamps` (`createdAt`, `updatedAt`).
- The server runs schema synchronization (`createCollection` + `syncIndexes`) during startup.
- The same synchronization can be run manually with `npm run db:schema:sync` for local initialization or CI checks.
- Startup and schema sync fail with clear error messages when MongoDB is not reachable or configuration is missing.
