// pilotApi.js — Centralized API client for the Automation Pilot.
// Uses relative /api/pilot/* URLs (routed via Vite proxy to port 8787).
// Stage 3B: sends credentials (session cookie) with every request.
// No credentials in code, no live-send logic. Easy to extend with auth headers later.

const BASE = '/api/pilot';

/**
 * Low-level fetch wrapper with JSON parsing and error detection.
 * @param {string} path - path relative to /api/pilot (e.g. '/leads')
 * @param {object} [opts] - fetch options (method, body, signal, headers)
 * @returns {Promise<object>} parsed JSON response
 * @throws {Error} on non-2xx or parse failure, with useful message
 */
async function request(path, opts = {}) {
  const url = BASE + path;
  const fetchOpts = {
    credentials: 'include',  // Stage 3B: send session cookie
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  };
  if (opts.method) fetchOpts.method = opts.method;
  if (opts.body !== undefined) fetchOpts.body = JSON.stringify(opts.body);
  if (opts.signal) fetchOpts.signal = opts.signal;

  let res;
  try {
    res = await fetch(url, fetchOpts);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(`Network error: ${e.message}`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg = data.error || data.message || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// ---- Read-only endpoints (Stage 2A) ----

export const pilotApi = {
  /** GET /api/pilot/health — mode, providers, config issues */
  getHealth(signal) {
    return request('/health', { signal });
  },

  /** GET /api/pilot/leads — list all leads */
  getLeads(signal) {
    return request('/leads', { signal });
  },

  /** GET /api/pilot/leads/:id — single lead */
  getLead(id, signal) {
    return request(`/leads/${id}`, { signal });
  },

  /** GET /api/pilot/drafts — list all drafts */
  getDrafts(signal) {
    return request('/drafts', { signal });
  },

  /** GET /api/pilot/jobs — job queue + history */
  getJobs(signal) {
    return request('/jobs', { signal });
  },

  /** GET /api/pilot/scheduler — scheduler status + scheduled items */
  getScheduler(signal) {
    return request('/scheduler', { signal });
  },

  /** GET /api/pilot/conversations — inbound SMS log */
  getConversations(signal) {
    return request('/conversations', { signal });
  },

  /** GET /api/pilot/calls — voice call log */
  getCalls(signal) {
    return request('/calls', { signal });
  },

  /** GET /api/pilot/optouts — opt-out registry */
  getOptouts(signal) {
    return request('/optouts', { signal });
  },

  /** GET /api/pilot/webhooks/health — webhook endpoint URLs + secret status */
  getWebhookHealth(signal) {
    return request('/webhooks/health', { signal });
  },

  // ---- Write endpoints (Stage 2B — simulation mode only) ----

  /** POST /api/pilot/leads — create lead + AI drafts */
  createLead(payload, signal) {
    return request('/leads', { method: 'POST', body: payload, signal });
  },

  /** POST /api/pilot/drafts/:id/approve — approve draft → engine sends (or simulates) */
  approveDraft(id, signal) {
    return request(`/drafts/${id}/approve`, { method: 'POST', signal });
  },

  /** POST /api/pilot/drafts/:id/reject — reject draft */
  rejectDraft(id, signal) {
    return request(`/drafts/${id}/reject`, { method: 'POST', signal });
  },

  /** PUT /api/pilot/drafts/:id — edit draft body/subject (only if status === 'pending') */
  editDraft(id, patch, signal) {
    return request(`/drafts/${id}`, { method: 'PUT', body: patch, signal });
  },

  /** POST /api/pilot/jobs/:id/cancel — cancel a pending/approved job */
  cancelJob(id, signal) {
    return request(`/jobs/${id}/cancel`, { method: 'POST', signal });
  },

  /** POST /api/pilot/scheduler/cancel/:leadId — cancel all scheduled follow-ups for a lead */
  cancelFollowups(leadId, signal) {
    return request(`/scheduler/cancel/${leadId}`, { method: 'POST', signal });
  },
};

export default pilotApi;
