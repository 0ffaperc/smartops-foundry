// agency-research.mjs — Competitor Research Engine
// Takes a prompt (competitor name, niche, location) → web search → AI reasoning → structured analysis.
// Stores results per client. The agent uses intelligent reasoning to rank competitors, find gaps, and recommend moves.
import { readJSON, writeJSON, join, uid, nowISO, aiDraft, CLIENTS_DIR } from './agency.mjs';

const OR_KEY = process.env.OPENROUTER_API_KEY;
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FAST_MODEL = process.env.AGENCY_MODEL || 'z-ai/glm-5.2';

// ---- Web search via Firecrawl (Hermes managed) ----
async function webSearch(query, limit = 5) {
  // Try Firecrawl's search API
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) return [];
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + fcKey },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ['markdown'] } }),
    });
    const j = await r.json();
    return (j.data || []).map(d => ({ url: d.url, title: d.title, content: (d.markdown || d.description || '').slice(0, 3000) }));
  } catch { return []; }
}

// ---- Deep AI reasoning over search results ----
async function aiResearch(systemPrompt, userMessage, maxTokens = 2000) {
  const body = { model: FAST_MODEL, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], max_tokens: maxTokens, temperature: 0.4 };
  const r = await fetch(OR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OR_KEY, 'HTTP-Referer': 'http://localhost:8787', 'X-Title': 'Agency Research' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

// ---- Research a client's competitors ----
// prompt = free text ("find HVAC companies in Dallas TX", or "compare Summit Air vs ABC Heating")
async function researchCompetitors(clientId, prompt) {
  const client = readJSON(join(CLIENTS_DIR, clientId, 'profile.json'), null);
  if (!client) return { ok: false, error: 'Client not found' };

  const niche = client.industry || 'local business';
  const location = client.address || '';
  const businessName = client.name;

  // Step 1: Web search for competitors
  const queries = [
    `${niche} companies near ${location}`,
    `top ${niche} businesses ${location} reviews`,
    prompt.includes('vs') ? prompt : `${prompt} ${niche} ${location}`,
  ];
  let allResults = [];
  for (const q of queries) {
    const r = await webSearch(q, 4);
    allResults = allResults.concat(r);
  }
  // Dedupe by URL
  const seen = new Set();
  const searchResults = allResults.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; }).slice(0, 10);

  // Step 2: AI reasoning — analyze the search results + the prompt
  const sys = `You are a competitive intelligence analyst for ${businessName}, a ${niche} business${location ? ' in ' + location : ''}. The user gave you this research prompt: "${prompt}". You have web search results below. Use INTELLIGENT REASONING to:
1. Identify the top 3-5 competitors (real businesses from the search results or known in the area).
2. For each: estimate their strengths, weaknesses, pricing tier (low/mid/high), review rating (if found), and market position.
3. Find GAPS in the market — what are competitors NOT doing that ${businessName} could capitalize on?
4. Rank ${businessName} against the competition on: online presence, review count, response speed, service offerings, pricing.
5. Recommend 3 specific moves to gain competitive advantage.

Output as JSON:
{"competitors":[{"name":"","strengths":"","weaknesses":"","pricing":"","rating":"","position":""}],"market_gaps":[""],"ranking":{"category":"","score":0,"outOf":10,"note":""},"recommendations":[""]}`;

  const resultsText = searchResults.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.content.slice(0, 800)}`).join('\n\n');
  const user = `Web search results:\n${resultsText || 'No web results found — use your knowledge of the ' + niche + ' industry and ' + location + ' market.'}\n\nNow analyze the competition for ${businessName} and recommend moves.`;

  const raw = await aiResearch(sys, user, 2500);

  // Parse JSON
  let analysis = null;
  try {
    let txt = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
    if (s !== -1 && e !== -1) analysis = JSON.parse(txt.substring(s, e + 1));
  } catch {}

  const research = {
    id: uid(), clientId, prompt, date: nowISO(),
    searchQueries: queries, searchResultsCount: searchResults.length,
    searchResults: searchResults.map(r => ({ url: r.url, title: r.title })),
    analysis: analysis || { raw },
    competitors: analysis?.competitors || [],
    marketGaps: analysis?.market_gaps || [],
    ranking: analysis?.ranking || [],
    recommendations: analysis?.recommendations || [],
  };

  // Save to client's research history
  const rPath = join(CLIENTS_DIR, clientId, 'research.json');
  const history = readJSON(rPath, []);
  history.unshift(research);
  writeJSON(rPath, history.slice(0, 20)); // keep last 20

  return { ok: true, research };
}

function listResearch(clientId) {
  return readJSON(join(CLIENTS_DIR, clientId, 'research.json'), []);
}

export { researchCompetitors, listResearch };
