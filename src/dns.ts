import { recentlyUpdatedDns, recordDnsUpdate } from './database';
import type { Env, PublicAggregate } from './types';

const DNS_UPDATE_MIN_INTERVAL_MINUTES = 30;

export async function updateDnsForAggregates(env: Env, aggregates: PublicAggregate[]): Promise<void> {
  if (!env.DNS_API_TOKEN || !env.DNS_ZONE_ID) {
    return;
  }

  for (const aggregate of aggregates) {
    if (await recentlyUpdatedDns(env.DB, aggregate.hostname, DNS_UPDATE_MIN_INTERVAL_MINUTES)) {
      continue;
    }
    await upsertDnsRecord(env, aggregate);
  }
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

  const listData = JSON.parse(listText) as { result?: Array<{ id: string }> };
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
