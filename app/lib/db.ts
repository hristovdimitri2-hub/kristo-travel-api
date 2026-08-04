import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;

function getDb(): Client {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || url.startsWith('file:')) {
    throw new Error('Turso database URL not configured. Set TURSO_DATABASE_URL.');
  }

  _client = createClient({ url, authToken });
  return _client;
}

export { getDb };

// ── Used tx hash (replay protection) ──────────────────────────────
export async function isTxHashUsed(txHash: string): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT 1 FROM UsedTransaction WHERE txHash = ?',
    args: [txHash],
  });
  return result.rows.length > 0;
}

export async function recordUsedTx(
  txHash: string,
  endpoint: string,
  fromAddress: string,
  amountRaw: number,
  blockNumber: number
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO UsedTransaction (txHash, endpoint, fromAddress, amountRaw, blockNumber, consumedAt)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [txHash, endpoint, fromAddress, amountRaw, blockNumber, new Date().toISOString()],
  });
}

// ── Sales ─────────────────────────────────────────────────────────
export async function recordSale(
  txHash: string,
  endpoint: string,
  fromAddress: string,
  amountUsdc: number,
  blockNumber: number
): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO Sale (id, txHash, endpoint, fromAddress, amountUsdc, blockNumber, consumedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, txHash, endpoint, fromAddress, amountUsdc, blockNumber, new Date().toISOString()],
  });
  return id;
}

export async function getRecentSales(limit = 20): Promise<any[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM Sale ORDER BY consumedAt DESC LIMIT ?',
    args: [limit],
  });
  return result.rows;
}

export async function getSalesStats(): Promise<{
  total: number;
  totalUsdc: number;
  last24h: number;
  last24hUsdc: number;
  last7d: number;
  last7dUsdc: number;
  uniqueWallets: number;
}> {
  const db = getDb();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString();
  const weekAgo = new Date(now.getTime() - 604800000).toISOString();

  const [totalR, last24R, last7R, walletsR] = await Promise.all([
    db.execute('SELECT COUNT(*) as c, COALESCE(SUM(amountUsdc), 0) as s FROM Sale'),
    db.execute({ sql: 'SELECT COUNT(*) as c, COALESCE(SUM(amountUsdc), 0) as s FROM Sale WHERE consumedAt >= ?', args: [yesterday] }),
    db.execute({ sql: 'SELECT COUNT(*) as c, COALESCE(SUM(amountUsdc), 0) as s FROM Sale WHERE consumedAt >= ?', args: [weekAgo] }),
    db.execute('SELECT COUNT(DISTINCT fromAddress) as c FROM Sale'),
  ]);

  return {
    total: Number(totalR.rows[0].c),
    totalUsdc: Number(totalR.rows[0].s),
    last24h: Number(last24R.rows[0].c),
    last24hUsdc: Number(last24R.rows[0].s),
    last7d: Number(last7R.rows[0].c),
    last7dUsdc: Number(last7R.rows[0].s),
    uniqueWallets: Number(walletsR.rows[0].c),
  };
}

// ── Wallet payment count (for volume discount) ───────────────────
export async function getWalletPaymentCount(wallet: string): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT COUNT(*) as c FROM Sale WHERE fromAddress = ?',
    args: [wallet.toLowerCase()],
  });
  return Number(result.rows[0].c);
}

// ── Trial credits ────────────────────────────────────────────────
// We use a dedicated table for trial credits since the Credit table is for refunds
export async function ensureTrialTable(): Promise<void> {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS TrialCredits (
    walletAddress TEXT PRIMARY KEY,
    creditsRemaining INTEGER NOT NULL DEFAULT 10,
    createdAt DATETIME NOT NULL,
    lastResetDate TEXT NOT NULL
  )`);
}

export async function getTrialCredits(wallet: string): Promise<number> {
  const db = getDb();
  await ensureTrialTable();
  const today = new Date().toISOString().split('T')[0];

  const result = await db.execute({
    sql: 'SELECT creditsRemaining, lastResetDate FROM TrialCredits WHERE walletAddress = ?',
    args: [wallet.toLowerCase()],
  });

  if (result.rows.length === 0) {
    // New wallet — create with full trial credits
    await db.execute({
      sql: 'INSERT INTO TrialCredits (walletAddress, creditsRemaining, createdAt, lastResetDate) VALUES (?, ?, ?, ?)',
      args: [wallet.toLowerCase(), 10, new Date().toISOString(), today],
    });
    return 10;
  }

  const row = result.rows[0] as any;
  if (row.lastResetDate !== today) {
    // Reset daily
    await db.execute({
      sql: 'UPDATE TrialCredits SET creditsRemaining = 10, lastResetDate = ? WHERE walletAddress = ?',
      args: [today, wallet.toLowerCase()],
    });
    return 10;
  }

  return Number(row.creditsRemaining);
}

export async function useTrialCredit(wallet: string): Promise<boolean> {
  const db = getDb();
  await ensureTrialTable();
  const today = new Date().toISOString().split('T')[0];
  const w = wallet.toLowerCase();

  // Check current credits
  const result = await db.execute({
    sql: 'SELECT creditsRemaining, lastResetDate FROM TrialCredits WHERE walletAddress = ?',
    args: [w],
  });

  let credits: number;
  if (result.rows.length === 0) {
    // New wallet
    await db.execute({
      sql: 'INSERT INTO TrialCredits (walletAddress, creditsRemaining, createdAt, lastResetDate) VALUES (?, ?, ?, ?)',
      args: [w, 9, new Date().toISOString(), today], // Start with 10, use 1 = 9 remaining
    });
    return true;
  }

  const row = result.rows[0] as any;
  if (row.lastResetDate !== today) {
    // Reset daily — give fresh 10 credits
    await db.execute({
      sql: 'UPDATE TrialCredits SET creditsRemaining = 9, lastResetDate = ? WHERE walletAddress = ?',
      args: [today, w],
    });
    return true;
  }

  credits = Number(row.creditsRemaining);
  if (credits <= 0) {
    return false;
  }

  await db.execute({
    sql: 'UPDATE TrialCredits SET creditsRemaining = ? WHERE walletAddress = ?',
    args: [credits - 1, w],
  });
  return true;
}
