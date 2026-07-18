# SmartOps Foundry

AI Ops Agency SaaS — landing page, auth, dashboard, multi-client agency backend, clip builder, and friend agent bridge.

## Quick Start (for both developers)

```bash
# 1. Clone the repo
git clone https://github.com/0ffaperc/smartops-foundry.git
cd smartops-foundry

# 2. Install dependencies
npm install

# 3. Create .env file (ask Sir Perc for the API keys)
#    Required: OPENROUTER_API_KEY=your_key_here

# 4. Start the backend (orchestrator)
cd orchestrator-server
node --env-file=../.env server.mjs
# → runs on http://localhost:8787

# 5. In another terminal, start the static server
cd orchestrator-server
node smartops-server.mjs
# → runs on http://localhost:3000

# 6. Open http://localhost:3000 in your browser
```

## Project Structure

```
├── public/                    # SmartOps Foundry website
│   ├── index.html             # Landing page (dark SaaS theme)
│   ├── login.html             # Login/signup page
│   ├── agency.html            # Agency dashboard (8 tabs)
│   ├── agency-app.js          # Dashboard logic + auth guard
│   ├── sof-logo.js            # Animated SVG logo component
│   └── command-center/        # Command Center UI
├── orchestrator-server/       # Backend
│   ├── server.mjs             # Main API server (:8787)
│   ├── smartops-server.mjs    # Static server (:3000) + API proxy
│   ├── agency.mjs             # Multi-client agency logic
│   ├── agency-send.mjs        # SMS/email sending
│   ├── agency-research.mjs    # Competitor research
│   └── agency-analysis.mjs    # Business analysis
├── src/                       # LifeOS V2 React app (Vite)
├── package.json
├── vite.config.js
└── .env                        # API keys (NOT in repo — ask Perc)
```

## Working Together

```bash
# Before you start working, always pull latest:
git pull origin main

# After you make changes, push them:
git add -A
git commit -m "describe what you changed"
git push origin main
```

## Key Ports

| Service | Port | Description |
|---------|------|-------------|
| Orchestrator API | 8787 | Main backend (agency, auth, AI) |
| SmartOps static server | 3000 | Serves website + proxies to :8787 |
| Vite dev server | 5173 | React dev server (LifeOS) |
| Hermes webhook | 8644 | Agent-to-agent bridge |
| Hermes API | 8642 | Hermes gateway |

## Agent-to-Agent Bridge

Both agents can send tasks to each other via webhooks:

- **You → Friend:** POST to friend's webhook with HMAC-SHA256 signature
- **Friend → You:** POST to your webhook with HMAC-SHA256 signature

See `orchestrator-server/server.mjs` → `/api/agency/send-to-friend` endpoint.

## Test Account

```
Email: perc@smartopsfoundry.com
Plan: Agency ($697/mo)
```
