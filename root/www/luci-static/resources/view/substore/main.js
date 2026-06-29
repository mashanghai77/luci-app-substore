'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

var callInitAction = rpc.declare({
	object: 'rc',
	method: 'init',
	params: ['name', 'action']
});

var callRunCmd = rpc.declare({
	object: 'file',
	method: 'exec',
	params: ['command', 'params'],
	expect: { '': {} }
});

function getServiceStatus() {
	return callServiceList('substore').then(function(res) {
		try {
			return res['substore']['instances']['instance1']['running'];
		} catch(e) {
			return false;
		}
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('substore'),
			getServiceStatus()
		]);
	},

	render: function(data) {
		var isRunning = data[1];
		var m, s, o;

		m = new form.Map('substore', _('Sub-Store'),
			_('高级订阅管理器，前后端已打包在此软件包中。'));

		// ── 状态栏 ──────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('服务状态'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('运行状态'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var color = isRunning ? '#2ecc71' : '#e74c3c';
			var text  = isRunning ? _('运行中') : _('已停止');
			return '<span style="color:%s;font-weight:bold;">● %s</span>'.format(color, text);
		};

		o = s.option(form.DummyValue, '_open', _('网页面板'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var port = uci.get('substore', section_id, 'frontend_port') || '3001';
			var path = uci.get('substore', section_id, 'frontend_backend_path') || '/sub-store-api';
			var host = window.location.hostname;
			var url  = 'http://' + host + ':' + port + '?api=http://' + host + ':' + port + path;
			if (!isRunning) {
				return '<span style="color:#999;">— 请先启动服务 —</span>';
			}
			return '<a href="%s" target="_blank" class="btn cbi-button cbi-button-action">打开 Sub-Store ↗</a>'
				.format(url);
		};

		o = s.option(form.DummyValue, '_actions', _('操作'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<button class="btn cbi-button cbi-button-apply" id="btn_restart">重启</button>';
		};
		o.write = function() {};

		o = s.option(form.DummyValue, '_update', _('更新'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">\
				<button class="btn cbi-button cbi-button-action" id="btn_update_backend">更新后端</button>\
				<button class="btn cbi-button cbi-button-action" id="btn_update_frontend">更新前端</button>\
				<span id="update_status" style="font-size:13px;color:#666;"></span>\
			</div>';
		};
		o.write = function() {};

		// ── 基础设置 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('基础设置'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('启用'), _('开机自动启动，保存并应用后立即生效'));
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('数据目录'), _('Sub-Store 数据文件存放路径'));
		o.default = '/etc/sub-store';
		o.placeholder = '/etc/sub-store';

		o = s.option(form.Value, 'backend_custom_name', _('实例名称'), _('显示在前端界面上的后端名称'));
		o.default = 'OpenWrt';

		o = s.option(form.Value, 'backend_custom_icon', _('自定义图标URL'), _('显示在前端界面上的后端图标'));
		o.placeholder = 'https://example.com/icon.png';

		// ── 端口 / 网络 ─────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('端口与网络'));
		s.anonymous = true;

		o = s.option(form.Value, 'frontend_port', _('服务端口'), _('前端和后端统一使用此端口'));
		o.default = '3001';
		o.datatype = 'port';

		o = s.option(form.Value, 'frontend_host', _('监听地址'), _(':: 表示同时监听 IPv4 和 IPv6'));
		o.default = '::';
		o.placeholder = '::';

		o = s.option(form.Value, 'frontend_backend_path', _('后端路径前缀'), _('作为 API 路径使用，避免使用特殊符号'));
		o.default = '/sub-store-api';
		o.placeholder = '/sub-store-api';

		// ── 同步 / 定时任务 ─────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('同步与定时任务'));
		s.anonymous = true;

		o = s.option(form.Value, 'backend_sync_cron', _('订阅同步定时'), _('定时将订阅推送到 Gist，例如 55 23 * * *（每天23点55分）'));
		o.placeholder = '55 23 * * *';

		o = s.option(form.Value, 'backend_upload_cron', _('数据备份定时'), _('定时将 Sub-Store 全部数据备份到 Gist'));
		o.placeholder = '0 2 * * *';

		o = s.option(form.Value, 'backend_download_cron', _('数据恢复定时'), _('定时从 Gist 恢复 Sub-Store 数据'));
		o.placeholder = '';

		o = s.option(form.Value, 'produce_cron', _('订阅预处理定时'), _('格式：cron,类型,名称；多个用分号连接，类型为 sub 或 col'));
		o.placeholder = '0 */2 * * *,sub,订阅名称';

		// ── 推送通知 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('推送通知'));
		s.anonymous = true;

		o = s.option(form.Value, 'push_service', _('推送服务URL'), _('支持 Bark、Telegram、PushPlus 等，用 [推送标题] 和 [推送内容] 作为占位符'));
		o.placeholder = 'https://api.day.app/YOUR_KEY/[推送标题]/[推送内容]';

		// ── 启动数据恢复 ─────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('启动数据恢复'));
		s.anonymous = true;

		o = s.option(form.Value, 'data_url', _('远程数据URL'), _('每次启动时从此地址拉取并恢复数据，支持 Gist Raw 链接'));
		o.placeholder = 'https://gist.githubusercontent.com/user/id/raw/Sub-Store#noCache';

		o = s.option(form.Value, 'data_url_post', _('拉取后执行'), _('拉取数据后执行的 JS 表达式，例如设置 Gist Token'));
		o.placeholder = "content.settings.gistToken='your_token_here'";

		// ── 高级设置 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('高级设置'));
		s.anonymous = true;

		o = s.option(form.Value, 'cors_allowed_origins', _('CORS 允许来源'), _('允许访问后端 API 的浏览器来源，多个用逗号分隔，* 表示允许所有'));
		o.default = '*';
		o.placeholder = '*';

		o = s.option(form.Value, 'backend_default_proxy', _('默认代理'), _('抓取订阅时使用的代理，支持 socks5://、http://、https://'));
		o.placeholder = 'http://127.0.0.1:7890';

		o = s.option(form.Value, 'max_header_size', _('最大 Header 大小（字节）'), _('遇到 Headers Overflow Error 时可适当调大'));
		o.default = '32768';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'body_json_limit', _('JSON Body 大小限制'), _('例如 1mb、10mb'));
		o.default = '1mb';
		o.placeholder = '1mb';

		return m.render().then(function(node) {

			// 重启按钮
			var btnRestart = node.querySelector('#btn_restart');
			if (btnRestart) {
				btnRestart.addEventListener('click', function() {
					btnRestart.disabled = true;
					btnRestart.textContent = '重启中...';
					callInitAction('substore', 'restart').then(function() {
						ui.addNotification(null, E('p', 'Sub-Store 已重启。'), 'info');
					}).catch(function() {
						ui.addNotification(null, E('p', '重启失败。'), 'danger');
					}).finally(function() {
						btnRestart.disabled = false;
						btnRestart.textContent = '重启';
					});
				});
			}

			// 更新后端按钮
			var btnUpdateBackend = node.querySelector('#btn_update_backend');
			var updateStatus = node.querySelector('#update_status');
			if (btnUpdateBackend) {
				btnUpdateBackend.addEventListener('click', function() {
					btnUpdateBackend.disabled = true;
					updateStatus.textContent = '正在下载后端...';
					callRunCmd('wget', ['-q', '-O', '/usr/libexec/substore/sub-store.bundle.js',
						'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
					]).then(function() {
						updateStatus.textContent = '正在重启...';
						return callInitAction('substore', 'restart');
					}).then(function() {
						updateStatus.style.color = '#2ecc71';
						updateStatus.textContent = '后端已更新并重启。';
					}).catch(function() {
						updateStatus.style.color = '#e74c3c';
						updateStatus.textContent = '后端更新失败。';
					}).finally(function() {
						btnUpdateBackend.disabled = false;
					});
				});
			}

			// 更新前端按钮
			var btnUpdateFrontend = node.querySelector('#btn_update_frontend');
			if (btnUpdateFrontend) {
				btnUpdateFrontend.addEventListener('click', function() {
					btnUpdateFrontend.disabled = true;
					updateStatus.textContent = '正在下载前端...';
					callRunCmd('wget', ['-q', '-O', '/tmp/dist.zip',
						'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
					]).then(function() {
						updateStatus.textContent = '正在解压...';
						return callRunCmd('sh', ['-c', 'rm -rf /www/sub-store/dist && unzip -q /tmp/dist.zip -d /www/sub-store && rm -f /tmp/dist.zip']);
					}).then(function() {
						updateStatus.style.color = '#2ecc71';
						updateStatus.textContent = '前端已更新。';
					}).catch(function() {
						updateStatus.style.color = '#e74c3c';
						updateStatus.textContent = '前端更新失败。';
					}).finally(function() {
						btnUpdateFrontend.disabled = false;
					});
				});
			}

			return node;
		});
	},

	handleSaveApply: function(ev) {
		return this.super('handleSaveApply', [ev]).then(function() {
			var btn = document.querySelector('#btn_restart');
			if (btn) btn.click();
		});
	}
});
