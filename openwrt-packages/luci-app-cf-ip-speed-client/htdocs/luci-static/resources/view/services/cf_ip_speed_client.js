'use strict';
'require view';
'require form';
'require fs';
'require ui';

function commandMessage(prefix, result) {
  var stdout = result && result.stdout ? result.stdout.trim() : '';
  var stderr = result && result.stderr ? result.stderr.trim() : '';
  return prefix + (stdout ? '\n\n' + stdout : '') + (stderr ? '\n\n' + stderr : '');
}

function showResult(title, body, reload) {
  ui.showModal(title, [
    E('pre', {
      'style': 'white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto'
    }, body),
    E('div', { 'class': 'right' }, [
      E('button', {
        'class': 'btn cbi-button',
        'click': function() {
          ui.hideModal();
          if (reload)
            window.location.reload();
        }
      }, _('\u5173\u95ed'))
    ])
  ]);
}

function saveForm(map) {
  return map.save().then(function() {
    return fs.exec('/usr/bin/cf-ip-speed-client', ['cron']).catch(function() {});
  });
}

function permissionHint(error) {
  var message = error && error.message ? error.message : String(error || '');
  if (/permission|access|denied|not permitted|unauthorized|forbidden/i.test(message))
    return _('LuCI \u6743\u9650\u4e0d\u8db3\uff0c\u8bf7\u91cd\u65b0\u5b89\u88c5\u63d2\u4ef6\u6216\u91cd\u8f7d rpcd\u3002');
  return message || _('\u672a\u77e5\u9519\u8bef');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}

function uciGet(map, sectionId, key) {
  return map.data.get('cf_ip_speed_client', sectionId, key) || '';
}

function formatNumber(value, suffix) {
  var number = Number(value);
  if (!isFinite(number))
    return '-';
  var text = number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return suffix ? text + ' ' + suffix : text;
}

function fallbackCopy(text) {
  var input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'readonly');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (e) {
    return false;
  } finally {
    document.body.removeChild(input);
  }
}

function copyText(text, label) {
  if (!text)
    return;

  function done(ok) {
    ui.addNotification(null, E('p', ok
      ? (label || _('\u5185\u5bb9')) + _('\u5df2\u590d\u5236')
      : _('\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u9009\u62e9\u5185\u5bb9\u590d\u5236')), ok ? 'info' : 'danger');
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      done(true);
    }).catch(function() {
      done(fallbackCopy(text));
    });
    return;
  }

  done(fallbackCopy(text));
}

function bindCopyButtons(root) {
  var buttons = root.querySelectorAll('[data-cf-copy]');
  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    if (button.getAttribute('data-cf-bound') === '1')
      continue;
    button.setAttribute('data-cf-bound', '1');
    button.addEventListener('click', function() {
      copyText(this.getAttribute('data-cf-copy'), this.getAttribute('data-cf-label'));
    });
  }
}

function formatRelativeTime(value) {
  if (!value)
    return '\u5c1a\u672a\u540c\u6b65';

  var normalized = String(value)
    .replace(' CST', '+08:00')
    .replace(' ', 'T');
  var timestamp = Date.parse(normalized);
  if (!isFinite(timestamp))
    return value;

  var seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60)
    return '\u521a\u521a';
  if (seconds < 3600)
    return Math.floor(seconds / 60) + ' \u5206\u949f\u524d';
  if (seconds < 86400)
    return Math.floor(seconds / 3600) + ' \u5c0f\u65f6\u524d';
  return Math.floor(seconds / 86400) + ' \u5929\u524d';
}

