// Mock AI functions — structured to be replaced with OpenRouter API calls later.

export function mockGeneratePlannerQuestions(profile) {
  return [
    { id: 'q1', question: 'What time do you plan to wake up tomorrow?', default: profile?.wakeTime || '06:30' },
    { id: 'q2', question: 'What time will you go to sleep?', default: profile?.sleepTime || '22:30' },
    { id: 'q3', question: 'What fixed commitments do you have tomorrow?', default: profile?.fixedCommitments || '' },
    { id: 'q4', question: 'How many deep work hours do you realistically have?', default: String(profile?.deepWorkHours || 4) },
    { id: 'q5', question: 'What weekly goals matter most right now?', default: '' },
    { id: 'q6', question: 'What must get done tomorrow — no excuses?', default: '' },
    { id: 'q7', question: 'Which good habits have been slipping?', default: profile?.habitsFocus || '' },
    { id: 'q8', question: 'Which bad habits are most likely to ruin the day?', default: profile?.badHabitsToAvoid || '' },
    { id: 'q9', question: 'What should you cut from tomorrow to protect focus?', default: '' },
    { id: 'q10', question: "What is the one non-negotiable for tomorrow?", default: '' },
  ];
}

export function mockBuildPlan(answers) {
  const wakeTime = answers.find((a) => a.id === 'q1')?.value || '06:30';
  const sleepTime = answers.find((a) => a.id === 'q2')?.value || '22:30';
  const deepWork = answers.find((a) => a.id === 'q4')?.value || '4';
  const mustDo = answers.find((a) => a.id === 'q6')?.value || '';
  const nonNegotiable = answers.find((a) => a.id === 'q10')?.value || '';
  const commitments = answers.find((a) => a.id === 'q3')?.value || '';

  const tasks = [
    { time: '06:30', title: 'Wake up & morning routine', type: 'ritual', duration: '60min' },
    { time: '07:30', title: 'Deep work block 1', type: 'deep', duration: `${deepWork}h` },
    ...(commitments ? [{ time: '09:00', title: commitments, type: 'commitment', duration: 'varies' }] : []),
    { time: '12:00', title: 'Lunch & recharge', type: 'break', duration: '45min' },
    { time: '13:00', title: 'Shallow work / admin', type: 'shallow', duration: '90min' },
    ...(mustDo ? [{ time: '15:00', title: mustDo, type: 'must-do', duration: 'focus' }] : []),
    { time: '17:00', title: 'Review & plan tomorrow', type: 'review', duration: '30min' },
    { time: '18:00', title: 'Personal time / exercise', type: 'personal', duration: '90min' },
    { time: '20:00', title: 'Evening wind-down', type: 'ritual', duration: '60min' },
    { time: sleepTime, title: 'Sleep', type: 'sleep', duration: '8h' },
  ];

  return {
    summary: `Tomorrow's plan is built around ${deepWork}h of deep work, with the non-negotiable being: "${nonNegotiable}". Wake at ${wakeTime}, sleep at ${sleepTime}.`,
    schedule: tasks,
    focusAreas: [nonNegotiable, mustDo].filter(Boolean),
    warnings: deepWork < 3 ? ['Deep work hours are low — try to protect at least 3 hours for high-impact work.'] : [],
    morningRitual: 'Hydrate, meditate 10min, review goals, set intention',
    eveningRitual: 'Journal, review day, plan tomorrow, prepare clothes',
  };
}

export function mockCritiquePlan(plan) {
  const warnings = [...(plan.warnings || [])];
  const suggestions = [];

  if (plan.schedule && plan.schedule.length < 6) {
    suggestions.push('Add more structure to your blocks — undefined time leads to distraction.');
  }

  const deepBlock = plan.schedule?.find((b) => b.type === 'deep');
  if (deepBlock) {
    const hours = parseInt(deepBlock.duration);
    if (hours && hours < 3) {
      warnings.push('Your deep work block is under 3 hours — consider extending it.');
    }
  }

  if (plan.schedule?.some((b) => b.type === 'must-do') === false) {
    suggestions.push('No "must-do" item defined — what is the one thing that moves the needle?');
  }

  return {
    score: Math.min(100, 60 + (plan.schedule?.length || 0) * 3 + (plan.focusAreas?.length || 0) * 5),
    warnings,
    suggestions,
    verdict: warnings.length > 0 || suggestions.length > 0
      ? 'Needs improvement — see suggestions below.'
      : 'Solid plan. Ready to execute.',
  };
}

export function mockImprovePlan(plan, critique) {
  const improved = JSON.parse(JSON.stringify(plan));
  improved.warnings = critique.warnings || [];

  if (critique.suggestions?.length > 0) {
    if (!improved.notes) improved.notes = [];
    critique.suggestions.forEach((s) => {
      improved.notes.push(`✓ Addressed: ${s}`);
    });
  }

  if (!improved.schedule?.some((b) => b.type === 'must-do')) {
    improved.schedule.push({
      time: '09:00',
      title: 'Non-negotiable deep work',
      type: 'must-do',
      duration: '2h',
    });
  }

  improved.critiqueScore = critique.score;
  improved.improved = true;
  return improved;
}

export async function mockGenerateReviewSummary(review) {
  await new Promise((r) => setTimeout(r, 500));
  const sentiment = review.mood >= 7 ? 'positive' : review.mood >= 4 ? 'neutral' : 'negative';
  const insights = [];

  if (review.wins) insights.push(`Key win: ${review.wins.split(',')[0]}`);
  if (review.mistakes) insights.push(`Growth area: ${review.mistakes.split(',')[0]}`);
  if (review.energy < 6) insights.push('Energy levels could be improved — check sleep and nutrition.');
  if (review.mood >= 7 && review.energy >= 7) insights.push('High performance state detected — replicate tomorrow\'s conditions.');

  return {
    sentiment,
    summary: `A ${sentiment} day with mood at ${review.mood}/10 and energy at ${review.energy}/10. ${insights.join(' ')}`,
    insights,
    suggestedFocus: review.tomorrowFocus || 'Set a clear intention for tomorrow.',
    score: Math.round((review.mood + review.energy) / 2),
  };
}




