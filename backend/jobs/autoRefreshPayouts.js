import { getPool } from '../services/databaseService.js';

const DATABASES = [
  { db: 'VCP',     prefix: '/api/vcp/payouts'     },
  { db: 'VAN',     prefix: '/api/van/payouts'     },
  { db: 'NEXCHEM', prefix: '/api/nexchem/payouts' },
];

const BASE_URL = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3011}`;

const CONCURRENCY             = Number(process.env.PAYOUT_CONCURRENCY) || 8;              // workers per database
const PAUSE_BETWEEN_RUNS_MS   = Number(process.env.PAYOUT_PAUSE_MS) || 2 * 60 * 1000;     // wait AFTER a run finishes
const INITIAL_DELAY_MS        = 5 * 1000;                                                  // let the server start listening first
const PER_CUSTOMER_TIMEOUT_MS = 60 * 1000;
const MAX_ATTEMPTS            = 3;

let running = false;
let stopped = false;
let timer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recomputeForCustomer = async (db, prefix, cardCode) => {
  const url = `${BASE_URL}${prefix}/customer/${encodeURIComponent(cardCode)}/payout-summary?db=${db}`;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(PER_CUSTOMER_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt); // small backoff
    }
  }
  throw lastErr;
};

// Runs `worker` over `items` with at most `concurrency` in flight
const runPool = async (items, concurrency, worker) => {
  let index = 0;
  const lane = async () => {
    while (!stopped) {
      const i = index++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
};

const refreshDatabase = async ({ db, prefix }) => {
  const pool = getPool(db);
  if (!pool) {
    console.log(`⚠️  [AUTO] No pool for ${db}, skipping`);
    return;
  }

  const { recordset } = await pool.request().query(`
    SELECT CardCode FROM FixCustRebate
    UNION
    SELECT CardCode FROM PerCustRebate
    UNION
    SELECT CardCode FROM IncCustRebate
  `);

  const cardCodes = recordset.map((r) => r.CardCode).filter(Boolean);
  const started = Date.now();
  let ok = 0, failed = 0, done = 0;

  await runPool(cardCodes, CONCURRENCY, async (cardCode) => {
    try {
      await recomputeForCustomer(db, prefix, cardCode);
      ok++;
    } catch (e) {
      failed++;
      console.error(`❌ [AUTO] ${db}/${cardCode}:`, e.message);
    }
    done++;
    if (done % 50 === 0) console.log(`⏳ [AUTO] ${db} ${done}/${cardCodes.length}`);
  });

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`✅ [AUTO] ${db} done in ${secs}s. customers: ${cardCodes.length}, ok: ${ok}, failed: ${failed}`);
};

const refreshAll = async () => {
  if (running) return; // safety net; the loop below never overlaps anyway
  running = true;
  const started = Date.now();
  console.log('⏰ [AUTO] Payout refresh started');

  try {
    // all databases at the same time; one failing doesn't affect the others
    await Promise.allSettled(
      DATABASES.map((target) =>
        refreshDatabase(target).catch((e) => {
          console.error(`❌ [AUTO] ${target.db} failed:`, e.message);
        })
      )
    );
  } finally {
    running = false;
    console.log(`🏁 [AUTO] Payout refresh finished in ${Math.round((Date.now() - started) / 1000)}s`);
  }
};

// Next run is scheduled only AFTER the current one completes -> no overlap, no matter how long it takes
const loop = async () => {
  if (stopped) return;
  try {
    await refreshAll();
  } catch (e) {
    console.error('❌ [AUTO] Unexpected error:', e.message);
  }
  if (!stopped) timer = setTimeout(loop, PAUSE_BETWEEN_RUNS_MS);
};

export const startAutoRefresh = () => {
  stopped = false;
  timer = setTimeout(loop, INITIAL_DELAY_MS); // first full run starts automatically
  console.log(`✅ Auto payout refresh started (concurrency ${CONCURRENCY}, ${PAUSE_BETWEEN_RUNS_MS / 1000}s pause between runs)`);
};

export const stopAutoRefresh = () => {
  stopped = true;
  if (timer) clearTimeout(timer);
};

export const refreshOneCustomer = async (db, cardCode) => {
  const target = DATABASES.find((d) => d.db === db);
  if (!target) throw new Error(`Unknown DB: ${db}`);
  await recomputeForCustomer(target.db, target.prefix, cardCode);
};

export const _internal = { refreshAll, refreshDatabase };