function renderOverview(map, sectionId) {
  var status = uciGet(map, sectionId, 'last_status') || '\u5f85\u8fd0\u884c';
  var updatedAt = uciGet(map, sectionId, 'last_upload_at') || '\u5c1a\u672a\u540c\u6b65';
  var deviceId = uciGet(map, sectionId, 'device_id') || '\u672a\u6ce8\u518c';
  var enabled = uciGet(map, sectionId, 'enabled') === '1';
  var v4 = localResult(map, sectionId, 'v4');
  var v6 = localResult(map, sectionId, 'v6');
  var healthy = /ok|success|\u6210\u529f|\u5b8c\u6210/i.test(status);
  var statusClass = healthy ? 'is-success' : 'is-neutral';
  var shortDeviceId = deviceId.length > 13 ? deviceId.slice(0, 8) + '\u2026' : deviceId;

  return '<div class="cfip-aside-content" data-enabled="' + (enabled ? '1' : '0') + '" data-relative="' + escapeAttr(formatRelativeTime(updatedAt)) + '">'
    + '<section class="cfip-summary cfip-card">'
    + '<div class="cfip-card-heading">'
    + '<strong>\u8fd0\u884c\u6458\u8981</strong>'
    + '<span class="cfip-status ' + statusClass + '">' + (healthy ? '\u6b63\u5e38' : escapeHtml(status)) + '</span>'
    + '</div>'
    + '<div class="cfip-metrics">'
    + '<div><span>\u8bbe\u5907 ID</span><strong title="' + escapeAttr(deviceId) + '">' + escapeHtml(shortDeviceId) + '</strong></div>'
    + '<div><span>\u6700\u8fd1\u72b6\u6001</span><strong class="' + (healthy ? 'is-good' : '') + '">' + escapeHtml(status) + '</strong></div>'
    + '<div><span>IPv4 \u6700\u4f73</span><strong>' + (v4 ? formatNumber(v4.speed, 'MB/s') : '-') + '</strong></div>'
    + '<div><span>IPv6 \u6700\u4f73</span><strong>' + (v6 ? formatNumber(v6.speed, 'MB/s') : '-') + '</strong></div>'
    + '</div>'
    + '<p class="cfip-sync">\u6700\u8fd1\u4efb\u52a1\uff1a' + escapeHtml(formatRelativeTime(updatedAt)) + '</p>'
    + '</section>'
    + '<section class="cfip-links cfip-card">'
    + '<div class="cfip-card-heading"><strong>\u9879\u76ee\u5165\u53e3</strong></div>'
    + '<a href="https://cf.6610000.xyz/" target="_blank" rel="noopener noreferrer">'
    + '<span><strong>\u8bbf\u95ee\u516c\u5f00\u9762\u677f</strong><small>cf.6610000.xyz</small></span><b aria-hidden="true">\u2197</b>'
    + '</a>'
    + '<a href="https://github.com/10000ge10000/cf-ip-speed-panel" target="_blank" rel="noopener noreferrer">'
    + '<span><strong>\u67e5\u770b\u9879\u76ee\u6e90\u7801</strong><small>GitHub \u00b7 10000ge10000</small></span><b aria-hidden="true">\u2197</b>'
    + '</a>'
    + '</section>'
    + '<section class="cfip-note cfip-card"><strong>\u6d4b\u901f\u8bf4\u660e</strong>'
    + '<p>\u6d4b\u901f\u671f\u95f4\u4f1a\u4e34\u65f6\u6682\u505c\u5df2\u8bc6\u522b\u7684\u4ee3\u7406\u670d\u52a1\uff0c\u4efb\u52a1\u7ed3\u675f\u540e\u81ea\u52a8\u6062\u590d\u3002</p></section>'
    + '</div>';
}

