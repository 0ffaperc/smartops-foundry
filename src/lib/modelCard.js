// LifeOS V2 — AM Model Scorecard (System V3), structured for the Model Study screen.
// This is a faithful transcription of Sir Perc's model card. DO NOT invent rules
// or alter the model — only display/organize what's here.

export const ONE_LINE =
  'Do not trade the sweep. Trade the asset that refuses the sweep, confirms with MSS/IFVG, and proves itself with fast 1R.';

export const CORE_IDEA = {
  summary:
    'The model builds six cards every morning (NQ BUY, NQ SELL, ES BUY, ES SELL, YM BUY, YM SELL), then asks: which asset is proving the cleanest trade right now? The trade is not the sweep alone — it is the full stack.',
  fullStack: [
    'Best asset/side',
    'Correct anchor sweep/refusal or continuation break',
    'Referee asset does not conflict',
    'IFVG/MSS confirmation',
    'Reasonable MSS candle stop',
    'Fast 1R for hold permission',
  ],
};

export const BASE_STATS = [
  {
    name: 'ONE-BEST-PER-DAY', live: true, maxPerDay: 1,
    trades: 567, days: 567, winRate: 56.97, avgR: 1.115, pf: 3.59, maxDD: -7, maxLossStreak: 7, totalR: 631.98,
  },
  {
    name: 'TWO-MAX-PER-DAY', live: true, maxPerDay: 2,
    trades: 746, days: 567, winRate: 56.84, avgR: 1.132, pf: 3.62, maxDD: -7, maxLossStreak: 6, totalR: 844.21,
  },
  {
    name: 'ALL-SELECTED', live: false, note: 'Research only. NOT live.',
  },
];

export const FAMILIES = [
  {
    id: 'reversal_buy', name: 'Reversal BUY', tone: 'buy',
    plain: 'One asset sells into a low, but the target asset refuses to sell lower. Then the target turns up.',
    need: [
      'A low gets attacked', 'Peer asset sweeps that low', 'Target asset refuses or reclaims that low',
      'Referee asset does not keep breaking lower', 'Target prints bullish MSS or bullish IFVG',
      'Stop goes below bullish MSS candle low',
    ],
    looksLike: 'YM sweeps premarket low. NQ refuses its own premarket low. ES holds or reclaims. NQ prints bullish MSS. → Trade = NQ BUY',
    bestRead: 'Reversal BUY is one of the cleanest model families.',
    data: [
      ['Full overnight reversal buy', 36, 66.67, 1.236, 4.71, 44.50],
      ['Premarket reversal buy', 34, 73.53, 1.203, 5.54, 40.89],
      ['Open range reversal buy', 50, 70.00, 1.303, 5.34, 65.14],
      ['9:45 primary reversal buy', 27, 66.67, 0.676, 3.03, 18.25],
      ['10:15 recheck reversal buy', 66, 63.64, 1.508, 5.15, 99.50],
    ],
  },
  {
    id: 'reversal_sell', name: 'Reversal SELL', tone: 'sell',
    plain: 'One asset buys into a high, but the target asset refuses to buy higher. Then the target turns down.',
    need: [
      'A high gets attacked', 'Peer asset sweeps that high', 'Target asset refuses or rejects that high',
      'Referee asset does not keep breaking higher', 'Target prints bearish MSS or bearish IFVG',
      'Stop goes above bearish MSS candle high',
    ],
    looksLike: 'YM sweeps overnight high. NQ refuses its own overnight high. ES rejects or does not support upside. NQ prints bearish MSS. → Trade = NQ SELL',
    bestRead: 'Reversal SELL works, but is less clean than reversal BUY. 10:15 recheck reversal sell has lower win rate — treat with less trust.',
    data: [
      ['Full overnight reversal sell', 49, 59.18, 1.189, 3.91, 58.25],
      ['Premarket reversal sell', 28, 57.14, 0.500, 2.17, 14.00],
      ['Open range reversal sell', 58, 60.34, 0.996, 3.51, 57.75],
      ['9:45 primary reversal sell', 20, 60.00, 0.850, 3.13, 17.00],
      ['10:15 recheck reversal sell', 70, 48.57, 0.943, 2.83, 66.00],
    ],
  },
  {
    id: 'continuation_buy', name: 'Continuation BUY', tone: 'buy',
    plain: 'The target asset is already acting strong. It holds or reclaims an anchor and keeps going up.',
    need: [
      'Target asset is strongest or becoming strongest', 'Target holds or reclaims an anchor',
      'Peers fail to break down cleanly', 'Referee does not conflict',
      'Target prints bullish MSS or bullish IFVG', 'Stop goes below bullish MSS candle low',
    ],
    looksLike: 'ES holds above ORM high. NQ and YM pull back but fail downside. YM referee stays clean. ES prints bullish MSS. → Trade = ES BUY continuation',
    bestRead: 'Works, but not as clean as reversal BUY. Needs stop quality and fast 1R.',
    data: [
      ['Premarket continuation buy', 13, 53.85, 1.154, 3.50, 15.00],
      ['9:45 primary continuation buy', 31, 51.61, 1.065, 3.20, 33.00],
      ['10:15 recheck continuation buy', 105, 49.52, 0.967, 2.92, 101.59],
    ],
  },
  {
    id: 'continuation_sell', name: 'Continuation SELL', tone: 'sell',
    plain: 'The target asset is already acting weak. It rejects or breaks an anchor and keeps going down.',
    need: [
      'Target asset is weakest or becoming weakest', 'Target rejects or breaks an anchor',
      'Peers fail upside', 'Referee does not conflict',
      'Target prints bearish MSS or bearish IFVG', 'Stop goes above bearish MSS candle high',
    ],
    looksLike: 'NQ rejects ORM high. ES and YM cannot hold higher. YM referee stays clean. NQ prints bearish MSS. → Trade = NQ SELL continuation',
    bestRead: 'Strongest in the 9:45 primary window.',
    data: [
      ['Premarket continuation sell', 17, 52.94, 1.118, 3.38, 19.00],
      ['9:45 primary continuation sell', 55, 65.45, 1.618, 5.68, 89.00],
      ['10:15 recheck continuation sell', 59, 47.46, 0.898, 2.71, 53.00],
    ],
  },
];

