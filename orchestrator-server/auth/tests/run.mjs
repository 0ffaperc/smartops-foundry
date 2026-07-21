// orchestrator-server/auth/tests/run.mjs — Automated tests for Stage 3B authentication.
// Runs against a temporary test data directory. No production data is touched.
// Usage: AGENCY_DATA_DIR=./agency-data-test node orchestrator-server/auth/tests/run.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = process.env.AGENCY_DATA_DIR || './agency-data-test';
const TEST_AUTH_DIR = join(TEST_DIR, 'auth-test-subdir');

// ---- Clean test directory before running ----
function cleanTestDir() {
  if (TEST_DIR.includes('agency-data-test') || TEST_DIR.includes('auth-test')) {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
}

// ---- Test harness ----
let passed = 0, failed = 0;
const failures = [];
function ok(name) { passed++; console.log(`  PASS ${name}`); }
function fail(name, detail) { failed++; failures.push({ name, detail }); console.log(`  FAIL ${name}`); if (detail) console.log(`       ${detail}`); }

// ---- Import the auth module (fresh, against test dir) ----
const authModule = await import('../../auth/index.mjs');
const {
  handleAuthRoutes, attachAuth, requireAuth, applyCORS,
  readBodyWithLimit, BodyTooLargeError, MAX_BODY_BYTES, AUTH_BODY_MAX,
  buildSetCookieHeader, buildClearCookieHeader, pruneExpiredSessions,
  checkLoginRateLimit, recordFailedLogin, resetLoginAttempts,
} = authModule;

// ---- Mock req/res helpers ----
function mockReq(method, url, body, headers = {}) {
  return {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
    _body: body ? JSON.stringify(body) : '',
    _bodyChunks: body ? [Buffer.from(JSON.stringify(body))] : [],
    on(event, handler) {
      if (event === 'data' && this._bodyChunks.length) handler(this._bodyChunks.shift());
      if (event === 'end') setTimeout(handler, 0);
    },
    destroy() {},
  };
}

function mockRes() {
  const r = { statusCode: 0, headers: {}, body: '', ended: false, cookies: [] };
  r.writeHead = (status, headers = {}) => { r.statusCode = status; r.headers = headers; if (headers['Set-Cookie']) r.cookies.push(headers['Set-Cookie']); };
  r.end = (body) => { r.body = body || ''; r.ended = true; };
  return r;
}

async function callAuth(method, path, body, headers = {}) {
  const req = mockReq(method, path, body, headers);
  const res = mockRes();
  const url = new URL(path, 'http://localhost');
  const handled = await handleAuthRoutes(req, res, url);
  return { handled, req, res };
}

function parseResBody(res) {
  try { return JSON.parse(res.body); } catch { return {}; }
}

function getCookieValue(setCookieHeader, name = 'sid') {
  if (!setCookieHeader) return null;
  const part = setCookieHeader.split(';')[0];
  const [k, v] = part.split('=');
  if (k.trim() !== name) return null;
  return v;
}

// ============================================================
// TESTS
// ============================================================
async function run() {
  cleanTestDir();
  console.log('Pilot auth tests (Stage 3B)\n');

  // ---- 1. Signup sets HttpOnly cookie ----
  {
    const { res, handled } = await callAuth('POST', '/api/auth/signup', {
      name: 'Test User', email: 'test@example.com', password: 'testpassword123', business: 'TestBiz',
    });
    const body = parseResBody(res);
    const setCookie = res.headers['Set-Cookie'];
    const hasHttpOnly = setCookie && setCookie.includes('HttpOnly');
    const hasSameSite = setCookie && setCookie.includes('SameSite=Strict');
    if (handled && res.statusCode === 200 && body.ok && hasHttpOnly && hasSameSite) ok('Signup sets HttpOnly cookie');
    else fail('Signup sets HttpOnly cookie', `status=${res.statusCode} ok=${body.ok} httpOnly=${hasHttpOnly} sameSite=${hasSameSite}`);
  }

  // ---- 2. Login sets HttpOnly cookie ----
  {
    const { res } = await callAuth('POST', '/api/auth/login', {
      email: 'test@example.com', password: 'testpassword123',
    });
    const body = parseResBody(res);
    const setCookie = res.headers['Set-Cookie'];
    const hasHttpOnly = setCookie && setCookie.includes('HttpOnly');
    if (res.statusCode === 200 && body.ok && hasHttpOnly) ok('Login sets HttpOnly cookie');
    else fail('Login sets HttpOnly cookie', `status=${res.statusCode} ok=${body.ok} httpOnly=${hasHttpOnly}`);
  }

  // ---- 3. Session token absent from response JSON ----
  {
    const { res } = await callAuth('POST', '/api/auth/login', {
      email: 'test@example.com', password: 'testpassword123',
    });
    const body = parseResBody(res);
    if (!body.token && !body.sessionId && !body.sid) ok('Session token absent from response JSON');
    else fail('Session token absent from response JSON', `token present: ${!!body.token}`);
  }

  // ---- 4. /api/auth/me returns authenticated user ----
  {
    // First login to get a cookie
    const loginResult = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const cookie = loginResult.res.headers['Set-Cookie'];
    const sid = getCookieValue(cookie);
    // Now call /me with the cookie
    const { res } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
    const body = parseResBody(res);
    if (res.statusCode === 200 && body.ok && body.user && body.user.email === 'test@example.com') ok('/api/auth/me returns authenticated user');
    else fail('/api/auth/me returns authenticated user', `status=${res.statusCode} ok=${body.ok} user=${JSON.stringify(body.user)}`);
  }

  // ---- 5. /api/auth/me returns 401 without cookie ----
  {
    const { res } = await callAuth('GET', '/api/auth/me', null, {});
    const body = parseResBody(res);
    if (res.statusCode === 401 && !body.ok) ok('/api/auth/me returns 401 without cookie');
    else fail('/api/auth/me returns 401 without cookie', `status=${res.statusCode}`);
  }

  // ---- 6. Logout invalidates the session ----
  {
    const loginResult = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sid = getCookieValue(loginResult.res.headers['Set-Cookie']);
    const { res: logoutRes } = await callAuth('POST', '/api/auth/logout', null, { cookie: `sid=${sid}` });
    // After logout, /me should return 401
    const { res: meRes } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
    if (logoutRes.statusCode === 200 && meRes.statusCode === 401) ok('Logout invalidates the session');
    else fail('Logout invalidates the session', `logout=${logoutRes.statusCode} meAfterLogout=${meRes.statusCode}`);
  }

  // ---- 7. Expired session returns 401 ----
  {
    // Create a session, then manually expire it by backdating createdAt
    const authDir = process.env.AGENCY_DATA_DIR || join(process.cwd(), 'agency-data-test');
    const sessionsFile = join(authDir, 'auth-sessions.json');
    const sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    const sid = Object.keys(sessions)[0];
    if (sid) {
      sessions[sid].createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      sessions[sid].lastSeenAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
      writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
      const { res } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
      if (res.statusCode === 401) ok('Expired session returns 401');
      else fail('Expired session returns 401', `status=${res.statusCode}`);
    } else {
      fail('Expired session returns 401', 'no session to expire');
    }
  }

  // ---- 8-9. Idle and absolute expiry ----
  {
    const authDir = process.env.AGENCY_DATA_DIR || join(process.cwd(), 'agency-data-test');
    const sessionsFile = join(authDir, 'auth-sessions.json');
    // Login fresh
    const loginRes = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    let sid = getCookieValue(loginRes.res.headers['Set-Cookie']);
    let sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    // Idle: lastSeenAt > 8h ago
    sessions[sid].lastSeenAt = Date.now() - (9 * 60 * 60 * 1000); // 9h ago
    sessions[sid].createdAt = Date.now() - (10 * 60 * 60 * 1000); // 10h ago (within 7-day absolute)
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
    const idleRes = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
    if (idleRes.res.statusCode === 401) ok('Idle expiry works (8h)');
    else fail('Idle expiry works (8h)', `status=${idleRes.res.statusCode}`);

    // Absolute: createdAt > 7 days ago
    sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    // Fresh login for absolute test
    const login2 = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    sid = getCookieValue(login2.res.headers['Set-Cookie']);
    sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    sessions[sid].createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
    sessions[sid].lastSeenAt = Date.now() - (1000); // 1s ago (within idle)
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
    const absRes = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
    if (absRes.res.statusCode === 401) ok('Absolute expiry works (7d)');
    else fail('Absolute expiry works (7d)', `status=${absRes.res.statusCode}`);
  }

  // ---- 10. Legacy password login succeeds and rehashes ----
  {
    const authDir = process.env.AGENCY_DATA_DIR || join(process.cwd(), 'agency-data-test');
    const usersFile = join(authDir, 'auth-users.json');
    const data = JSON.parse(readFileSync(usersFile, 'utf-8'));
    // Add a legacy user with SHA-256 hash
    const legacyHash = createHash('sha256').update('legacypass123' + 'sof-salt-2026').digest('hex');
    data.users.push({
      id: 'legacy-user-1', name: 'Legacy', email: 'legacy@test.com', business: 'LegacyBiz',
      passwordHash: legacyHash, hashAlgo: 'sha256-legacy',
      role: 'owner', clientId: 'default-tenant',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    writeFileSync(usersFile, JSON.stringify(data, null, 2));
    // Login with legacy password
    const { res } = await callAuth('POST', '/api/auth/login', { email: 'legacy@test.com', password: 'legacypass123' });
    const body = parseResBody(res);
    // Check if the hash was upgraded
    const updatedData = JSON.parse(readFileSync(usersFile, 'utf-8'));
    const updatedUser = updatedData.users.find(u => u.email === 'legacy@test.com');
    if (res.statusCode === 200 && body.ok && updatedUser.hashAlgo === 'scrypt') ok('Legacy password login succeeds and rehashes');
    else fail('Legacy password login succeeds and rehashes', `status=${res.statusCode} algo=${updatedUser?.hashAlgo}`);
  }

  // ---- 11. Incorrect password fails generically ----
  {
    const { res } = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrongpassword' });
    const body = parseResBody(res);
    if (res.statusCode === 401 && body.error === 'Invalid email or password') ok('Incorrect password fails generically');
    else fail('Incorrect password fails generically', `status=${res.statusCode} error=${body.error}`);
  }

  // ---- 12. Login rate limiting returns 429 ----
  {
    resetLoginAttempts('127.0.0.1');
    for (let i = 0; i < 10; i++) {
      await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrong' });
    }
    const { res } = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'wrong' });
    if (res.statusCode === 429) ok('Login rate limiting returns 429');
    else fail('Login rate limiting returns 429', `status=${res.statusCode}`);
    resetLoginAttempts('127.0.0.1');
  }

  // ---- 13. Unauthenticated /api/pilot/leads returns 401 ----
  {
    // We test requireAuth directly since pilot routes are in routes.mjs
    const req = { user: null };
    const res = mockRes();
    const result = requireAuth(req, res);
    if (!result && res.statusCode === 401) ok('Unauthenticated request returns 401 (requireAuth)');
    else fail('Unauthenticated request returns 401 (requireAuth)', `result=${result} status=${res.statusCode}`);
  }

  // ---- 14. Authenticated request passes requireAuth ----
  {
    const req = { user: { id: 'x', email: 'x@x.com', role: 'owner' } };
    const res = mockRes();
    const result = requireAuth(req, res);
    if (result === true) ok('Authenticated request passes requireAuth');
    else fail('Authenticated request passes requireAuth', `result=${result}`);
  }

  // ---- 15. Provider webhook routes are not blocked by dashboard auth ----
  {
    // The isDashboardRoute function excludes webhook paths; we verify by checking
    // that the webhook paths are in the WEBHOOK_PATHS set (not a dashboard route).
    // This is tested by confirming attachAuth doesn't block webhook routes.
    const req = mockReq('POST', '/api/pilot/sms/webhook', null, {});
    await attachAuth(req, mockRes());
    // req.user may be null, but the webhook route should still be processable
    if (req.user === null) ok('Webhook routes do not require auth (req.user=null is ok)');
    else fail('Webhook routes do not require auth', `req.user=${req.user}`);
  }

  // ---- 16. Oversized body returns 413 ----
  {
    // Create a request with a body > AUTH_BODY_MAX
    const bigBody = { email: 'x'.repeat(AUTH_BODY_MAX + 100), password: 'test' };
    const req = mockReq('POST', '/api/auth/login', bigBody, {});
    // Simulate the body being sent in chunks that exceed the limit
    const bigBuffer = Buffer.from(JSON.stringify(bigBody));
    req._bodyChunks = [bigBuffer];
    req.on = (event, handler) => {
      if (event === 'data') {
        // Send the whole buffer at once — exceeds limit
        handler(bigBuffer);
      }
      if (event === 'end') { /* won't fire because destroy was called */ }
    };
    const res = mockRes();
    try {
      const url = new URL('/api/auth/login', 'http://localhost');
      await handleAuthRoutes(req, res, url);
      if (res.statusCode === 413) ok('Oversized body returns 413');
      else fail('Oversized body returns 413', `status=${res.statusCode}`);
    } catch (e) {
      if (e instanceof BodyTooLargeError) {
        if (res.statusCode === 413) ok('Oversized body returns 413');
        else fail('Oversized body returns 413', `exception but status=${res.statusCode}`);
      } else {
        fail('Oversized body returns 413', `unexpected error: ${e.message}`);
      }
    }
  }

  // ---- 17. Allowed development origin receives credential-compatible CORS ----
  {
    const req = { headers: { origin: 'http://localhost:5173' } };
    const res = {};
    const headers = applyCORS(req, res);
    if (headers['Access-Control-Allow-Origin'] === 'http://localhost:5173' && headers['Access-Control-Allow-Credentials'] === 'true') ok('Allowed dev origin receives credential CORS');
    else fail('Allowed dev origin receives credential CORS', JSON.stringify(headers));
  }

  // ---- 18. Disallowed CORS origin is rejected ----
  {
    const req = { headers: { origin: 'https://evil.com' } };
    const res = {};
    const headers = applyCORS(req, res);
    if (!headers['Access-Control-Allow-Origin'] && !headers['Access-Control-Allow-Credentials']) ok('Disallowed CORS origin is rejected');
    else fail('Disallowed CORS origin is rejected', `origin=${headers['Access-Control-Allow-Origin']}`);
  }

  // ==================================================
  // SESSION REGENERATION TESTS
  // ==================================================

  // ---- 23. Login while already authenticated replaces the current session ----
  {
    // Login to get session A
    const loginA = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sidA = getCookieValue(loginA.res.headers['Set-Cookie']);
    // Login again with the old cookie — should replace session A with session B
    const loginB = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' }, { cookie: `sid=${sidA}` });
    const sidB = getCookieValue(loginB.res.headers['Set-Cookie']);
    if (loginB.res.statusCode === 200 && sidA && sidB && sidA !== sidB) ok('Login while authenticated replaces session (new sid differs)');
    else fail('Login while authenticated replaces session', `sidA=${sidA?.slice(0,8)} sidB=${sidB?.slice(0,8)} same=${sidA===sidB}`);
  }

  // ---- 24. Old session cookie returns 401 after replacement ----
  {
    const loginA = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sidA = getCookieValue(loginA.res.headers['Set-Cookie']);
    // Replace with new session
    await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' }, { cookie: `sid=${sidA}` });
    // Old session should now be invalid
    const { res: meRes } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sidA}` });
    if (meRes.statusCode === 401) ok('Old session cookie returns 401 after replacement');
    else fail('Old session cookie returns 401 after replacement', `status=${meRes.statusCode}`);
  }

  // ---- 25. New session cookie succeeds ----
  {
    const loginA = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sidA = getCookieValue(loginA.res.headers['Set-Cookie']);
    const loginB = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' }, { cookie: `sid=${sidA}` });
    const sidB = getCookieValue(loginB.res.headers['Set-Cookie']);
    const { res: meRes } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sidB}` });
    if (meRes.statusCode === 200) ok('New session cookie succeeds');
    else fail('New session cookie succeeds', `status=${meRes.statusCode}`);
  }

  // ---- 26. Another independent session is not removed ----
  {
    // Create session A (simulated as if from another device — no cookie in request)
    const loginA = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sidA = getCookieValue(loginA.res.headers['Set-Cookie']);
    // Create session B (separate device — no cookie in request)
    const loginB = await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' });
    const sidB = getCookieValue(loginB.res.headers['Set-Cookie']);
    // Now login again with session B's cookie — should replace B but NOT A
    await callAuth('POST', '/api/auth/login', { email: 'test@example.com', password: 'testpassword123' }, { cookie: `sid=${sidB}` });
    // Session A should still be valid
    const { res: meA } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sidA}` });
    if (meA.statusCode === 200) ok('Independent session is not removed by replacement');
    else fail('Independent session is not removed by replacement', `status=${meA.statusCode}`);
  }

  // ==================================================
  // SIGNUP BOOTSTRAP TESTS
  // ==================================================

  // ---- 27. First signup succeeds and receives owner role ----
  {
    // Clean all auth data so we have zero users
    cleanTestDir();
    const { res } = await callAuth('POST', '/api/auth/signup', { name: 'Owner', email: 'owner@bootstrap.test', password: 'bootstrappass123', business: 'BootBiz' });
    const body = parseResBody(res);
    if (res.statusCode === 200 && body.ok && body.user.role === 'owner') ok('First signup succeeds and receives owner role');
    else fail('First signup succeeds and receives owner role', `status=${res.statusCode} role=${body.user?.role}`);
  }

  // ---- 28. Second unauthenticated signup returns 403 ----
  {
    const { res } = await callAuth('POST', '/api/auth/signup', { name: 'Second', email: 'second@bootstrap.test', password: 'secondpass123', business: 'SecondBiz' });
    const body = parseResBody(res);
    if (res.statusCode === 403 && !body.ok) ok('Second unauthenticated signup returns 403');
    else fail('Second unauthenticated signup returns 403', `status=${res.statusCode} ok=${body.ok}`);
  }

  // ---- 29. Duplicate-email behaviour remains safe ----
  {
    // Even with zero users (fresh), signup creates the user. A second signup with
    // the same email after bootstrap should still be blocked (403 comes first).
    cleanTestDir();
    await callAuth('POST', '/api/auth/signup', { name: 'Dup', email: 'dup@test.test', password: 'duppass1234', business: 'DupBiz' });
    const { res } = await callAuth('POST', '/api/auth/signup', { name: 'Dup2', email: 'dup@test.test', password: 'duppass1234', business: 'DupBiz' });
    // Should be 403 (users exist) not 409 (duplicate email)
    if (res.statusCode === 403) ok('Duplicate-email after bootstrap returns 403 (bootstrap gate first)');
    else fail('Duplicate-email after bootstrap', `status=${res.statusCode} (expected 403)`);
  }

  // ---- 30. Public signup does not create another owner after bootstrap ----
  {
    // We already have 1+ users from test 27. Verify signup is blocked.
    const { res } = await callAuth('POST', '/api/auth/signup', { name: 'Evil', email: 'evil@evil.test', password: 'evilpass1234', business: 'EvilInc' });
    if (res.statusCode === 403) ok('Public signup blocked after bootstrap (no new owner)');
    else fail('Public signup blocked after bootstrap', `status=${res.statusCode} (expected 403)`);
  }

  // ==================================================
  // INTEGRATION TESTS (pilot + agency routes)
  // ==================================================

  // Dynamic import pilot routes for integration tests
  const pilotMod = await import('../../pilot/routes.mjs');

  // ---- 31. Unauthenticated /api/pilot/leads returns 401 ----
  {
    const req = mockReq('GET', '/api/pilot/leads', null, {});
    const res = mockRes();
    await attachAuth(req, res);
    const handled = await pilotMod.mountPilotRoutes(req, res);
    if (handled && res.statusCode === 401) ok('Unauthenticated /api/pilot/leads returns 401');
    else fail('Unauthenticated /api/pilot/leads returns 401', `handled=${handled} status=${res.statusCode}`);
  }

  // ---- 32. Authenticated /api/pilot/leads returns 200 ----
  {
    // Need a valid session — login as the bootstrap owner
    cleanTestDir();
    await callAuth('POST', '/api/auth/signup', { name: 'Int', email: 'int@test.test', password: 'intpass1234', business: 'IntBiz' });
    const loginRes = await callAuth('POST', '/api/auth/login', { email: 'int@test.test', password: 'intpass1234' });
    const sid = getCookieValue(loginRes.res.headers['Set-Cookie']);
    const req = mockReq('GET', '/api/pilot/leads', null, { cookie: `sid=${sid}` });
    const res = mockRes();
    await attachAuth(req, res);
    const handled = await pilotMod.mountPilotRoutes(req, res);
    const body = parseResBody(res);
    if (handled && res.statusCode === 200 && body.ok) ok('Authenticated /api/pilot/leads returns 200');
    else fail('Authenticated /api/pilot/leads returns 200', `handled=${handled} status=${res.statusCode} ok=${body.ok}`);
  }

  // ---- 33. Unauthenticated /api/agency route returns 401 ----
  {
    const req = { user: null, method: 'GET', url: '/api/agency/catalog', headers: {} };
    const res = mockRes();
    const result = requireAuth(req, res);
    if (!result && res.statusCode === 401) ok('Unauthenticated /api/agency route returns 401 (requireAuth)');
    else fail('Unauthenticated /api/agency route returns 401', `result=${result} status=${res.statusCode}`);
  }

  // ---- 34. Unauthenticated GET /pilot redirects ----
  {
    const req = mockReq('GET', '/pilot', null, {});
    const res = mockRes();
    await attachAuth(req, res);
    await pilotMod.mountPilotRoutes(req, res);
    if (res.statusCode === 302 && (res.headers['Location'] || '').includes('/login.html')) ok('Unauthenticated GET /pilot redirects to login');
    else fail('Unauthenticated GET /pilot redirects', `status=${res.statusCode} Location=${res.headers['Location']}`);
  }

  // ---- 35. Authenticated GET /pilot succeeds ----
  {
    const loginRes = await callAuth('POST', '/api/auth/login', { email: 'int@test.test', password: 'intpass1234' });
    const sid = getCookieValue(loginRes.res.headers['Set-Cookie']);
    const req = mockReq('GET', '/pilot', null, { cookie: `sid=${sid}` });
    const res = mockRes();
    await attachAuth(req, res);
    await pilotMod.mountPilotRoutes(req, res);
    if (res.statusCode === 200 && (res.headers['Content-Type'] || '').includes('text/html')) ok('Authenticated GET /pilot succeeds (HTML)');
    else fail('Authenticated GET /pilot succeeds', `status=${res.statusCode} ct=${res.headers['Content-Type']}`);
  }

  // ---- 36. Webhook routes remain outside dashboard authentication ----
  {
    const req = mockReq('POST', '/api/pilot/sms/webhook', null, {});
    const res = mockRes();
    await attachAuth(req, res); // req.user will be null
    const handled = await pilotMod.mountPilotRoutes(req, res);
    // Should NOT return 401 — it should be handled (200/other)
    if (handled && res.statusCode !== 401) ok('Webhook routes remain outside dashboard auth (no 401)');
    else fail('Webhook routes remain outside dashboard auth', `handled=${handled} status=${res.statusCode}`);
  }

  // ---- 37. Logout expires the cookie with Max-Age=0 ----
  {
    const loginRes = await callAuth('POST', '/api/auth/login', { email: 'int@test.test', password: 'intpass1234' });
    const sid = getCookieValue(loginRes.res.headers['Set-Cookie']);
    const { res: logoutRes } = await callAuth('POST', '/api/auth/logout', null, { cookie: `sid=${sid}` });
    const setCookie = logoutRes.headers['Set-Cookie'] || '';
    if (setCookie.includes('Max-Age=0') && setCookie.includes('HttpOnly')) ok('Logout expires cookie with Max-Age=0 + HttpOnly');
    else fail('Logout expires cookie with Max-Age=0', `Set-Cookie: ${setCookie}`);
  }

  // ---- 38. Server-side rejects idle-expired session despite 7-day cookie Max-Age ----
  {
    const authDir = process.env.AGENCY_DATA_DIR || join(process.cwd(), 'agency-data-test');
    const sessionsFile = join(authDir, 'auth-sessions.json');
    const loginRes = await callAuth('POST', '/api/auth/login', { email: 'int@test.test', password: 'intpass1234' });
    const sid = getCookieValue(loginRes.res.headers['Set-Cookie']);
    // Verify cookie has Max-Age of 7 days (604800 seconds)
    const cookieHas7Days = (loginRes.res.headers['Set-Cookie'] || '').includes('Max-Age=604800');
    // Backdate lastSeenAt to 9 hours ago (exceeds 8h idle), but createdAt within 7 days
    const sessions = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    sessions[sid].lastSeenAt = Date.now() - (9 * 60 * 60 * 1000);
    sessions[sid].createdAt = Date.now() - (10 * 60 * 60 * 1000);
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
    // Server should reject despite cookie being valid in the browser
    const { res: meRes } = await callAuth('GET', '/api/auth/me', null, { cookie: `sid=${sid}` });
    if (cookieHas7Days && meRes.statusCode === 401) ok('Server rejects idle-expired session despite 7-day cookie Max-Age');
    else fail('Server rejects idle-expired session', `cookie7d=${cookieHas7Days} status=${meRes.statusCode}`);
  }

  // ---- Summary ----
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail || ''}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });
