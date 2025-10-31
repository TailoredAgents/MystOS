# MystOS Research Notes

## Runtime & Framework Versions
- **Node.js v22.20.0 (LTS "Jod")** - active LTS through October 2027; ships with npm 10.9.x and OpenSSL 3.5.x. Pin via `.nvmrc` and enable Corepack (`corepack enable`) so pnpm stays consistent.  
  Docs: https://nodejs.org/en/about/releases
- **Next.js 15.5.5** - latest stable App Router release with Partial Prerendering, Turbopack dev server, and built-in metadata routes.  
  Docs: https://nextjs.org/docs/app
- **Drizzle ORM 0.44.6 / drizzle-kit 0.31.5** - current stable packages with typed Postgres migrations and schema inference.  
  Docs: https://orm.drizzle.team/docs/overview

## Stripe Deposits And Tap To Pay
- **Payment Links best practice**: create a dedicated "Pressure Washing Deposit" product or price; clone links at runtime when the deposit amount changes. Attach `customer_email` and quote metadata for CRM sync and redirect to a thank-you route after success.  
  Docs: https://stripe.com/docs/payments/payment-links/api
- **Checkout Sessions fallback**: build dynamic deposits with `mode: 'payment'` and `payment_intent_data[capture_method]=automatic` when quotes generate unique amounts.  
  Docs: https://stripe.com/docs/payments/checkout
- **Webhooks**: subscribe to `checkout.session.completed` and `payment_intent.succeeded` to flip lead status; verify signatures with `STRIPE_WEBHOOK_SECRET`.  
  Docs: https://stripe.com/docs/webhooks/signatures
- **Tap to Pay roadmap**: Stripe Tap to Pay on iPhone and Android requires Stripe Terminal SDK and compatible devices; plan for crew hardware selection before rollout.  
  Docs: https://stripe.com/terminal/tap-to-pay

## Google Calendar 2-Way Sync
- **Current status**: API already creates primary calendar events when credentials are present (`createCalendarEvent` helper). Next step is to add incremental sync + updates flowing back from Google.
- **Quickstart flow**: start with OAuth 2.0 "Desktop App" credentials for local development; production should use OAuth "Web application" with secure redirect URIs and store the refresh token in the DB (`GOOGLE_REFRESH_TOKEN`).  
  Docs: https://developers.google.com/calendar/api/quickstart/nodejs
- **Minimal scopes**: request `https://www.googleapis.com/auth/calendar.events` for read/write access or `https://www.googleapis.com/auth/calendar.events.readonly` when read-only is sufficient. Avoid broader calendar scopes to reduce consent friction.  
  Scope reference: https://developers.google.com/identity/protocols/oauth2/scopes#calendar
- **Sync approach**: leverage incremental sync tokens (`syncToken`) and push channels (`events.watch`) to keep MystOS availability up to date with minimal polling.  
  Docs: https://developers.google.com/calendar/api/guides/sync

## Next.js A/B Testing Strategy
- **Bucketing**: use Middleware to assign visitors deterministically (hash of `crypto.randomUUID()` stored in `ab_variant` cookie) and forward the variant via request headers to Server Components.  
  Middleware docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
- **Server analytics**: log exposures and conversions via `/api/web/ab-events`, sending experiment metadata to GA4 and Meta Pixel using server-side Measurement Protocol events.  
  GA4 docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
- **ISR compatibility**: pair Partial Prerendering with variant-aware dynamic segments or `cookies().get` inside Server Components to avoid client-only rendering and maintain SEO.  
  Partial prerendering: https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering


