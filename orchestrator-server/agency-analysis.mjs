// agency-analysis.mjs — Business Analyzation Engine
// The AI "consultant" that deeply analyzes a client's business:
// 1. INTAKE — requests necessary paperwork (revenue, costs, employees, hours, niche, trends, seasonality)
// 2. ANALYSIS — complete SWOT + growth opportunity analysis
// 3. GOALS — sets benchmark goals per category (marketing, reputation, sales, ops)
// 4. RANKING — ranks how far they are from each goal (gap analysis)
// 5. ACTION PLAN — daily/weekly/monthly tasks to achieve + maintain each goal
// 6. LOOP — recurring re-analysis to track progress + catch loopholes (no stagnation)
import { readJSON, writeJSON, join, uid, nowISO, aiDraft, CLIENTS_DIR } from './agency.mjs';

const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FAST_MODEL = process.env.AGENCY_MODEL || 'z-ai/glm-5.2';

async function aiAnalyze(systemPrompt, userMessage, maxTokens = 3000) {
  const body = { model: FAST_MODEL, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], max_tokens: maxTokens, temperature: 0.5 };
  const r = await fetch(OR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OR_KEY, 'HTTP-Referer': 'http://localhost:8787', 'X-Title': 'Agency Analysis' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    let txt = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
    if (s !== -1 && e !== -1) {
      const fixed = txt.substring(s, e + 1).replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
      return JSON.parse(fixed);
    }
  } catch {}
  return null;
}

// ---- The intake questionnaire — what the AI needs to analyze the business ----
const INTAKE_QUESTIONS = [
  { id: 'revenue', label: 'Monthly Revenue ($)', type: 'number', placeholder: 'e.g. 45000', required: true,
    help: 'Gross monthly revenue. This is the baseline for all growth goals.' },
  { id: 'costs', label: 'Monthly Costs ($)', type: 'number', placeholder: 'e.g. 30000', required: true,
    help: 'All operating costs: labor, materials, rent, ads, software.' },
  { id: 'employees', label: 'Number of Employees', type: 'number', placeholder: 'e.g. 5', required: true },
  { id: 'hours', label: 'Hours of Operation', type: 'text', placeholder: 'e.g. Mon-Fri 8am-6pm, Sat 9-2', required: true },
  { id: 'niche', label: 'Business Niche / Services', type: 'text', placeholder: 'e.g. HVAC repair, installation, maintenance', required: true,
    help: 'What exactly do you sell? List your main services.' },
  { id: 'leadVolume', label: 'Monthly Leads (inquiries)', type: 'number', placeholder: 'e.g. 80', required: true,
    help: 'How many new customer inquiries do you get per month?' },
  { id: 'closeRate', label: 'Close Rate (%)', type: 'number', placeholder: 'e.g. 35', required: true,
    help: 'What % of leads become paying customers?' },
  { id: 'avgJob', label: 'Average Job Value ($)', type: 'number', placeholder: 'e.g. 650', required: true },
  { id: 'reviews', label: 'Google Review Count + Rating', type: 'text', placeholder: 'e.g. 47 reviews, 4.2 stars', required: true },
  { id: 'seasonality', label: 'Seasonality / Busy Months', type: 'text', placeholder: 'e.g. Summer (AC repairs) is peak, winter is slow', required: true,
    help: 'When is your busy season? When is slow? This drives the marketing calendar.' },
  { id: 'topChannel', label: 'Top Lead Source Currently', type: 'text', placeholder: 'e.g. Google, word of mouth, Facebook', required: true },
  { id: 'biggestChallenge', label: 'Biggest Current Challenge', type: 'text', placeholder: 'e.g. Can\'t keep up in summer, slow in winter', required: true },
  { id: 'goal12mo', label: '12-Month Goal', type: 'text', placeholder: 'e.g. Double revenue to $90k/mo, hire 2 more techs', required: true },
];

export { INTAKE_QUESTIONS };

