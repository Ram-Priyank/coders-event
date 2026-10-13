# Implementation notes

## Reference and architecture

The user-supplied combined MySQL design is the requirements reference. This implementation replaces the original insecure JSON demonstration backend. `server/src/schema.sql` is the initial MySQL schema; `db.ts` owns the pool and transaction boundary; `domain.ts` owns calendar dates and domain errors; `app.ts` contains authenticated API routes and transactional operations. `client/src/App.jsx` is the connected React workspace. The frontend remains JavaScript/JSX; the API is strict TypeScript. Further module extraction and frontend TypeScript conversion are worthwhile as the product grows.

All transaction-creating endpoints require `Idempotency-Key`. The client keeps one key while retrying a modal submission. Keys are scoped to actor and endpoint, and parsed request bodies are hashed. Changing the body under an existing committed key returns a conflict. Failed transactions roll back their idempotency records so corrected requests can succeed. Database deadlocks are safe failures; the client can retry without duplicate operations.

Stock uses mutually exclusive buckets. Bulk `USABLE` balances exclude issued stock. Individual availability comes from each asset's status. Issue quantities minus return quantities define outstanding loans. Student rows are locked when enforcing issue limits; bulk allocation uses conditional updates; individual allocation conditionally changes `USABLE` to `ISSUED`. Returns and approvals lock their source records. Audit and movements commit with the business operation.

## PDF coverage and deliberate scope

| PDF area | Implementation |
| --- | --- |
| Inventory and assets | Item create/edit/deactivate, category create, unique tags, conditions, stock adjustments, transfers |
| Locations | Parent-child creation; new IDs prevent cycles because existing locations cannot be reparented |
| Students/staff | Student registration/eligibility, separate student and staff roles; one seeded admin |
| Issue and return | Single-item issue transactions; individual or bulk; 15-day deadline; partial/full returns with receipt IDs |
| Renewals | Student ownership, pending requests, locked decisions, 15-day extensions, limits |
| Reports | Loan/stock/movement reports; multi-field search; upcoming and overdue filters; CSV and print |
| Audit/idempotency | Atomic append-only API audit and stock ledger; scoped request hashes |
| Policies | Global limits and overdue setting; each edit recorded in audit |
| Notifications | On-screen pending/overdue indicators; email worker not implemented |

Differences from the fuller design: fixed role permissions rather than editable permission tables; programme data on student profiles rather than department/programme master tables; single-item receipts rather than multi-line issue/return batches; global policy plus audit history rather than scoped versioned policy tables; asset changes in the common ledger/audit rather than a dedicated asset-status-history table. No SSO, MFA, password recovery, bulk import, scheduled reminders, or automatic reconciliation job is included.

List responses currently load the complete department catalogue and loan/renewal/movement records; the audit screen shows the latest 200 events. Reports and dashboard totals therefore use complete loaded loan data. Server-side aggregation, filtering, and pagination are required before scaling to large datasets. The PDF performance/availability targets have not been load-tested.

## Operations before production

1. Provision a MySQL 8+ database and separate migration and runtime accounts. The development Docker user owns its schema; it is not a production least-privilege account. Runtime permissions need SELECT/INSERT/UPDATE/DELETE on sessions, INSERT/SELECT on audit/movements/returns, and operation-appropriate permissions on other tables. Do not grant public audit modification endpoints.
2. Replace demonstration accounts with institution identities and strong individual passwords. The initial seed is intentionally blocked in production. Provision initial staff through a controlled database/admin process; self-registration and arbitrary role changes are not exposed.
3. Terminate HTTPS at a trusted proxy, configure `APP_ORIGIN`, set `NODE_ENV=production`, and preserve host headers. If trusting proxy headers, configure Express only for the known proxy topology.
4. Protect database connections with TLS when crossing untrusted networks, configure pool capacity, and use a shared rate-limit store before running multiple API replicas. Current login limiting is per process.
5. Choose hosting, backup frequency, audit retention, RPO/RTO, and restore procedures. Take encrypted database backups with a backup account; restore into a separate database and verify constraints, inventory counts, and loan history before relying on them. No backup restoration drill or production deployment has been performed.
6. Add scheduled reminders and email credentials only when an email provider and sender domain are chosen. Overdue status does not depend on a worker.
7. Run a dedicated security assessment, dependency scan, representative load test, and accessibility review. The tests included here demonstrate core correctness but are not a comprehensive security certification.

## Cloud workspace

Use the existing checkout at `/workspace/coders-event`; cloud tasks already have isolated environments, so no Git worktree is needed. Dependencies and compiled files remain on disk, but API/Vite/MySQL processes must be started again after a restore. `npm run db` is repeatable and never deletes a container or volume. A fresh empty database also needs migrations and explicit demo seeding. Keep all real passwords in environment settings or ignored local configuration, never in committed setup scripts.
