#!/bin/bash

# 天气扩展卸载脚本

set -e

EXTENSION_UUID="weather-cn@amanannn"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "🗑️  卸载中国区天气显示扩展..."

# 先禁用扩展
gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true

# 删除扩展目录
rm -rf "$EXTENSION_DIR"

echo "✅ 卸载完成！"
echo "💡 请重启 GNOME Shell 或注销重新登录以完全生效"