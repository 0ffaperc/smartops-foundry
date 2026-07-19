# SmartOps Foundry — Automation Pilot

A production-ready automation pilot that runs **inside the clone only** (branch `feat/automation-pilot`). It adds a complete lead → AI draft → approval → send → follow-up pipeline with SMS (Twilio), Email (Resend), and Voice (Twilio Voice), plus a persistent scheduler, webhook handling, and a simulation mode for safe testing.

Everything lives under `orchestrator-server/pilot/` and mounts into the existing server without touching existing functionality.

---

## Quick start (simulation mode — no accounts needed)

```bash
cd ~/Desktop/smartops-foundry
cp .env.example .env                 # fill in OPENROUTER_API_KEY for real AI drafts
node --env-file=.env orchestrator-server/server.mjs
```

Then open the pilot dashboard:

```
http://localhost:8787/pilot
```

In simulation mode (`LIVE_MODE=false`, the default), **no external API is ever called**. SMS/email sends are recorded as `simulated` and stored exactly as if sent. You can exercise the entire pipeline — leads, drafts, approvals, scheduling, webhooks — for free.

### Run the automated test suite

```bash
AGENCY_DATA_DIR=./agency-data-test node orchestrator-server/pilot/tests/run.mjs
```

27 tests covering engine lifecycle, SMS opt-out/STOP/START/HELP, scheduler, webhook dedupe, and lead ingestion.

---

## Architecture

```
orchestrator-server/pilot/
  env.mjs        — central config from env vars (no hardcoded paths/secrets)
  store.mjs      — atomic JSON persistence under AGENCY_DATA_DIR/pilot/
  ai.mjs         — OpenRouter drafting (GLM 5.2), mock fallback when no key/empty
  engine.mjs     — job queue: pending→approved→simulated/sent→delivered/failed/cancelled + retries
  scheduler.mjs  — persistent follow-ups; survives restart; cancels on reply
  sms.mjs        — Twilio SMS + simulate + STOP/START/HELP opt-out registry
  email.mjs      — Resend + simulate + delivery/bounce events
  voice.mjs      — Twilio Voice: forward to TEST_FORWARD_PHONE, missed-call text-back
  leads.mjs      — lead CRUD + website lead flow (AI drafts SMS+email)
  approvals.mjs  — draft → approve/reject/edit → engine job
  webhooks.mjs   — Twilio + Resend signature verification, duplicate-event protection
  routes.mjs     — all REST endpoints + webhooks, mounted into server.mjs
  pilot.html     — self-contained dashboard (no Vite needed)
  tests/run.mjs  — automated tests
  README.md      — this file
```

**Data:** `<AGENCY_DATA_DIR>/pilot/{leads,drafts,jobs,schedule,optouts,events,conversations}.json` (atomic writes via tmp+rename).

**Job statuses:** `pending → approved → simulated | sent → delivered | failed | cancelled`.

---

## REST API

All under `/api/pilot/`. The dashboard at `/pilot` uses these.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Mode, providers configured, config issues |
| GET | `/pilot` | Pilot dashboard (HTML) |
| POST | `/leads` | Create lead → AI drafts SMS + email |
| GET | `/leads` | List leads |
| GET | `/leads/:id` | Get one lead |
| GET | `/drafts` | List drafts (filter: `?status=pending`) |
| PUT | `/drafts/:id` | Edit a draft (body/subject) |
| POST | `/drafts/:id/approve` | Approve → engine sends (or simulates) → schedules follow-up |
| POST | `/drafts/:id/reject` | Reject → cancels associated job |
| GET | `/jobs` | Job queue + history |
| POST | `/jobs/:id/cancel` | Cancel a pending/approved job |
| GET | `/scheduler` | Scheduler status + scheduled items |
| POST | `/scheduler/cancel/:leadId` | Cancel all follow-ups for a lead |
| GET | `/conversations` | SMS conversation log (`?phone=...`) |
| GET | `/calls` | Voice call log |
| GET | `/optouts` | Opt-out registry |
| GET | `/webhooks/health` | Webhook endpoint URLs + secret status |
| POST | `/sms/webhook` | Twilio inbound SMS (STOP/START/HELP + replies) |
| POST | `/voice/incoming` | Twilio inbound call → TwiML (forward or text-back) |
| POST | `/voice/status` | Twilio call status → missed-call text-back |
| POST | `/email/webhook` | Resend delivery/bounce events |

---

## Configuring providers

### OpenRouter (AI drafts)
```env
OPENROUTER_API_KEY=sk-or-...n
LIFEOS_FAST_MODEL=z-ai/glm-5.2
```
Without a key, drafts fall back to a safe default template so the pipeline still works.

### Twilio (SMS + Voice)
1. Buy a Twilio number. Set:
   ```env
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   TEST_FORWARD_PHONE=+1...   # calls forward here
   ```
