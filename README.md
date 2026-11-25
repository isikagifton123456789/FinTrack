# FinTrack — Portfolio & Transactions Tracker

FinTrack is a portfolio and transaction tracker for analysts at a fictional investment operations team. Analysts can manage client portfolios, record buys and sells, and review holdings and indicative performance.

## Live submission

- **Repository:** [isikagifton123456789/FinTrack](https://github.com/isikagifton123456789/FinTrack)
- **Frontend:** [https://fin-track-eta-dusky.vercel.app/](https://fin-track-eta-dusky.vercel.app/)
- **Backend API:** [https://fintrack-clgc.onrender.com/](https://fintrack-clgc.onrender.com/)
- **Interactive API documentation (Swagger):** [https://fintrack-clgc.onrender.com/api/docs](https://fintrack-clgc.onrender.com/api/docs)
- **OpenAPI JSON:** [https://fintrack-clgc.onrender.com/api/openapi.json](https://fintrack-clgc.onrender.com/api/openapi.json)
- **API health:** [https://fintrack-clgc.onrender.com/api/health](https://fintrack-clgc.onrender.com/api/health)

The API health endpoint and Swagger UI were reachable when this README was updated. Confirm that the frontend is configured for the live API and that sign-in and portfolio workflows work before submitting.

### Submission details to complete

- **Demo login:** Set `DEMO_EMAIL` and `DEMO_PASSWORD` in Render, seed that account and sample data, then provide the actual login details to the reviewers. Do not put a real password in this public README; share it through the submission form or another private channel.
- **Approximate hours spent:** Add your own estimate.
- **Screenshots or short demo recording:** Add a link before submission (the repository currently has no screenshot or recording files).
- **Git feature branch / pull request:** Add the pull/merge request link if available. The local checkout only shows the `main` branch.
- Keep the public deployment running for at least 14 days after submission.

## Features

- JWT-based registration and sign-in; passwords are hashed with bcrypt.
- Email verification before new accounts can sign in; password reset by email.
- Portfolio create, read, update, and delete, scoped to the signed-in user.
- Buy and sell transactions with date, quantity, instrument, and unit price.
- Holdings summary with average cost, invested value, current indicative value, and allocation chart.
- Sortable/filterable transaction history and CSV export for portfolios, holdings, and filtered transactions.
- Responsive interface, accessible loading/empty/error states, and light/dark color schemes.
- OpenAPI documentation and Docker Compose configuration for local development.

## Architecture and technology

This is an npm-workspaces monorepo. The browser app calls the REST API over HTTPS in production; PostgreSQL is the persistent source of truth.

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, and Zod. TypeScript and schema validation help catch invalid client inputs and API response handling errors early.
- **Backend:** Node.js, Express, Zod, JWT, bcrypt, and Nodemailer. Express provides a small REST surface; validation and a consistent error envelope are applied at the API boundary.
- **Database:** PostgreSQL with versioned SQL migrations. Transaction writes lock the portfolio row while checking that sells do not exceed holdings.
- **Hosting:** Vercel for the frontend and Render for the API and PostgreSQL.

## Requirements coverage and scope

Implemented assessment requirements include authentication, CRUD portfolios, transaction operations, validation, PostgreSQL persistence and migrations, seed data, OpenAPI/Swagger, a responsive single-page frontend, holdings/performance visualization, and public deployments.

Bonus work implemented includes automated backend and frontend tests, Docker Compose, CSV exports, and dark mode. CI/CD and pagination are not implemented.

### Assumptions and trade-offs

- Prices are indicative sample prices and the KES/USD conversion is fixed; this is not live market or foreign-exchange data.
- Portfolio values are calculated from the sample pricing model, not an external market-data provider.
- Transaction validation rejects invalid quantities and sells that exceed holdings as of the trade date.
- Verification and password-reset email delivery requires Gmail SMTP environment variables. Email credentials are secrets and must not be committed.
- CSV exports include the current portfolio list or the current filtered transaction view. CSV text values are quoted and spreadsheet-formula-like text is neutralized.

## Local setup

Requirements: Node.js 20 or later, npm, and PostgreSQL (or Docker Desktop for the Compose option).

From the repository root in PowerShell:

```powershell
npm install
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and set `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and `DATABASE_SSL` as appropriate for your PostgreSQL host. To use the real API locally instead of the browser mock, create `frontend\.env.local` with:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=
```

The Vite development server proxies `/api` to `http://localhost:4000`.

For verification and password-reset messages, configure `SMTP_USER` and `SMTP_PASS` with a Gmail address and Google App Password; set `APP_URL` to the frontend origin. Never use your Gmail sign-in password for SMTP or commit SMTP credentials.

Apply migrations, seed sample data, and start both apps:

```powershell
npm run migrate
npm run seed
npm run dev
```

The frontend runs at `http://localhost:5173`; the API runs at `http://localhost:4000`. The seed script uses `DEMO_EMAIL` and `DEMO_PASSWORD` from `backend\.env`.

## Docker Compose

Install and start Docker Desktop. From the repository root:

```powershell
Copy-Item .env.docker.example .env
```

Edit `.env` and replace the example database password, JWT secret, and demo password with unique values. Add Gmail SMTP settings if email actions should work. Do not commit `.env`.

```powershell
docker compose up --build -d
docker compose ps
docker compose exec api npm run seed --workspace backend
```

Open [http://localhost:8080](http://localhost:8080). Migrations run when the API container starts. PostgreSQL data persists in the `postgres_data` volume. Use `docker compose down` to stop the stack without deleting data; `docker compose down -v` deletes the database volume.

## Production deployment configuration

### Render API

The Render web service should use the repository root as its root directory:

- **Build command:** `npm install`
- **Pre-deploy command:** `npm run migrate --workspace backend`
- **Start command:** `npm start`
- **Environment:** `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `CORS_ORIGIN`, `APP_URL`, and `DEMO_EMAIL` / `DEMO_PASSWORD`. Add `SMTP_USER` / `SMTP_PASS` and related SMTP variables to enable account emails.

For `DATABASE_URL`, use the **Internal Database URL** from Render if the API service and PostgreSQL database are in the same Render region and workspace. It uses Render's private network and is the preferred service-to-database connection; set `DATABASE_SSL=false` for this internal connection. Use the **External Database URL** for local tools or clients outside Render, or when the service cannot reach the database over Render's private network; external connections require TLS, so set `DATABASE_SSL=true`. Keep the database URL only in Render's environment settings, not in source control. See Render's [PostgreSQL connection-string guidance](https://render.com/tutorials/postgres-on-render/connection-strings).

In Render **Environment**, set `CORS_ORIGIN` and `APP_URL` to the exact Vercel origin:

```text
https://fin-track-eta-dusky.vercel.app
```

For the API to accept the browser's cross-origin requests, `CORS_ORIGIN` must be exactly the frontend origin above (no trailing slash). The API defaults to that origin in production if `CORS_ORIGIN` is absent, but an explicitly configured older value such as `http://localhost:5173` overrides the default and must be replaced. Save the setting and redeploy the Render service.

### Vercel frontend

In the Vercel project settings, set these **Production** environment variables and redeploy:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://fintrack-clgc.onrender.com
```

These are build-time variables. Redeploy after changing them. Then test registration or demo sign-in, portfolio loading, create/edit/delete, transaction entry, and CSV downloads against the deployed services.

The production frontend defaults to the Render API URL and the mock adapter is opt-in only. Set both Vercel variables explicitly as shown to make the deployment configuration visible and reproducible. Redeploy the Vercel project after saving the variables; Vite embeds them into the frontend build.

## API overview

All API paths are under `/api`. Interactive details and request/response schemas are in the live [Swagger UI](https://fintrack-clgc.onrender.com/api/docs) and [OpenAPI document](https://fintrack-clgc.onrender.com/api/openapi.json).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register and send email verification |
| POST | `/api/auth/verify-email` | Verify an email using its one-time token |
| POST | `/api/auth/resend-verification` | Request another verification email |
| POST | `/api/auth/login` | Sign in and receive access/refresh tokens |
| POST | `/api/auth/refresh` | Refresh the token pair |
| POST | `/api/auth/forgot-password` | Request a password-reset email |
| POST | `/api/auth/reset-password` | Set a password with a one-time token |
| GET, POST | `/api/portfolios` | List or create the signed-in user's portfolios |
| GET, PUT, DELETE | `/api/portfolios/{id}` | Read, update, or delete an owned portfolio |
| GET, POST | `/api/portfolios/{id}/transactions` | List or record portfolio transactions |
| DELETE | `/api/transactions/{id}` | Delete a transaction |
| GET | `/api/portfolios/{id}/summary` | Return holdings and portfolio totals |

Protected portfolio endpoints require an access token in the `Authorization: Bearer <token>` header. Errors use the JSON shape `{ "error": { "code": "...", "message": "...", "details": {} } }`.

## Tests and build

From the repository root:

```powershell
npm test
npm run build
```

The backend tests cover API authentication/error behavior, documentation routes, validation, and ledger calculations. Frontend tests cover auth flows and utility behavior.

## AI tool usage

AI assistance was used during implementation, debugging, test creation, and documentation updates. The author should review the final code and be prepared to explain design decisions and trade-offs.

## Contact and submission

Submit the repository URL, live frontend URL, live Swagger/API URL, demo login, and approximate hours through the assessment submission channel. Use the live links at the top of this README.
