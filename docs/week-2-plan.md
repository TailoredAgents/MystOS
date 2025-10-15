# Week 2 Execution Plan - "Quote & Schedule"

## Summary Snapshot
- [done] Pricing package extended (still available for internal use), but instant web quotes have been retired.
- [done] In-person estimate scheduler launched (Lead form upgrades + API changes).
- [done] Notifications now log estimate requests for email/SMS handoff.
- [done] Chatbot widget answers FAQs and shares price ranges before booking.
- [todo] Integrate real notification providers when credentials are ready.

---

## Objectives
1. Convert web interest into booked on-site estimates.
2. Give visitors fast answers (services, pricing ranges, process) via chatbot.
3. Keep operations informed via structured notifications/logs.

---

## Feature Work

### 1. Estimate Scheduler (Site) — _Done_
- Updated `/components/LeadForm` to capture multi-service selections, contact/property, preferred date/time.
- Confirms consent for SMS/email updates and posts to the `lead-intake` endpoint as an in-person estimate.
- Success state invites customers to call if they need immediate adjustments.

### 2. Lead Intake API (`apps/api`) — _Done_
- `POST /api/web/lead-intake` accepts `services[]`, `appointmentType`, and `scheduling` payloads.
- Stores data in `leads` table with full form payload, emits `estimate.requested` outbox events.
- Added `notifyEstimateRequested` stub to log email/SMS payloads for future providers.
- Legacy `quote-request` endpoint now returns HTTP 410 to signal the deprecation.

### 3. Pricing & Chatbot Experience — _Done_
- `ChatBot` widget provides canned answers + price ranges (e.g., driveway $120-$260) and nudges visitors to schedule.
- Uses quick suggestion chips and a lightweight keyword matcher for instant responses.

### 4. Notifications — _Stub Complete_
- Logging-based email/SMS payloads ready for Gmail/Twilio integration. Replace the logger when credentials are available.

---

## API Contract Highlights
- `POST /api/web/lead-intake`
  - `services`: string[] (required)
  - `scheduling`: `{ preferredDate?, alternateDate?, timeWindow? }`
  - `appointmentType`: defaults to `web_lead`, set to `in_person_estimate` for scheduler.
  - Other fields (contact, property, notes) unchanged from previous lead form.
- Response: `{ ok: true, leadId }` on success; detailed error JSON on validation issues.

---

## Supporting Work
- Update README with notification notes (?).
- Add chatbot component to layout (?).
- Future: consider analytics around chatbot interactions and scheduler conversions.

---

## Delivery Checklist
- [x] In-person estimate scheduler shipped (UI + API).
- [x] Chatbot live on site layout.
- [x] Notifications stub logging.
- [ ] Docs for notification provider setup (when integrations arrive).
- [x] Quality gates: `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter site build`, `pnpm -w build`.

---

## Hand-off Notes for Next Dev
1. Wire Gmail/Twilio (or chosen providers) into `notifyEstimateRequested` once credentials are approved.
2. Monitor chatbot logs; expand keyword coverage or hook into a conversational API if needed.
3. Review scheduler accessibility and copy with the ops team; adjust time windows or service list as offerings evolve.
4. Keep lead-intake tests in mind for future additions (e.g., automated follow-up flows).
