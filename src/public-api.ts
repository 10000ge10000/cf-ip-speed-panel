import { calibrateIpv6Geo, readAggregates, readPublicCache, rebuildAggregates, recordPublicUpload, registerDevice, validateDevice, writePublicCache } from './database';
import { updateDnsForAggregates } from './dns';
import { detectCarrier, detectProvince, detectServerGeo } from './geo';
import type { Carrier, DirectCheckResult, Env, IpVersion, NodeRecord, PublicUploadPayload, ServerGeo, UploadNodeInput } from './types';
import { buildDataset, isIpv4Address, isIpv6Address, jsonResponse, normalizeCarrier, normalizeIpVersion, sortNodes } from './utils';

const MAX_PUBLIC_UPLOAD_NODES = 50;
const DEFAULT_ROOT_DOMAIN = '6610000.xyz';

export async function handlePublicApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/api/public/register') {
    return handleRegister(request, env);
  }
  if (request.method === 'POST' && url.pathname === '/api/public/upload') {
    return handlePublicUpload(request, env, ctx);
  }
  if (request.method === 'GET' && url.pathname === '/api/public/latest') {
    return handlePublicLatest(env);
  }

  return jsonResponse({ success: false, error: '公开 API 路径不存在' }, 404);
}

export async function rebuildPublicData(env: Env): Promise<void> {
  const aggregates = await rebuildAggregates(env.DB, env.DNS_ROOT_DOMAIN ?? DEFAULT_ROOT_DOMAIN);
  await writePublicCache(env.SPEED_TEST_KV, aggregates);
  await updateDnsForAggregates(env, aggregates);
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ nickname?: unknown; device_name?: unknown }>(request);
  if (!body.ok) {
    return jsonResponse({ success: false, error: body.error }, 400);
  }
  const nickname = stringOrUndefined(body.value.nickname);
  const result = await registerDevice(env.DB, {
    nickname: nickname ?? '',
    deviceName: stringOrUndefined(body.value.device_name)
  });
  if ('error' in result) {
    return jsonResponse({ success: false, error: result.error }, result.status);
  }
  return jsonResponse({ success: true, message: '注册成功，请保存 device_token', ...result });
}

async function handlePublicUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await readJson<PublicUploadPayload>(request);
  if (!body.ok) {
    return jsonResponse({ success: false, error: body.error }, 400);
  }

  const payload = body.value;
  const deviceId = stringOrUndefined(payload.device_id);
  const deviceToken = stringOrUndefined(payload.device_token);
  const nickname = stringOrUndefined(payload.nickname);

  let effectiveDeviceId = deviceId;
  let effectiveNickname = nickname;
  let issuedDeviceToken: string | undefined;

  if (deviceId && deviceToken) {
    const device = await validateDevice(env.DB, deviceId, deviceToken);
    if (!device) {
      return jsonResponse({ success: false, error: '设备凭据无效' }, 401);
    }
    effectiveNickname = device.nickname;
  } else {
    if (!nickname) {
      return jsonResponse({ success: false, error: '首次公开上传必须提供 nickname' }, 400);
    }
    const registered = await registerDevice(env.DB, {
      nickname,
      deviceName: stringOrUndefined(payload.device_name)
    });
    if ('error' in registered) {
      return jsonResponse({ success: false, error: registered.error }, registered.status);
    }
    effectiveDeviceId = registered.device_id;
    effectiveNickname = registered.nickname;
    issuedDeviceToken = registered.device_token;
  }

  const ipVersion = normalizeIpVersion(payload.ip_version);
  const parsed = parsePublicNodes(payload, ipVersion);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, 400);
  }

  const directCheck = parseDirectCheck(payload.direct_check);
  const detectedServerGeo = applyDirectCheckGeo(detectServerGeo(request), directCheck);
  const serverGeo = ipVersion === 'v6'
    ? await calibrateIpv6Geo(env.DB, effectiveDeviceId ?? '', detectedServerGeo)
    : detectedServerGeo;
  const uploadId = await recordPublicUpload(env.DB, {
    deviceId: effectiveDeviceId ?? '',
    nickname: effectiveNickname ?? '',
    ipVersion,
    serverGeo,
    clientRegion: stringOrUndefined(payload.client_region ?? payload.region),
    clientCarrier: normalizeCarrier(payload.client_carrier ?? payload.carrier),
    directCheck,
    nodes: parsed.nodes
  });

  ctx.waitUntil(rebuildPublicData(env));

  return jsonResponse({
    success: true,
    message: '公开上传成功',
    upload_id: uploadId,
    device_id: effectiveDeviceId,
    ...(issuedDeviceToken ? { device_token: issuedDeviceToken } : {}),
    nickname: effectiveNickname,
    ip_version: ipVersion,
    server_geo: serverGeo,
    direct_check: directCheck,
    total: parsed.nodes.length
  });
}

async function handlePublicLatest(env: Env): Promise<Response> {
  const cached = await readPublicCache(env.SPEED_TEST_KV);
  if (cached) {
    return jsonResponse(cached as { success: true } & Record<string, unknown>);
  }
  const aggregates = await readAggregates(env.DB);
  return jsonResponse({
    success: true,
    updated_at: new Date().toISOString(),
    total: aggregates.length,
    aggregates
  });
}

