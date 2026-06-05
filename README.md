# cf-ip-speed-panel

`cf-ip-speed-panel` 是一个基于 Cloudflare Worker + KV 的 Cloudflare 优选 IP 测速结果展示面板。

它不在 Worker 里直接测速，而是在 Windows、Linux、macOS、本地宽带或 VPS 上运行 `cfst` / `CloudflareSpeedTest`，把测速结果上传到 Worker。Worker 负责鉴权、校验、写入 KV、提供 API，并渲染一个中文响应式页面。

当前示例部署：

- GitHub 仓库：`https://github.com/10000ge10000/cf-ip-speed-panel`
- 面板域名：`https://cf.6610000.xyz`
- workers.dev：`https://cf-ip-speed-panel.10454728.workers.dev`

## 功能

- Cloudflare Worker TypeScript 实现，无需独立服务器。
- Cloudflare D1 保存用户、设备、上传明细和聚合结果。
- Cloudflare KV 缓存前端公开聚合结果。
- `POST /api/upload` 使用 `Authorization: Bearer <UPLOAD_TOKEN>` 鉴权。
- `POST /api/public/register` 和 `POST /api/public/upload` 支持公开众测上传。
- 前端展示节点统计、运营商筛选、速度/延迟排序、复制 IP。
- 支持 IPv4 和 IPv6。
- 按省份和运营商聚合最佳 IP，并可自动更新 `sh.ct.6610000.xyz` 这类 DNS 记录。
- 提供 Windows PowerShell 和 Linux/macOS Bash 上传脚本。
- 前端内联 CSS/JS，不依赖 React/Vue/CDN。

## 快速开始：Windows

### 1. 安装依赖

```powershell
cd "C:\Users\Administrator\Documents\Worker Man\cf-ip-speed-panel"
npm install
```

### 2. 设置 Cloudflare API Token

仅部署时需要 Cloudflare API Token。不要写进仓库文件。

```powershell
$env:CLOUDFLARE_API_TOKEN="你的 Cloudflare API Token"
npx wrangler whoami
```

如果 `whoami` 能显示账号，说明部署权限可用。

### 3. 创建 KV

如果还没有创建 KV：

```powershell
npx wrangler kv namespace create SPEED_TEST_KV --binding SPEED_TEST_KV --update-config
```

确认 `wrangler.jsonc` 中只保留一个 `SPEED_TEST_KV` 绑定，并且 `id` 是真实 KV Namespace ID。

### 4. 创建 D1 并应用表结构

公开众测模式需要 D1 保存用户、设备、上传明细和聚合结果：

```powershell
npx wrangler d1 create cf-ip-speed-panel
```

把返回的 `database_id` 写入 `wrangler.jsonc` 的 `d1_databases[0].database_id`，然后执行：

```powershell
npm run d1:migrate:remote
```

### 5. 设置 Worker 上传 Token 和 DNS Token

这个 Token 是测速脚本调用 `/api/upload` 用的，不是 Cloudflare API Token。

```powershell
npx wrangler secret put UPLOAD_TOKEN
npx wrangler secret put DNS_API_TOKEN
```

`DNS_API_TOKEN` 只给 `6610000.xyz` 的 DNS 编辑权限即可，Worker 不需要账户全局权限。
如果暂时不配置 `DNS_API_TOKEN`，项目仍可部署和接收公开上传，只是不会自动更新 DNS。

### 6. 部署 Worker

```powershell
npm run check
npm run deploy
```

部署完成后访问：

```text
https://cf.6610000.xyz
```

### 7. 上传真实 cfst 结果

先确认 Windows 里可以直接运行 `cfst`，并且脚本所在目录能看到 `result.csv`。

```powershell
$env:WORKER_URL="https://cf.6610000.xyz"
$env:UPLOAD_TOKEN="你的 Worker 上传 Token"
$env:CARRIER="ct"
$env:REGION="你的地区"
$env:SOURCE="windows-local"
powershell -ExecutionPolicy Bypass -File .\scripts\upload-windows.ps1
```

