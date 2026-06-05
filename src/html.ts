export function renderHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cloudflare 优选 IP 公开众测面板</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --panel-2: #f8fafc;
      --line: #d8e1ec;
      --text: #102033;
      --muted: #64748b;
      --accent: #0f8f7f;
      --blue: #1677d2;
      --warn: #b7791f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, #ffffff 0, var(--bg) 320px);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    button, select, a { font: inherit; }
    .wrap {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 38px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.12;
    }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .sub, .meta, footer { color: var(--muted); line-height: 1.7; }
    .sub { margin: 0; }
    .actions, .filters, .quick-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .actions { justify-content: flex-end; }
    .btn, select {
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      color: var(--text);
      padding: 0 13px;
      cursor: pointer;
    }
    .btn.primary { border-color: rgba(22, 119, 210, .34); background: #e8f3ff; color: #0f4f91; }
    .btn:hover, select:hover { border-color: var(--accent); }
    .btn.disabled {
      color: #94a3b8;
      background: #f1f5f9;
      cursor: not-allowed;
      pointer-events: none;
    }
    .notice {
      position: fixed;
      left: 50%;
      top: 22px;
      z-index: 50;
      transform: translate(-50%, -10px);
      opacity: 0;
      pointer-events: none;
      background: #10172a;
      color: #ffffff;
      border-radius: 8px;
      padding: 13px 18px;
      box-shadow: 0 14px 35px rgba(15, 23, 42, .22);
      font-weight: 700;
      transition: opacity .16s ease, transform .16s ease;
    }
    .notice.show { opacity: 1; transform: translate(-50%, 0); }
    .panel, .stat, .card {
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 10px 30px rgba(15, 23, 42, .06);
      border-radius: 8px;
    }
    .panel { padding: 16px; margin-bottom: 16px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat { padding: 14px; min-height: 84px; }
    .stat span { display: block; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    .stat strong { display: block; font-size: 21px; overflow-wrap: anywhere; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card {
      padding: 18px;
      min-width: 0;
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    }
    .card:hover {
      transform: translateY(-4px) scale(1.01);
      border-color: #a8d8ff;
      box-shadow: 0 18px 42px rgba(22, 119, 210, .14);
    }
    .card-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
    .badge {
      border: 1px solid rgba(56, 189, 248, .42);
      background: #eef7ff;
      color: #155a95;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    .badge.good {
      border-color: rgba(15, 143, 127, .34);
      background: #e9fbf7;
      color: #0b7669;
    }
    .host, .ip { color: var(--accent); overflow-wrap: anywhere; }
    .host, .ip {
      cursor: pointer;
      border-radius: 6px;
      transition: background .15s ease, color .15s ease;
    }
    .host:hover, .ip:hover { background: #e8f7f5; color: #0b7669; }
    .host { font-size: 20px; font-weight: 800; margin: 0 0 12px; padding: 3px 4px; }
    .ip { font-size: 26px; font-weight: 800; margin: 0 0 16px; padding: 3px 4px; }
    .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .metric { background: var(--panel-2); border-radius: 8px; padding: 12px; min-height: 74px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 5px; }
    .metric strong { font-size: 16px; }
    .sync-line {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .filter-panel {
      display: grid;
      gap: 12px;
      margin: 16px 0;
      padding: 14px;
    }
    .filter-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-label { min-width: 58px; color: var(--muted); font-size: 13px; }
    .chip {
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--text);
      border-radius: 999px;
      padding: 7px 12px;
      cursor: pointer;
      transition: background .15s ease, color .15s ease, transform .15s ease, border-color .15s ease;
    }
    .chip:hover { transform: translateY(-1px); border-color: #8ecaff; }
    .chip.active { border-color: #0f8f7f; background: #e9fbf7; color: #0b7669; font-weight: 700; }
    .info-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .info-block { background: var(--panel-2); border-radius: 8px; padding: 14px; }
    .info-block h3 { margin: 0 0 8px; font-size: 15px; }
    .info-block p, .info-block ol { margin: 0; color: var(--muted); line-height: 1.7; }
    .info-block ol { padding-left: 20px; }
    .download-actions { display: grid; gap: 8px; margin-top: 10px; }
    .download-actions .btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
    .install-command {
      display: block;
      margin-top: 8px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #ffffff;
      color: #0f766e;
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      cursor: pointer;
    }
    pre {
      margin: 10px 0 0;
      padding: 12px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid var(--line);
      overflow: auto;
      color: #1f6f3d;
      line-height: 1.6;
      font-size: 13px;
    }
    .empty, .error {
      border: 1px dashed var(--line);
      color: var(--muted);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
    }
    .error { color: #9f1239; border-color: rgba(244, 63, 94, .35); background: #fff1f2; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
    #aggregates { margin-bottom: 22px; }
    footer { padding-top: 12px; }
    @media (max-width: 980px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .wrap { width: min(100% - 24px, 1180px); padding-top: 20px; }
      header { display: block; }
      .actions { justify-content: flex-start; margin-top: 14px; }
      .stats, .grid { grid-template-columns: 1fr; }
      .metrics, .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header>
      <div>
        <h1>Cloudflare 优选 IP 公开众测面板</h1>
        <p class="sub">OpenWrt / LuCI 客户端自动测速、检测直连状态、上传结果；面板按省份和运营商聚合最佳 IP。</p>
      </div>
      <div class="actions">
        <button class="btn primary" id="refreshBtn">刷新数据</button>
      </div>
    </header>

    <div id="notice" class="notice"></div>

    <section class="stats" id="stats"></section>

    <div class="panel filter-panel">
      <div class="filter-group" id="carrierChips">
        <span class="filter-label">运营商</span>
        <button class="chip active" data-carrier="">全部</button>
        <button class="chip" data-carrier="ct">中国电信</button>
        <button class="chip" data-carrier="cm">中国移动</button>
        <button class="chip" data-carrier="cu">中国联通</button>
      </div>
      <div class="filter-group" id="provinceChips">
        <span class="filter-label">省份</span>
        <button class="chip active" data-province="">全部</button>
      </div>
      <span class="meta" id="updatedAt">等待加载</span>
    </div>

    <section id="aggregates" class="grid"></section>

    <section class="panel">
      <h2>项目说明</h2>
      <div class="info-grid">
        <div class="info-block">
          <h3>这是什么</h3>
          <p>公开众测 Cloudflare 优选 IP。每条推荐都来自 OpenWrt 客户端的真实直连测速。</p>
        </div>
        <div class="info-block">
          <h3>项目地址</h3>
          <p>GitHub：<a href="https://github.com/10000ge10000/cf-ip-speed-panel" target="_blank" rel="noopener noreferrer">10000ge10000/cf-ip-speed-panel</a></p>
          <p>面板：<a href="https://cf.6610000.xyz" target="_blank" rel="noopener noreferrer">cf.6610000.xyz</a></p>
        </div>
        <div class="info-block">
          <h3>插件下载</h3>
          <div class="download-actions">
            <a class="btn" href="https://github.com/10000ge10000/cf-ip-speed-panel/releases/tag/v0.1.3" target="_blank" rel="noopener noreferrer">下载插件</a>
          </div>
          <p class="meta">点击下面命令可一键复制：</p>
          <code class="install-command" title="点击复制安装命令" data-copy="sh -c &quot;$(wget -O- https://raw.githubusercontent.com/10000ge10000/cf-ip-speed-panel/main/scripts/install-openwrt.sh)&quot;" data-copy-label="安装命令">sh -c "$(wget -O- https://raw.githubusercontent.com/10000ge10000/cf-ip-speed-panel/main/scripts/install-openwrt.sh)"</code>
        </div>
        <div class="info-block">
          <h3>怎么使用</h3>
          <ol>
            <li>安装插件并填写昵称。</li>
            <li>选择测速方式并启用。</li>
            <li>等待定时测速，或在 LuCI 中手动测速上传。</li>
            <li>回到页面复制推荐域名或 IP 使用。</li>
          </ol>
        </div>
      </div>
    </section>

    <footer>
      疑似代理、归属未知或运营商未知的数据会保存贡献记录，但不会参与自动 DNS 绑定。公开上传接口会记录服务端识别归属和客户端直连检测结果。
    </footer>
  </main>

  <script>
    const carrierLabels = { ct: '中国电信', cm: '中国移动', cu: '中国联通', other: '其他' };
    const coloLabels = {
      HKG: '香港', NRT: '东京', KIX: '大阪', ICN: '首尔', SIN: '新加坡', TPE: '台北',
      SJC: '圣何塞', LAX: '洛杉矶', SEA: '西雅图', FRA: '法兰克福', LHR: '伦敦',
      CDG: '巴黎', AMS: '阿姆斯特丹', DFW: '达拉斯', IAD: '华盛顿', ORD: '芝加哥'
    };
    let latestAggregates = [];
    let selectedCarrier = '';
    let selectedProvince = '';

    const aggregatesEl = document.getElementById('aggregates');
    const statsEl = document.getElementById('stats');
    const noticeEl = document.getElementById('notice');
    const updatedAtEl = document.getElementById('updatedAt');
    const carrierChips = document.getElementById('carrierChips');
    const provinceChips = document.getElementById('provinceChips');

    document.getElementById('refreshBtn').addEventListener('click', loadLatest);
    document.querySelectorAll('.install-command[data-copy]').forEach((node) => {
      node.addEventListener('click', () => copyText(node.dataset.copy, node.dataset.copyLabel));
    });
    carrierChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-carrier]');
      if (!chip) return;
      selectedCarrier = chip.dataset.carrier || '';
      updateActiveChips(carrierChips, 'carrier', selectedCarrier);
      renderAggregates();
    });
    provinceChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-province]');
      if (!chip) return;
      selectedProvince = chip.dataset.province || '';
      updateActiveChips(provinceChips, 'province', selectedProvince);
      renderAggregates();
    });

    loadLatest();

    async function loadLatest() {
      aggregatesEl.innerHTML = '<div class="empty">正在加载公开众测聚合数据...</div>';
      try {
        const res = await fetch('/api/public/latest');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '接口返回失败');
        latestAggregates = data.aggregates || [];
        renderStats(data);
        renderProvinceChips();
        renderAggregates();
        updatedAtEl.textContent = data.updated_at ? '最后聚合：' + formatBeijingTime(data.updated_at) : '暂无聚合数据';
      } catch (error) {
        aggregatesEl.innerHTML = '<div class="error">加载失败：' + escapeHtml(error.message) + '</div>';
      }
    }

    function renderStats(data) {
      const provinces = new Set(latestAggregates.map((item) => item.province_code));
      const users = new Set(latestAggregates.map((item) => item.nickname));
      const bestSpeed = latestAggregates.reduce((max, item) => Math.max(max, Number(item.speed) || 0), 0);
      const items = [
        ['聚合记录', data.total || latestAggregates.length],
        ['覆盖省份', provinces.size],
        ['贡献用户', users.size],
        ['最快速度', bestSpeed + ' MB/s']
      ];
      statsEl.innerHTML = items.map(([label, value]) => '<div class="stat"><span>' + label + '</span><strong>' + value + '</strong></div>').join('');
    }

    function renderAggregates() {
      const items = latestAggregates.filter((item) =>
        (!selectedCarrier || item.carrier === selectedCarrier) &&
        (!selectedProvince || item.province_code === selectedProvince)
      );
      if (!items.length) {
        aggregatesEl.innerHTML = '<div class="empty">暂无可用于自动 DNS 的可信聚合数据。</div>';
        return;
      }
      aggregatesEl.innerHTML = items.map((item) => '<article class="card">'
        + '<div class="card-top"><span class="badge">' + escapeHtml(item.province_name) + ' · ' + (carrierLabels[item.carrier] || item.carrier) + '</span><span class="badge">' + escapeHtml(formatColo(item.colo)) + '</span></div>'
        + '<p class="host" title="点击复制域名" data-copy="' + escapeAttr(item.hostname) + '" data-copy-label="域名">' + escapeHtml(item.hostname) + '</p>'
        + '<p class="ip" title="点击复制 IP" data-copy="' + escapeAttr(item.ip) + '" data-copy-label="IP">' + escapeHtml(item.ip) + '</p>'
        + '<div class="metrics">'
        + '<div class="metric"><span>速度</span><strong>' + item.speed + ' MB/s</strong></div>'
        + '<div class="metric"><span>延迟</span><strong>' + item.latency + ' ms</strong></div>'
        + '<div class="metric"><span>归属</span><strong>' + escapeHtml(formatColo(item.colo)) + '</strong></div>'
        + '<div class="metric"><span>贡献者</span><strong>' + escapeHtml(item.nickname) + '</strong></div>'
        + '</div>'
        + '<p class="sync-line">最后同步时间：' + escapeHtml(formatRelativeTime(item.updated_at)) + '</p>'
        + '</article>').join('');
      aggregatesEl.querySelectorAll('[data-copy]').forEach((node) => node.addEventListener('click', () => copyText(node.dataset.copy, node.dataset.copyLabel)));
    }

    function renderProvinceChips() {
      const provinces = [...new Map(latestAggregates.map((item) => [item.province_code, item.province_name])).entries()]
        .filter(([code]) => code)
        .sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'));
      provinceChips.innerHTML = '<span class="filter-label">省份</span><button class="chip active" data-province="">全部</button>'
        + provinces.map(([code, name]) => '<button class="chip" data-province="' + escapeAttr(code) + '">' + escapeHtml(name) + '</button>').join('');
      selectedProvince = provinces.some(([code]) => code === selectedProvince) ? selectedProvince : '';
      updateActiveChips(provinceChips, 'province', selectedProvince);
    }

    function updateActiveChips(container, key, value) {
      container.querySelectorAll('[data-' + key + ']').forEach((chip) => {
        chip.classList.toggle('active', (chip.dataset[key] || '') === value);
      });
    }

    async function copyText(text, label) {
      try {
        await navigator.clipboard.writeText(text);
        showNotice((label || '内容') + ' 已成功复制');
        setTimeout(() => showNotice(''), 1000);
      } catch {
        showNotice('复制失败，请手动选择文本复制');
      }
    }

    function showNotice(text) {
      noticeEl.textContent = text;
      noticeEl.className = text ? 'notice show' : 'notice';
    }

    function formatBeijingTime(value) {
      return new Date(value).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    function formatRelativeTime(value) {
      const time = new Date(value).getTime();
      if (!Number.isFinite(time)) return '未知';
      const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
      if (diffSeconds < 60) return '刚刚';
      const minutes = Math.floor(diffSeconds / 60);
      if (minutes < 60) return minutes + ' 分钟前';
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + ' 小时前';
      return Math.floor(hours / 24) + ' 天前';
    }

    function formatColo(value) {
      const colo = String(value || '').trim().toUpperCase();
      if (!colo || colo === 'N/A') return '归属未知';
      return (coloLabels[colo] || colo) + ' · ' + colo;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/\\n/g, '&#10;');
    }
  </script>
</body>
</html>`;
}
