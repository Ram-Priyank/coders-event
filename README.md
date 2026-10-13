# DeptTrack

Department inventory and student lending application, implemented from `Department_Inventory_Combined_Final_MySQL_Design.pdf`.

React 19 + Vite frontend, a strict TypeScript Express API, and MySQL 8.4/InnoDB. The previous browser role switcher and JSON/MongoDB fallback have been replaced with authenticated server sessions and transactional persistence.

## Run locally

Requires Node.js 24, npm, and Docker (or an existing MySQL 8+ database).

```bash
npm run install-all
npm run db
npm run migrate --prefix server
# Choose a local demonstration password, at least 12 characters:
read -rsp 'Demo password: ' SEED_PASSWORD; echo
export SEED_PASSWORD
npm run seed
APP_ORIGIN=http://localhost:5173 npm run dev
```

Open the Vite development server on port 5173. The API listens on port 5000. The seed is non-destructive: it does nothing when users already exist. It creates `admin`, `priya`, and `arjun` with the password supplied through `SEED_PASSWORD`, ten individually tagged development boards, and twenty bulk USB cables. These are synthetic demonstration identities.

In the prepared cloud instance, the demo password is `DeptTrack-Demo-2026` for all three accounts. This public demonstration password must not be used in production.

`npm run db` starts a loopback-only Docker database. New containers use a named volume and a pinned MySQL image digest. It preserves existing containers and never resets the database. The local database credentials in the helper are public development defaults. Use explicit environment variables for a real deployment.

Environment variables are documented in [.env.example](.env.example). If using dotenv, place the configuration in `server/.env`, since server scripts run from that directory. Do not commit that file. Exported shell variables also work. For npm cache permission errors in cloud environments, use `export npm_config_cache=/workspace/.npm-cache`.

## Implemented workflows

- Username/password authentication, bcrypt hashes, hashed expiring sessions, logout, server-side student/staff/admin permissions, login rate limiting, and origin checks.
- Inventory definitions and categories; individual asset tags and serials; bulk stock by location and condition; item retirement; asset condition and location changes; receipts, corrections, and transfers with reasons.
- Student registration and eligibility; hierarchical location creation.
- Atomic issues with server-calculated 15-day calendar deadlines, issue acknowledgement and printing, student limits, no stock oversell, and unique asset allocation.
- Full and partial returns, inspection remarks, damaged/maintenance/lost/retired stock segregation, and return receipts in the database.
- Ownership-scoped student loan history and renewal requests; staff approval/rejection; exactly one 15-day extension from the existing deadline per approval.
- Dashboard, overdue/upcoming views, search across students/items/programmes/locations, stock and movement reports, CSV export, and print.
- Atomic stock movements and append-only API audit records, plus actor/operation-scoped idempotency keys for mutation retries.
- Admin borrowing policy: maximum outstanding units, renewal limit, and whether overdue renewals may be approved.

The business timezone defaults to `Asia/Kolkata`. Initial and renewal periods are 15 days. No backdating is allowed. Overdue approval defaults to disabled. Students cannot cancel a submitted renewal. Staff can restore or retire unissued assets with a reason; stock adjustments do not require a second approver.

## Validation

```bash
npm test                         # MySQL integration, concurrency, authorization, rollback
npm run build                    # API type check and frontend production build
npm run lint --prefix client
# Start the app first; install Chromium once:
npx --prefix client playwright install chromium
npm run test:e2e --prefix client
```

API tests create unique test fixtures in the configured development database and remove them afterwards. Do not point tests at production. Browser tests require seeded demo users and the matching `SEED_PASSWORD` (defaulting to the cloud demonstration password).

`npm start` serves the API and built client together on port 5000 after `npm run build`. The development server uses a Vite proxy. Production needs HTTPS, explicit database credentials, an appropriate `APP_ORIGIN`, and `NODE_ENV=production` so session cookies are Secure. Production startup rejects the development database password and production demo seeding is disabled.

## Design and remaining deployment work

See [implementation notes](docs/IMPLEMENTATION.md) for the PDF mapping, current limits, and production checklist. This is a functional core application, not a claim that the PDF's proposed load, availability, backup, or security-audit targets have been certified.
