// pilot/env.mjs — Central environment configuration for the Automation Pilot.
// All secrets/paths/tunables come from env vars. No hardcoded values.
// Import `CFG` everywhere; never read process.env directly in other modules.
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

function bool(v, dflt) { if (v === undefined) return dflt; return v === '1' || v === 'true' || v === 'yes'; }
function int(v, dflt) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : dflt; }

const PROJECT_ROOT = process.cwd();

// Data directory — shared with the existing agency stack so leads/clients
// live alongside each other. Pilot-specific state goes under <data>/pilot/.
const AGENCY_DATA_DIR = process.env.AGENCY_DATA_DIR || join(PROJECT_ROOT, 'agency-data');
const PILOT_DATA_DIR = join(AGENCY_DATA_DIR, 'pilot');

// AI (OpenRouter)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LIFEOS_FAST_MODEL = process.env.LIFEOS_FAST_MODEL || 'z-ai/glm-5.2';

// Mode flags
const LIVE_MODE = bool(process.env.LIVE_MODE, false);            // false → simulate all sends
const TEST_MODE = bool(process.env.AUTOMATION_TEST_MODE, true);   // true → enforce allowlist on outbound

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

// Resend (email)
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

// Allowlists / forwarding (safety: in test mode, outbound is restricted)
const TEST_PHONE_ALLOWLIST = (process.env.TEST_PHONE_ALLOWLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const TEST_FORWARD_PHONE = process.env.TEST_FORWARD_PHONE || '';
const TEST_EMAIL_ALLOWLIST = (process.env.TEST_EMAIL_ALLOWLIST || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Public base URL (for absolute webhook URLs / TwiML callbacks)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:8787';

// Scheduler tunables
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';
const AUTOMATION_POLL_SECONDS = int(process.env.AUTOMATION_POLL_SECONDS, 5);
const TEST_FOLLOWUP_MINUTES = int(process.env.TEST_FOLLOWUP_MINUTES, 2);

export const CFG = {
  PROJECT_ROOT,
  AGENCY_DATA_DIR,
  PILOT_DATA_DIR,
  OPENROUTER_API_KEY,
  OPENROUTER_URL,
  MODEL: LIFEOS_FAST_MODEL,
  LIVE_MODE,
  TEST_MODE,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  RESEND_WEBHOOK_SECRET,
  TEST_PHONE_ALLOWLIST,
  TEST_FORWARD_PHONE,
  TEST_EMAIL_ALLOWLIST,
  PUBLIC_BASE_URL,
  DEFAULT_TIMEZONE,
  AUTOMATION_POLL_SECONDS,
  TEST_FOLLOWUP_MINUTES,
};

// Validate at import: warn (don't crash) about missing required-for-live vars.
export function validateConfig() {
  const issues = [];
  if (!OPENROUTER_API_KEY) issues.push('OPENROUTER_API_KEY missing — AI drafts will return empty.');
  if (LIVE_MODE) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER)
      issues.push('LIVE_MODE=1 but Twilio creds incomplete — SMS/Voice will fail.');
    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL)
      issues.push('LIVE_MODE=1 but Resend creds incomplete — email will fail.');
  }
  return issues;
}

// Ensure data dirs exist
if (!existsSync(PILOT_DATA_DIR)) mkdirSync(PILOT_DATA_DIR, { recursive: true });