2. In Twilio console, configure webhook URLs (see `/api/pilot/webhooks/health` for exact URLs):
   - **Messaging → A MESSAGE COMES IN:** `https://<tunnel>/api/pilot/sms/webhook`
   - **Voice → A CALL COMES IN:** `https://<tunnel>/api/pilot/voice/incoming`
   - **Voice → Call Status Changes:** `https://<tunnel>/api/pilot/voice/status`
3. SMS compliance: STOP/START/HELP are handled automatically; opted-out numbers are never messaged.

### Resend (Email)
1. Verify your sending domain in Resend. Set:
   ```env
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=onboarding@yourdomain.com
   RESEND_WEBHOOK_SECRET=whsec_...
   ```
2. In Resend dashboard → Webhooks, add endpoint `https://<tunnel>/api/pilot/email/webhook` with events `email.delivered`, `email.bounced`, `email.delivery_status_changed`. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET`.

---

## Switching from simulation to live mode

1. Fill in all provider creds in `.env` (Twilio + Resend).
2. Set `TEST_PHONE_ALLOWLIST` and `TEST_EMAIL_ALLOWLIST` to numbers/addresses you control.
3. Flip the flag:
   ```env
   LIVE_MODE=true
   AUTOMATION_TEST_MODE=true   # keep test mode ON first — outbound restricted to allowlists
   ```
4. Test a real send to an allowlisted number. When confident, set `AUTOMATION_TEST_MODE=false` to remove the allowlist restriction.

**Safety:** in `TEST_MODE`, outbound SMS/email are rejected unless the recipient is in the allowlist, even in `LIVE_MODE`. This prevents accidental real sends to real customers during pilot testing.

---

## Receiving webhooks locally (Cloudflare Tunnel)

Twilio and Resend need a public HTTPS URL. Use Cloudflare Tunnel:

```bash
# install once
winget install --id Cloudflare.cloudflared

# expose the local backend
cloudflared tunnel --url http://localhost:8787
```

Cloudflare prints a URL like `https://random-words.trycloudflare.com`. Set it in `.env`:
```env
PUBLIC_BASE_URL=https://random-words.trycloudflare.com
```
Restart the server, then point Twilio/Resend webhooks at `<PUBLIC_BASE_URL>/api/pilot/...`.

> The tunnel URL changes each run unless you create a named tunnel. For a stable pilot, [create a named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) bound to your domain.

---

## Manual testing checklist

See the full checklist in the final delivery report. Highlights (all doable in simulation mode via the dashboard at `/pilot` or curl):

- **Lead creation** → POST `/api/pilot/leads` with name/phone/email → 2 drafts appear.
- **SMS draft / Email draft** → review in dashboard.
- **Approval** → click Approve → job becomes `simulated`.
- **Simulation** → no real send; `messages`/`jobs` show `simulated`.
- **Real SMS** → set `LIVE_MODE=true` + Twilio creds + allowlist → approve → real text.
- **Real email** → same with Resend.
- **Incoming SMS** → POST `/api/pilot/sms/webhook` with `From/To/Body/MessageSid`.
- **STOP** → `Body=STOP` → contact opted out, auto-reply sent.
- **Missed-call text** → POST `/api/pilot/voice/status` with `CallStatus=no-answer` → text-back draft created (pending approval).
- **Answered call** → `CallStatus=completed` → logged, no text-back.
- **Scheduler persistence** → create a follow-up, restart the server → it's still scheduled.
- **Restart recovery** → pending/approved jobs survive restart (worker reprocesses due jobs).
- **Duplicate webhook** → POST the same `MessageSid` twice → second returns `{duplicate:true}`.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | AI drafting (GLM 5.2) |
| `LIFEOS_FAST_MODEL` | `z-ai/glm-5.2` | OpenRouter model |
| `LIVE_MODE` | `false` | `true` = real sends |
| `AUTOMATION_TEST_MODE` | `true` | restrict outbound to allowlists |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | — | SMS + Voice |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_WEBHOOK_SECRET` | — | Email |
| `TEST_PHONE_ALLOWLIST` / `TEST_EMAIL_ALLOWLIST` | — | comma-separated safety lists |
| `TEST_FORWARD_PHONE` | — | inbound calls forward here |
| `PUBLIC_BASE_URL` | `http://localhost:8787` | base for webhook callback URLs |
| `DEFAULT_TIMEZONE` | `UTC` | scheduler timezone |
| `AUTOMATION_POLL_SECONDS` | `5` | worker poll interval |
| `TEST_FOLLOWUP_MINUTES` | `2` | follow-up delay (short for testing) |
| `AGENCY_DATA_DIR` | `./agency-data` | storage root |
| `HERMES_BIN` | `hermes` | Hermes CLI (existing 'site' mode only) |

**No secrets are hardcoded.** `.env` is gitignored. `.env.example` and `.env.test` contain only placeholders.

---

## Security

- Webhook signatures verified (Twilio HMAC-SHA256, Resend/Svix).
- Duplicate webhooks rejected via event-ID tracking.
- All inputs validated (phone E.164, email format, required fields).
- API keys never logged; responses redact secret presence to booleans.
- Opt-out enforced: `isOptedOut` checked before every SMS send and before missed-call text-back.
