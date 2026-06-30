'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return uci.load('substore');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('substore', _('Sub-Store'), null);

		s = m.section(form.NamedSection, 'config', 'substore', _('同步与定时任务'));
		s.anonymous = true;

		o = s.option(form.Value, 'backend_sync_cron', _('订阅同步定时'), _('定时将订阅推送到 Gist，例如 55 23 * * *（每天23点55分）'));
		o.placeholder = '55 23 * * *';

		o = s.option(form.Value, 'backend_upload_cron', _('数据备份定时'), _('定时将 Sub-Store 全部数据备份到 Gist'));
		o.placeholder = '0 2 * * *';

		o = s.option(form.Value, 'backend_download_cron', _('数据恢复定时'), _('定时从 Gist 恢复 Sub-Store 数据'));
		o.placeholder = '55 22 * * *';

		o = s.option(form.Value, 'produce_cron', _('订阅预处理定时'), _('格式：cron,类型,名称；多个用分号连接，类型为 sub 或 col'));
		o.placeholder = '0 */2 * * *,sub,订阅名称';

		return m.render();
	}
});