如果你已经手动运行过 `cfst`，并且当前目录已有 `result.csv`，可以跳过再次测速：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\upload-windows.ps1 -SkipCfst
```

运营商参数：

```text
ct = 中国电信
cm = 中国移动
cu = 中国联通
other = 其他
```

## 快速开始：Linux / macOS

### 1. 安装依赖并部署

```bash
cd /opt/cf-ip-speed-panel
npm install
export CLOUDFLARE_API_TOKEN="你的 Cloudflare API Token"
npx wrangler whoami
npx wrangler d1 create cf-ip-speed-panel
npm run d1:migrate:remote
npx wrangler secret put UPLOAD_TOKEN
npx wrangler secret put DNS_API_TOKEN
npm run check
npm run deploy
```

### 2. 确认 cfst 和 python3

```bash
command -v cfst
command -v python3
```

缺少 `cfst` 时，请先安装 CloudflareSpeedTest/cfst，并确保 `cfst` 在 `PATH` 中。

### 3. 上传测速结果

```bash
CARRIER=ct \
REGION=陕西西安 \
SOURCE=xian-ct-vps \
WORKER_URL=https://cf.6610000.xyz \
UPLOAD_TOKEN=你的Worker上传Token \
bash scripts/upload-linux.sh
```

脚本会运行 `cfst`，读取 `result.csv`，转换为 JSON，然后上传到 `/api/upload`。

定时任务示例见：

```text
scripts/example-crontab.txt
```

## 域名配置

`wrangler.jsonc` 当前使用：

```jsonc
"vars": {
  "DOMAIN_CT": "ct.6610000.xyz",
  "DOMAIN_CM": "cm.6610000.xyz",
  "DOMAIN_CU": "cu.6610000.xyz"
}
```

这些变量用于旧版 `/api/mappings` 的运营商级 DNS/hosts 建议。
公开众测模式会根据 D1 聚合结果和 `DNS_ROOT_DOMAIN` 自动更新省份级记录。例如：

```text
sh.ct.6610000.xyz -> 上海电信最佳 IP
sx.cu.6610000.xyz -> 陕西联通最佳 IP
gd.cm.6610000.xyz -> 广东移动最佳 IP
```

自动 DNS 只使用 `DNS_API_TOKEN` Secret，不会把 Cloudflare Token 写入源码或 KV/D1。建议该 Token 只允许编辑 `6610000.xyz` 的 DNS。

## 项目结构

```text
cf-ip-speed-panel/
├── src/
│   ├── index.ts
│   ├── api.ts
│   ├── html.ts
│   ├── types.ts
│   ├── utils.ts
│   └── storage.ts
├── scripts/
│   ├── upload-linux.sh
│   ├── upload-windows.ps1
│   ├── example-crontab.txt
│   └── example-task-scheduler.md
├── wrangler.jsonc
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## API

### POST `/api/public/register`

公开众测设备注册。昵称先到先得。

```json
{
  "nickname": "一万网友",
  "device_name": "home-router"
}
```

返回：

```json
{
  "success": true,
  "device_id": "...",
  "device_token": "..."
}
```

`device_token` 只显示一次，OpenWrt 客户端会保存到 UCI。

### POST `/api/public/upload`

公开众测上传接口。首次上传可以只带 `nickname`，Worker 会自动注册设备；后续上传应携带 `device_id` 和 `device_token`。

```json
{
  "nickname": "一万网友",
  "device_id": "...",
  "device_token": "...",
  "direct_check": {
    "proxy_suspected": false,
    "route_interface": "pppoe-wan",
    "wan_interface": "wan",
    "egress_ip": "1.2.3.4",
    "egress_asn": "4134",
    "warnings": []
  },
  "nodes": [
    {
      "ip": "104.18.1.1",
      "port": 443,
      "latency": 45,
      "speed": 32.5,
      "loss": 0,
      "tls": true,
      "colo": "SJC"
    }
  ]
}
```

