import type { HistorySummary, NodesDataset } from './types';

const LATEST_KEY = 'nodes:latest';
const HISTORY_INDEX_KEY = 'history:index';
const META_LAST_UPLOAD_KEY = 'meta:last_upload';
const HISTORY_PREFIX = 'nodes:history:';
const HISTORY_LIMIT = 20;

export async function readLatest(kv: KVNamespace): Promise<NodesDataset | null> {
  return kv.get<NodesDataset>(LATEST_KEY, 'json');
}

export async function readRawLatest(kv: KVNamespace): Promise<string | null> {
  return kv.get(LATEST_KEY, 'text');
}

export async function writeLatest(kv: KVNamespace, dataset: NodesDataset, summary: HistorySummary): Promise<void> {
  const historyKey = `${HISTORY_PREFIX}${summary.uploaded_at}`;
  const history = await readHistoryIndex(kv);
  const nextHistory = [summary, ...history.filter((item) => item.key !== historyKey)].slice(0, HISTORY_LIMIT);

  await kv.put(LATEST_KEY, JSON.stringify(dataset));
  await kv.put(historyKey, JSON.stringify(dataset));
  await kv.put(META_LAST_UPLOAD_KEY, JSON.stringify(summary));
  await kv.put(HISTORY_INDEX_KEY, JSON.stringify(nextHistory));
}

export async function readHistoryIndex(kv: KVNamespace): Promise<HistorySummary[]> {
  const history = await kv.get<HistorySummary[]>(HISTORY_INDEX_KEY, 'json');
  return Array.isArray(history) ? history : [];
}

export async function checkKv(kv: KVNamespace): Promise<boolean> {
  try {
    await kv.get(META_LAST_UPLOAD_KEY, 'text');
    return true;
  } catch {
    return false;
  }
}
