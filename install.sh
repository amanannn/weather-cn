#!/bin/bash

EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/weather-cn@amanannn"
EXTENSION_UUID="weather-cn@amanannn"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🌤️  安装中国区天气显示扩展..."

# 创建目录
mkdir -p "$EXTENSION_DIR"

# 复制文件
echo "📦 复制扩展文件..."
cp "$SCRIPT_DIR/extension.js" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/metadata.json" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/stylesheet.css" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/prefs.js" "$EXTENSION_DIR/"

# 复制并编译 schemas
mkdir -p "$EXTENSION_DIR/schemas"
cp "$SCRIPT_DIR/schemas/org.gnome.shell.extensions.weather-cn.gschema.xml" "$EXTENSION_DIR/schemas/"
glib-compile-schemas "$EXTENSION_DIR/schemas/"

# 同步到用户 GSettings 路径（prefs.js 和 gsettings 命令需要）
mkdir -p "$HOME/.local/share/glib-2.0/schemas"
cp "$SCRIPT_DIR/schemas/org.gnome.shell.extensions.weather-cn.gschema.xml" "$HOME/.local/share/glib-2.0/schemas/"
glib-compile-schemas "$HOME/.local/share/glib-2.0/schemas/"

# 设置默认值（仅当未配置时）
current_city=$(gsettings get org.gnome.shell.extensions.weather-cn city-id 2>/dev/null)
if [ "$current_city" = "''" ] || [ -z "$current_city" ]; then
    gsettings set org.gnome.shell.extensions.weather-cn city-id "101010100"
    gsettings set org.gnome.shell.extensions.weather-cn city-name "北京"
fi
gsettings set org.gnome.shell.extensions.weather-cn temp-unit 0

echo "✅ 安装完成！"
echo ""
echo "📋 后续步骤："
echo "1. 重启 GNOME Shell（按 Alt+F2，输入 r，回车）"
echo "2. 启用扩展：gnome-extensions enable $EXTENSION_UUID"
echo "3. 打开设置：gnome-extensions prefs $EXTENSION_UUID"
echo "4. 填入和风天气 API Key"
echo ""
echo "🔗 获取 API Key 和 API Host: https://dev.qweather.com"
echo ""
echo "💡 提示：如果扩展未生效，请注销并重新登录"