export const ROLES = [
  { role: 'Target asset', desc: 'The asset you actually trade. Long: refuses low + confirms up. Short: refuses high + confirms down. Continuation: strongest/weakest and confirms continuation.' },
  { role: 'Peer sweeper', desc: 'The asset that takes liquidity. Long: sweeps a low. Short: sweeps a high. Does the dirty work; target is usually the one that refuses.' },
  { role: 'Referee asset', desc: 'The third asset. Target NQ + peer YM → referee ES. Target ES + peer NQ → referee YM. Target YM + peer NQ → referee ES.' },
];

export const REFEREE_RULES = [
  ['Clean referee', 'Normal', 'ok'],
  ['Dirty referee', 'Risk down / need stronger confirmation (warning, NOT a hard block — appeared on winners too)', 'warn'],
  ['Invalid referee', 'No trade', 'bad'],
];

export const ANCHORS = [
  ['Full overnight high/low', '18:00–09:29 ET'],
  ['Premarket high/low', '07:30–09:00 ET'],
  ['Final 90m high/low', '08:00–09:29 ET (needs more raw-data proof)'],
  ['Open range high/low', '09:30–09:45 ET'],
  ['Primary range', '09:45–10:15 ET'],
  ['Recheck range', '10:15–11:00 ET'],
  ['Rolling 15m high/low', 'Highest high / lowest low of last 15 minutes'],
  ['Rolling 30m high/low', 'Highest high / lowest low of last 30 minutes'],
];

