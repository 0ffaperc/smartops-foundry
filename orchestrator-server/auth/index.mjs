// orchestrator-server/auth/index.mjs — Secure session-based authentication.
// Stage 3B: cookie-based sessions, scrypt password hashing, legacy SHA-256 migration.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

// ---- Configuration ----
const SESSION_COOKIE = 'sid';
const IDLE_EXPIRY_MS = 8 * 60 * 60 * 1000;       // 8 hours idle
const ABSOLUTE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days absolute
const MAX_BODY_BYTES = 1024 * 1024;               // 1 MB global
const AUTH_BODY_MAX = 16 * 1024;                  // 16 KB for auth routes
const LEGACY_SALT = 'sof-salt-2026';              // old static salt for migration
const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };   // moderate cost

// ---- CORS allowed origins ----
function getAllowedOrigins() {
  // Environment override or sensible dev defaults
  const env = process.env.CORS_ALLOWED_ORIGINS;
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8787', 'http://127.0.0.1:8787', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://smartopsfoundry.com', 'https://www.smartopsfoundry.com', 'https://agency.smartopsfoundry.com'];
}

// ---- Auth data directory ----
function getAuthDir() {
  // Use AGENCY_DATA_DIR (consistent with the rest of the app) or fall back to project agency-data
  return process.env.AGENCY_DATA_DIR || join(process.cwd(), 'agency-data');
}

function authFilePaths() {
  const dir = getAuthDir();
  return {
    users: join(dir, 'auth-users.json'),
    sessions: join(dir, 'auth-sessions.json'),
  };
}

function ensureAuthDir() {
  const dir = getAuthDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ---- Atomic JSON read/write ----
function readJSON(p, fallback) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : fallback; }
  catch { return fallback; }
}
function writeJSON(p, data) {
  ensureAuthDir();
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, p);
}

// ---- Users ----
function readUsers() {
  const { users } = authFilePaths();
  const data = readJSON(users, { users: [] });
  // Migration: add role + clientId to any users missing them (non-destructive)
  let changed = false;
  for (const u of data.users) {
    if (!u.role) { u.role = 'owner'; changed = true; }
    if (!u.clientId) { u.clientId = 'default-tenant'; changed = true; }
    if (!u.hashAlgo) { u.hashAlgo = 'sha256-legacy'; changed = true; }
    if (!u.createdAt) { u.createdAt = new Date().toISOString(); changed = true; }
    if (!u.updatedAt) { u.updatedAt = new Date().toISOString(); changed = true; }
  }
  if (changed) writeJSON(users, data);
  return data;
}
function writeUsers(data) { writeJSON(authFilePaths().users, data); }

// ---- Sessions ----
function readSessions() { return readJSON(authFilePaths().sessions, {}); }
function writeSessions(data) { writeJSON(authFilePaths().sessions, data); }

function removeSession(token) {
  const sessions = readSessions();
  delete sessions[token];
  writeSessions(sessions);
}

