import type { ApiError, ApiSuccess, Carrier, IpVersion, NodeRecord, NodesDataset, NodesStats } from './types';

const CARRIER_LABELS: Record<Carrier, string> = {
  ct: '中国电信',
  cm: '中国移动',
  cu: '中国联通',
  other: '其他'
};

export function jsonResponse<T>(payload: ApiSuccess<T> | ApiError, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function textResponse(text: string, status = 404): Response {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function normalizeCarrier(value: unknown): Carrier {
  if (value === 'ct' || value === 'cm' || value === 'cu' || value === 'other') {
    return value;
  }
  return 'other';
}

export function carrierLabel(carrier: Carrier): string {
  return CARRIER_LABELS[carrier];
}

export function isCarrier(value: string): value is Carrier {
  return value === 'ct' || value === 'cm' || value === 'cu' || value === 'other';
}

export function normalizeIpVersion(value: unknown): IpVersion {
  return value === 'v6' ? 'v6' : 'v4';
}

export function parseLimit(value: string | null, fallback: number, max: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function buildStats(nodes: NodeRecord[]): NodesStats {
  const stats: NodesStats = {
    ct: 0,
    cm: 0,
    cu: 0,
    other: 0,
    best_speed: 0,
    best_latency: 0
  };

  for (const node of nodes) {
    stats[node.carrier] += 1;
    stats.best_speed = Math.max(stats.best_speed, node.speed);
    if (stats.best_latency === 0 || node.latency < stats.best_latency) {
      stats.best_latency = node.latency;
    }
  }

  return stats;
}

export function buildDataset(nodes: NodeRecord[], updatedAt: string): NodesDataset {
  return {
    updated_at: updatedAt,
    total: nodes.length,
    stats: buildStats(nodes),
    nodes
  };
}

export function sortNodes(nodes: NodeRecord[], sort: string | null): NodeRecord[] {
  const sorted = [...nodes];
  if (sort === 'latency') {
    sorted.sort((left, right) => left.latency - right.latency || right.speed - left.speed);
    return sorted;
  }
  sorted.sort((left, right) => right.speed - left.speed || left.latency - right.latency);
  return sorted;
}

export function isIpAddress(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

export function isIpv4Address(value: string): boolean {
  return isIpv4(value);
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const number = Number(part);
    return number >= 0 && number <= 255 && String(number) === String(Number(part));
  });
}

function isIpv6(value: string): boolean {
  const address = value.trim();
  if (!address.includes(':') || address.length > 45 || address.includes('[') || address.includes(']') || address.includes('%')) {
    return false;
  }
  try {
    const parsed = new URL(`http://[${address}]/`);
    return parsed.hostname.includes(':');
  } catch {
    return false;
  }
}

export function isIpv6Address(value: string): boolean {
  return isIpv6(value);
}

export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

export async function isBearerAuthorized(request: Request, token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) {
    return false;
  }
  return timingSafeEqual(header.slice(prefix.length).trim(), token);
}