疑似代理、归属未知或运营商未知的数据会保存，但不参与自动 DNS 绑定。

### GET `/api/public/latest`

返回当前按省份和运营商聚合出的最佳 IP，前端首页默认读取该接口。

### GET `/api/health`

返回 Worker 和 KV 基本状态。

### GET `/api/nodes`

查询最新节点。

支持参数：

- `carrier=ct|cm|cu|other`
- `limit=20`
- `sort=speed|latency`

### POST `/api/upload`

请求头：

```text
Authorization: Bearer <UPLOAD_TOKEN>
Content-Type: application/json
```

请求体：

```json
{
  "source": "xian-ct-vps",
  "region": "陕西西安",
  "carrier": "ct",
  "nodes": [
    {
      "ip": "104.18.1.1",
      "port": 443,
      "latency": 45,
      "speed": 32.5,
      "loss": 0,
      "tls": true,
      "colo": "SJC"
    }
  ]
}
```

规则：

- `carrier` 只允许 `ct`、`cm`、`cu`、`other`。
- 节点缺少 `carrier/source/region` 时继承顶层字段。
- 最多保存速度排序后的前 100 个节点。
- Token 错误返回 `401`。

### GET `/api/mappings`

按运营商选出最快节点，并根据 `DOMAIN_CT`、`DOMAIN_CM`、`DOMAIN_CU` 生成 DNS/hosts 建议。

### GET `/api/history`

返回最近最多 20 次上传摘要。

### GET `/api/raw`

返回 KV 中 `nodes:latest` 的原始 JSON，方便调试。

## 常见问题

### 为什么 Worker 不能直接测速？

Cloudflare Worker 运行在 Cloudflare 边缘网络里，无法代表你的本地宽带、VPS 线路或某个地区运营商环境测速。优选 IP 的价值来自具体网络环境，所以测速必须在目标网络中运行。

### 上传成功但网页不显示怎么办？

按顺序检查：

1. `wrangler.jsonc` 中 `SPEED_TEST_KV` 的 `id` 是否正确。
2. 上传返回是否 `success: true`。
3. 访问 `/api/raw` 是否有数据。
4. 访问 `/api/nodes` 是否有节点。
5. 节点 IP、速度、延迟字段是否被脚本正确解析。

### 自定义域名和映射域名有什么区别？

- 面板域名：访问这个 Worker 页面，例如 `cf.6610000.xyz`。
- 映射域名：给不同运营商解析到优选 IP，例如 `ct.6610000.xyz`、`cm.6610000.xyz`、`cu.6610000.xyz`。

### 如何限制上传频率？

首版只做 Token 鉴权。生产使用建议：

- Worker 上传 Token 足够长且不要公开。
- 只在可信机器上保存上传 Token。
- 用 Cloudflare WAF 或 Zero Trust 限制上传来源。
- crontab / 任务计划不要设置过高频率。

## 安全说明

- 不要公开 `UPLOAD_TOKEN`。
- 不要把 Cloudflare API Token 写入本项目。
- 自动 DNS 只使用 `DNS_API_TOKEN` Secret，并建议限制为 `6610000.xyz` DNS 编辑权限。
- `/api/upload` 必须鉴权，未授权请求会返回 `401`。

## 二次开发

核心逻辑拆分在：

- `src/api.ts`：API 路由和上传校验。
- `src/public-api.ts`：公开注册、公开上传、聚合触发。
- `src/database.ts`：D1 读写、设备注册、聚合生成。
- `src/dns.ts`：自动 DNS 更新。
- `src/storage.ts`：KV 读写。
- `src/html.ts`：前端页面。
- `src/utils.ts`：通用工具。

如果要扩展自动 DNS 更新，建议单独增加显式开关，并使用最小权限 Cloudflare API Token，不要复用上传 Token。