// ---- Password hashing ----
function hashScrypt(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  // Format: scrypt:saltHex:hashHex
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyScrypt(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const hash = scryptSync(password, salt, expected.length, SCRYPT_PARAMS);
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function verifyLegacySha256(password, stored) {
  const expected = createHash('sha256').update(password + LEGACY_SALT).digest('hex');
  if (expected.length !== stored.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(stored));
}

function verifyPassword(password, user) {
  const algo = user.hashAlgo || 'sha256-legacy';
  if (algo === 'scrypt') return verifyScrypt(password, user.passwordHash);
  if (algo === 'sha256-legacy') return verifyLegacySha256(password, user.passwordHash);
  return false;
}

function needsRehash(user) {
  return (user.hashAlgo || 'sha256-legacy') === 'sha256-legacy';
}

function rehashPassword(user, password) {
  user.passwordHash = hashScrypt(password);
  user.hashAlgo = 'scrypt';
  user.updatedAt = new Date().toISOString();
  return user;
}

// ---- Session management ----
function createSession(user) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  const sessions = readSessions();
  sessions[token] = {
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    email: user.email,
    createdAt: now,
    lastSeenAt: now,
  };
  writeSessions(sessions);
  return token;
}

function isSessionExpired(session) {
  const now = Date.now();
  if (now - session.lastSeenAt > IDLE_EXPIRY_MS) return true;
  if (now - session.createdAt > ABSOLUTE_EXPIRY_MS) return true;
  return false;
}

function touchSession(token, session) {
  session.lastSeenAt = Date.now();
  const sessions = readSessions();
  sessions[token] = session;
  writeSessions(sessions);
}

function pruneExpiredSessions() {
  const sessions = readSessions();
  let changed = false;
  for (const [tok, s] of Object.entries(sessions)) {
    if (isSessionExpired(s)) { delete sessions[tok]; changed = true; }
  }
  if (changed) writeSessions(sessions);
}

// ---- Cookie helpers ----
function buildSetCookieHeader(token) {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${ABSOLUTE_EXPIRY_MS / 1000}`,
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

function buildClearCookieHeader() {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true';
  const parts = [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

// ---- Cookie parsing ----
export function parseCookies(req) {
  const cookieHeader = req.headers['cookie'] || '';
  const cookies = {};
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = (v.join('=') || '').trim();
  }
  return cookies;
}

// ---- Body size enforcement ----
export function readBodyWithLimit(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new BodyTooLargeError());
        return;
      }
      data = Buffer.concat([data, chunk]);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data.toString('utf-8') || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export function readRawWithLimit(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new BodyTooLargeError());
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export class BodyTooLargeError extends Error {
  constructor() { super('Request body too large'); this.code = 'BODY_TOO_LARGE'; }
}

// ---- Rate limiting (in-memory, single-server) ----
const loginAttempts = new Map(); // ip -> { count, firstAt }
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS };
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS - entry.count };
}

export function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

export function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

export function pruneLoginAttempts() {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
  }
}

// ---- IP extraction (do not trust X-Forwarded-For by default) ----
export function getClientIP(req) {
  // Only trust X-Forwarded-For if explicitly configured (trusted proxy)
  if (process.env.TRUST_PROXY === 'true') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ---- Safe user object (no passwordHash, no sensitive fields) ----
export function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    plan: user.plan,
    business: user.business,
  };
}

// ---- Auth middleware: attach req.user or null ----
export async function attachAuth(req, res, next) {
  pruneExpiredSessions();
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) { req.user = null; req.session = null; if (next) next(); return; }
  const sessions = readSessions();
  const session = sessions[token];
  if (!session || isSessionExpired(session)) {
    if (session) removeSession(token);
    req.user = null; req.session = null;
    if (next) next();
    return;
  }
  // Load user
  const users = readUsers();
  const user = users.users.find(u => u.id === session.userId);
  if (!user) {
    removeSession(token);
    req.user = null; req.session = null;
    if (next) next();
    return;
  }
  // Touch session (update lastSeenAt)
  touchSession(token, session);
  req.user = safeUser(user);
  req.session = { token, ...session };
  if (next) next();
}

// ---- Require auth (for API routes) ----
export function requireAuth(req, res) {
  if (!req.user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Authentication required' }));
    return false;
  }
  return true;
}

// ---- CORS helper ----
export function applyCORS(req, res, extraHeaders = {}) {
  const origin = req.headers['origin'];
  const allowed = getAllowedOrigins();
  const headers = { ...extraHeaders };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }
  // For non-browser (no origin) or disallowed origins: send nothing (same-origin or server-to-server)
  return headers;
}

// ---- Export the auth route handler ----
export async function handleAuthRoutes(req, res, url) {
  const path = url.pathname;
  const ip = getClientIP(req);

  // ---- POST /api/auth/signup ----
  // Bootstrap rule: public signup may create the initial owner ONLY when zero users exist.
  // After the first owner exists, unauthenticated public signup returns 403.
  // Future account creation will require an authenticated administrator or invitation system.
  if (req.method === 'POST' && path === '/api/auth/signup') {
    let body;
    try { body = await readBodyWithLimit(req, AUTH_BODY_MAX); }
    catch (e) {
      if (e instanceof BodyTooLargeError) { res.writeHead(413); res.end(JSON.stringify({ ok: false, error: 'Request body too large' })); return true; }
      throw e;
    }
    const { name, email, password, business, plan } = body;
    if (!name || !email || !password || !business) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(400, h); res.end(JSON.stringify({ ok: false, error: 'All fields are required' })); return true;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 8) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(400, h); res.end(JSON.stringify({ ok: false, error: 'Password must be at least 8 characters' })); return true;
    }
    // Public signup is open — no bootstrap gate
    const data = readUsers();
    if (data.users.find(u => u.email === normalizedEmail)) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(409, h); res.end(JSON.stringify({ ok: false, error: 'An account with this email already exists' })); return true;
    }
    const user = {
      id: 'user-' + Date.now().toString(36),
      name: String(name).trim(),
      email: normalizedEmail,
      business: String(business).trim(),
      plan: plan || 'starter',
      passwordHash: hashScrypt(password),
      hashAlgo: 'scrypt',
      role: 'owner',
      clientId: 'default-tenant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.users.push(user);
    writeUsers(data);
    // Session replacement: if an existing session cookie is present, delete it
    const oldToken = parseCookies(req)[SESSION_COOKIE];
    if (oldToken) removeSession(oldToken);
    const token = createSession(user);
    const setCookie = buildSetCookieHeader(token);
    const h = applyCORS(req, res, { 'Content-Type': 'application/json', 'Set-Cookie': setCookie });
    res.writeHead(200, h);
    res.end(JSON.stringify({ ok: true, user: safeUser(user) }));
    return true;
  }

  // ---- POST /api/auth/login ----
  if (req.method === 'POST' && path === '/api/auth/login') {
    let body;
    try { body = await readBodyWithLimit(req, AUTH_BODY_MAX); }
    catch (e) {
      if (e instanceof BodyTooLargeError) { res.writeHead(413); res.end(JSON.stringify({ ok: false, error: 'Request body too large' })); return true; }
      throw e;
    }
    const { email, password } = body;
    if (!email || !password) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(400, h); res.end(JSON.stringify({ ok: false, error: 'Email and password are required' })); return true;
    }
    // Rate limiting
    const rl = checkLoginRateLimit(ip);
    if (!rl.allowed) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json', 'Retry-After': '900' });
      res.writeHead(429, h); res.end(JSON.stringify({ ok: false, error: 'Too many login attempts. Please try again later.' })); return true;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const data = readUsers();
    const user = data.users.find(u => u.email === normalizedEmail);
    // Generic error (don't reveal whether email exists)
    if (!user || !verifyPassword(password, user)) {
      recordFailedLogin(ip);
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(401, h); res.end(JSON.stringify({ ok: false, error: 'Invalid email or password' })); return true;
    }
    // Legacy password migration: rehash with scrypt
    if (needsRehash(user)) {
      rehashPassword(user, password);
      writeUsers(data);
    }
    resetLoginAttempts(ip);
    // Session regeneration: delete the existing session (if any), then create a fresh one.
    // This invalidates the old session ID — it can no longer authenticate.
    // Unrelated sessions from other devices are NOT affected.
    const oldToken = parseCookies(req)[SESSION_COOKIE];
    if (oldToken) removeSession(oldToken);
    const token = createSession(user);
    const setCookie = buildSetCookieHeader(token);
    const h = applyCORS(req, res, { 'Content-Type': 'application/json', 'Set-Cookie': setCookie });
    res.writeHead(200, h);
    res.end(JSON.stringify({ ok: true, user: safeUser(user) }));
    return true;
  }

  // ---- GET /api/auth/me ----
  if (req.method === 'GET' && path === '/api/auth/me') {
    await attachAuth(req, res);
    if (!req.user) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(401, h); res.end(JSON.stringify({ ok: false, error: 'Authentication required' })); return true;
    }
    const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
    res.writeHead(200, h);
    res.end(JSON.stringify({ ok: true, user: req.user }));
    return true;
  }

  // ---- GET /api/auth/verify (backward compatibility — now uses cookie) ----
  if (req.method === 'GET' && path === '/api/auth/verify') {
    await attachAuth(req, res);
    if (!req.user) {
      const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
      res.writeHead(401, h); res.end(JSON.stringify({ ok: false, error: 'Invalid or expired session' })); return true;
    }
    const h = applyCORS(req, res, { 'Content-Type': 'application/json' });
    res.writeHead(200, h);
    res.end(JSON.stringify({ ok: true, user: req.user }));
    return true;
  }

  // ---- POST /api/auth/logout ----
  if (req.method === 'POST' && path === '/api/auth/logout') {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (token) removeSession(token);
    const clearCookie = buildClearCookieHeader();
    const h = applyCORS(req, res, { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie });
    res.writeHead(200, h);
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  return false; // not handled
}

// ---- Export helpers for use in server.mjs ----
// (Functions already exported inline above; only non-inline exports need listing here.)
export {
  MAX_BODY_BYTES,
  AUTH_BODY_MAX,
  buildSetCookieHeader,
  buildClearCookieHeader,
  pruneExpiredSessions,
};
