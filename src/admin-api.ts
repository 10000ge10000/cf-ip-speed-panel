import { addBadWord, blockDevice, blockNickname, listBadWords, listRecentUploads, rebuildAggregates, removeBadWord, writePublicCache } from './database';
import { updateDnsForAggregates } from './dns';
import type { Env } from './types';
import { isBearerAuthorized, jsonResponse } from './utils';

const DEFAULT_ROOT_DOMAIN = '6610000.xyz';

export async function handleAdminApi(request: Request, env: Env): Promise<Response> {
  if (!(await isBearerAuthorized(request, env.ADMIN_TOKEN))) {
    return jsonResponse({ success: false, error: '未授权' }, 401);
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/admin/uploads') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 30), 1), 100);
    return jsonResponse({ success: true, uploads: await listRecentUploads(env.DB, limit) });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/block-device') {
    const body = await readBody(request);
    const deviceId = stringOrUndefined(body.device_id);
    if (!deviceId) {
      return jsonResponse({ success: false, error: 'device_id 必填' }, 400);
    }
    await blockDevice(env.DB, deviceId, stringOrUndefined(body.reason) ?? '');
    await rebuildPublicCacheAndDns(env);
    return jsonResponse({ success: true, message: '设备已封禁' });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/block-nickname') {
    const body = await readBody(request);
    const nickname = stringOrUndefined(body.nickname);
    if (!nickname) {
      return jsonResponse({ success: false, error: 'nickname 必填' }, 400);
    }
    await blockNickname(env.DB, nickname, stringOrUndefined(body.reason) ?? '');
    await rebuildPublicCacheAndDns(env);
    return jsonResponse({ success: true, message: '昵称已封禁' });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/bad-words') {
    return jsonResponse({ success: true, bad_words: await listBadWords(env.DB) });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/bad-words') {
    const body = await readBody(request);
    const pattern = stringOrUndefined(body.pattern);
    if (!pattern) {
      return jsonResponse({ success: false, error: 'pattern 必填' }, 400);
    }
    await addBadWord(env.DB, pattern, stringOrUndefined(body.reason) ?? '');
    return jsonResponse({ success: true, message: '词条已添加' });
  }

  if (request.method === 'DELETE' && url.pathname === '/api/admin/bad-words') {
    const pattern = stringOrUndefined(url.searchParams.get('pattern'));
    if (!pattern) {
      return jsonResponse({ success: false, error: 'pattern 必填' }, 400);
    }
    await removeBadWord(env.DB, pattern);
    return jsonResponse({ success: true, message: '词条已删除' });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/rebuild') {
    const aggregates = await rebuildPublicCacheAndDns(env);
    return jsonResponse({ success: true, total: aggregates.length, aggregates });
  }

  return jsonResponse({ success: false, error: '管理 API 路径不存在' }, 404);
}

async function rebuildPublicCacheAndDns(env: Env) {
  const aggregates = await rebuildAggregates(env.DB, env.DNS_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN);
  await writePublicCache(env.SPEED_TEST_KV, aggregates);
  await updateDnsForAggregates(env, aggregates);
  return aggregates;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
