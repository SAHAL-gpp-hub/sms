# SMS Frontend

React + Vite frontend for the Iqra School Management System.

## Prerequisites

- Node.js 22+
- npm 10+

## Local development

```bash
cd <repository-root>/frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Build and validate

```bash
cd <repository-root>/frontend
npm run lint
npm run build
```

## Docker workflow

```bash
cd <repository-root>
docker compose up -d --build frontend
```

Frontend is served through nginx at `http://localhost`.

## Environment assumptions

The frontend calls backend APIs through `/api/*` via nginx proxy. Ensure backend is reachable in Docker as service `backend`.

## Contribution checklist

- Keep UI changes responsive (mobile + desktop).
- Validate forms with existing patterns in `src/pages`.
- Run lint/build before opening a PR.
