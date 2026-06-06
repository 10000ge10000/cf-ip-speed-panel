import { listActiveDnsTargets, recentlyUpdatedDns, recordDnsUpdate, type DnsTarget } from './database';
import type { Env, PublicAggregate } from './types';

const DNS_UPDATE_MIN_INTERVAL_MINUTES = 30;

export async function updateDnsForAggregates(env: Env, aggregates: PublicAggregate[]): Promise<void> {
  if (!env.DNS_API_TOKEN || !env.DNS_ZONE_ID) {
    return;
  }

  const desiredTargets = new Set(aggregates.map((aggregate) => targetKey(aggregate)));

  for (const aggregate of aggregates) {
    if (await recentlyUpdatedDns(env.DB, aggregate.hostname, aggregate.record_type, aggregate.ip, DNS_UPDATE_MIN_INTERVAL_MINUTES)) {
      continue;
    }
    await upsertDnsRecord(env, aggregate);
  }

  await deleteStaleDnsRecords(env, desiredTargets);
}

async function upsertDnsRecord(env: Env, aggregate: PublicAggregate): Promise<void> {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${env.DNS_ZONE_ID}/dns_records`;
  const headers = {
    authorization: `Bearer ${env.DNS_API_TOKEN}`,
    'content-type': 'application/json'
  };

  const listUrl = `${endpoint}?type=${encodeURIComponent(aggregate.record_type)}&name=${encodeURIComponent(aggregate.hostname)}`;
  const listResponse = await fetch(listUrl, { headers });
  const listText = await listResponse.text();
  if (!listResponse.ok) {
    await recordDnsUpdate(env.DB, aggregate.hostname, aggregate.record_type, aggregate.ip, 'list_failed', listText);
    return;
  }

  const listData = parseCloudflareList(listText);
  if (!listData) {
    await recordDnsUpdate(env.DB, aggregate.hostname, aggregate.record_type, aggregate.ip, 'list_parse_failed', listText);
    return;
  }
  const recordId = listData.result?.[0]?.id;
  const body = JSON.stringify({
    type: aggregate.record_type,
    name: aggregate.hostname,
    content: aggregate.ip,
    ttl: 300,
    proxied: false,
    comment: `cf-ip-speed-panel auto update: ${aggregate.province_name} ${aggregate.carrier_label}`
  });

  const response = recordId
    ? await fetch(`${endpoint}/${recordId}`, { method: 'PUT', headers, body })
    : await fetch(endpoint, { method: 'POST', headers, body });
  const responseText = await response.text();
  await recordDnsUpdate(env.DB, aggregate.hostname, aggregate.record_type, aggregate.ip, response.ok ? 'success' : 'update_failed', responseText);
}

async function deleteStaleDnsRecords(env: Env, desiredTargets: Set<string>): Promise<void> {
  const activeTargets = await listActiveDnsTargets(env.DB);
  for (const target of activeTargets) {
    if (desiredTargets.has(targetKey(target))) {
      continue;
    }
    await deleteDnsRecord(env, target);
  }
}

async function deleteDnsRecord(env: Env, target: DnsTarget): Promise<void> {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${env.DNS_ZONE_ID}/dns_records`;
  const headers = {
    authorization: `Bearer ${env.DNS_API_TOKEN}`,
    'content-type': 'application/json'
  };
  const listUrl = `${endpoint}?type=${encodeURIComponent(target.record_type)}&name=${encodeURIComponent(target.hostname)}`;
  const listResponse = await fetch(listUrl, { headers });
  const listText = await listResponse.text();
  if (!listResponse.ok) {
    await recordDnsUpdate(env.DB, target.hostname, target.record_type, '', 'delete_list_failed', listText);
    return;
  }

  const listData = parseCloudflareList(listText);
  if (!listData) {
    await recordDnsUpdate(env.DB, target.hostname, target.record_type, '', 'delete_list_parse_failed', listText);
    return;
  }

  const recordIds = (listData.result ?? []).map((record) => record.id).filter(Boolean);
  if (!recordIds.length) {
    await recordDnsUpdate(env.DB, target.hostname, target.record_type, '', 'delete_success', 'record already absent');
    return;
  }

  for (const recordId of recordIds) {
    const response = await fetch(`${endpoint}/${recordId}`, { method: 'DELETE', headers });
    const responseText = await response.text();
    await recordDnsUpdate(env.DB, target.hostname, target.record_type, '', response.ok ? 'delete_success' : 'delete_failed', responseText);
  }
}

function parseCloudflareList(text: string): { result?: Array<{ id: string }> } | null {
  try {
    return JSON.parse(text) as { result?: Array<{ id: string }> };
  } catch {
    return null;
  }
}

function targetKey(target: Pick<DnsTarget, 'hostname' | 'record_type'>): string {
  return `${target.hostname}|${target.record_type}`;
}