export const WINDOWS = [
  {
    n: 1, name: 'Premarket Context', time: '07:30–09:29', job: 'Build context only. Do not enter yet.',
    best: 'Premarket / overnight sweep-refusal', style: 'No entry',
    notes: 'Mark overnight + premarket high/low. Watch 9:00–9:29 for premarket sweeps. Build the six cards. Premarket sweep is context, not entry.',
    data: [
      ['Reversal BUY', 34, 73.53, 1.203, 5.54, 40.89],
      ['Reversal SELL', 28, 57.14, 0.500, 2.17, 14.00],
      ['Continuation BUY', 13, 53.85, 1.154, 3.50, 15.00],
      ['Continuation SELL', 17, 52.94, 1.118, 3.38, 19.00],
    ],
  },
  {
    n: 2, name: 'Open Read', time: '09:30–09:45', job: 'Only confirm a setup that was already preselected. No pre-open SMT/refusal = no random open trade.',
    best: 'Reversal BUY / SELL only', style: 'Open trade only if preselected',
    notes: 'Confirm a pre-open sweep/refusal with MSS/IFVG. Tested open bucket is reversal only — do not invent open continuation.',
    data: [
      ['Reversal BUY', 50, 70.00, 1.303, 5.34, 65.14],
      ['Reversal SELL', 58, 60.34, 0.996, 3.51, 57.75],
    ],
  },
  {
    n: 3, name: 'Primary Entry', time: '09:45–10:15', job: 'The main AM entry window.',
    best: 'Continuation SELL, Reversal BUY, ORM/overnight anchors', style: 'Normal risk if clean',
    notes: 'Ask: did the open manipulation finish, and which card confirms? Anchors: ORM, premarket, overnight, rolling 15/30.',
    data: [
      ['Continuation SELL', 55, 65.45, 1.618, 5.68, 89.00],
      ['Continuation BUY', 31, 51.61, 1.065, 3.20, 33.00],
      ['Reversal BUY', 27, 66.67, 0.676, 3.03, 18.25],
      ['Reversal SELL', 20, 60.00, 0.850, 3.13, 17.00],
    ],
    anchorData: [
      ['ORM high', 30, 66.67, 1.667, 6.00, 50.00],
      ['Overnight', 22, 72.73, 1.614, 6.92, 35.50],
      ['Premarket', 43, 53.49, 0.773, 2.66, 33.25],
      ['Rolling 15m', 31, 54.84, 0.766, 2.70, 23.75],
      ['Rolling 30m', 7, 85.71, 2.107, 15.75, 14.75],
    ],
  },
  {
    n: 4, name: 'Recheck', time: '10:15–11:00', job: 'Second read only. Not a chase window.',
    best: 'Reversal BUY strongest; continuation can work', style: 'Smaller target first',
    notes: '10:30 can work but is lower quality. Need a new reason, clean stop, and fast 1R. Data is broadly labeled 10:30 recheck — live logic, not overclaimed proof.',
    data: [
      ['Reversal BUY', 66, 63.64, 1.508, 5.15, 99.50],
      ['Continuation BUY', 105, 49.52, 0.967, 2.92, 101.59],
      ['Reversal SELL', 70, 48.57, 0.943, 2.83, 66.00],
      ['Continuation SELL', 59, 47.46, 0.898, 2.71, 53.00],
    ],
  },
  {
    n: 5, name: 'After 10:45', time: '10:45+', job: 'Late caution. No direct one-best sample after 10:45 — do not overtrust.',
    best: 'Not directly proven', style: 'Reduce risk',
    notes: 'Late first setup: reduced risk by default. 1R/2R/BE first. Only hold for 3R/5R if 1R hits fast and referee stays clean.',
    data: [],
  },
];

export const VARIABLE_QUALITY = [
  ['Fast 1R', 'KEEP_STABLE', 'Allows 3R/5R hold', 'good'],
  ['Small MAE before 1R', 'KEEP_STABLE', 'Best runner-quality confirmation', 'good'],
  ['Large MSS stop', 'KEEP_STABLE avoid', 'Risk down or skip', 'bad'],
  ['Slow 1R', 'KEEP_STABLE avoid', 'No runner / protect', 'bad'],
  ['Peer sweep alone', 'CONTEXT_ONLY', 'Needs target refusal + confirmation', 'context'],
  ['Target refusal alone', 'CONTEXT_ONLY', 'Needs MSS/IFVG + stop quality', 'context'],
  ['9:45 confirmation', 'CONTEXT_ONLY', 'Better with fast 1R', 'context'],
  ['Open preselected', 'CONTEXT_ONLY', 'Better with small MAE / fast 1R', 'context'],
  ['10:30 first setup', 'CONTEXT_ONLY', 'Risk down unless clean', 'context'],
  ['Dirty referee', 'TRAP_VARIABLE', 'Do not use alone as hard avoid', 'warn'],
];

export const MANAGEMENT = [
  ['0–2m to 1R', 'Hold possible'],
  ['3–5m to 1R', '1.5R / 2R / BE'],
  ['5m+ to 1R', 'Scalp / BE'],
  ['No 1R', 'Failed'],
];

export const INVALIDATIONS = [
  'Target also sweeps and accepts beyond the level',
  'Referee holds against the setup',
  'Opposite MSS/IFVG appears',
  'Stop is Q4 / large',
  'No confirmation by cutoff',
  'No 1R after entry',
];

