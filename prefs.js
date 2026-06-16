import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WeatherCNPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({title: 'API 设置'});
        page.add(group);

        // API Key
        const api_key_row = new Adw.EntryRow({title: 'API Key'});
        api_key_row.set_text(settings.get_string('api-key'));
        api_key_row.connect('changed', () => {
            settings.set_string('api-key', api_key_row.get_text());
        });
        group.add(api_key_row);

        // API Host
        const api_host_row = new Adw.EntryRow({title: 'API Host'});
        api_host_row.set_text(settings.get_string('api-host'));
        api_host_row.connect('changed', () => {
            settings.set_string('api-host', api_host_row.get_text());
        });
        group.add(api_host_row);

        // --- 城市搜索 ---
        const city_group = new Adw.PreferencesGroup({title: '城市设置'});
        page.add(city_group);

        // 当前城市显示
        const current_city = settings.get_string('city-name') || '未设置';
        const city_status_row = new Adw.ActionRow({
            title: '当前城市',
            subtitle: current_city,
        });
        city_group.add(city_status_row);

        // 搜索框
        const search_row = new Adw.EntryRow({title: '搜索城市'});
        city_group.add(search_row);

        // 搜索按钮
        const button_box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            margin_top: 8, margin_bottom: 8,
            margin_start: 12, margin_end: 12,
        });
        const search_btn = new Gtk.Button({
            label: '搜索',
            css_classes: ['suggested-action'],
        });
        button_box.append(search_btn);
        city_group.add(button_box);

        // 搜索结果列表
        const results_group = new Adw.PreferencesGroup({title: '搜索结果'});
        page.add(results_group);

        const results_list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['boxed-list'],
        });
        results_group.add(results_list);

        // 搜索逻辑
        const doSearch = () => {
            const query = search_row.get_text().trim();
            if (!query) return;

            const apiKey = settings.get_string('api-key');
            const apiHost = settings.get_string('api-host');
            if (!apiKey || !apiHost) {
                this._showMessage(results_list, '请先填写 API Key 和 API Host');
                return;
            }

            // 清空结果
            this._clearResults(results_list);
            this._showMessage(results_list, '搜索中...');

            const url = `https://${apiHost}/geo/v2/city/lookup?location=${encodeURIComponent(query)}&range=cn`;
            this._httpGet(url, apiKey, (data) => {
                this._clearResults(results_list);
                if (!data) {
                    this._showMessage(results_list, '请求失败');
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.code !== '200' || !json.location || json.location.length === 0) {
                        this._showMessage(results_list, '未找到城市');
                        return;
                    }
                    this._populateResults(results_list, json.location, settings, city_status_row);
                } catch (e) {
                    this._showMessage(results_list, `解析失败: ${e.message}`);
                }
            });
        };

        search_btn.connect('clicked', doSearch);
        search_row.connect('entry-activated', doSearch);

        window.add(page);
    }

    _httpGet(url, apiKey, callback) {
        try {
            const proc = Gio.Subprocess.new(
                ['curl', '-s', '--compressed', '-H', `X-QW-Api-Key: ${apiKey}`, url],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout] = proc.communicate_utf8_finish(res);
                    callback(stdout);
                } catch (e) {
                    callback(null);
                }
            });
        } catch (e) {
            callback(null);
        }
    }

    _clearResults(list) {
        let child = list.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            list.remove(child);
            child = next;
        }
    }

    _showMessage(list, msg) {
        this._clearResults(list);
        const row = new Adw.ActionRow({title: msg});
        list.append(row);
    }

    _populateResults(list, locations, settings, city_status_row) {
        for (const loc of locations) {
            const parts = [loc.name];
            if (loc.adm1 && loc.adm1 !== loc.name) parts.push(loc.adm1);
            if (loc.adm2 && loc.adm2 !== loc.adm1) parts.push(loc.adm2);
            parts.push(loc.country || '中国');

            const row = new Adw.ActionRow({
                title: loc.name,
                subtitle: parts.slice(1).join(' / '),
                activatable: true,
            });
            const id_label = new Gtk.Label({
                label: loc.id,
                css_classes: ['dim-label'],
            });
            row.add_suffix(id_label);

            row.connect('activated', () => {
                settings.set_string('city-id', loc.id);
                settings.set_string('city-name', loc.name);
                city_status_row.set_subtitle(`${loc.name} (${loc.id})`);
            });

            list.append(row);
        }
    }
}
