import type { Carrier, DirectCheckResult, NodeRecord, PublicAggregate, RegisterResult, ServerGeo } from './types';
import { carrierLabel, isIpv6Address } from './utils';

const DEVICE_TOKEN_BYTES = 24;
const AGGREGATE_WINDOW_HOURS = 24;
const REUSABLE_NICKNAME = '一万AI分享';
const NICKNAME_DENY_PATTERNS = [
  /习近平|毛泽东|邓小平|江泽民|胡锦涛|李强|蔡英文|赖清德|川普|特朗普|拜登/i,
  /共产党|国民党|民进党|台独|港独|藏独|疆独|法轮功|六四|天安门/i,
  /操你|傻逼|煞笔|妈逼|尼玛|去死|垃圾|废物|畜生/i,
  /黄片|色情|约炮|裸聊|嫖|卖淫|援交|强奸|乱伦|自慰|肛交|口交/i,
  /admin|administrator|root|official|system|support|cloudflare|官方|管理员|客服|系统|站长/i
];

interface RegisterInput {
  nickname: string;
  deviceName?: string;
}

interface UploadInput {
  deviceId: string;
  nickname: string;
  serverGeo: ServerGeo;
  clientRegion?: string;
  clientCarrier?: Carrier;
  directCheck: DirectCheckResult;
  nodes: NodeRecord[];
}

interface StoredDevice {
  id: string;
  user_id: string;
  token_hash: string;
  nickname: string;
  status: string;
}

interface AggregateRow {
  key: string;
  province_code: string;
  province_name: string;
  carrier: Carrier;
  hostname: string;
  ip: string;
  port: number;
  record_type: 'A' | 'AAAA';
  speed: number;
  latency: number;
  loss: number;
  colo?: string;
  nickname: string;
  upload_id: string;
  updated_at: string;
}

