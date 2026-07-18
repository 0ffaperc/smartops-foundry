const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function buildLifeOSContext({ goals = [], tasks = [], habits = [], habitLogs = [], reviews = [], today }) {
  const activeGoals = goals.filter((g) => g.status === 'active' && g.title !== 'Become a Senior Architect');
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const todaysTasks = tasks.filter((t) => t.date === today);
  const todayDone = todaysTasks.filter((t) => t.status === 'done');
  const activeHabits = habits.filter((h) => h.active);
  const todaysHabitLogs = habitLogs.filter((l) => l.date === today && l.completed);
  const recentReviews = [...reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return {
    today,
    goals: {
      activeCount: activeGoals.length,
      active: activeGoals.slice(0, 20).map((g) => ({
        id: g.id,
        level: g.level,
        title: g.title,
        targetResult: g.targetResult,
        deadline: g.deadline,
        parentId: g.parentId,
      })),
    },
    tasks: {
      openCount: openTasks.length,
      todayTotal: todaysTasks.length,
      todayDone: todayDone.length,
      openTop: openTasks.slice(0, 30).map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        priority: t.priority,
        status: t.status,
        goalId: t.goalId,
      })),
    },
    habits: {
      activeCount: activeHabits.length,
      active: activeHabits.map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        completedToday: todaysHabitLogs.some((l) => l.habitId === h.id),
      })),
    },
    recentReviews: recentReviews.map((r) => ({
      date: r.date,
      mood: r.mood,
      energy: r.energy,
      wins: r.wins,
      mistakes: r.mistakes,
      tomorrowFocus: r.tomorrowFocus,
    })),
  };
}

export function buildOrchestratorSystemPrompt(lifeContext, mode = 'coach') {
  return `You are the LifeOS Orchestrator Agent.

Your sole mission is to help the user achieve their goals and be genuinely useful.

Act like a normal chatbot. Answer the user's actual message. Use LifeOS context only when helpful.

Rules:
- Be direct, practical, and specific.
- Ask follow-up questions when context is missing.
- Do not repeat default templates.
- Do not force old sample goals unless asked.
- Use TASK: lines only when useful.
- For app changes, give a safe implementation plan and ask for approval.

LifeOS context:
${JSON.stringify(lifeContext, null, 2)}`;
}

export async function callOpenRouterChat({ apiKey, model, messages, temperature = 0.35, maxTokens = 1000 }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'z-ai/glm-5.2',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const text = await response.text();

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Backend returned non-JSON: ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Backend request failed with status ${response.status}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('The backend returned an empty response.');

  return content;
}

export function localOrchestratorReply(userMessage, lifeContext, mode = 'coach') {
  const msg = (userMessage || '').trim();
  const low = msg.toLowerCase();

  if (!msg) return 'I’m here. Tell me what you want help with.';
  if (low === 'hi' || low === 'hello' || low === 'hey' || low === 'yo' || low.startsWith('yo ')) {
    return 'Yo. I’m here. What are we working on right now?';
  }
  if (low.includes('plan') && low.includes('day')) {
    return 'I can plan your day. Give me wake time, sleep target, fixed commitments, energy 1-10, and top 3 tasks.';
  }
  if (low.includes('task')) {
    return 'Send me the messy task list and I’ll clean it up.';
  }
  if (low.includes('app') || low.includes('site') || low.includes('change') || low.includes('code')) {
    return 'Tell me the exact app change you want. I’ll turn it into a safe implementation plan first.';
  }
  return 'I get you. What do you want help with right now?';
}



