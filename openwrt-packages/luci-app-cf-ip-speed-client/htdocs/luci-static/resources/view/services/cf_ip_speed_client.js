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
      _('\u6d4b\u901f\u671f\u95f4\u4f1a\u4e34\u65f6\u6682\u505c\u5e38\u89c1\u4ee3\u7406\u670d\u52a1\uff0c\u5b8c\u6210\u540e\u81ea\u52a8\u6062\u590d\uff1b\u7591\u4f3c\u4ee3\u7406\u6570\u636e\u4f1a\u4fdd\u5b58\u5c55\u793a\uff0c\u4f46\u4e0d\u4f1a\u53c2\u4e0e DNS \u4f18\u9009\u3002')
    );

    var s = m.section(form.NamedSection, 'main', 'client');
    s.anonymous = true;

    var links = s.option(form.DummyValue, '_project_links', _('\u9879\u76ee\u94fe\u63a5'));
    links.rawhtml = true;
    links.cfgvalue = function() {
      return '<a href="https://cf.6610000.xyz/" target="_blank" rel="noopener noreferrer">\u9879\u76ee\u9875\u9762</a>'
        + ' | <a href="https://github.com/10000ge10000/cf-ip-speed-panel" target="_blank" rel="noopener noreferrer">GitHub</a>';
    };

    var o = s.option(form.Flag, 'enabled', _('\u542f\u7528'));
    o.default = '0';
    o.rmempty = false;

    o = s.option(form.Value, 'nickname', _('\u6635\u79f0'));
    o.description = _('\u6635\u79f0\u5148\u5230\u5148\u5f97\uff0c\u6ce8\u518c\u540e\u4f1a\u5c55\u793a\u5728\u8d21\u732e\u5217\u8868\u4e2d\u3002');
    o.placeholder = '\u4e00\u4e07AI\u5206\u4eab';
    o.rmempty = false;

    o = s.option(form.ListValue, 'schedule_mode', _('\u6d4b\u901f\u65b9\u5f0f'));
    o.value('interval', _('\u5468\u671f\u6027\u6d4b\u901f'));
    o.value('daily', _('\u6bcf\u5929\u5b9a\u65f6\u6d4b\u901f'));
    o.default = 'interval';
    o.rmempty = false;

    o = s.option(form.Value, 'interval_hours', _('\u5468\u671f\u6d4b\u901f\u95f4\u9694\uff08\u5c0f\u65f6\uff09'));
    o.default = '6';
    o.datatype = 'range(1,168)';
    o.rmempty = false;
    o.depends('schedule_mode', 'interval');

    o = s.option(form.Value, 'daily_hour', _('\u6bcf\u5929\u6d4b\u901f\u65f6\u95f4\uff08\u5c0f\u65f6\uff09'));
    o.default = '3';
    o.datatype = 'range(0,23)';
    o.rmempty = false;
    o.depends('schedule_mode', 'daily');

    o = s.option(form.Value, 'daily_minute', _('\u6bcf\u5929\u6d4b\u901f\u65f6\u95f4\uff08\u5206\u949f\uff09'));
    o.default = '0';
    o.datatype = 'range(0,59)';
    o.rmempty = false;
    o.depends('schedule_mode', 'daily');

    o = s.option(form.DummyValue, '_daily_hint', _('\u95f2\u65f6\u63d0\u9192'));
    o.cfgvalue = function() {
      return _('\u5efa\u8bae\u5c3d\u91cf\u9009\u62e9\u6bcf\u5929\u95f2\u65f6\u6d4b\u901f\uff0c\u4f8b\u5982\u51cc\u6668 3 \u70b9\u81f3 5 \u70b9\uff0c\u907f\u514d\u5f71\u54cd\u6b63\u5e38\u4ee3\u7406\u4e0a\u7f51\u4f53\u9a8c\u3002');
    };
    o.depends('schedule_mode', 'daily');

    o = s.option(form.ListValue, 'log_clear_interval', _('日志定时清理'));
    o.value('never', _('不自动清理'));
    o.value('daily', _('每天清理'));
    o.value('weekly', _('每周清理'));
    o.value('monthly', _('每月清理'));
    o.default = 'weekly';
    o.rmempty = false;

    o = s.option(form.ListValue, 'log_max_size', _('日志大小上限'));
    o.value('102400', '100 KB');
    o.value('1048576', '1 MB');
    o.value('5242880', '5 MB');
    o.default = '1048576';
    o.rmempty = false;

    o = s.option(form.DummyValue, 'device_id', _('\u8bbe\u5907 ID'));
    o.cfgvalue = function(section_id) {
      return this.map.data.get('cf_ip_speed_client', section_id, 'device_id') || _('\u672a\u6ce8\u518c');
    };

    o = s.option(form.DummyValue, 'last_status', _('\u6700\u8fd1\u72b6\u6001'));
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

    var registerButton = s.option(form.Button, '_register', _('\u6ce8\u518c\u6635\u79f0'));
    registerButton.inputstyle = 'apply';
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

    var runButton = s.option(form.Button, '_run', _('\u7acb\u5373\u6d4b\u901f\u5e76\u4e0a\u4f20'));
    runButton.inputstyle = 'action';
    runButton.onclick = function() {
      showResult(_('\u6d4b\u901f\u4e0a\u4f20'), _('\u6b63\u5728\u542f\u52a8\u540e\u53f0\u6d4b\u901f\u4efb\u52a1\uff0c\u8bf7\u7a0d\u5019...'), false);
      return saveForm(m).then(function() {
        return fs.exec('/usr/bin/cf-ip-speed-client', ['run-background']);
      }).then(function(result) {
        showResult(_('\u4efb\u52a1\u5df2\u542f\u52a8'), commandMessage(_('\u540e\u53f0\u6d4b\u901f\u5df2\u542f\u52a8\u3002\u8bf7\u7a0d\u540e\u5237\u65b0\u9875\u9762\u67e5\u770b\u6700\u8fd1\u72b6\u6001\uff0c\u4efb\u52a1\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u6062\u590d\u4ee3\u7406\u670d\u52a1\u3002'), result), true);
      }).catch(function(error) {
        showResult(_('\u6267\u884c\u5931\u8d25'), _('\u6267\u884c\u5931\u8d25\uff1a') + permissionHint(error), true);
      });
    };

    var logButton = s.option(form.Button, '_show_log', _('查看日志'));
    logButton.inputstyle = 'action';
    logButton.onclick = function() {
      showResult(_('运行日志'), _('正在读取日志...'), false);
      return fs.exec('/usr/bin/cf-ip-speed-client', ['show-log']).then(function(result) {
        showResult(_('运行日志'), commandMessage('', result), false);
      }).catch(function(error) {
        showResult(_('读取失败'), _('读取日志失败：') + permissionHint(error), false);
      });
    };

    var clearLogButton = s.option(form.Button, '_clear_log', _('清空日志'));
    clearLogButton.inputstyle = 'remove';
    clearLogButton.onclick = function() {
      showResult(_('清空日志'), _('正在清空日志...'), false);
      return fs.exec('/usr/bin/cf-ip-speed-client', ['clear-log']).then(function(result) {
        showResult(_('清空完成'), commandMessage(_('日志已清空。'), result), true);
      }).catch(function(error) {
        showResult(_('清空失败'), _('清空日志失败：') + permissionHint(error), false);
      });
    };

    return m.render();
  }
});
