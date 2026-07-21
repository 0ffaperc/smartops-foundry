// SmartOps Foundry — Chatbot backend endpoints
// Two endpoints:
//   /api/chat/help  — public, uses DeepSeek free model (no auth needed)
//   /api/chat/jarvis — private, uses OpenRouter (auth required)

import { request as httpsRequest } from 'node:https';

const HELP_SYSTEM = `You are the SmartOps Foundry assistant. SmartOps Foundry is an AI automation platform for service businesses (HVAC, roofing, plumbing, landscaping, electrical). It offers 22+ automation types: missed call text-back, appointment reminders, review requests, quote follow-ups, nurture sequences, seasonal campaigns, referral requests, and more. Key features: AI drafts every message, human approves before sending, multi-client dashboard, SMS + email channels, simulation mode (no provider needed). Pricing: Starter $97/mo (1 business), Professional $297/mo (5 businesses), Agency $697/mo (unlimited). Be helpful, concise, and friendly. Answer questions about features, pricing, setup, and how things work. If asked something unrelated, gently redirect to SmartOps topics.`;

const JARVIS_SYSTEM = `You are Jarvis, the personal AI site builder assistant for Sir Perc (the owner of SmartOps Foundry). You are connected via OpenRouter and have deep knowledge of web development. The site is built with vanilla HTML/CSS/JS + a Node.js backend (smartops-server.mjs proxying to orchestrator-server/server.mjs on port 8787). Public files live in /public. Help Sir Perc plan changes, write code snippets, debug issues, and brainstorm improvements for the SmartOps Foundry website. Be concise but thorough. Call him "sir" occasionally. You are British, professional, and slightly witty.`;

async function callOpenAICompatible(url, apiKey, model, messages, maxTokens = 1024) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = httpsRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          // Strip any leading whitespace (OpenRouter sometimes sends leading newlines)
          const trimmed = data.trimStart();
          const parsed = JSON.parse(trimmed);
          const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || '';
          resolve(content);
        } catch (e) {
          reject(new Error('Failed to parse AI response: ' + data.slice(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

export async function handleChatRoutes(req, res, url, body) {
  const path = url.pathname;

  // POST /api/chat/help — public help bot (DeepSeek free)
  if (req.method === 'POST' && path === '/api/chat/help') {
    const userMsg = body?.message || '';
    if (!userMsg) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'Message required' }));
      return true;
    }
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, reply: "I'm not connected to an AI backend yet. Please set OPENROUTER_API_KEY to enable me." }));
        return true;
      }
      const reply = await callOpenAICompatible(
        'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        'deepseek/deepseek-chat-v3.1',
        [
          { role: 'system', content: HELP_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        512
      );
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, reply }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, reply: "I'm having trouble connecting right now. Please try again in a moment, or email us at hello@smartopsfoundry.com" }));
    }
    return true;
  }

  // POST /api/chat/jarvis — private bot (OpenRouter, auth required)
  if (req.method === 'POST' && path === '/api/chat/jarvis') {
    const userMsg = body?.message || '';
    if (!userMsg) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'Message required' }));
      return true;
    }
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, reply: "OpenRouter API key not configured, sir. Set OPENROUTER_API_KEY in the environment to enable me." }));
        return true;
      }
      const history = body?.history || [];
      const messages = [
        { role: 'system', content: JARVIS_SYSTEM },
        ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
      ];
      // Only add the current message if it's not already the last in history
      const last = history[history.length - 1];
      if (!last || last.content !== userMsg) {
        messages.push({ role: 'user', content: userMsg });
      }
      const reply = await callOpenAICompatible(
        'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        'deepseek/deepseek-chat-v3.1',
        messages,
        1024
      );
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, reply }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, reply: `I hit a snag, sir: ${e.message}. Please try again.` }));
    }
    return true;
  }

  return false;
}
