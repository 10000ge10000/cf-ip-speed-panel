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

function renderProjectLinks() {
  var cardStyle = [
    'display:grid',
    'grid-template-columns:repeat(auto-fit,minmax(230px,1fr))',
    'gap:10px',
    'margin-top:4px'
  ].join(';');
  var itemStyle = [
    'border:1px solid #d8e1ec',
    'border-radius:8px',
    'background:#fff',
    'padding:12px',
    'box-shadow:0 8px 24px rgba(15,23,42,.06)'
  ].join(';');
  var titleStyle = 'font-weight:700;color:#102033;margin-bottom:4px';
  var descStyle = 'color:#64748b;line-height:1.55;margin-bottom:10px';
  var linkStyle = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'min-height:32px',
    'padding:0 11px',
    'border:1px solid #9bc7ee',
    'border-radius:7px',
    'background:#eef7ff',
    'color:#0f4f91',
    'font-weight:700',
    'text-decoration:none'
  ].join(';');

  return '<div style="' + cardStyle + '">'
    + '<div style="' + itemStyle + '">'
    + '<div style="' + titleStyle + '">Web \u9762\u677f</div>'
    + '<div style="' + descStyle + '">\u67e5\u770b\u516c\u5f00\u4f17\u6d4b\u805a\u5408\u7ed3\u679c\u3001DNS \u57df\u540d\u548c OpenWrt \u4e0b\u8f7d\u5165\u53e3\u3002</div>'
    + '<a style="' + linkStyle + '" href="https://cf.6610000.xyz/" target="_blank" rel="noopener noreferrer">\u6253\u5f00\u9762\u677f</a>'
    + '</div>'
    + '<div style="' + itemStyle + '">'
    + '<div style="' + titleStyle + '">GitHub</div>'
    + '<div style="' + descStyle + '">\u67e5\u770b\u6e90\u7801\u3001Release\u3001Actions \u6784\u5efa\u8bb0\u5f55\u548c\u5b89\u88c5\u811a\u672c\u3002</div>'
    + '<a style="' + linkStyle + '" href="https://github.com/10000ge10000/cf-ip-speed-panel" target="_blank" rel="noopener noreferrer">\u6253\u5f00\u4ed3\u5e93</a>'
    + '</div>'
    + '</div>';
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
      _('\u6d4b\u901f\u671f\u95f4\u4f1a\u4e34\u65f6\u6682\u505c\u5e38\u89c1\u4ee3\u7406\u670d\u52a1\uff0c\u5b8c\u6210\u540e\u81ea\u52a8\u6062\u590d\uff1b\u4f60\u53ef\u4ee5\u9009\u62e9\u53ea\u6d4b\u8bd5 IPv4 \u6216\u540c\u65f6\u6d4b\u8bd5 IPv4+IPv6\uff0c\u4e5f\u53ef\u4ee5\u9009\u62e9\u4ec5\u672c\u5730\u81ea\u7528\u4e0d\u4e0a\u4f20\u3002')
    );

    var s = m.section(form.NamedSection, 'main', 'client');
    s.anonymous = true;
    s.tab('basic', _('\u57fa\u672c\u8bbe\u7f6e'));
    s.tab('log', _('\u65e5\u5fd7'));

    var links = s.taboption('basic', form.DummyValue, '_project_links', _('\u9879\u76ee\u8d44\u6e90'));
    links.rawhtml = true;
    links.cfgvalue = function() {
      return renderProjectLinks();
    };

    var o = s.taboption('basic', form.Flag, 'enabled', _('\u542f\u7528'));
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

    o = s.taboption('basic', form.Value, 'nickname', _('\u6635\u79f0'));
    o.description = _('\u6635\u79f0\u5148\u5230\u5148\u5f97\uff0c\u6ce8\u518c\u540e\u4f1a\u5c55\u793a\u5728\u8d21\u732e\u5217\u8868\u4e2d\u3002');
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

    o = s.taboption('basic', form.DummyValue, 'device_id', _('\u8bbe\u5907 ID'));
    o.cfgvalue = function(section_id) {
      return this.map.data.get('cf_ip_speed_client', section_id, 'device_id') || _('\u672a\u6ce8\u518c');
    };
    o.depends('upload_enabled', '1');

    o = s.taboption('basic', form.DummyValue, 'last_status', _('\u6700\u8fd1\u72b6\u6001'));
    o.rawhtml = true;
    o.cfgvalue = function(section_id) {
      var status = this.map.data.get('cf_ip_speed_client', section_id, 'last_status') || '-';
      var message = this.map.data.get('cf_ip_speed_client', section_id, 'last_message') || '';
      var at = this.map.data.get('cf_ip_speed_client', section_id, 'last_upload_at') || '';
      var parts = [
        '<strong>' + status + '</strong>',
        message ? message : '',
        at ? at : ''
      ].filter(Boolean);
      return parts.join('<br />');
    };

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

    var runButton = s.taboption('basic', form.Button, '_run', _('\u7acb\u5373\u6d4b\u901f'));
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
      bindCopyButtons(rendered);
      return rendered;
    }

    return rendered.then(function(node) {
      bindCopyButtons(node);
      return node;
    });
  }
});
