export type Carrier = 'ct' | 'cm' | 'cu' | 'other';

export interface Env {
  SPEED_TEST_KV: KVNamespace;
  DB: D1Database;
  UPLOAD_TOKEN: string;
  DNS_API_TOKEN?: string;
  DNS_ZONE_ID?: string;
  DNS_ROOT_DOMAIN?: string;
  DOMAIN_CT?: string;
  DOMAIN_CM?: string;
  DOMAIN_CU?: string;
}

export interface NodeRecord {
  ip: string;
  port: number;
  carrier: Carrier;
  latency: number;
  speed: number;
  loss: number;
  tls: boolean;
  colo?: string;
  region?: string;
  source?: string;
  updated_at: string;
}

export interface UploadNodeInput {
  ip?: unknown;
  port?: unknown;
  carrier?: unknown;
  latency?: unknown;
  speed?: unknown;
  loss?: unknown;
  tls?: unknown;
  colo?: unknown;
  region?: unknown;
  source?: unknown;
}

export interface UploadPayload {
  source?: unknown;
  region?: unknown;
  carrier?: unknown;
  nodes?: unknown;
}

export interface PublicUploadPayload extends UploadPayload {
  nickname?: unknown;
  device_id?: unknown;
  device_token?: unknown;
  device_name?: unknown;
  client_region?: unknown;
  client_carrier?: unknown;
  direct_check?: unknown;
}

export interface DirectCheckResult {
  proxy_suspected: boolean;
  route_interface?: string;
  egress_ip?: string;
  egress_asn?: string;
  egress_country?: string;
  egress_org?: string;
  egress_region?: string;
  egress_city?: string;
  wan_interface?: string;
  warnings: string[];
}

export interface NodesStats {
  ct: number;
  cm: number;
  cu: number;
  other: number;
  best_speed: number;
  best_latency: number;
}

export interface NodesDataset {
  updated_at: string;
  total: number;
  stats: NodesStats;
  nodes: NodeRecord[];
}

export interface HistorySummary {
  key: string;
  uploaded_at: string;
  source?: string;
  region?: string;
  carrier?: Carrier;
  total: number;
  best_speed: number;
  best_latency: number;
}

export interface DomainMapping {
  carrier: Carrier;
  carrier_label: string;
  domain: string;
  ip: string;
  port: number;
  record_type: 'A' | 'AAAA';
  speed: number;
  latency: number;
  source?: string;
  region?: string;
  updated_at: string;
}

export interface RegisterResult {
  user_id: string;
  nickname: string;
  device_id: string;
  device_token: string;
}

export interface ServerGeo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  asn?: number;
  asOrganization?: string;
  province_code: string;
  province_name: string;
  carrier: Carrier;
}

export interface PublicAggregate {
  key: string;
  province_code: string;
  province_name: string;
  carrier: Carrier;
  carrier_label: string;
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

export type ApiSuccess<T> = {
  success: true;
  data?: T;
  message?: string;
} & Record<string, unknown>;

export interface ApiError {
  success: false;
  error: string;
}
