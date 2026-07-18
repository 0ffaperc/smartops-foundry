// LifeOS V2 — Backtest data loader for System V3 (NQ/ES/YM).
// Loads the playbook CSVs from /v3data, parses them, and derives week-level
// stats (the pack ships month-level; we compute weeks from the daily rows).
//
// Designed to grow: add more modes (two-max, all-selected) by loading more CSVs
// here and exposing them through the same shape.

// --- tiny robust CSV parser (handles quoted fields w/ commas) ---------------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else { field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// --- ISO week key (YYYY-Www) ------------------------------------------------
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;          // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3);        // Thursday of this week
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// --- aggregate a set of daily rows into a stats block -----------------------
export function aggregate(rows) {
  const trades = rows.length;
  const wins = rows.filter((r) => num(r.result_R) > 0).length;
  const totalR = rows.reduce((s, r) => s + num(r.result_R), 0);
  const grossWin = rows.filter((r) => num(r.result_R) > 0).reduce((s, r) => s + num(r.result_R), 0);
  const grossLoss = Math.abs(rows.filter((r) => num(r.result_R) < 0).reduce((s, r) => s + num(r.result_R), 0));
  // running equity + max drawdown
  let eq = 0, peak = 0, maxDD = 0, streak = 0, worstStreak = 0;
  rows.forEach((r) => {
    const R = num(r.result_R);
    eq += R; peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq - peak);
    if (R < 0) { streak += 1; worstStreak = Math.max(worstStreak, streak); } else { streak = 0; }
  });
  return {
    trades,
    wins,
    winPct: trades ? (wins / trades) * 100 : 0,
    totalR: +totalR.toFixed(2),
    avgR: trades ? +(totalR / trades).toFixed(2) : 0,
    pf: grossLoss ? +(grossWin / grossLoss).toFixed(2) : (grossWin ? Infinity : 0),
    maxDD: +maxDD.toFixed(2),
    maxLossStreak: worstStreak,
  };
}

function groupBy(rows, keyFn) {
  const m = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
}

// --- main loader ------------------------------------------------------------
const MODE_FILES = {
  oneBest: 'day_by_day_one_best_full.csv',
  // future: twoMax: 'day_by_day_two_max_full.csv',
  // future: allSelected: 'day_by_day_all_selected_full.csv',
};

export async function loadBacktest(mode = 'oneBest') {
  const file = MODE_FILES[mode] || MODE_FILES.oneBest;
  const res = await fetch(`/v3data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const text = await res.text();
  const days = rowsToObjects(parseCSV(text)).filter((r) => r.date);

  // attach week key + numeric result
  days.forEach((d) => { d._week = isoWeekKey(d.date); d._month = d.date.slice(0, 7); d._R = num(d.result_R); });

  // equity curve (cumulative R by date)
  let cum = 0;
  const equity = days.map((d) => { cum += d._R; return { date: d.date, R: d._R, cumR: +cum.toFixed(2) }; });

  // monthly + weekly aggregates
  const monthly = [...groupBy(days, (d) => d._month).entries()]
    .map(([month, rows]) => ({ key: month, ...aggregate(rows) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const weekly = [...groupBy(days, (d) => d._week).entries()]
    .map(([week, rows]) => ({ key: week, ...aggregate(rows) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // breakdowns
  const byAssetSide = [...groupBy(days, (d) => `${d.asset_to_trade_today} ${d.side_to_trade}`).entries()]
    .map(([key, rows]) => ({ key, ...aggregate(rows) })).sort((a, b) => b.totalR - a.totalR);
  const byModel = [...groupBy(days, (d) => d.entry_model).entries()]
    .map(([key, rows]) => ({ key, ...aggregate(rows) })).sort((a, b) => b.totalR - a.totalR);
  const byWindow = [...groupBy(days, (d) => d.playbook_window).entries()]
    .map(([key, rows]) => ({ key, ...aggregate(rows) })).sort((a, b) => b.totalR - a.totalR);
  const bySpeed = [...groupBy(days, (d) => d.hit_1R_speed_bucket).entries()]
    .map(([key, rows]) => ({ key, ...aggregate(rows) })).sort((a, b) => b.totalR - a.totalR);

  return {
    mode,
    days,
    overall: aggregate(days),
    equity,
    monthly,
    weekly,
    byAssetSide,
    byModel,
    byWindow,
    bySpeed,
    firstDate: days[0]?.date,
    lastDate: days[days.length - 1]?.date,
  };
}

// --- reflection notes persistence (per day, keyed by mode+date) -------------
const NOTES_KEY = 'lifeos_backtest_notes';

export function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { return {}; }
}
export function saveNote(mode, date, note) {
  const all = loadNotes();
  all[`${mode}|${date}`] = { ...note, updatedAt: new Date().toISOString() };
  localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  return all;
}
export function getNote(notes, mode, date) {
  return notes[`${mode}|${date}`] || {};
}
