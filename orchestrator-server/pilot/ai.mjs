// pilot/ai.mjs — OpenRouter drafting abstraction.
// Reuses the existing pattern from agency.mjs (direct fetch, GLM 5.2).
// Falls back to a deterministic placeholder when no key is configured so the
// rest of the pipeline (drafts, approvals, scheduling) is fully testable offline.
import { CFG } from './env.mjs';

export async function draft({ system, user, maxTokens = 600, temperature = 0.8 }) {
  if (!CFG.OPENROUTER_API_KEY) {
    return _mock(system, user);
  }
  try {
    const r = await fetch(CFG.OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CFG.OPENROUTER_API_KEY,
        'HTTP-Referer': 'http://localhost:8787',
        'X-Title': 'SmartOps Foundry Pilot',
      },
      body: JSON.stringify({
        model: CFG.MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return { __error: `OpenRouter ${r.status}: ${txt.slice(0, 200)}` };
    }
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  } catch (e) {
    return { __error: String(e) };
  }
}

// Draft a channel message. Returns { subject?, body } or { __error }.
export async function draftMessage({ business, contact, automationType, context }) {
  const biz = business || { name: 'the business', industry: 'general', tone: 'friendly' };
  const c = contact || {};
  const sys = `You are an automation assistant for ${biz.name}, a ${biz.industry} business. Write a ${automationType} message. Tone: ${biz.tone || 'friendly'}. For SMS keep under 160 chars (1 segment). Be personal, warm, specific. Use {{contact_name}} placeholder sparingly — the system fills it. Never invent facts about the business not given. Output ONLY the message text (for email: "SUBJECT: <subject>\\n\\n<body>").`;
  const ctxStr = context ? `\nContext: ${JSON.stringify(context)}` : '';
  const user = `Customer: ${c.name || 'there'}${c.phone ? ', phone ' + c.phone : ''}${c.email ? ', email ' + c.email : ''}. Tags: ${(c.tags || []).join(', ') || 'none'}. Notes: ${c.notes || 'none'}. Automation: ${automationType}.${ctxStr}`;
  const out = await draft({ system: sys, user, maxTokens: 500 });
  if (out && out.__error) return out;
  if (!out || !String(out).trim()) {
    // AI returned empty — fall back to a safe default so the draft is never blank.
    const fallback = _mock(sys, user);
    return /SUBJECT:/i.test(fallback)
      ? { subject: fallback.replace(/^SUBJECT:\s*/i, '').split('\n')[0].trim(), body: fallback.split('\n').slice(1).join('\n').replace(/^\n+/, '').trim() }
      : { body: fallback };
  }
  // Parse email subject/body
  if (/^SUBJECT:\s*/i.test(out)) {
    const [head, ...rest] = out.split('\n');
    const subject = head.replace(/^SUBJECT:\s*/i, '').trim();
    const body = rest.join('\n').replace(/^\n+/, '').trim();
    return { subject, body };
  }
  return { body: String(out).trim() };
}

function _mock(system, user) {
  const isEmail = /email/i.test(system);
  if (isEmail) {
    return 'SUBJECT: Thanks for reaching out!\n\nHi {{contact_name}}, thanks for contacting us! We received your request and will follow up shortly. Reply to this email or call us anytime.\n\nBest,\nThe Team';
  }
  return 'Hi {{contact_name}}, thanks for reaching out! We received your request and will follow up shortly. Reply here or call us. — The Team';
}
