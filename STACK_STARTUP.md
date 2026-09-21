# Local stack startup

<!-- START_STACK_V2
{
  "version": 2,
  "steps": [
    {
      "name": "postgres",
      "cwd": ".",
      "mode": "oneshot",
      "start": "pnpm db:up",
      "verify": ["node -e \"const socket=require('node:net').connect(5433,'127.0.0.1'); socket.setTimeout(2000); socket.on('connect',()=>{socket.end(); process.exit(0)}); socket.on('error',()=>process.exit(1)); socket.on('timeout',()=>process.exit(1))\""],
      "timeout": 45
    },
    {
      "name": "application",
      "cwd": ".",
      "mode": "background",
      "start": "pnpm dev",
      "verify": [
        "curl -fsS http://localhost:3000 >/dev/null",
        "curl -fsS http://localhost:3001/health >/dev/null",
        "curl -fsS http://localhost:3001/health/db >/dev/null"
      ],
      "timeout": 45
    }
  ],
  "urls": ["http://localhost:3000"]
}
-->

Prerequisites are Node.js, pnpm 11, Docker, and populated `apps/api/.env` and `apps/web/.env`
files. Start PostgreSQL with `pnpm db:up`, apply migrations with `pnpm db:migrate`, then run both
applications with `pnpm dev`.

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API health: `http://localhost:3001/health/db`

The API environment provides `DATABASE_URL`, optional `DIRECT_URL`, `POSTGRES_*`, `PORT`, and the
Firebase Admin variables. The web environment provides `VITE_API_URL` and the `VITE_FIREBASE_*`
web configuration. Stop the foreground development process normally; use `pnpm db:down` when the
local PostgreSQL container should also stop while retaining its data.