## D1 和自动 DNS

创建 D1：

```powershell
npx wrangler d1 create cf-ip-speed-panel
```

把返回的 `database_id` 写入 `wrangler.jsonc` 的 `d1_databases[0].database_id`。

应用 migration：

```powershell
npm run d1:migrate:remote
```

设置 DNS Token：

```powershell
npx wrangler secret put DNS_API_TOKEN
```

DNS Token 建议只给 `6610000.xyz` 的 DNS 编辑权限。Worker 会按聚合结果更新：

```text
sh.ct.6610000.xyz
sx.cu.6610000.xyz
gd.cm.6610000.xyz
```

同一 hostname 30 分钟内不会重复更新，避免频繁刷 Cloudflare DNS API。

## OpenWrt / LuCI 包源码

包源码位于：

```text
openwrt-packages/
├── cf-ip-speed-client
└── luci-app-cf-ip-speed-client
```

在 OpenWrt SDK 中构建：

```bash
cp -r openwrt-packages/cf-ip-speed-client package/
cp -r openwrt-packages/luci-app-cf-ip-speed-client package/
make menuconfig
make package/cf-ip-speed-client/compile V=s
make package/luci-app-cf-ip-speed-client/compile V=s
```

### GitHub Actions 自动构建 IPK

仓库内置两个 GitHub Actions：

- `.github/workflows/ci.yml`：检查 Worker TypeScript、OpenWrt shell 脚本语法，以及 LuCI 前端是否保持 ASCII 转义，避免部分 OpenWrt 环境出现中文乱码。
- `.github/workflows/openwrt-packages.yml`：使用 OpenWrt SDK 构建 `cf-ip-speed-client` 和 `luci-app-cf-ip-speed-client`。

默认构建：

```text
x86_64-24.10.6
x86_64-23.05.5
```

推送普通分支时，IPK 会作为 GitHub Actions artifact 保存。打版本标签时，会自动上传到 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

下载地址：

```text
https://github.com/10000ge10000/cf-ip-speed-panel/releases
```

说明：

- IPK 适用于 OpenWrt 24.10 及以下仍使用 `opkg` 的系统。
- APK 是 OpenWrt 后续 apk 包管理器方向，当前项目先保留入口，等目标版本生态稳定后再补。
- 当前包是 `PKGARCH:=all`，脚本本身不绑定 CPU 架构；但 LuCI/OpenWrt 依赖仍建议优先安装与系统版本匹配的构建产物。

### 本地目录关联 GitHub 仓库

如果你的本地目录还不是 Git 仓库，可以这样关联到已创建的仓库：

```powershell
git init
git branch -M main
git remote add origin https://github.com/10000ge10000/cf-ip-speed-panel.git
git status
```

确认没有敏感文件后，再按需提交和推送。不要提交 `.env`、`.dev.vars`、Cloudflare Token、OpenWrt 密码或任何生产密钥。

安装后在 LuCI 的“服务 / Cloudflare IP 优选助手”里配置：

- 是否启用
- 昵称
- 测速周期

面板地址固定为 `https://cf.6610000.xyz`，直连检测默认开启，WAN 出口会自动识别。测速期间会临时暂停常见代理服务，完成后自动恢复。客户端会使用 UCI 保存设备凭据和最近上传状态，并通过 cron 定时执行。

测速下载地址已经合并到 Worker 项目中，默认使用：

```text
https://cf.6610000.xyz/__speedtest?bytes=104857600
```

如果你后续想临时替换下载测速地址，可以在 OpenWrt 上设置隐藏 UCI 项：

```sh
uci set cf_ip_speed_client.main.download_url='https://你的域名/__speedtest?bytes=104857600'
uci commit cf_ip_speed_client
```

如果检测到代理、云服务 ASN 或非 CN 出口，数据仍会上传和展示贡献昵称，但不会参与自动 DNS 优选。
