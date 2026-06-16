#!/bin/bash

# 扩展测试脚本

UUID="weather-cn@amanannn"

echo "🌤️  天气扩展测试脚本"
echo "================================"

# 1. 检查扩展是否被识别
echo ""
echo "1️⃣  检查扩展状态..."
if gnome-extensions list | grep -q "$UUID"; then
    echo "   ✅ 扩展已识别"
else
    echo "   ❌ 扩展未被识别，请先注销重新登录"
    exit 1
fi

# 2. 启用扩展
echo ""
echo "2️⃣  启用扩展..."
gnome-extensions enable "$UUID" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ 扩展已启用"
else
    echo "   ⚠️  启用失败，可能已经是启用状态"
fi

# 3. 显示扩展信息
echo ""
echo "3️⃣  扩展信息："
gnome-extensions info "$UUID"

# 4. 询问是否打开设置
echo ""
read -p "是否打开扩展设置？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    gnome-extensions prefs "$UUID" &
fi

# 5. 询问是否查看日志
echo ""
read -p "是否实时查看日志？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📋 按 Ctrl+C 退出日志查看"
    echo "--------------------------------"
    journalctl /usr/bin/gnome-shell -f --no-pager | grep -i --line-buffered -E "(weather|Weather CN|error)"
fi