export async function registerDevice(db: D1Database, input: RegisterInput): Promise<RegisterResult | { error: string; status: number }> {
  const nickname = normalizeNickname(input.nickname);
  if (!nickname) {
    return { error: '昵称不能为空，只能包含中文、英文、数字、下划线和短横线，长度 2-24 个字符', status: 400 };
  }
  if (isDisallowedNickname(nickname)) {
    return { error: '昵称包含不适合公开展示的内容，请更换昵称', status: 400 };
  }

  const existing = await db.prepare('SELECT id FROM users WHERE nickname = ?1').bind(nickname).first<{ id: string }>();
  if (existing && nickname !== REUSABLE_NICKNAME) {
    return { error: '昵称已被占用，请更换昵称', status: 409 };
  }

  const userId = existing?.id ?? crypto.randomUUID();
  const deviceId = crypto.randomUUID();
  const deviceToken = createToken();
  const tokenHash = await sha256(deviceToken);
  const now = new Date().toISOString();

  const statements = [
    db.prepare('INSERT INTO devices (id, user_id, token_hash, device_name, status, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(
      deviceId,
      userId,
      tokenHash,
      input.deviceName ?? '',
      'active',
      now,
      now
    ),
    db.prepare('UPDATE users SET last_seen_at = ?1 WHERE id = ?2').bind(now, userId)
  ];

  if (!existing) {
    statements.unshift(
      db.prepare('INSERT INTO users (id, nickname, status, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(userId, nickname, 'active', now, now)
    );
  }

  await db.batch(statements);

  return {
    user_id: userId,
    nickname,
    device_id: deviceId,
    device_token: deviceToken
  };
}

export async function validateDevice(db: D1Database, deviceId: string, deviceToken: string): Promise<StoredDevice | null> {
  const row = await db
    .prepare(
      `SELECT devices.id, devices.user_id, devices.token_hash, devices.status, users.nickname
       FROM devices
       JOIN users ON users.id = devices.user_id
       WHERE devices.id = ?1 AND users.status = 'active'`
    )
    .bind(deviceId)
    .first<StoredDevice>();
  if (!row || row.status !== 'active') {
    return null;
  }
  const tokenHash = await sha256(deviceToken);
  return tokenHash === row.token_hash ? row : null;
}

export async function recordPublicUpload(db: D1Database, input: UploadInput): Promise<string> {
  const uploadId = crypto.randomUUID();
  const now = new Date().toISOString();
  const proxySuspected = input.directCheck.proxy_suspected ? 1 : 0;
  const serverCarrier = input.serverGeo.carrier;
  const serverProvinceCode = input.serverGeo.province_code;
  const trusted = proxySuspected === 0 && serverCarrier !== 'other' && serverProvinceCode !== 'unknown';

  const statements = [
    db
      .prepare(
        `INSERT INTO uploads (
          id, device_id, nickname, client_ip, cf_country, cf_region, cf_city, cf_asn, cf_as_organization,
          server_province_code, server_province_name, server_carrier, client_region, client_carrier,
          proxy_suspected, route_interface, egress_ip, egress_asn, direct_check_json, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`
      )
      .bind(
        uploadId,
        input.deviceId,
        input.nickname,
        input.serverGeo.ip,
        input.serverGeo.country ?? '',
        input.serverGeo.region ?? '',
        input.serverGeo.city ?? '',
        input.serverGeo.asn ?? null,
        input.serverGeo.asOrganization ?? '',
        serverProvinceCode,
        input.serverGeo.province_name,
        serverCarrier,
        input.clientRegion ?? '',
        input.clientCarrier ?? '',
        proxySuspected,
        input.directCheck.route_interface ?? '',
        input.directCheck.egress_ip ?? '',
        input.directCheck.egress_asn ?? '',
        JSON.stringify(input.directCheck),
        now
      ),
    db.prepare('UPDATE devices SET last_seen_at = ?1 WHERE id = ?2').bind(now, input.deviceId),
    db.prepare('UPDATE users SET last_seen_at = ?1 WHERE nickname = ?2').bind(now, input.nickname)
  ];

  for (const node of input.nodes) {
    statements.push(
      db
        .prepare(
          `INSERT INTO node_results (
            id, upload_id, ip, port, carrier, latency, speed, loss, tls, colo, region, source, trusted, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
        )
        .bind(
          crypto.randomUUID(),
          uploadId,
          node.ip,
          node.port,
          node.carrier,
          node.latency,
          node.speed,
          node.loss,
          node.tls ? 1 : 0,
          node.colo ?? '',
          node.region ?? '',
          node.source ?? '',
          trusted ? 1 : 0,
          now
        )
    );
  }

  await db.batch(statements);
  return uploadId;
}

export async function rebuildAggregates(db: D1Database, rootDomain: string): Promise<PublicAggregate[]> {
  const since = new Date(Date.now() - AGGREGATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const rows = await db
    .prepare(
      `SELECT
        uploads.id AS upload_id,
        uploads.nickname,
        uploads.server_province_code,
        uploads.server_province_name,
        uploads.server_carrier,
        node_results.ip,
        node_results.port,
        node_results.speed,
        node_results.latency,
        node_results.loss,
        node_results.colo,
        node_results.created_at
       FROM node_results
       JOIN uploads ON uploads.id = node_results.upload_id
       JOIN (
         SELECT device_id, MAX(created_at) AS created_at
         FROM uploads
         GROUP BY device_id
       ) latest_uploads
         ON latest_uploads.device_id = uploads.device_id
        AND latest_uploads.created_at = uploads.created_at
       WHERE node_results.trusted = 1
         AND uploads.server_province_code != 'unknown'
         AND uploads.server_carrier IN ('ct', 'cm', 'cu')
         AND node_results.created_at >= ?1
       ORDER BY node_results.speed DESC, node_results.latency ASC
       LIMIT 1000`
    )
    .bind(since)
    .all<{
      upload_id: string;
      nickname: string;
      server_province_code: string;
      server_province_name: string;
      server_carrier: Carrier;
      ip: string;
      port: number;
      speed: number;
      latency: number;
      loss: number;
      colo?: string;
      created_at: string;
    }>();

  const bestByKey = new Map<string, PublicAggregate>();
  const now = new Date().toISOString();

  for (const row of rows.results ?? []) {
    const key = `${row.server_province_code}:${row.server_carrier}`;
    if (bestByKey.has(key)) {
      continue;
    }
    const hostname = `${row.server_province_code}.${row.server_carrier}.${rootDomain}`;
    bestByKey.set(key, {
      key,
      province_code: row.server_province_code,
      province_name: row.server_province_name,
      carrier: row.server_carrier,
      carrier_label: carrierLabel(row.server_carrier),
      hostname,
      ip: row.ip,
      port: row.port,
      record_type: isIpv6Address(row.ip) ? 'AAAA' : 'A',
      speed: row.speed,
      latency: row.latency,
      loss: row.loss,
      colo: row.colo ?? '',
      nickname: row.nickname,
      upload_id: row.upload_id,
      updated_at: now
    });
  }

  const aggregates = [...bestByKey.values()];
  await db.prepare('DELETE FROM aggregates').run();
  if (aggregates.length) {
    await db.batch(
      aggregates.map((item) =>
        db
          .prepare(
            `INSERT INTO aggregates (
              key, province_code, province_name, carrier, hostname, ip, port, record_type,
              speed, latency, loss, colo, nickname, upload_id, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
          )
          .bind(
            item.key,
            item.province_code,
            item.province_name,
            item.carrier,
            item.hostname,
            item.ip,
            item.port,
            item.record_type,
            item.speed,
            item.latency,
            item.loss,
            item.colo ?? '',
            item.nickname,
            item.upload_id,
            item.updated_at
          )
      )
    );
  }

  return aggregates;
}

export async function readAggregates(db: D1Database): Promise<PublicAggregate[]> {
  const rows = await db.prepare('SELECT * FROM aggregates ORDER BY province_code ASC, carrier ASC').all<AggregateRow>();
  return (rows.results ?? []).map((row) => ({
    ...row,
    carrier_label: carrierLabel(row.carrier)
  }));
}

export async function writePublicCache(kv: KVNamespace, aggregates: PublicAggregate[]): Promise<void> {
  const payload = {
    success: true,
    updated_at: new Date().toISOString(),
    total: aggregates.length,
    aggregates
  };
  await kv.put('public:latest', JSON.stringify(payload));
}

export async function readPublicCache(kv: KVNamespace): Promise<unknown | null> {
  return kv.get('public:latest', 'json');
}

export async function recordDnsUpdate(db: D1Database, hostname: string, recordType: string, ip: string, status: string, response: string): Promise<void> {
  await db
    .prepare('INSERT INTO dns_updates (id, hostname, record_type, ip, status, response_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(crypto.randomUUID(), hostname, recordType, ip, status, response.slice(0, 4000), new Date().toISOString())
    .run();
}

export async function recentlyUpdatedDns(db: D1Database, hostname: string, minutes: number): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const row = await db.prepare('SELECT id FROM dns_updates WHERE hostname = ?1 AND status = ?2 AND created_at >= ?3 LIMIT 1').bind(hostname, 'success', since).first();
  return Boolean(row);
}

export function normalizeNickname(value: string): string {
  const nickname = value.trim();
  if (!/^[\u4e00-\u9fa5A-Za-z0-9_-]{2,24}$/.test(nickname)) {
    return '';
  }
  return nickname;
}

function isDisallowedNickname(nickname: string): boolean {
  if (nickname === REUSABLE_NICKNAME) {
    return false;
  }
  return NICKNAME_DENY_PATTERNS.some((pattern) => pattern.test(nickname));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createToken(): string {
  const bytes = new Uint8Array(DEVICE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
