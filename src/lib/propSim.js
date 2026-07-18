// LifeOS V2 — Prop Firm Simulator engine.
// Takes a per-day R series and runs it through a prop firm's rules to answer:
// would you pass, when, and would the account ever blow?
//
// Rules verified Dec 2025 / 2026 for 50K accounts. Always re-check the firm's
// official site — terms change. These are sensible, editable defaults.

export const FIRMS = {
  topstep_50k: {
    name: 'Topstep 50K Combine',
    accountSize: 50000,
    profitTarget: 3000,
    maxTrailingDD: 2000,      // trails the highest *intraday* equity peak
    dailyLossLimit: 1000,
    ddType: 'intraday',       // trailing off peak unrealized equity
    consistencyPct: 50,       // best day must stay < 50% of profit target
    minDays: 2,
    maxContracts: 5,
    note: 'Intraday trailing DD off your highest equity peak. Consistency 50% of target.',
  },
  lucid_50k: {
    name: 'Lucid 50K (LucidTest)',
    accountSize: 50000,
    profitTarget: 3000,
    maxTrailingDD: 2000,      // trails END-OF-DAY balance only
    dailyLossLimit: 600,
    ddType: 'eod',            // more forgiving — only closes count
    consistencyPct: 40,
    minDays: 5,
    maxContracts: 5,
    note: 'EOD trailing DD (intraday swings ignored). Daily loss $600. Consistency 40%.',
  },
  tradeify_50k: {
    name: 'Tradeify 50K (Growth)',
    accountSize: 50000,
    profitTarget: 3000,
    maxTrailingDD: 2000,
    dailyLossLimit: 1100,
    ddType: 'eod',
    consistencyPct: 40,
    minDays: 5,
    maxContracts: 5,
    note: 'EOD trailing DD. Consistency 40%. Verify current Growth-plan numbers on site.',
  },
};

// dailyR: array of { date, R }  (sum of that day's trades in R)
// riskPerTrade$: dollars risked = 1R in dollars
export function simulate(dailyR, firm, riskPerTradeDollars) {
  const oneR = riskPerTradeDollars;
  const start = firm.accountSize;
  let balance = start;             // realized balance (EOD)
  let peak = start;                // highest point (intraday or eod depending on ddType)
  let floor = start - firm.maxTrailingDD;
  const targetBalance = start + firm.profitTarget;

  const curve = [];
  let result = 'in_progress';
  let breachDay = null;
  let passDay = null;
  let tradingDays = 0;
  let bestDayProfit = 0;
  let worstDayLoss = 0;

  for (let i = 0; i < dailyR.length; i++) {
    const day = dailyR[i];
    const dayPnl = day.R * oneR;
    tradingDays += 1;

    // intraday DD model: assume the day's low touches (balance + min(0, dayPnl)) — conservative
    // For a single aggregated R/day we approximate intraday low as the day's loss extent.
    const intradayLow = balance + Math.min(0, dayPnl);
    const eodBalance = balance + dayPnl;

    // daily loss limit breach
    if (dayPnl <= -firm.dailyLossLimit) {
      result = 'failed_daily_loss';
      breachDay = day.date;
      curve.push({ date: day.date, balance: eodBalance, floor, peak });
      break;
    }

    // trailing DD breach
    const checkPoint = firm.ddType === 'intraday' ? intradayLow : eodBalance;
    if (checkPoint <= floor) {
      result = 'failed_drawdown';
      breachDay = day.date;
      curve.push({ date: day.date, balance: eodBalance, floor, peak });
      break;
    }

    // commit the day
    balance = eodBalance;
    bestDayProfit = Math.max(bestDayProfit, dayPnl);
    worstDayLoss = Math.min(worstDayLoss, dayPnl);

    // update peak + trailing floor
    const peakRef = firm.ddType === 'intraday' ? Math.max(peak, balance, intradayLow >= 0 ? balance : peak) : balance;
    if (balance > peak) {
      peak = balance;
      // floor trails up but never beyond start+target (then it locks)
      floor = Math.min(peak - firm.maxTrailingDD, targetBalance - firm.maxTrailingDD);
    }

    curve.push({ date: day.date, balance: +balance.toFixed(0), floor: +floor.toFixed(0), peak: +peak.toFixed(0) });

    // pass check (must also meet min days + consistency)
    if (balance >= targetBalance && tradingDays >= firm.minDays) {
      // consistency: best day must be < consistencyPct% of total profit
      const totalProfit = balance - start;
      const consistencyOK = bestDayProfit <= (firm.consistencyPct / 100) * totalProfit;
      if (consistencyOK) {
        result = 'passed';
        passDay = day.date;
        break;
      }
      // else keep trading to dilute the big day
    }
  }

  const finalProfit = balance - start;
  const consistencyCap = (firm.consistencyPct / 100) * Math.max(1, finalProfit);
  return {
    result,
    breachDay,
    passDay,
    tradingDays,
    finalBalance: +balance.toFixed(0),
    finalProfit: +finalProfit.toFixed(0),
    bestDayProfit: +bestDayProfit.toFixed(0),
    worstDayLoss: +worstDayLoss.toFixed(0),
    consistencyOK: bestDayProfit <= consistencyCap,
    consistencyCap: +consistencyCap.toFixed(0),
    curve,
    targetBalance,
  };
}

// Aggregate the v3 day rows (each has result_R) into one R per calendar day.
export function toDailyR(days) {
  const map = new Map();
  days.forEach((d) => {
    const r = parseFloat(d.result_R) || 0;
    map.set(d.date, (map.get(d.date) || 0) + r);
  });
  return [...map.entries()].map(([date, R]) => ({ date, R })).sort((a, b) => a.date.localeCompare(b.date));
}
