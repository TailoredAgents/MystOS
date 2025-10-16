# MystOS Monorepo

## Prerequisites
- Node.js 18+
- pnpm 9+
- Docker Desktop (for local Postgres)

## Environment
1. Copy `.env.example` to `.env` and fill in values.
2. Set `DATABASE_URL` to your local connection string, for example `postgres://myst:myst@localhost:5432/mystos`.
3. When running the API locally, set `NEXT_PUBLIC_API_BASE_URL` (site) and `API_BASE_URL` (server actions) to `http://localhost:3001`.
4. Provide `ADMIN_API_KEY`; this key gates the appointments API and the `/admin/estimates` board.
5. Adjust `APPOINTMENT_TIMEZONE` (defaults to `America/New_York`) if the crew operates in a different locale.

## Database
1. Start Postgres via Docker:
   ```bash
   docker compose -f devops/docker-compose.yml up -d postgres
   ```
2. Apply the latest schema:
   ```bash
   pnpm -w db:migrate
   ```
   This creates/updates the `contacts`, `properties`, `leads`, and new `quotes` tables with pricing breakdown fields.
3. Stop the database when you are done:
   ```bash
   docker compose -f devops/docker-compose.yml down
   ```

## Development
- Install dependencies:
  ```bash
  pnpm install
  ```
- Run both apps (API + Site):
  ```bash
  pnpm -w dev
  ```
  The API listens on `http://localhost:3001` (via `apps/api`). The site runs on `http://localhost:3000`.

## Useful Commands
```bash
pnpm -w build    # production build for all apps
pnpm -w lint     # lint all workspaces
pnpm -w test     # run workspace tests (if configured)
pnpm outbox:worker  # run the outbox dispatcher (see docs/outbox-worker.md)
```

## Content
Markdown/MDX content lives under `apps/site/content`. Re-run `pnpm -w build` after changes to regenerate static pages.

## Deployment
Render deployment details are tracked in `DEPLOY-ON-RENDER.md` along with the generated `render.yaml` blueprint.

## Notifications
- Estimate requests currently log email/SMS payloads via `notifyEstimateRequested` (see `apps/api/src/lib/notifications.ts`).
- Twilio SMS is wired: if `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` are set, the server will attempt to send a confirmation SMS in addition to logging.
- For email, replace the logger with your provider integration (e.g., Gmail/SMTP) when credentials are ready.
- Outbox events are drained by a lightweight worker. See `docs/outbox-worker.md` for deployment instructions.

## Payments & Stripe
- Backfill charges with `pnpm tsx scripts/stripe-backfill.ts` (or the admin backfill endpoint).
- Charges tagged with `appointment_id` metadata in Stripe will auto-attach to the matching appointment.
- Review and reconcile charges under `/admin/payments`; the dashboard highlights unmatched counts.

## Quotes
- Create quotes via the Owner Hub Admin API (`POST /api/quotes`) using services and add-ons priced through the MystOS engine.
- Send quotes with shareable tokens (`POST /api/quotes/:id/send`) to generate customer-facing links (e.g., `/quote/{token}`) or manage them in the `/admin/quotes` board.
- Customers accept or decline through the public endpoint (`/quote/{token}`); decisions update the admin board in real time.
- Outbox events capture `quote.sent` and `quote.decision` for follow-up automations. Run `pnpm tsx scripts/quote-demo.ts` to create a demo quote, enqueue outbox events, and exercise the worker flow end-to-end.

### Environment for Chat & Notifications
- Chat API (in `apps/site`) reads `OPENAI_API_KEY` and optional `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
- For SMS/email provider wiring, add:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
  - Your email SMTP creds as needed

You can place these in the monorepo root `.env` or per-app `.env.local` files. Both API and Site load `.env.local`, `.env`, and the monorepo root `.env` at startup.

### Dev commands
- API: `pnpm --filter api dev`
- Site: `pnpm --filter site dev`


