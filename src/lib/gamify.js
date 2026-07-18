// LifeOS V2 — gamification + calendar helpers for the Trading Journal.
// Weekly goal: 5 daily logs (Mon–Fri) + 1 weekly review = 6/6.
// Monthly goal: hit every trading weekday in the month + 1 monthly review.

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday-based week key (YYYY-MM-DD of that week's Monday)
export function weekStartKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day);
  return ymd(d);
}

export function isWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return d >= 1 && d <= 5;
}

// Build a month grid (array of weeks, each 7 cells; null for padding days)
export function monthGrid(year, month /* 0-based */) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Mon-based leading blanks
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Weekly score: how many of Mon–Fri have a daily log, +1 if a weekly review exists that week
export function weekScore(entries, weekKey) {
  const inWeek = entries.filter((e) => weekStartKey(e.date) === weekKey);
  const dailyDays = new Set(inWeek.filter((e) => isWeekday(e.date)).map((e) => e.date));
  const daily = Math.min(5, dailyDays.size);
  const hasReview = inWeek.some((e) => e.weeklyReview);
  return { daily, max: 5, review: hasReview ? 1 : 0, total: daily + (hasReview ? 1 : 0), totalMax: 6 };
}

// Monthly score: distinct weekday logs this month (capped at # trading weekdays), + monthly review
export function monthScore(entries, year, month) {
  const prefix = `${year}-${pad(month + 1)}`;
  const inMonth = entries.filter((e) => e.date.startsWith(prefix));
  const tradingDays = countWeekdaysInMonth(year, month);
  const loggedWeekdays = new Set(inMonth.filter((e) => isWeekday(e.date)).map((e) => e.date)).size;
  const hasMonthlyReview = inMonth.some((e) => e.monthlyReview);
  return {
    logged: loggedWeekdays,
    tradingDays,
    pct: tradingDays ? Math.round((loggedWeekdays / tradingDays) * 100) : 0,
    review: hasMonthlyReview,
  };
}

export function countWeekdaysInMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  let c = 0;
  for (let d = 1; d <= days; d++) { const w = new Date(year, month, d).getDay(); if (w >= 1 && w <= 5) c++; }
  return c;
}

// Current logging streak (consecutive trading weekdays with a log, walking back from today)
export function currentStreak(entries, today = new Date()) {
  const logged = new Set(entries.map((e) => e.date));
  let streak = 0;
  const d = new Date(today);
  // if today is a weekend, start from last Friday
  for (let i = 0; i < 400; i++) {
    const ds = ymd(d);
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) {
      if (logged.has(ds)) streak++;
      else if (i > 0) break; // allow today to be unlogged without breaking the streak yet
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