function parsePublicNodes(payload: PublicUploadPayload, ipVersion: IpVersion): { ok: true; nodes: NodeRecord[] } | { ok: false; error: string } {
  if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) {
    return { ok: false, error: 'nodes 必须是非空数组' };
  }

  const inheritedCarrier = normalizeCarrier(payload.carrier);
  const inheritedRegion = stringOrUndefined(payload.region);
  const inheritedSource = stringOrUndefined(payload.source);
  const now = new Date().toISOString();
  const nodes: NodeRecord[] = [];

  for (const [index, item] of payload.nodes.entries()) {
    const parsed = parsePublicNode(item as UploadNodeInput, ipVersion, inheritedCarrier, inheritedRegion, inheritedSource, now, index);
    if (!parsed.ok) {
      return parsed;
    }
    nodes.push(parsed.node);
  }

  return {
    ok: true,
    nodes: sortNodes(nodes, 'speed').slice(0, MAX_PUBLIC_UPLOAD_NODES)
  };
}

function parsePublicNode(
  item: UploadNodeInput,
  ipVersion: IpVersion,
  inheritedCarrier: Carrier,
  inheritedRegion: string | undefined,
  inheritedSource: string | undefined,
  updatedAt: string,
  index: number
): { ok: true; node: NodeRecord } | { ok: false; error: string } {
  const ip = stringOrUndefined(item.ip);
  if (!ip || (ipVersion === 'v6' ? !isIpv6Address(ip) : !isIpv4Address(ip))) {
    return { ok: false, error: `nodes[${index}].ip 必须是合法 ${ipVersion === 'v6' ? 'IPv6' : 'IPv4'} 地址` };
  }

  const port = numberOrDefault(item.port, 443);
  const latency = numberOrDefault(item.latency, Number.NaN);
  const speed = numberOrDefault(item.speed, Number.NaN);
  const loss = numberOrDefault(item.loss, 0);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: `nodes[${index}].port 必须是 1-65535 的整数` };
  }
  if (!Number.isFinite(latency) || latency < 0) {
    return { ok: false, error: `nodes[${index}].latency 必须是非负数字` };
  }
  if (!Number.isFinite(speed) || speed < 0) {
    return { ok: false, error: `nodes[${index}].speed 必须是非负数字` };
  }
  if (!Number.isFinite(loss) || loss < 0 || loss > 100) {
    return { ok: false, error: `nodes[${index}].loss 必须是 0-100 的数字` };
  }

  return {
    ok: true,
    node: {
      ip,
      port,
      carrier: item.carrier ? normalizeCarrier(item.carrier) : inheritedCarrier,
      latency,
      speed,
      loss,
      tls: booleanOrDefault(item.tls, true),
      colo: stringOrUndefined(item.colo),
      region: stringOrUndefined(item.region) ?? inheritedRegion,
      source: stringOrUndefined(item.source) ?? inheritedSource,
      updated_at: updatedAt
    }
  };
}

function parseDirectCheck(value: unknown): DirectCheckResult {
  const source = isRecord(value) ? value : {};
  const routeInterface = stringOrUndefined(source.route_interface);
  const warnings = Array.isArray(source.warnings) ? source.warnings.filter((item): item is string => typeof item === 'string') : [];
  const suspiciousInterface = routeInterface ? /^(tun|utun|clash|mihomo|sing-box|wg|tailscale|zerotier)/i.test(routeInterface) : false;
  const proxySuspected = booleanOrDefault(source.proxy_suspected, false) || suspiciousInterface;

  if (suspiciousInterface && !warnings.includes('路由出口疑似代理接口')) {
    warnings.push('路由出口疑似代理接口');
  }

  return {
    proxy_suspected: proxySuspected,
    route_interface: routeInterface,
    egress_ip: stringOrUndefined(source.egress_ip),
    egress_asn: stringOrUndefined(source.egress_asn),
    egress_country: stringOrUndefined(source.egress_country),
    egress_org: stringOrUndefined(source.egress_org),
    egress_region: stringOrUndefined(source.egress_region),
    egress_city: stringOrUndefined(source.egress_city),
    wan_interface: stringOrUndefined(source.wan_interface),
    warnings
  };
}

function applyDirectCheckGeo(serverGeo: ServerGeo, directCheck: DirectCheckResult): ServerGeo {
  if (directCheck.proxy_suspected || directCheck.egress_country !== 'CN') {
    return serverGeo;
  }

  const province = detectProvince(directCheck.egress_region, directCheck.egress_city);
  if (province.code === 'unknown') {
    return serverGeo;
  }
  const egressAsn = directCheck.egress_asn ? Number(directCheck.egress_asn) : undefined;
  const carrier = directCheck.egress_org ? detectCarrier(directCheck.egress_org) : serverGeo.carrier;

  return {
    ...serverGeo,
    ip: directCheck.egress_ip || serverGeo.ip,
    region: directCheck.egress_region ?? serverGeo.region,
    city: directCheck.egress_city ?? serverGeo.city,
    asOrganization: directCheck.egress_org ?? serverGeo.asOrganization,
    asn: Number.isFinite(egressAsn) ? egressAsn : serverGeo.asn,
    province_code: province.code,
    province_name: province.name,
    carrier
  };
}

async function readJson<T>(request: Request): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return { ok: false, error: '仅支持 application/json' };
  }
  try {
    return { ok: true, value: (await request.json()) as T };
  } catch {
    return { ok: false, error: 'JSON 格式无效' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberOrDefault(value: unknown, fallback: number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return Number(value);
  }
  return fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return fallback;
}
