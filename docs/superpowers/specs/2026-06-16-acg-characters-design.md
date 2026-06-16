# ACG 角色系统设计

为 GNOME Shell 天气扩展添加二次元角色系统，包含颜文字、角色语音播报、可切换角色等功能。

## 架构

方案 B：每角色一个 JSON 文件，放在 `characters/` 目录下。

```
characters/
├── genki.json        # 元气少女
├── genki.png         # 元气少女立绘
├── tsundere.json     # 傲娇
├── tsundere.png      # 傲娇立绘
├── tennei.json       # 天然呆
├── tennei.png        # 天然呆立绘
├── calm.json         # 冷静知性
├── calm.png          # 冷静知性立绘
├── maid.json         # 女仆/执事
├── maid.png          # 女仆/执事立绘
├── chuuni.json       # 中二病
├── chuuni.png        # 中二病立绘
├── nekomimi.json     # 兽耳娘
├── nekomimi.png      # 兽耳娘立绘
├── shy.json          # 害羞后辈
└── shy.png           # 害羞后辈立绘
```

扩展启动时扫描目录，从 GSettings 读取 `character-id`，加载对应文件。

## 数据结构

每个角色 JSON 文件：

```json
{
  "id": "genki",
  "label": "元气少女",
  "kaomoji": {
    "sunny": ["(◕‿◕)♪", "✧٩(ˊᗜˋ*)و✧", "☀(´▽`)ノ"],
    "cloudy": ["(´・ω・`)", "嗯哼～☁️"],
    "rain": ["(；´д｀)", "呜呜下雨了～"],
    "snow": ["(⋈◍＞◡＜◍)。✧☆", "雪花花！"],
    "hot": ["(⁄ ⁄•⁄ω⁄•⁄ ⁄) 好热～"],
    "cold": ["(＞﹏＜) 冷嗖嗖～"],
    "default": ["(◕‿◕)"]
  },
  "lines": {
    "current": {
      "sunny": [
        "今天天气超好的！快粗去玩吧～♪",
        "阳光满满的一天！心情也闪闪发光～✧"
      ],
      "rain": [
        "呜…下雨了，记得带伞喵～",
        "雨天也要元气满满哦！(ﾉ>ω<)ﾉ"
      ],
      "default": [
        "今天{temp}度，{condition}哦～",
        "现在{temp}度呢，{condition}！"
      ]
    },
    "forecast": [
      "{day}：{tempMin}～{tempMax}°C，{condition}哦～",
      "{day}的话，{condition}呢，{tempMin}到{tempMax}度～"
    ],
    "indices": {
      "1": "运动指数：{category}！{text}",
      "3": "今天穿{category}就好啦～{text}",
      "5": "紫外线{category}哦！{text}"
    }
  }
}
```

### 字段说明

- `id` — 唯一标识，对应文件名
- `label` — 显示标签（设置 UI 用）
- `avatar` — 立绘文件名（PNG/SVG），放在同目录下
- `kaomoji` — 按天气类型分组的颜文字数组，随机选取
- `lines.current` — 当前天气台词，支持 `{temp}` `{condition}` 变量，每天气 2-3 句随机
- `lines.forecast` — 预报台词模板，支持 `{day}` `{tempMin}` `{tempMax}` `{condition}`
- `lines.indices` — 生活指数台词，key 对应 API 的 type（1=运动, 2=洗车, 3=穿衣, 5=紫外线, 6=旅游, 9=感冒, 16=防晒）

### 天气类型映射

根据 QWeather icon code 映射到 kaomoji/lines 的 key：

| icon code 范围 | key |
|---|---|
| 100-104, 150-153 | sunny / cloudy（100=sunny, 其他=cloudy）|
| 300-313 | rain |
| 400-410 | snow |
| 500-510 | cloudy（雾/霾归为多云）|
| 900 | hot |
| 901 | cold |
| 其他 | default |

## UI 集成

### 面板

用角色立绘替代原来的 emoji 图标：

```
原来：🌡️ 28°C
现在：[角色头像] 28°C
```

- 优先加载角色 `avatar` 字段对应的图片文件
- 用 `St.Icon` + `Gio.FileIcon` 显示
- 图片不存在时回退到 emoji
- 面板图标尺寸：22×22px

### 弹出菜单

**天气状况行改造：**
```
原来：晴
现在：(◕‿◕)♪ 晴 ～ 今天天气超好的！
```

**生活指数改造：**
```
原来：🏃 运动 - 较不宜
现在：🏃 运动 - 较不宜！有降水，室内运动更好哦～
```

**预报改造：**
```
原来：今天 ☀️ 25°C / 32°C 晴
现在：今天 ☀️ 25°C / 32°C 晴 ～ 阳光满满的一天！
```

### 错误处理

- 角色文件不存在 → 回退到硬编码默认台词
- JSON 解析失败 → log 错误，回退默认
- 台词模板缺少变量 → 原样显示，不崩溃

## 设置 UI

prefs.js 新增"角色设置"分组：

```
┌─────────────────────────────┐
│ 角色设置                     │
├─────────────────────────────┤
│ 当前角色  ○ 元气少女（默认）  │
│          ○ 傲娇              │
│          ○ 天然呆            │
│          ○ 冷静知性          │
│          ○ 女仆/执事         │
│          ○ 中二病            │
│          ○ 兽耳娘            │
│          ○ 害羞后辈          │
│                             │
│ 示例："今天天气超好的！"      │
└─────────────────────────────┘
```

- 用 Gtk.ListBox 单选列表
- 选中后立即保存到 GSettings
- 下方显示选中角色的示例台词

## GSettings Schema

新增字段：

```xml
<key name="character-id" type="s">
  <default>'genki'</default>
  <summary>Character ID</summary>
  <description>当前选择的角色 ID</description>
</key>
```

## 文件组织

```
weather-cn@amanannn/
├── extension.js          # 修改：加载角色、应用台词
├── prefs.js              # 修改：角色选择 UI
├── stylesheet.css        # 可能微调
├── metadata.json
├── characters/           # 新增
│   ├── genki.json
│   ├── tsundere.json
│   ├── tennei.json
│   ├── calm.json
│   ├── maid.json
│   ├── chuuni.json
│   ├── nekomimi.json
│   └── shy.json
├── schemas/
│   └── org.gnome.shell.extensions.weather-cn.gschema.xml  # 修改
└── install.sh            # 修改：复制 characters 目录
```

## 实现顺序

1. 创建 8 个角色 JSON 文件 ✅
2. GSettings schema 加 `character-id` ✅
3. extension.js 加角色加载和台词应用逻辑
4. extension.js 加面板立绘显示
5. prefs.js 加角色选择 UI
6. install.sh 加复制 characters 目录
7. 用户提供立绘图片后集成
8. 测试
