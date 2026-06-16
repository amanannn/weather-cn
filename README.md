# 🌤️ 中国区天气显示 - GNOME Shell 扩展

一个专为中国用户设计的 GNOME Shell 天气显示扩展，使用和风天气数据源。

## ✨ 特点

- 🇨🇳 **中国区优化** - 使用和风天气 API，中国区数据最准确
- 📍 **IP 自动定位** - 根据网络 IP 自动定位所在城市
- 🎨 **GNOME 原生风格** - 完美融入 GNOME 桌面环境
- 🌡️ **详细信息** - 温度、湿度、风向、气压、能见度一应俱全
- 📅 **未来预报** - 显示未来 3 天天气预报
- ⚙️ **可配置** - 支持温度单位、刷新间隔等自定义设置

## 📸 界面预览

```
┌─────────────────────────────────────┐
│  ☀️ 北京                             │
│  28°C                               │
│  晴                                 │
├─────────────────────────────────────┤
│  体感温度        30°C               │
│  湿度           45%                 │
│  风向风速        东南风 3级          │
│  气压           1013 hPa            │
│  能见度         25 km               │
├─────────────────────────────────────┤
│  未来预报                            │
│  今天  ☀️  22°C / 30°C  晴          │
│  明天  ⛅  20°C / 28°C  多云        │
│  后天  🌧️  18°C / 25°C  小雨       │
├─────────────────────────────────────┤
│  更新时间: 14:30                    │
├─────────────────────────────────────┤
│  🔄 立即刷新                        │
│  ⚙️ 设置                            │
└─────────────────────────────────────┘
```

## 🚀 安装

### 前置条件

1. **GNOME Shell 42+**（Manjaro GNOME 默认已安装）
2. **和风天气 API Key**（免费注册获取）

### 获取 API Key

1. 访问 [和风天气开发平台](https://dev.qweather.com)
2. 注册账号并登录
3. 创建项目，获取 API Key
4. 免费版每天 1000 次调用，足够个人使用

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/amanannn/weather-cn-gnome.git
cd weather-cn-gnome

# 运行安装脚本
chmod +x install.sh
./install.sh

# 启用扩展
gnome-extensions enable weather-cn@amanannn
```

或者手动安装：

```bash
# 复制到扩展目录
mkdir -p ~/.local/share/gnome-shell/extensions/weather-cn@amanannn
cp -r * ~/.local/share/gnome-shell/extensions/weather-cn@amanannn/

# 编译 Schema
cd ~/.local/share/gnome-shell/extensions/weather-cn@amanannn
glib-compile-schemas schemas/
```

## ⚙️ 配置

安装后，点击面板上的天气图标，选择 **⚙️ 设置**，填入你的 API Key。

### 设置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| API Key | 和风天气 API 密钥 | （必填）|
| API 类型 | 普通版 / 商业版 | 普通版 |
| 温度单位 | 摄氏度 / 华氏度 | 摄氏度 |
| 刷新间隔 | 数据刷新频率 | 30 分钟 |

## 🗑️ 卸载

```bash
chmod +x uninstall.sh
./uninstall.sh
```

或手动卸载：

```bash
gnome-extensions disable weather-cn@amanannn
rm -rf ~/.local/share/gnome-shell/extensions/weather-cn@amanannn
```

## 🔧 开发

### 项目结构

```
weather-cn@amanannn/
├── metadata.json      # 扩展元数据
├── extension.js       # 主要逻辑
├── prefs.js           # 设置页面
├── stylesheet.css     # 样式表
├── schemas/           # GSettings Schema
├── install.sh         # 安装脚本
├── uninstall.sh       # 卸载脚本
└── README.md          # 说明文档
```

### 技术栈

- **GJS** (GNOME JavaScript) - 扩展开发语言
- **GTK4 / libadwaita** - 设置界面
- **Soup 3** - HTTP 请求
- **和风天气 API** - 天气数据源

## 📝 注意事项

1. **API 调用限制**：免费版每天 1000 次，建议刷新间隔设为 30 分钟
2. **网络要求**：需要网络连接访问和风天气 API
3. **GNOME 版本**：支持 GNOME Shell 42-46

## 🐛 问题反馈

如遇到问题，请提交 Issue 并附上：
- GNOME Shell 版本：`gnome-shell --version`
- 错误日志：`journalctl /usr/bin/gnome-shell -f`

## 📄 许可证

GPL-3.0

## 🙏 致谢

- [和风天气](https://qweather.com) - 提供天气数据 API
- [GNOME Shell 开发文档](https://gjs.guide/extensions/) - 扩展开发指南