export const EXAMPLES = [
  { date: '2023-01-04', title: 'NQ SELL continuation', window: '9:45–10:15 primary', anchor: 'ORM high', model: 'Continuation SELL', target: 'NQ SELL', referee: 'YM clean', confirmation: 'Bearish IFVG/MSS', entry: '09:50 @ 11003.00', stop: '11012.00 (9 pts)', result: '+3R', read: 'Bearish continuation. NQ was the weakest rejecting asset.' },
  { date: '2023-01-06', title: 'NQ SELL reversal', window: '9:30–9:45 open', anchor: 'Overnight high', model: 'Reversal SELL', target: 'NQ SELL', referee: 'ES held high', confirmation: 'Bearish IFVG/MSS', entry: '09:41 @ 10839.25', stop: '10844.75 (5.5 pts)', result: '+3R', read: 'YM took buy-side liquidity. NQ refused & confirmed down → NQ short.' },
  { date: '2023-02-02', title: 'NQ BUY reversal', window: '9:30–9:45 open', anchor: 'Overnight low', model: 'Reversal BUY', target: 'NQ BUY', referee: 'ES held low', confirmation: 'Bullish IFVG/MSS', entry: '09:44 @ 12701.50', stop: '12701.25 (0.25 pts)', result: '+3R', read: 'YM took sell-side liquidity. NQ refused & confirmed up. Caution: tiny exported stop — verify visually.' },
  { date: '2023-03-01', title: 'YM BUY reversal', window: '9:30–9:45 open', anchor: 'Premarket low', model: 'Reversal BUY', target: 'YM BUY', referee: 'ES held low', confirmation: 'Bullish IFVG/MSS', entry: '09:40 @ 32692', stop: '32685 (7 pts)', result: '+3R', read: 'NQ swept, YM refused → YM (not NQ) was the long target.' },
  { date: '2023-05-02', title: 'ES SELL reversal', window: '9:30–9:45 open', anchor: 'Premarket high', model: 'Reversal SELL', target: 'ES SELL', referee: 'YM dirty sweep/reject', confirmation: 'Bearish IFVG/MSS', entry: '09:34 @ 4171.50', stop: '4172.00 (0.5 pts)', result: '+0.75R', read: 'Valid short but dirty referee lowered quality → conservative target.' },
  { date: '2023-05-22', title: 'ES BUY reversal', window: '9:45–10:15 primary', anchor: 'Premarket low', model: 'Reversal BUY', target: 'ES BUY', referee: 'NQ held low', confirmation: 'Bullish IFVG/MSS', entry: '09:46 @ 4211.50', stop: '4210.75 (0.75 pts)', result: '+0.75R', read: '9:45 confirmed the premarket low reversal. ES was the refusing target.' },
  { date: '2023-07-11', title: 'ES SELL continuation', window: '9:45–10:15 primary', anchor: 'Rolling 15m high', model: 'Continuation SELL', target: 'ES SELL', referee: 'NQ clean', confirmation: 'Bearish IFVG/MSS', entry: '09:45 @ 4449.75', stop: '4450.75 (1 pt)', result: '+3R', read: 'Not a reversal. ES was weakest and rejected local structure.' },
  { date: '2024-09-06', title: 'NQ SELL continuation — FAILED', window: '10:15–11:00 recheck', anchor: '10:30 recheck', model: 'Continuation SELL', target: 'NQ SELL', referee: 'ES held high', confirmation: '10:30 recheck', entry: '10:31 @ 18641', stop: '18657.75 (16.75 pts)', result: '-1R', read: 'WARNING example. Recheck setup + large stop can fail. 10:30 = reduced trust until proven.', failed: true },
  { date: '2025-07-15', title: 'YM SELL continuation', window: '10:15–11:00 recheck', anchor: '10:30 recheck', model: 'Continuation SELL', target: 'YM SELL', referee: 'ES held high', confirmation: '10:30 bearish recheck', entry: '10:31 @ 44471', stop: '44474 (3 pts)', result: '+3R', read: 'Same recheck window as the failed NQ example, but cleaner stop & follow-through worked.' },
  { date: '2026-05-14', title: 'ES BUY continuation', window: '9:45–10:15 primary', anchor: 'ORM high', model: 'Continuation BUY', target: 'ES BUY', referee: 'YM clean', confirmation: 'Bullish IFVG/MSS', entry: '09:52 @ 7493.75', stop: '7493.00 (0.75 pts)', result: '+3R', read: 'ES was strongest / reclaiming asset. Continuation long, not sweep reversal.' },
];