function applyPageDesign(root) {
  if (!document.getElementById('cfip-luci-design')) {
    var style = document.createElement('style');
    style.id = 'cfip-luci-design';
    style.textContent = [
      '.cfip-luci-page{--cfip-blue:#146bc7;--cfip-ink:#0d1f33;--cfip-muted:#5c738f;--cfip-line:#d6e0eb;max-width:1280px;margin:0 auto;padding:12px 0 32px;color:var(--cfip-ink)}',
      '.cfip-header{display:flex;align-items:center;justify-content:space-between;gap:24px;height:80px;margin-bottom:16px;padding:16px 22px;border:1px solid var(--cfip-line);border-radius:8px;background:#fff;box-sizing:border-box}',
      '.cfip-header::after{content:none!important;display:none!important}',
      '.cfip-header h2{margin:0 0 5px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;color:var(--cfip-ink);font-size:24px;line-height:1.2}',
      '.cfip-header .cbi-map-descr{margin:0!important;color:var(--cfip-muted);font-size:13px;line-height:1.45}',
      '.cfip-header-state{display:flex;align-items:center;gap:10px;flex:none;color:var(--cfip-muted);font-size:12px;font-weight:600}',
      '.cfip-header-state strong{padding:6px 10px;border-radius:999px;background:#e8faf5;color:#0a8c73;font-size:12px}',
      '.cfip-luci-page>.cbi-section{border:0;background:transparent;box-shadow:none}',
      '.cfip-layout{display:grid;grid-template-columns:minmax(0,780px) minmax(300px,400px);gap:20px;align-items:start}',
      '.cfip-main{display:flex;min-width:0;flex-direction:column;gap:16px}',
      '.cfip-aside{display:flex;min-width:0;flex-direction:column;gap:16px}',
      '.cfip-luci-page .cbi-section-node{padding:0;border:0;background:transparent;box-shadow:none}',
      '.cfip-luci-page .cbi-tabmenu{display:flex;gap:6px;width:100%;height:44px;padding:4px;margin:0;border:0;border-radius:8px;background:#e8edf2;box-sizing:border-box}',
      '.cfip-luci-page .cbi-tabmenu li{border:0!important;background:transparent!important;margin:0!important}',
      '.cfip-luci-page .cbi-tabmenu li a{display:flex;align-items:center;justify-content:center;min-width:100px;height:36px;padding:0 18px!important;border:1px solid var(--cfip-line)!important;border-radius:7px;background:#fff!important;color:var(--cfip-ink)!important;text-align:center;font-size:14px;font-weight:700;text-decoration:none;box-sizing:border-box}',
      '.cfip-luci-page .cbi-tabmenu li.cbi-tab a{width:130px;background:var(--cfip-blue)!important;border-color:var(--cfip-blue)!important;color:#fff!important;box-shadow:none}',
      '.cfip-panel,.cfip-card{min-width:0;padding:18px;border:1px solid var(--cfip-line);border-radius:8px;background:#fff;box-sizing:border-box}',
      '.cfip-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}',
      '.cfip-panel-title{grid-column:1/-1;margin:0;color:var(--cfip-ink);font-size:18px;line-height:1.25}',
      '.cfip-panel .cbi-value{display:flex;min-width:0;flex-direction:column;padding:0;border:0}',
      '.cfip-panel .cbi-value.hidden{display:none}',
      '.cfip-panel .cbi-value-title{width:auto;margin:0 0 7px;color:var(--cfip-muted);font-size:13px;font-weight:700;line-height:1.25}',
      '.cfip-panel .cbi-value-field{width:auto;min-width:0}',
      '.cfip-panel .cbi-value-description{margin-top:7px;color:var(--cfip-muted);font-size:12px;line-height:1.45}',
      '.cfip-run [data-name=\"upload_enabled\"] .cbi-value-description,.cfip-run [data-name=\"ip_mode\"] .cbi-value-description{display:none}',
      '.cfip-panel input[type=text],.cfip-panel input[type=number],.cfip-panel select{width:100%;max-width:none;min-height:44px;border-color:#bfcfe0;border-radius:7px;background:#fff;box-sizing:border-box}',
      '.cfip-enabled{grid-column:1/-1}',
      '.cfip-enabled.cbi-value{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center}',
      '.cfip-enabled .cbi-value-title{margin-bottom:3px;color:var(--cfip-ink);font-size:14px}',
      '.cfip-enabled .cbi-value-description{grid-column:1;margin:0}',
      '.cfip-enabled .cbi-value-field{grid-column:2;grid-row:1/3}',
      '.cfip-time{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}',
      '.cfip-time-field{min-width:0}',
      '.cfip-time-field>.cbi-value-title{display:block;width:auto;margin:0 0 7px;color:var(--cfip-muted);font-size:13px;font-weight:700}',
      '.cfip-time-field>.cbi-value-description{margin-top:7px;color:var(--cfip-muted);font-size:12px;line-height:1.45}',
      '.cfip-time>span{color:var(--cfip-muted);font-weight:700}',
      '.cfip-time .cbi-value{display:block}',
      '.cfip-time .cbi-value-title,.cfip-time .cbi-value-description{display:none}',
      '.cfip-identity{grid-template-columns:1fr}',
      '.cfip-identity .cfip-actions{display:flex;gap:10px;align-items:center}',
      '.cfip-actions .cbi-value{width:auto}',
      '.cfip-actions .cbi-value-title{display:none}',
      '.cfip-actions .cbi-value-field{display:block}',
      '.cfip-actions .cbi-button{margin:0;min-width:150px}',
      '.cfip-actions [data-name=\"_run\"] .cbi-button{min-width:210px}',
      '.cfip-luci-page .cbi-button{min-height:42px;padding:0 16px;border-radius:7px;font-weight:700;transition:transform .15s ease,box-shadow .15s ease}',
      '.cfip-luci-page .cbi-button:hover{transform:translateY(-1px)}',
      '.cfip-luci-page .cbi-button-action{background:var(--cfip-blue)!important;border-color:var(--cfip-blue)!important;color:#fff!important;box-shadow:none}',
      '.cfip-luci-page .cbi-button-apply{background:#fff!important;border-color:#b8c7d8!important;color:var(--cfip-ink)!important}',
      '.cfip-aside-content{display:flex;flex-direction:column;gap:16px}',
      '.cfip-card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}',
      '.cfip-card-heading>strong{font-size:18px}',
      '.cfip-status{flex:none;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:700}',
      '.cfip-status.is-success{background:#e9fbf7;color:#087c6c}',
      '.cfip-status.is-neutral{background:#eef3f8;color:#516174}',
      '.cfip-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
      '.cfip-metrics div{min-width:0;padding:12px;border-radius:7px;background:#f7fafc}',
      '.cfip-metrics span{display:block;margin-bottom:4px;color:var(--cfip-muted);font-size:12px}',
      '.cfip-metrics strong{display:block;overflow:hidden;color:var(--cfip-ink);text-overflow:ellipsis;white-space:nowrap}',
      '.cfip-metrics strong.is-good{color:#0a8c73}',
      '.cfip-sync{margin:11px 0 0;color:var(--cfip-muted);font-size:12px}',
      '.cfip-links{display:grid;gap:9px}',
      '.cfip-links .cfip-card-heading{margin-bottom:5px}',
      '.cfip-links a{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:64px;padding:9px 12px;border:1px solid var(--cfip-line);border-radius:7px;background:#f7fafc;color:var(--cfip-ink);text-decoration:none;transition:transform .15s ease,border-color .15s ease,background .15s ease;box-sizing:border-box}',
      '.cfip-links a:hover{transform:translateY(-1px);border-color:#9bc7ee;background:#f0f7ff}',
      '.cfip-links a strong,.cfip-links a small{display:block}',
      '.cfip-links a small{margin-top:3px;color:var(--cfip-muted);font-size:12px}',
      '.cfip-links a b{color:var(--cfip-blue);font-size:18px}',
      '.cfip-note{border-color:#f5c775;background:#fffaed}',
      '.cfip-note strong{color:#bf590d;font-size:14px}',
      '.cfip-note p{margin:12px 0 0;color:var(--cfip-ink);font-size:13px;line-height:1.5}',
      '.cfip-log-panel{padding:18px;border:1px solid var(--cfip-line);border-radius:8px;background:#fff}',
      '@media(max-width:900px){.cfip-luci-page{padding:8px 0 24px}.cfip-header{display:block;height:auto;min-height:112px;padding:16px}.cfip-header h2{font-size:21px}.cfip-header-state{margin-top:12px}.cfip-layout{display:flex;flex-direction:column;gap:14px}.cfip-main,.cfip-aside{width:100%}.cfip-luci-page .cbi-tabmenu{height:42px;padding:3px}.cfip-luci-page .cbi-tabmenu li{flex:1}.cfip-luci-page .cbi-tabmenu li a,.cfip-luci-page .cbi-tabmenu li.cbi-tab a{width:100%;min-width:0}.cfip-panel{grid-template-columns:1fr;gap:12px;padding:16px 14px}.cfip-panel-title{font-size:17px}.cfip-enabled.cbi-value{display:grid!important}.cfip-time{grid-template-columns:1fr auto 1fr}.cfip-identity .cfip-actions{flex-direction:column}.cfip-actions [data-name=\"_run\"]{order:-1}.cfip-actions .cbi-value,.cfip-actions .cbi-button{width:100%;min-width:0!important}.cfip-card{padding:16px 14px}.cfip-card-heading>strong{font-size:17px}.cfip-summary .cfip-metrics{display:block}.cfip-summary .cfip-metrics div{padding:0;background:transparent}.cfip-summary .cfip-metrics div+div{margin-top:10px}.cfip-summary .cfip-metrics div:nth-child(n+3){display:none}.cfip-summary .cfip-metrics span,.cfip-summary .cfip-metrics strong{display:inline}.cfip-summary .cfip-metrics span{margin-right:8px}.cfip-sync{display:none}.cfip-links a{min-height:58px}.cfip-note{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  if (!root || !root.classList || root.getAttribute('data-cfip-layout') === '1')
    return;

  root.classList.add('cfip-luci-page');
  root.setAttribute('data-cfip-layout', '1');

  var title = root.querySelector('h2');
  var description = root.querySelector('.cbi-map-descr');
  var section = root.querySelector('.cbi-section');
  var tabMenu = section && section.querySelector('.cbi-tabmenu');
  var sectionNode = section && section.querySelector('.cbi-section-node');
  var basic = root.querySelector('[id="container.cf_ip_speed_client.main.basic"]');
  var log = root.querySelector('[id="container.cf_ip_speed_client.main.log"]');
  var overview = root.querySelector('[id="cbi-cf_ip_speed_client-main-_overview"]');
  if (!title || !description || !section || !tabMenu || !sectionNode || !basic || !log || !overview)
    return;

  var asideContent = overview.querySelector('.cfip-aside-content');
  var header = document.createElement('header');
  header.className = 'cfip-header';
  var headerCopy = document.createElement('div');
  headerCopy.appendChild(title);
  headerCopy.appendChild(description);
  header.appendChild(headerCopy);
  var headerState = document.createElement('div');
  headerState.className = 'cfip-header-state';
  var enabled = asideContent && asideContent.getAttribute('data-enabled') === '1';
  var relative = asideContent ? asideContent.getAttribute('data-relative') : '';
  headerState.innerHTML = '<strong>' + (enabled ? '\u670d\u52a1\u5df2\u542f\u7528' : '\u670d\u52a1\u672a\u542f\u7528') + '</strong><span>\u4e0a\u6b21\u540c\u6b65 ' + escapeHtml(relative || '\u5c1a\u672a\u8fd0\u884c') + '</span>';
  header.appendChild(headerState);
  root.insertBefore(header, section);

  var layout = document.createElement('div');
  layout.className = 'cfip-layout';
  var main = document.createElement('main');
  main.className = 'cfip-main';
  var aside = document.createElement('aside');
  aside.className = 'cfip-aside';
  layout.appendChild(main);
  layout.appendChild(aside);
  section.appendChild(layout);
  main.appendChild(tabMenu);
  main.appendChild(sectionNode);
  aside.appendChild(overview);
  overview.classList.remove('cbi-value');
  overview.removeAttribute('id');
  var overviewTitle = overview.querySelector('.cbi-value-title');
  if (overviewTitle)
    overviewTitle.remove();
  var overviewField = overview.querySelector('.cbi-value-field');
  if (overviewField && asideContent) {
    overviewField.parentNode.insertBefore(asideContent, overviewField);
    overviewField.remove();
  }

  function field(name) {
    return root.querySelector('[id="cbi-cf_ip_speed_client-main-' + name + '"]');
  }

  function createPanel(className, heading) {
    var panel = document.createElement('section');
    panel.className = 'cfip-panel ' + className;
    var panelTitle = document.createElement('h3');
    panelTitle.className = 'cfip-panel-title';
    panelTitle.textContent = heading;
    panel.appendChild(panelTitle);
    return panel;
  }

  var runPanel = createPanel('cfip-run', '\u8fd0\u884c\u8bbe\u7f6e');
  var identityPanel = createPanel('cfip-identity', '\u8eab\u4efd\u4e0e\u4e0a\u4f20');
  basic.insertBefore(runPanel, basic.firstChild);
  basic.insertBefore(identityPanel, runPanel.nextSibling);

  var enabledField = field('enabled');
  enabledField.classList.add('cfip-enabled');
  var enabledDescription = document.createElement('div');
  enabledDescription.className = 'cbi-value-description';
  enabledDescription.textContent = '\u4fdd\u5b58\u914d\u7f6e\u540e\u6309\u8ba1\u5212\u6267\u884c\u6d4b\u901f\u4efb\u52a1';
  enabledField.appendChild(enabledDescription);
  runPanel.appendChild(enabledField);
  ['upload_enabled', 'ip_mode', 'schedule_mode', 'interval_hours'].forEach(function(name) {
    runPanel.appendChild(field(name));
  });

  var time = document.createElement('div');
  time.className = 'cfip-time-field';
  var timeTitle = document.createElement('div');
  timeTitle.className = 'cbi-value-title';
  timeTitle.textContent = '\u6bcf\u5929\u5f00\u59cb\u65f6\u95f4';
  var timeInputs = document.createElement('div');
  timeInputs.className = 'cfip-time';
  var hour = field('daily_hour');
  var minute = field('daily_minute');
  timeInputs.appendChild(hour);
  var colon = document.createElement('span');
  colon.textContent = ':';
  timeInputs.appendChild(colon);
  timeInputs.appendChild(minute);
  time.appendChild(timeTitle);
  time.appendChild(timeInputs);
  var dailyHint = field('_daily_hint');
  var hintText = dailyHint.querySelector('.cbi-value-field');
  if (hintText) {
    hintText.className = 'cbi-value-description';
    time.appendChild(hintText);
  }
  dailyHint.remove();
  runPanel.appendChild(time);

  var nickname = field('nickname');
  identityPanel.appendChild(nickname);
  var actions = document.createElement('div');
  actions.className = 'cfip-actions';
  actions.appendChild(field('_register'));
  actions.appendChild(field('_run'));
  identityPanel.appendChild(actions);

  var localResults = field('_local_results');
  if (localResults)
    basic.appendChild(localResults);

  log.classList.add('cfip-log-panel');
  function updateTabLayout() {
    var basicVisible = window.getComputedStyle(basic).display !== 'none';
    aside.style.display = basicVisible ? '' : 'none';
    var dailyVisible = window.getComputedStyle(hour).display !== 'none' || window.getComputedStyle(minute).display !== 'none';
    time.style.display = dailyVisible ? '' : 'none';
  }

  var observer = new MutationObserver(updateTabLayout);
  observer.observe(sectionNode, {
    attributes: true,
    subtree: true,
    attributeFilter: ['style', 'class']
  });
  tabMenu.addEventListener('click', function() {
    window.setTimeout(updateTabLayout, 0);
  });
  updateTabLayout();
}

function localResult(map, sectionId, version) {
  var prefix = 'last_result_' + version + '_';
  var ip = uciGet(map, sectionId, prefix + 'ip');
  if (!ip)
    return null;

  return {
    version: version,
    label: version === 'v6' ? 'IPv6' : 'IPv4',
    recordType: uciGet(map, sectionId, prefix + 'record_type') || (version === 'v6' ? 'AAAA' : 'A'),
    ip: ip,
    port: uciGet(map, sectionId, prefix + 'port') || '443',
    speed: uciGet(map, sectionId, prefix + 'speed'),
    latency: uciGet(map, sectionId, prefix + 'latency'),
    loss: uciGet(map, sectionId, prefix + 'loss'),
    colo: uciGet(map, sectionId, prefix + 'colo') || '-',
    resultFile: uciGet(map, sectionId, prefix + 'result_file'),
    routeInterface: uciGet(map, sectionId, prefix + 'route_interface') || '-',
    egressIp: uciGet(map, sectionId, prefix + 'egress_ip') || '-',
    proxySuspected: uciGet(map, sectionId, prefix + 'proxy_suspected'),
    warning: uciGet(map, sectionId, prefix + 'warning'),
    updatedAt: uciGet(map, sectionId, prefix + 'updated_at')
  };
}

function renderMetric(label, value) {
  return '<div style="background:rgba(248,250,252,.9);border:1px solid rgba(216,225,236,.8);border-radius:8px;padding:9px">'
    + '<div style="color:#64748b;font-size:12px;margin-bottom:4px">' + escapeHtml(label) + '</div>'
    + '<strong style="display:block;word-break:break-word;color:#102033">' + escapeHtml(value || '-') + '</strong>'
    + '</div>';
}

function renderResultCard(item) {
  var isV6 = item.version === 'v6';
  var accent = isV6 ? '#0f8f7f' : '#1677d2';
  var soft = isV6 ? '#f2fcf9' : '#f8fbff';
  var badge = 'display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;border:1px solid rgba(15,143,127,.28);background:#e9fbf7;color:#0b7669;font-size:12px;font-weight:700';
  var copyButton = 'border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#102033;min-height:30px;padding:0 9px;cursor:pointer';
  var ipPort = isV6 ? '[' + item.ip + ']:' + item.port : item.ip + ':' + item.port;

  return '<section style="border:1px solid rgba(216,225,236,.95);border-radius:8px;background:linear-gradient(180deg,#fff 0,' + soft + ' 100%);padding:14px;min-width:0">'
    + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px">'
    + '<div style="min-width:0">'
    + '<div style="font-size:16px;font-weight:800;color:#102033;margin-bottom:6px">' + item.label + ' \u00b7 ' + escapeHtml(item.recordType) + '</div>'
    + '<span style="' + badge + '">' + (item.proxySuspected === 'true' ? '\u51fa\u53e3\u9700\u590d\u6838' : '\u672c\u5730\u76f4\u8fde') + '</span>'
    + '</div>'
    + '<div style="color:#64748b;font-size:12px;text-align:right">' + escapeHtml(item.updatedAt || '-') + '</div>'
    + '</div>'
    + '<div style="display:grid;gap:8px;margin-bottom:11px">'
    + '<div style="display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center">'
    + '<span style="color:#64748b;font-size:12px;font-weight:700">IP</span>'
    + '<code style="display:block;color:' + accent + ';font-size:' + (isV6 ? '15px' : '19px') + ';font-weight:800;word-break:break-all;line-height:1.35">' + escapeHtml(item.ip) + '</code>'
    + '<button type="button" class="btn cbi-button" style="' + copyButton + '" data-cf-copy="' + escapeAttr(item.ip) + '" data-cf-label="' + item.label + ' IP">\u590d\u5236 IP</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center">'
    + '<span style="color:#64748b;font-size:12px;font-weight:700">\u7aef\u53e3</span>'
    + '<code style="display:block;color:#102033;font-weight:700;word-break:break-all">' + escapeHtml(ipPort) + '</code>'
    + '<button type="button" class="btn cbi-button" style="' + copyButton + '" data-cf-copy="' + escapeAttr(ipPort) + '" data-cf-label="' + item.label + ' IP:Port">IP:\u7aef\u53e3</button>'
    + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">'
    + renderMetric('\u901f\u5ea6', formatNumber(item.speed, 'MB/s'))
    + renderMetric('\u5ef6\u8fdf', formatNumber(item.latency, 'ms'))
    + renderMetric('\u4e22\u5305', formatNumber(item.loss, '%'))
    + renderMetric('\u6570\u636e\u4e2d\u5fc3', item.colo)
    + renderMetric('\u8def\u7531\u51fa\u53e3', item.routeInterface)
    + renderMetric('\u51fa\u53e3 IP', item.egressIp)
    + '</div>'
    + (item.warning ? '<div style="margin-top:10px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px;line-height:1.5">' + escapeHtml(item.warning) + '</div>' : '')
    + (item.resultFile ? '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#64748b"><span>\u7ed3\u679c\u6587\u4ef6</span><code style="word-break:break-all;color:#102033">' + escapeHtml(item.resultFile) + '</code><button type="button" class="btn cbi-button" style="' + copyButton + '" data-cf-copy="' + escapeAttr(item.resultFile) + '" data-cf-label="\u7ed3\u679c\u6587\u4ef6">\u590d\u5236</button></div>' : '')
    + '</section>';
}

function renderLocalResults(map, sectionId) {
  var results = [
    localResult(map, sectionId, 'v4'),
    localResult(map, sectionId, 'v6')
  ].filter(Boolean);

  if (!results.length) {
    return '<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:16px;color:#64748b;line-height:1.7;background:#fff">'
      + '\u6682\u65e0\u672c\u5730\u6d4b\u901f\u7ed3\u679c\u3002\u4fdd\u5b58\u914d\u7f6e\u540e\u70b9\u51fb\u201c\u7acb\u5373\u6d4b\u901f\u201d\uff0c\u5b8c\u6210\u540e\u4f1a\u5728\u8fd9\u91cc\u751f\u6210\u53ef\u590d\u5236\u7684 IP \u5361\u7247\u3002'
      + '</div>';
  }

  return '<div style="display:grid;gap:12px;margin-top:4px">'
    + '<div style="color:#64748b;line-height:1.6">\u8fd9\u4e9b\u7ed3\u679c\u4ec5\u4fdd\u5b58\u5728\u672c\u673a UCI \u914d\u7f6e\u4e2d\uff0c\u4e0d\u4f1a\u4e0a\u4f20\u5230\u516c\u5f00\u9762\u677f\u3002</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">'
    + results.map(renderResultCard).join('')
    + '</div>'
    + '</div>';
}

return view.extend({
  applyCron: function() {
    return fs.exec('/usr/bin/cf-ip-speed-client', ['cron']).catch(function(error) {
      ui.addNotification(null, E('p', _('\u5b9a\u65f6\u4efb\u52a1\u66f4\u65b0\u5931\u8d25\uff1a') + permissionHint(error)), 'danger');
    });
  },

  handleSave: function(ev) {
    var self = this;
    return this.super('handleSave', [ev]).then(function() {
      return self.applyCron();
    });
  },

  handleSaveApply: function(ev, mode) {
    var self = this;
    return this.super('handleSaveApply', [ev, mode]).then(function() {
      return self.applyCron();
    });
  },

  render: function() {
    var m = new form.Map(
      'cf_ip_speed_client',
      _('Cloudflare IP \u4f18\u9009\u52a9\u624b'),
      _('\u81ea\u52a8\u4f18\u9009 Cloudflare IP\uff0c\u5e76\u6309\u8ba1\u5212\u5b8c\u6210\u6d4b\u901f\u4e0e\u4e0a\u4f20')
    );

    var s = m.section(form.NamedSection, 'main', 'client');
    s.anonymous = true;
    s.tab('basic', _('\u57fa\u672c\u8bbe\u7f6e'));
    s.tab('log', _('\u65e5\u5fd7'));

    var overview = s.taboption('basic', form.DummyValue, '_overview');
    overview.rawhtml = true;
    overview.cfgvalue = function(section_id) {
      return renderOverview(this.map, section_id);
    };

    var o = s.taboption('basic', form.Flag, 'enabled', _('\u542f\u7528\u81ea\u52a8\u6d4b\u901f'));
    o.default = '0';
    o.rmempty = false;

    o = s.taboption('basic', form.ListValue, 'upload_enabled', _('\u6570\u636e\u7528\u9014'));
    o.value('1', _('\u4e0a\u4f20\u516c\u5f00\u4f17\u6d4b'));
    o.value('0', _('\u4ec5\u672c\u5730\u81ea\u7528'));
    o.default = '1';
    o.rmempty = false;
    o.description = _('\u81ea\u7528\u6a21\u5f0f\u53ea\u751f\u6210\u672c\u673a cfst \u7ed3\u679c\u6587\u4ef6\uff0c\u4e0d\u6ce8\u518c\u6635\u79f0\uff0c\u4e5f\u4e0d\u4e0a\u4f20\u6570\u636e\u3002');

    o = s.taboption('basic', form.ListValue, 'ip_mode', _('IP \u6d4b\u8bd5\u8303\u56f4'));
    o.value('v4', _('\u4ec5 IPv4'));
    o.value('dual', _('IPv4 + IPv6'));
    o.default = 'v4';
    o.rmempty = false;
    o.description = _('IPv4+IPv6 \u4f1a\u987a\u5e8f\u6267\u884c\u4e24\u6b21\u6d4b\u901f\uff1b\u5982\u679c\u8def\u7531\u5668\u6ca1\u6709 IPv6 \u9ed8\u8ba4\u8def\u7531\uff0c\u4f1a\u81ea\u52a8\u8df3\u8fc7 IPv6\u3002');

    o = s.taboption('basic', form.Value, 'nickname', _('\u8d21\u732e\u6635\u79f0'));
    o.description = _('\u6635\u79f0\u7528\u4e8e\u516c\u5f00\u8d21\u732e\u5217\u8868\uff0c\u6ce8\u518c\u6210\u529f\u540e\u5c06\u4fdd\u7559\u5728\u8bbe\u5907\u4e2d\u3002');
    o.placeholder = '\u4e00\u4e07AI\u5206\u4eab';
    o.rmempty = false;
    o.depends('upload_enabled', '1');

    o = s.taboption('basic', form.ListValue, 'schedule_mode', _('\u6d4b\u901f\u65b9\u5f0f'));
    o.value('interval', _('\u5468\u671f\u6027\u6d4b\u901f'));
    o.value('daily', _('\u6bcf\u5929\u5b9a\u65f6\u6d4b\u901f'));
    o.default = 'interval';
    o.rmempty = false;

    o = s.taboption('basic', form.Value, 'interval_hours', _('\u5468\u671f\u6d4b\u901f\u95f4\u9694\uff08\u5c0f\u65f6\uff09'));
    o.default = '6';
    o.datatype = 'range(1,168)';
    o.rmempty = false;
    o.depends('schedule_mode', 'interval');

    o = s.taboption('basic', form.Value, 'daily_hour', _('\u6bcf\u5929\u6d4b\u901f\u65f6\u95f4\uff08\u5c0f\u65f6\uff09'));
    o.default = '3';
    o.datatype = 'range(0,23)';
    o.rmempty = false;
    o.depends('schedule_mode', 'daily');

    o = s.taboption('basic', form.Value, 'daily_minute', _('\u6bcf\u5929\u6d4b\u901f\u65f6\u95f4\uff08\u5206\u949f\uff09'));
    o.default = '0';
    o.datatype = 'range(0,59)';
    o.rmempty = false;
    o.depends('schedule_mode', 'daily');

    o = s.taboption('basic', form.DummyValue, '_daily_hint', _('\u95f2\u65f6\u63d0\u9192'));
    o.cfgvalue = function() {
      return _('\u5efa\u8bae\u5c3d\u91cf\u9009\u62e9\u6bcf\u5929\u95f2\u65f6\u6d4b\u901f\uff0c\u4f8b\u5982\u51cc\u6668 3 \u70b9\u81f3 5 \u70b9\uff0c\u907f\u514d\u5f71\u54cd\u6b63\u5e38\u4ee3\u7406\u4e0a\u7f51\u4f53\u9a8c\u3002');
    };
    o.depends('schedule_mode', 'daily');

    o = s.taboption('log', form.ListValue, 'log_clear_interval', _('\u65e5\u5fd7\u5b9a\u65f6\u6e05\u7406'));
    o.value('never', _('\u4e0d\u81ea\u52a8\u6e05\u7406'));
    o.value('daily', _('\u6bcf\u5929\u6e05\u7406'));
    o.value('weekly', _('\u6bcf\u5468\u6e05\u7406'));
    o.value('monthly', _('\u6bcf\u6708\u6e05\u7406'));
    o.default = 'weekly';
    o.rmempty = false;

    o = s.taboption('log', form.ListValue, 'log_max_size', _('\u65e5\u5fd7\u5927\u5c0f\u4e0a\u9650'));
    o.value('102400', '100 KB');
    o.value('1048576', '1 MB');
    o.value('5242880', '5 MB');
    o.default = '1048576';
    o.rmempty = false;

    o = s.taboption('basic', form.DummyValue, '_local_results', _('\u672c\u5730\u81ea\u7528\u7ed3\u679c'));
    o.rawhtml = true;
    o.cfgvalue = function(section_id) {
      return renderLocalResults(this.map, section_id);
    };
    o.depends('upload_enabled', '0');

    var registerButton = s.taboption('basic', form.Button, '_register', _('\u6ce8\u518c\u6635\u79f0'));
    registerButton.inputstyle = 'apply';
    registerButton.depends('upload_enabled', '1');
    registerButton.onclick = function() {
      showResult(_('\u6ce8\u518c\u6635\u79f0'), _('\u6b63\u5728\u6ce8\u518c\uff0c\u8bf7\u7a0d\u5019...'), false);
      return saveForm(m).then(function() {
        return fs.exec('/usr/bin/cf-ip-speed-client', ['register']);
      }).then(function(result) {
        showResult(_('\u6ce8\u518c\u6210\u529f'), commandMessage(_('\u6ce8\u518c\u5b8c\u6210\uff0c\u8bf7\u67e5\u770b\u8bbe\u5907 ID\u3002'), result), true);
      }).catch(function(error) {
        showResult(_('\u6ce8\u518c\u5931\u8d25'), _('\u6ce8\u518c\u5931\u8d25\uff1a') + permissionHint(error), true);
      });
    };

    var runButton = s.taboption('basic', form.Button, '_run', _('\u7acb\u5373\u6d4b\u901f\u5e76\u4e0a\u4f20'));
    runButton.inputstyle = 'action';
    runButton.onclick = function() {
      showResult(_('\u6d4b\u901f\u4efb\u52a1'), _('\u6b63\u5728\u542f\u52a8\u540e\u53f0\u6d4b\u901f\u4efb\u52a1\uff0c\u8bf7\u7a0d\u5019...'), false);
      return saveForm(m).then(function() {
        return fs.exec('/usr/bin/cf-ip-speed-client', ['run-background']);
      }).then(function(result) {
        showResult(_('\u4efb\u52a1\u5df2\u542f\u52a8'), commandMessage(_('\u540e\u53f0\u6d4b\u901f\u5df2\u542f\u52a8\u3002\u8bf7\u7a0d\u540e\u5237\u65b0\u9875\u9762\u67e5\u770b\u6700\u8fd1\u72b6\u6001\uff0c\u4efb\u52a1\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u6062\u590d\u4ee3\u7406\u670d\u52a1\u3002'), result), true);
      }).catch(function(error) {
        showResult(_('\u6267\u884c\u5931\u8d25'), _('\u6267\u884c\u5931\u8d25\uff1a') + permissionHint(error), true);
      });
    };

    var logButton = s.taboption('log', form.Button, '_show_log', _('\u67e5\u770b\u65e5\u5fd7'));
    logButton.inputstyle = 'action';
    logButton.onclick = function() {
      showResult(_('\u8fd0\u884c\u65e5\u5fd7'), _('\u6b63\u5728\u8bfb\u53d6\u65e5\u5fd7...'), false);
      return fs.exec('/usr/bin/cf-ip-speed-client', ['show-log']).then(function(result) {
        showResult(_('\u8fd0\u884c\u65e5\u5fd7'), commandMessage('', result), false);
      }).catch(function(error) {
        showResult(_('\u8bfb\u53d6\u5931\u8d25'), _('\u8bfb\u53d6\u65e5\u5fd7\u5931\u8d25\uff1a') + permissionHint(error), false);
      });
    };

    var clearLogButton = s.taboption('log', form.Button, '_clear_log', _('\u6e05\u7a7a\u65e5\u5fd7'));
    clearLogButton.inputstyle = 'remove';
    clearLogButton.onclick = function() {
      showResult(_('\u6e05\u7a7a\u65e5\u5fd7'), _('\u6b63\u5728\u6e05\u7a7a\u65e5\u5fd7...'), false);
      return fs.exec('/usr/bin/cf-ip-speed-client', ['clear-log']).then(function(result) {
        showResult(_('\u6e05\u7a7a\u5b8c\u6210'), commandMessage(_('\u65e5\u5fd7\u5df2\u6e05\u7a7a\u3002'), result), true);
      }).catch(function(error) {
        showResult(_('\u6e05\u7a7a\u5931\u8d25'), _('\u6e05\u7a7a\u65e5\u5fd7\u5931\u8d25\uff1a') + permissionHint(error), false);
      });
    };

    var rendered = m.render();
    if (!rendered || typeof rendered.then !== 'function') {
      applyPageDesign(rendered);
      bindCopyButtons(rendered);
      return rendered;
    }

    return rendered.then(function(node) {
      applyPageDesign(node);
      bindCopyButtons(node);
      return node;
    });
  }
});
