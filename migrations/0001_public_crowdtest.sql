CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  cf_country TEXT NOT NULL DEFAULT '',
  cf_region TEXT NOT NULL DEFAULT '',
  cf_city TEXT NOT NULL DEFAULT '',
  cf_asn INTEGER,
  cf_as_organization TEXT NOT NULL DEFAULT '',
  server_province_code TEXT NOT NULL,
  server_province_name TEXT NOT NULL,
  server_carrier TEXT NOT NULL,
  client_region TEXT NOT NULL DEFAULT '',
  client_carrier TEXT NOT NULL DEFAULT '',
  proxy_suspected INTEGER NOT NULL DEFAULT 0,
  route_interface TEXT NOT NULL DEFAULT '',
  egress_ip TEXT NOT NULL DEFAULT '',
  egress_asn TEXT NOT NULL DEFAULT '',
  direct_check_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_uploads_geo_carrier ON uploads(server_province_code, server_carrier);
CREATE INDEX IF NOT EXISTS idx_uploads_proxy ON uploads(proxy_suspected);

CREATE TABLE IF NOT EXISTS node_results (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  carrier TEXT NOT NULL,
  latency REAL NOT NULL,
  speed REAL NOT NULL,
  loss REAL NOT NULL,
  tls INTEGER NOT NULL DEFAULT 1,
  colo TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  trusted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (upload_id) REFERENCES uploads(id)
);

CREATE INDEX IF NOT EXISTS idx_node_results_upload_id ON node_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_node_results_trusted_speed ON node_results(trusted, speed DESC, latency ASC);

CREATE TABLE IF NOT EXISTS aggregates (
  key TEXT PRIMARY KEY,
  province_code TEXT NOT NULL,
  province_name TEXT NOT NULL,
  carrier TEXT NOT NULL,
  hostname TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  record_type TEXT NOT NULL,
  speed REAL NOT NULL,
  latency REAL NOT NULL,
  loss REAL NOT NULL,
  nickname TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aggregates_hostname ON aggregates(hostname);

CREATE TABLE IF NOT EXISTS dns_updates (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  record_type TEXT NOT NULL,
  ip TEXT NOT NULL,
  status TEXT NOT NULL,
  response_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dns_updates_hostname_created_at ON dns_updates(hostname, created_at);