// ---- Save intake data ----
function saveIntake(clientId, intake) {
  const aPath = join(CLIENTS_DIR, clientId, 'analysis.json');
  const data = readJSON(aPath, { intake: null, analyses: [], goals: [], history: [] });
  data.intake = { ...intake, savedAt: nowISO() };
  writeJSON(aPath, data);
  return data;
}

function getAnalysis(clientId) {
  return readJSON(join(CLIENTS_DIR, clientId, 'analysis.json'), { intake: null, analyses: [], goals: [], history: [] });
}

// ---- Deep business analysis (the "consultant" pass) ----
// Takes the intake data → produces SWOT + growth opportunities + sets benchmark goals + action plans
async function runAnalysis(clientId) {
  const client = readJSON(join(CLIENTS_DIR, clientId, 'profile.json'), null);
  if (!client) return { ok: false, error: 'Client not found' };
  const data = getAnalysis(clientId);
  if (!data.intake) return { ok: false, error: 'No intake data. Complete the intake questionnaire first.' };
  const i = data.intake;

  const sys = `You are a senior business consultant + growth strategist for ${client.name}, a ${client.industry} business. You analyze the business data below and produce a COMPLETE growth analysis. Use industry benchmarks for ${client.industry} businesses to set realistic goals.

Your output MUST be JSON with this structure:
{
  "summary": "2-3 sentence executive summary of the business's current state + biggest opportunity",
  "swot": {
    "strengths": ["3-4 items"],
    "weaknesses": ["3-4 items"],
    "opportunities": ["3-4 items"],
    "threats": ["3-4 items"]
  },
  "goals": [
    {
      "id": "short-kebab-id",
      "category": "Marketing | Reputation | Sales | Operations | Revenue",
      "title": "Clear goal title",
      "current": "current state/value",
      "target": "the benchmark target (specific number)",
      "gap": "what's missing to reach the target",
      "progressPct": 0-100,
      "priority": "high|medium|low",
      "actions": {
        "daily": ["specific tasks to do every day"],
        "weekly": ["specific tasks to do every week"],
        "monthly": ["specific tasks to do every month"]
      },
      "automations": ["automation type keys from the catalog that support this goal, e.g. review_request, social_post"]
    }
  ],
  "marketTrends": ["current trends in the " + client.industry + " industry the business should act on"],
  "seasonalPlan": "how to capitalize on busy season + survive slow season based on their seasonality data",
  "benchmarkComparison": "how this business compares to industry averages for " + client.industry + " (revenue/employee, close rate, review count)"
}

Set 4-6 goals across different categories. Each goal must have SPECIFIC daily/weekly/monthly actions — not vague advice. Tie actions to real automation types from the catalog when possible. Progress % is how close they are to the target NOW (usually 20-60% for a new client).`;

  const user = `BUSINESS: ${client.name} (${client.industry})${client.address ? ', ' + client.address : ''}

INTAKE DATA:
- Monthly Revenue: $${i.revenue || 'N/A'}
- Monthly Costs: $${i.costs || 'N/A'}
- Employees: ${i.employees || 'N/A'}
- Hours: ${i.hours || 'N/A'}
- Niche/Services: ${i.niche || 'N/A'}
- Monthly Leads: ${i.leadVolume || 'N/A'}
- Close Rate: ${i.closeRate || 'N/A'}%
- Average Job Value: $${i.avgJob || 'N/A'}
- Reviews: ${i.reviews || 'N/A'}
- Seasonality: ${i.seasonality || 'N/A'}
- Top Lead Source: ${i.topChannel || 'N/A'}
- Biggest Challenge: ${i.biggestChallenge || 'N/A'}
- 12-Month Goal: ${i.goal12mo || 'N/A'}

Analyze this business and set the growth plan. Be specific and actionable — no generic advice.`;

  const raw = await aiAnalyze(sys, user, 6000);
  const result = parseJson(raw);
  if (!result) return { ok: false, error: 'AI analysis failed to parse', raw };

  // Save the analysis + goals
  const analysis = {
    id: uid(), date: nowISO(),
    summary: result.summary,
    swot: result.swot,
    marketTrends: result.marketTrends,
    seasonalPlan: result.seasonalPlan,
    benchmarkComparison: result.benchmarkComparison,
    goals: result.goals || [],
  };
  data.analyses = data.analyses || [];
  data.analyses.unshift(analysis);
  data.analyses = data.analyses.slice(0, 12); // keep last 12
  data.goals = result.goals || [];
  // history snapshot for progress tracking
  data.history = data.history || [];
  data.history.push({ date: nowISO(), goals: (result.goals || []).map(g => ({ id: g.id, title: g.title, progressPct: g.progressPct })) });
  data.history = data.history.slice(-26); // keep ~6 months weekly
  writeJSON(join(CLIENTS_DIR, clientId, 'analysis.json'), data);

  return { ok: true, analysis };
}

