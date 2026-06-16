/* extension.js
 *
 * 中国区天气显示小组件 - GNOME Shell Extension
 * 数据源：和风天气 (https://dev.qweather.com)
 *
 * 作者: amanannn
 * 许可: GPL-3.0
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Soup from 'gi://Soup';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// 和风天气 API 路径
const QWEATHER_API_VERSION = '/v7';
const QWEATHER_GEO_VERSION = '/geo/v2';

// 天气图标映射
const WEATHER_ICONS = {
    '100': '☀️',   // 晴
    '101': '⛅',   // 多云
    '102': '⛅',   // 少云
    '103': '⛅',   // 晴间多云
    '104': '☁️',   // 阴
    '150': '🌙',   // 晴（夜）
    '151': '🌙',   // 多云（夜）
    '153': '🌙',   // 晴间多云（夜）
    '300': '🌧️',   // 阵雨
    '301': '🌧️',   // 强阵雨
    '302': '⛈️',   // 雷阵雨
    '303': '⛈️',   // 强雷阵雨
    '304': '⛈️',   // 雷阵雨伴有冰雹
    '305': '🌧️',   // 小雨
    '306': '🌧️',   // 中雨
    '307': '🌧️',   // 大雨
    '308': '🌧️',   // 极端降雨
    '309': '🌦️',   // 毛毛雨/细雨
    '310': '🌧️',   // 暴雨
    '311': '🌧️',   // 大暴雨
    '312': '🌧️',   // 特大暴雨
    '313': '🌧️',   // 冻雨
    '400': '🌨️',   // 小雪
    '401': '🌨️',   // 中雪
    '402': '🌨️',   // 大雪
    '403': '🌨️',   // 暴雪
    '404': '🌨️',   // 雨夹雪
    '405': '🌨️',   // 雨夹雪
    '406': '🌨️',   // 阵雨夹雪
    '407': '🌨️',   // 阵雪
    '408': '🌨️',   // 小到中雪
    '409': '🌨️',   // 中到大雪
    '410': '🌨️',   // 大到暴雪
    '500': '🌫️',   // 薄雾
    '501': '🌫️',   // 雾
    '502': '🌫️',   // 霾
    '503': '🌫️',   // 扬沙
    '504': '🌫️',   // 浮尘
    '507': '🌫️',   // 沙尘暴
    '508': '🌫️',   // 强沙尘暴
    '509': '🌫️',   // 浓雾
    '510': '🌫️',   // 强浓雾
    '900': '🌡️',   // 热
    '901': '🥶',   // 冷
    '999': '❓',   // 未知
};

const WeatherIndicator = GObject.registerClass(
class WeatherIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Weather CN');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._httpSession = new Soup.Session();
        this._httpSession.timeout = 30;

        // 加载角色
        this._character = this._loadCharacter();

        // 面板显示
        this._panelBox = new St.BoxLayout({
            style_class: 'weather-panel-box',
        });

        // 面板图标：优先用角色头像
        this._panelIcon = this._createPanelIcon();
        this._panelTemp = new St.Label({
            text: '--°C',
            style_class: 'weather-temp',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._panelBox.add_child(this._panelIcon);
        this._panelBox.add_child(this._panelTemp);
        this.add_child(this._panelBox);

        // 监听角色切换
        this._settings.connect('changed::character-id', () => {
            this._character = this._loadCharacter();
            this._updatePanelIcon();
            this._refreshWeather();
        });

        // 弹出菜单
        this._buildMenu();

        // 启动时获取天气
        this._refreshWeather();

        // 定时刷新（每30分钟）
        this._timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            1800,
            () => {
                this._refreshWeather();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _buildMenu() {
        // 主要天气信息
        this._weatherItem = new PopupMenu.PopupMenuItem('', {reactive: false});

        // 自定义内容容器
        this._contentBox = new St.BoxLayout({
            style_class: 'weather-popup-menu',
            vertical: true,
        });

        // 头部：图标 + 主要信息
        this._headerBox = new St.BoxLayout({
            style_class: 'weather-header',
        });

        this._mainIcon = new St.Label({
            text: '🌡️',
            style_class: 'weather-main-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._mainInfoBox = new St.BoxLayout({
            style_class: 'weather-main-info',
            vertical: true,
        });

        this._cityLabel = new St.Label({
            text: '定位中...',
            style_class: 'weather-city',
        });

        this._tempMainLabel = new St.Label({
            text: '--°C',
            style_class: 'weather-temp-main',
        });

        this._conditionLabel = new St.Label({
            text: '加载中...',
            style_class: 'weather-condition',
        });

        this._mainInfoBox.add_child(this._cityLabel);
        this._mainInfoBox.add_child(this._tempMainLabel);
        this._mainInfoBox.add_child(this._conditionLabel);

        this._headerBox.add_child(this._mainIcon);
        this._headerBox.add_child(this._mainInfoBox);

        // 详细信息
        this._detailsBox = new St.BoxLayout({
            style_class: 'weather-details',
            vertical: true,
        });

        this._feelsLikeLabel = this._createDetailRow('体感温度');
        this._humidityLabel = this._createDetailRow('湿度');
        this._windLabel = this._createDetailRow('风向风速');
        this._pressureLabel = this._createDetailRow('气压');
        this._visibilityLabel = this._createDetailRow('能见度');

        // 空气质量
        this._aqiBox = new St.BoxLayout({
            style_class: 'weather-aqi-box',
            vertical: true,
        });
        this._aqiTitle = new St.Label({
            text: '🌬️ 空气质量',
            style_class: 'weather-section-title',
        });
        this._aqiBox.add_child(this._aqiTitle);

        this._aqiRow = new St.BoxLayout({
            style_class: 'weather-aqi-row',
        });
        this._aqiValueLabel = new St.Label({
            text: '--',
            style_class: 'weather-aqi-value',
        });
        this._aqiCategoryLabel = new St.Label({
            text: '--',
            style_class: 'weather-aqi-category',
        });
        this._aqiRow.add_child(this._aqiValueLabel);
        this._aqiRow.add_child(this._aqiCategoryLabel);
        this._aqiBox.add_child(this._aqiRow);

        this._aqiPrimaryLabel = new St.Label({
            text: '',
            style_class: 'weather-aqi-primary',
        });
        this._aqiBox.add_child(this._aqiPrimaryLabel);

        // 生活指数
        this._indicesBox = new St.BoxLayout({
            style_class: 'weather-indices-box',
            vertical: true,
        });
        this._indicesTitle = new St.Label({
            text: '📋 生活指数',
            style_class: 'weather-section-title',
        });
        this._indicesBox.add_child(this._indicesTitle);
        this._indicesRows = {};

        // 未来预报
        this._forecastBox = new St.BoxLayout({
            style_class: 'weather-forecast',
            vertical: true,
        });

        this._forecastTitle = new St.Label({
            text: '未来预报',
            style_class: 'weather-forecast-title',
        });
        this._forecastBox.add_child(this._forecastTitle);

        this._forecastRows = [];

        // 更新时间
        this._footerLabel = new St.Label({
            text: '更新时间: --',
            style_class: 'weather-footer',
        });

        // 组装
        this._contentBox.add_child(this._headerBox);
        this._contentBox.add_child(this._detailsBox);
        this._contentBox.add_child(this._aqiBox);
        this._contentBox.add_child(this._indicesBox);
        this._contentBox.add_child(this._forecastBox);
        this._contentBox.add_child(this._footerLabel);

        this._weatherItem.add_child(this._contentBox);
        this.menu.addMenuItem(this._weatherItem);

        // 分隔线
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 手动刷新按钮
        let refreshItem = new PopupMenu.PopupMenuItem('🔄 立即刷新');
        refreshItem.connect('activate', () => this._refreshWeather());
        this.menu.addMenuItem(refreshItem);

        // 设置按钮
        let settingsItem = new PopupMenu.PopupMenuItem('⚙️ 设置');
        settingsItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(settingsItem);
    }

    _createPanelIcon() {
        const avatarPath = this._getAvatarPath();
        if (avatarPath) {
            return new St.Icon({
                gicon: Gio.FileIcon.new(Gio.File.new_for_path(avatarPath)),
                icon_size: 16,
                y_align: Clutter.ActorAlign.START,
                x_align: Clutter.ActorAlign.START,
            });
        }
        return new St.Label({
            text: '🌡️',
            style_class: 'weather-panel-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
    }

    _updatePanelIcon() {
        const newIcon = this._createPanelIcon();
        this._panelBox.replace_child(this._panelIcon, newIcon);
        this._panelIcon = newIcon;
    }

    _loadCharacter() {
        try {
            const characterId = this._settings.get_string('character-id') || 'genki';
            const dir = this._extension.dir.get_child('characters');
            const file = dir.get_child(`${characterId}.json`);

            if (!file.query_exists(null)) {
                log(`[Weather CN] 角色文件不存在: ${characterId}.json`);
                return null;
            }

            const [ok, contents] = file.load_contents(null);
            if (!ok) {
                log(`[Weather CN] 读取角色文件失败`);
                return null;
            }

            const decoder = new TextDecoder('utf-8');
            const character = JSON.parse(decoder.decode(contents));
            log(`[Weather CN] 加载角色: ${character.label} (${character.id})`);
            return character;
        } catch (e) {
            log(`[Weather CN] 加载角色失败: ${e.message}`);
            return null;
        }
    }

    _getAvatarPath() {
        try {
            const characterId = this._settings.get_string('character-id') || 'genki';
            const dir = this._extension.dir.get_child('characters');

            // 尝试 jpg 和 png
            for (const ext of ['jpg', 'png']) {
                const file = dir.get_child(`${characterId}.${ext}`);
                if (file.query_exists(null)) {
                    return file.get_path();
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    _getWeatherType(iconCode) {
        const code = parseInt(iconCode);
        if (code === 100) return 'sunny';
        if (code >= 101 && code <= 104) return 'cloudy';
        if (code >= 150 && code <= 153) return 'cloudy';
        if (code >= 300 && code <= 313) return 'rain';
        if (code >= 400 && code <= 410) return 'snow';
        if (code >= 500 && code <= 510) return 'cloudy';
        if (code === 900) return 'hot';
        if (code === 901) return 'cold';
        return 'default';
    }

    _getRandomLine(lines) {
        if (!lines || lines.length === 0) return '';
        return lines[Math.floor(Math.random() * lines.length)];
    }

    _applyTemplate(template, vars) {
        let result = template;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    _getCharacterLine(type, weatherType, vars) {
        if (!this._character || !this._character.lines) return '';

        try {
            if (type === 'current') {
                const currentLines = this._character.lines.current;
                const lines = currentLines[weatherType] || currentLines['default'];
                const template = this._getRandomLine(lines);
                return this._applyTemplate(template, vars);
            }

            if (type === 'forecast') {
                const templates = this._character.lines.forecast;
                const template = this._getRandomLine(templates);
                return this._applyTemplate(template, vars);
            }

            if (type === 'index') {
                const indexLines = this._character.lines.indices;
                const template = indexLines[vars.type];
                if (!template) return '';
                return this._applyTemplate(template, vars);
            }
        } catch (e) {
            log(`[Weather CN] 获取角色台词失败: ${e.message}`);
        }

        return '';
    }

    _getKaomoji(weatherType) {
        if (!this._character || !this._character.kaomoji) return '';

        try {
            const kaomojiList = this._character.kaomoji[weatherType] || this._character.kaomoji['default'];
            return this._getRandomLine(kaomojiList) || '';
        } catch (e) {
            return '';
        }
    }

    _createDetailRow(labelText) {
        let row = new St.BoxLayout({
            style_class: 'weather-detail-row',
        });

        let label = new St.Label({
            text: labelText,
            style_class: 'weather-detail-label',
        });

        let value = new St.Label({
            text: '--',
            style_class: 'weather-detail-value',
        });

        row.add_child(label);
        row.add_child(value);
        this._detailsBox.add_child(row);

        return value;
    }

    _httpGet(url, apiKey) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('GET', url);
            if (!message) {
                reject(new Error(`无法创建请求: ${url}`));
                return;
            }

            // 添加 API Key 请求头
            if (apiKey) {
                message.get_request_headers().append('X-QW-Api-Key', apiKey);
            }
            // 禁止 gzip 压缩，避免解压问题
            message.get_request_headers().append('Accept-Encoding', 'identity');

            log(`[Weather CN] HTTP GET: ${url}`);

            this._httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        if (!bytes) {
                            reject(new Error('响应为空'));
                            return;
                        }

                        const contentType = message.get_response_headers().get_one('Content-Type');
                        const contentEncoding = message.get_response_headers().get_one('Content-Encoding');
                        log(`[Weather CN] Content-Type: ${contentType}, Content-Encoding: ${contentEncoding}`);

                        let responseData = bytes.get_data();
                        if (!responseData) {
                            reject(new Error('响应数据为空'));
                            return;
                        }

                        // 如果是 gzip 压缩，用 Gio.ZlibDecompressor 解压
                        if (contentEncoding === 'gzip') {
                            log(`[Weather CN] 解压 gzip 数据 (${responseData.length} 字节)`);
                            try {
                                const stream = Gio.MemoryInputStream.new_from_bytes(bytes);
                                const decompressor = new Gio.ZlibDecompressor({format: Gio.ZlibCompressorFormat.GZIP});
                                const converterStream = new Gio.ConverterInputStream({
                                    base_stream: stream,
                                    converter: decompressor,
                                });
                                // 读取解压后的数据
                                const chunks = [];
                                let totalSize = 0;
                                while (true) {
                                    const buf = converterStream.read_bytes(4096, null);
                                    const bufData = buf.get_data();
                                    if (!bufData || bufData.length === 0) break;
                                    chunks.push(bufData);
                                    totalSize += bufData.length;
                                }
                                // 合并所有块
                                responseData = new Uint8Array(totalSize);
                                let offset = 0;
                                for (const chunk of chunks) {
                                    responseData.set(chunk, offset);
                                    offset += chunk.length;
                                }
                                log(`[Weather CN] 解压完成: ${responseData.length} 字节`);
                            } catch (decompressErr) {
                                log(`[Weather CN] gzip 解压失败: ${decompressErr.message}`);
                                // 尝试直接读取
                            }
                        }

                        const decoder = new TextDecoder('utf-8');
                        const text = decoder.decode(responseData);
                        if (!text || text.trim() === '') {
                            reject(new Error('响应内容为空'));
                            return;
                        }
                        resolve(text);
                    } catch (e) {
                        reject(new Error(`请求失败: ${e.message}`));
                    }
                }
            );
        });
    }

    async _refreshWeather() {
        try {
            // 1. 获取配置
            const apiKey = this._settings.get_string('api-key');
            const apiHost = this._settings.get_string('api-host');

            if (!apiKey) {
                this._updateUI({
                    city: '请设置 API Key',
                    temp: '--',
                    condition: '请在设置中填入和风天气 API Key',
                    icon: '⚠️',
                });
                return;
            }

            if (!apiHost) {
                this._updateUI({
                    city: '请设置 API Host',
                    temp: '--',
                    condition: '请在设置中填入你的 API Host（控制台-设置中查看）',
                    icon: '⚠️',
                });
                return;
            }

            log(`[Weather CN] API Host: ${apiHost}`);

            // 2. 获取位置信息
            const location = await this._getLocation(apiKey, apiHost);
            log(`[Weather CN] 位置: ${location.name} (ID: ${location.id})`);

            // 3. 获取当前天气
            const current = await this._getCurrentWeather(apiKey, location.id, apiHost);

            // 4. 获取未来预报
            const forecast = await this._getForecast(apiKey, location.id, apiHost);

            // 5. 获取空气质量
            const airNow = await this._getAirNow(apiKey, location.id, apiHost);

            // 6. 获取生活指数
            const indices = await this._getIndices(apiKey, location.id, apiHost);

            // 7. 更新 UI
            this._updateUI({
                city: location.name,
                temp: current.temp,
                feelsLike: current.feelsLike,
                condition: current.text,
                icon: WEATHER_ICONS[current.icon] || '🌡️',
                iconCode: current.icon,
                humidity: current.humidity,
                windDir: current.windDir,
                windSpeed: current.windScale,
                pressure: current.pressure,
                visibility: current.vis,
                forecast: forecast,
                updateTime: current.obsTime,
                airNow: airNow,
                indices: indices,
            });

        } catch (error) {
            logError(error, 'Weather CN Error');
            this._updateUI({
                city: '获取失败',
                temp: '--',
                condition: error.message || '请检查网络连接',
                icon: '❌',
            });
        }
    }

    async _getLocation(apiKey, apiHost) {
        // 优先使用已选中的城市 ID（设置里搜索选择的）
        const cityId = this._settings.get_string('city-id');
        const cityName = this._settings.get_string('city-name');
        if (cityId && cityId.trim() !== '') {
            log(`[Weather CN] 使用已保存城市: ${cityName} (${cityId})`);
            return { id: cityId.trim(), name: cityName || cityId };
        }

        // 兼容：只有 city-name 时查一次 GeoAPI 并缓存
        if (cityName && cityName.trim() !== '') {
            log(`[Weather CN] 通过城市名查询: ${cityName}`);
            const result = await this._searchCity(apiKey, apiHost, cityName.trim());
            if (result && result.id) {
                this._settings.set_string('city-id', result.id);
                this._settings.set_string('city-name', result.name);
            }
            return result;
        }

        // 尝试 IP 定位
        try {
            const ipUrl = 'http://ip-api.com/json/?lang=zh-CN&fields=status,country,regionName,city';
            log(`[Weather CN] 请求 IP 定位: ${ipUrl}`);

            const ipText = await this._httpGet(ipUrl);
            log(`[Weather CN] IP 定位响应: ${ipText}`);

            const ipJson = JSON.parse(ipText);
            log(`[Weather CN] IP 定位数据: status=${ipJson.status}, city=${ipJson.city}`);

            if (ipJson.status === 'success' && ipJson.city) {
                return await this._searchCity(apiKey, apiHost, ipJson.city);
            }
        } catch (e) {
            log(`[Weather CN] IP 定位失败: ${e.message}`);
        }

        // 都失败，使用默认城市
        log(`[Weather CN] 使用默认城市: 北京`);
        return await this._searchCity(apiKey, apiHost, 'beijing');
    }

    async _searchCity(apiKey, apiHost, cityName) {
        const url = `https://${apiHost}${QWEATHER_GEO_VERSION}/city/lookup?location=${encodeURIComponent(cityName)}&lang=zh`;
        log(`[Weather CN] 搜索城市: ${url}`);

        const text = await this._httpGet(url, apiKey);
        log(`[Weather CN] 城市搜索响应: ${text.substring(0, 200)}`);

        const json = JSON.parse(text);
        if (json.code === '200' && json.location && json.location.length > 0) {
            return json.location[0];
        }

        throw new Error(`城市搜索失败: ${json.code} - ${json.msg || '未知错误'}`);
    }

    async _getCurrentWeather(apiKey, locationId, apiHost) {
        const url = `https://${apiHost}${QWEATHER_API_VERSION}/weather/now?location=${locationId}&lang=zh`;
        log(`[Weather CN] 请求天气: ${url}`);

        const text = await this._httpGet(url, apiKey);
        log(`[Weather CN] 天气响应: ${text.substring(0, 200)}`);

        const json = JSON.parse(text);
        log(`[Weather CN] 天气数据: code=${json.code}`);

        if (json.code === '200' && json.now) {
            return json.now;
        }

        throw new Error(`获取天气失败: ${json.code} - ${json.msg || '未知错误'}`);
    }

    async _getForecast(apiKey, locationId, apiHost) {
        const url = `https://${apiHost}${QWEATHER_API_VERSION}/weather/3d?location=${locationId}&lang=zh`;
        log(`[Weather CN] 请求预报: ${url}`);

        try {
            const text = await this._httpGet(url, apiKey);
            log(`[Weather CN] 预报响应: ${text.substring(0, 100)}`);

            const json = JSON.parse(text);

            if (json.code === '200' && json.daily) {
                return json.daily;
            }

            log(`[Weather CN] 预报数据为空或失败: code=${json.code}`);
            return [];
        } catch (e) {
            log(`[Weather CN] 预报错误: ${e.message}`);
            return [];
        }
    }

    async _getAirNow(apiKey, locationId, apiHost) {
        const url = `https://${apiHost}${QWEATHER_API_VERSION}/air/now?location=${locationId}&lang=zh`;
        log(`[Weather CN] 请求空气质量: ${url}`);

        try {
            const text = await this._httpGet(url, apiKey);
            const json = JSON.parse(text);

            if (json.code === '200' && json.now) {
                return json.now;
            }

            log(`[Weather CN] 空气质量数据失败: code=${json.code}`);
            return null;
        } catch (e) {
            log(`[Weather CN] 空气质量错误: ${e.message}`);
            return null;
        }
    }

    async _getIndices(apiKey, locationId, apiHost) {
        // type=1,2,3,5,6,9,16: 运动、洗车、穿衣、紫外线、旅游、感冒、防晒
        const url = `https://${apiHost}${QWEATHER_API_VERSION}/indices/1d?type=1,2,3,5,6,9,16&location=${locationId}&lang=zh`;
        log(`[Weather CN] 请求生活指数: ${url}`);

        try {
            const text = await this._httpGet(url, apiKey);
            const json = JSON.parse(text);

            if (json.code === '200' && json.daily) {
                return json.daily;
            }

            log(`[Weather CN] 生活指数数据失败: code=${json.code}`);
            return [];
        } catch (e) {
            log(`[Weather CN] 生活指数错误: ${e.message}`);
            return [];
        }
    }

    _updateUI(data) {
        // 更新面板
        if (this._panelIcon instanceof St.Label) {
            this._panelIcon.text = data.icon;
        }
        this._panelTemp.text = `${data.temp}°C`;

        // 获取角色台词
        const weatherType = this._getWeatherType(data.iconCode || '100');
        const kaomoji = this._getKaomoji(weatherType);
        const characterLine = this._getCharacterLine('current', weatherType, {
            temp: data.temp,
            condition: data.condition,
        });

        // 更新弹出菜单
        this._mainIcon.text = data.icon;
        this._cityLabel.text = data.city;
        this._tempMainLabel.text = `${data.temp}°C`;

        // 天气状况：颜文字 + 原始天气 + 角色台词
        if (kaomoji || characterLine) {
            let conditionText = data.condition;
            if (kaomoji) conditionText = `${kaomoji} ${conditionText}`;
            if (characterLine) conditionText += ` ～ ${characterLine}`;
            this._conditionLabel.text = conditionText;
        } else {
            this._conditionLabel.text = data.condition;
        }

        // 更新详细信息
        if (data.feelsLike) {
            this._feelsLikeLabel.text = `${data.feelsLike}°C`;
        }
        if (data.humidity) {
            this._humidityLabel.text = `${data.humidity}%`;
        }
        if (data.windDir && data.windSpeed) {
            this._windLabel.text = `${data.windDir} ${data.windSpeed}级`;
        }
        if (data.pressure) {
            this._pressureLabel.text = `${data.pressure} hPa`;
        }
        if (data.visibility) {
            this._visibilityLabel.text = `${data.visibility} km`;
        }

        // 更新空气质量
        if (data.airNow && data.airNow.aqi) {
            this._aqiBox.visible = true;
            const aqi = data.airNow.aqi;
            const category = data.airNow.category || '--';
            this._aqiValueLabel.text = `AQI ${aqi}`;
            this._aqiCategoryLabel.text = category;

            // 根据 AQI 等级上色
            const aqiNum = parseInt(aqi);
            let color = '#4caf50'; // 优
            if (aqiNum > 300) color = '#7e0023'; // 严重
            else if (aqiNum > 200) color = '#99004c'; // 重度
            else if (aqiNum > 150) color = '#ff6600'; // 中度
            else if (aqiNum > 100) color = '#ff9933'; // 轻度
            else if (aqiNum > 50) color = '#ffde33'; // 良
            this._aqiValueLabel.style = `color: ${color};`;

            // 主要污染物
            const primary = data.airNow.primary || '';
            this._aqiPrimaryLabel.text = primary ? `主要污染物: ${primary}` : '';
        } else {
            // 无权限或无数据时隐藏整个模块
            this._aqiBox.visible = false;
        }

        // 更新生活指数
        // 清空旧数据
        for (const key in this._indicesRows) {
            this._indicesRows[key].destroy();
        }
        this._indicesRows = {};

        if (data.indices && data.indices.length > 0) {
            const typeIcons = {
                '1': '🏃', // 运动
                '2': '🚗', // 洗车
                '3': '👔', // 穿衣
                '5': '☀️', // 紫外线
                '6': '✈️', // 旅游
                '9': '🤧', // 感冒
                '16': '🧴', // 防晒
            };
            const typeNames = {
                '1': '运动',
                '2': '洗车',
                '3': '穿衣',
                '5': '紫外线',
                '6': '旅游',
                '9': '感冒',
                '16': '防晒',
            };

            for (const item of data.indices) {
                const icon = typeIcons[item.type] || '📌';
                const name = typeNames[item.type] || item.name;

                // 尝试用角色台词
                const characterIndexLine = this._getCharacterLine('index', null, {
                    type: item.type,
                    category: item.category || '--',
                    text: item.text || '',
                });

                const row = new St.BoxLayout({
                    style_class: 'weather-index-row',
                });
                const label = new St.Label({
                    text: `${icon} ${name}`,
                    style_class: 'weather-index-label',
                });
                const value = new St.Label({
                    text: characterIndexLine || item.category || '--',
                    style_class: 'weather-index-value',
                });
                row.add_child(label);
                row.add_child(value);
                this._indicesBox.add_child(row);
                this._indicesRows[item.type] = row;
            }
        }

        // 更新预报
        if (data.forecast && data.forecast.length > 0) {
            // 清空旧的预报行
            for (const row of this._forecastRows) {
                row.destroy();
            }
            this._forecastRows = [];

            const dayNames = ['今天', '明天', '后天'];

            for (let i = 0; i < Math.min(data.forecast.length, 3); i++) {
                const day = data.forecast[i];
                const row = new St.BoxLayout({
                    style_class: 'weather-forecast-row',
                });

                const dayLabel = new St.Label({
                    text: dayNames[i] || day.fxDate.substring(5),
                    style_class: 'weather-forecast-day',
                });

                const iconLabel = new St.Label({
                    text: WEATHER_ICONS[day.iconDay] || '🌡️',
                    style_class: 'weather-forecast-icon',
                });

                const tempLabel = new St.Label({
                    text: `${day.tempMin}°C / ${day.tempMax}°C`,
                    style_class: 'weather-forecast-temp',
                });

                // 尝试用角色台词
                const characterForecastLine = this._getCharacterLine('forecast', null, {
                    day: dayNames[i] || day.fxDate.substring(5),
                    tempMin: day.tempMin,
                    tempMax: day.tempMax,
                    condition: day.textDay,
                });

                const conditionLabel = new St.Label({
                    text: characterForecastLine || day.textDay,
                    style_class: 'weather-forecast-temp',
                });

                row.add_child(dayLabel);
                row.add_child(iconLabel);
                row.add_child(tempLabel);
                row.add_child(conditionLabel);

                this._forecastBox.add_child(row);
                this._forecastRows.push(row);
            }
        }

        // 更新时间
        if (data.updateTime) {
            const time = new Date(data.updateTime);
            const timeStr = time.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
            this._footerLabel.text = `更新时间: ${timeStr}`;
        }
    }

    destroy() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
        }
        super.destroy();
    }
});

export default class WeatherExtension extends Extension {
    enable() {
        this._indicator = new WeatherIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