// ---- Progress loop — re-evaluate goal progress + catch loopholes ----
// Runs on a cron. Reads latest CRM/messages data, asks AI to re-rank progress + flag stagnation.
async function runProgressLoop(clientId) {
  const data = getAnalysis(clientId);
  if (!data.goals?.length) return { ok: false, error: 'No goals to track. Run analysis first.' };
  const client = readJSON(join(CLIENTS_DIR, clientId, 'profile.json'), null);
  if (!client) return { ok: false, error: 'Client not found' };

  // Gather current metrics from the agency data
  const contacts = readJSON(join(CLIENTS_DIR, clientId, 'contacts.json'), []);
  const messages = readJSON(join(CLIENTS_DIR, clientId, 'messages.json'), []);
  const leadsThisMonth = contacts.filter(c => c.created?.startsWith(new Date().toISOString().slice(0,7))).length;
  const sentMsgs = messages.filter(m => m.status === 'sent');

  const sys = `You are tracking progress for ${client.name}. Compare the current metrics against the existing goals. For each goal:
1. Re-estimate the progressPct based on the new data.
2. Flag any goal that is STAGNANT (no progress since last check) — these are "loopholes" the business is falling through.
3. Flag any goal where progress went DOWN.
4. Recommend the #1 action to focus on THIS WEEK.

Output JSON: {"goals":[{"id":"","title":"","progressPct":0,"status":"on_track|stagnant|declining","note":""}],"focusThisWeek":"the #1 priority","alerts":["any loopholes or declining goals"]}`;

  const user = `CURRENT GOALS:\n${JSON.stringify(data.goals.map(g => ({id:g.id,title:g.title,category:g.category,target:g.target,current:g.current,progressPct:g.progressPct})),null,2)}\n\nCURRENT METRICS (this month):\n- Total contacts/leads: ${contacts.length}\n- New leads this month: ${leadsThisMonth}\n- Messages sent: ${sentMsgs.length}\n- Last analysis: ${data.analyses[0]?.date || 'none'}\n\nRe-rank progress and flag loopholes.`;

  const raw = await aiAnalyze(sys, user, 1500);
  const result = parseJson(raw);
  if (!result) return { ok: false, error: 'Progress loop parse failed', raw };

  // Update goal progress
  if (result.goals) {
    for (const ug of result.goals) {
      const g = data.goals.find(x => x.id === ug.id);
      if (g) { g.progressPct = ug.progressPct; g.status = ug.status; g.lastNote = ug.note; }
    }
  }
  data.history.push({ date: nowISO(), goals: (data.goals||[]).map(g => ({ id: g.id, title: g.title, progressPct: g.progressPct })), focus: result.focusThisWeek, alerts: result.alerts });
  data.history = data.history.slice(-26);
  writeJSON(join(CLIENTS_DIR, clientId, 'analysis.json'), data);

  return { ok: true, focusThisWeek: result.focusThisWeek, alerts: result.alerts || [], goals: data.goals };
}

export { saveIntake, getAnalysis, runAnalysis, runProgressLoop };
